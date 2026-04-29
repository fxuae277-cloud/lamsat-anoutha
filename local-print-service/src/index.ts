import "dotenv/config";
import express, { type Request, type Response, type NextFunction, type RequestHandler } from "express";
import cors from "cors";
import { listPrinters } from "./printers.js";
import { printText, printRawBytes } from "./rawPrint.js";
import {
  pngToEscposRaster,
  RASTER_BUILD_MARKER,
  PAPER_WIDTH_DOTS,
  DRAWER_KICK_BYTES,
  type PaperWidth,
} from "./escposRaster.js";
import { printLabel as printTscLabel } from "./printers/tscLabel.js";

// TSC TTP-244M Pro is the only label printer wired up for now. The cashier
// can override via env (e.g. if Windows renames the queue), but this default
// matches every PC that ran the standard install.
const LABEL_PRINTER_NAME =
  (process.env.LABEL_PRINTER_NAME || "TSC TTP-244M Pro").trim();

// PORT: support both 3001 (cashier-machine convention) and 3030 (legacy default).
// Cashier PCs run `node dist/index.js` from this directory, so .env wins.
const PORT = Number(process.env.PORT ?? 3001);
// Default to the canonical cashier key so a missing .env doesn't break setup.
// The matching default lives in the frontend (DEFAULT_LOCAL_PRINT_API_KEY).
const API_KEY = (process.env.LOCAL_PRINT_API_KEY || "123456").trim();
// The service is bound to 127.0.0.1 (loopback) below — no LAN host can reach
// it — so CORS is just a paranoia layer. Default it to permissive so the
// browser's preflight from any Lamsa origin (Railway, custom domain, dev)
// always succeeds. Set LOCAL_PRINT_ALLOW_ALL=false to opt back into the
// allowlist below.
const ALLOW_ALL = process.env.LOCAL_PRINT_ALLOW_ALL !== "false";

const ALLOWED_ORIGINS = [
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "http://192.168.100.170:5000",
  "https://lamsa-pos-production.up.railway.app",
  "https://lamsa-pos.up.railway.app",
  "https://lamsa-pos.com",
];

const app = express();
// PNG receipts (576px wide × ~2000px tall) base64-encoded land around 1–3 MB.
// 8mb gives plenty of headroom without exposing us to absurd payloads.
app.use(express.json({ limit: "8mb" }));

// Lightweight request log so 404s and route mismatches show up in the service
// console without us having to reproduce them in the cashier's browser.
app.use((req: Request, _res: Response, next: NextFunction) => {
  console.log(`[LocalPrint] ${req.method} ${req.path}`);
  next();
});

// Private Network Access (PNA) preflight header. The cashier's browser loads
// the POS over HTTPS (Railway) and then calls this loopback service — Chrome/
// Edge require an explicit opt-in via this header on the OPTIONS preflight,
// otherwise the preflight is rejected with a misleading "header not allowed"
// error before the cors() middleware below ever gets to inspect the request.
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  next();
});

app.use(
  cors({
    origin: (origin, cb) => {
      // Same-origin / curl / Postman requests have no Origin header — allow.
      if (!origin) return cb(null, true);
      if (ALLOW_ALL) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error(`origin not allowed: ${origin}`));
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    // Accept both the canonical x-api-key (new) and x-lamsa-print-key (legacy
    // — kept so any older deployed client still authenticates). Authorization
    // is included so Bearer-token clients can reach the service without a
    // second preflight failure.
    allowedHeaders: ["Content-Type", "x-api-key", "x-lamsa-print-key", "Authorization"],
    maxAge: 86400,
    optionsSuccessStatus: 204,
  })
);

// Auth gate for write endpoints. Read endpoints (/health, /printers) stay open
// so the POS UI can probe the service before the user enters the key.
// API_KEY is guaranteed non-empty (defaults to 123456 above) so we can't
// land in a "key not configured" trap that produces 500 on every print.
function requireApiKey(req: Request, res: Response, next: NextFunction) {
  const provided =
    req.header("x-api-key") ?? req.header("x-lamsa-print-key") ?? "";
  if (provided !== API_KEY) {
    return res.status(401).json({
      ok: false,
      error: "invalid or missing x-api-key",
    });
  }
  next();
}

// Accept both the new `{ printerName, data: {...} }` shape and the legacy
// flat shape. Spreading `data` on top of the body lets every existing
// handler keep reading `req.body.printerName / paperWidth / imageBase64`
// without changes.
app.use((req: Request, _res: Response, next: NextFunction) => {
  if (
    req.method === "POST" &&
    req.body &&
    typeof req.body === "object" &&
    req.body.data &&
    typeof req.body.data === "object" &&
    !Array.isArray(req.body.data)
  ) {
    req.body = { ...req.body.data, ...req.body };
  }
  next();
});

// ─── Routes ────────────────────────────────────────────────────────────────

const HEALTH_PAYLOAD = {
  ok: true,
  service: "Lamsa Local Print Service",
  version: "2.3.0",
  pipeline: "raster+tspl+drawer",
  printers: {
    receipt: {
      name: "EPSON TM-T100 Receipt",
      type: "thermal-receipt",
      width: "80mm",
      language: "ESC/POS",
    },
    label: {
      name: LABEL_PRINTER_NAME,
      type: "thermal-label",
      size: "59x39mm",
      language: "TSPL",
      dpi: 203,
    },
  },
} as const;

app.get("/health", (_req, res) => {
  res.json(HEALTH_PAYLOAD);
});
app.get("/api/health", (_req, res) => res.json(HEALTH_PAYLOAD));

app.get("/printers", async (_req, res) => {
  try {
    const printers = await listPrinters();
    res.json({ ok: true, printers });
  } catch (e: any) {
    console.error("[printers] failed:", e);
    res.status(500).json({
      ok: false,
      error: "failed to list printers",
      detail: e?.message ?? String(e),
    });
  }
});
app.get("/api/printers", async (_req, res) => {
  try {
    const printers = await listPrinters();
    res.json({ ok: true, printers });
  } catch (e: any) {
    console.error("[printers] failed:", e);
    res.status(500).json({ ok: false, error: "failed to list printers", detail: e?.message ?? String(e) });
  }
});

app.post("/print/test", requireApiKey, async (req, res) => {
  const { printerName, text } = req.body ?? {};
  if (!printerName || typeof printerName !== "string") {
    return res
      .status(400)
      .json({ ok: false, error: "printerName is required" });
  }
  if (typeof text !== "string" || text.length === 0) {
    return res
      .status(400)
      .json({ ok: false, error: "text is required" });
  }
  try {
    await printText(printerName, text);
    res.json({ ok: true });
  } catch (e: any) {
    console.error("[print/test] failed:", e);
    res.status(500).json({
      ok: false,
      error: "print failed",
      detail: e?.message ?? String(e),
    });
  }
});

// ─── Cash drawer kick ──────────────────────────────────────────────────────
// Standalone endpoint for opening the drawer without printing a receipt — used
// for manual testing and any future "cash-in / cash-out" flow that needs the
// drawer to pop without a print job. The same DRAWER_KICK_BYTES are embedded
// in every /print/invoice raster, so the cashier doesn't need to call this
// endpoint as part of a normal sale.
const DRAWER_ROUTES = ["/open-drawer", "/api/open-drawer"];
const handleOpenDrawer: RequestHandler = async (req, res) => {
  const { printerName } = req.body ?? {};
  if (!printerName || typeof printerName !== "string") {
    res
      .status(400)
      .json({ ok: false, error: "printerName is required" });
    return;
  }
  console.log(`[Drawer] kick request printer=${printerName}`);
  try {
    await printRawBytes(printerName, DRAWER_KICK_BYTES);
    console.log(
      `[Drawer] kick sent printer=${printerName} bytes=${DRAWER_KICK_BYTES.length}`,
    );
    res.json({
      ok: true,
      printer: printerName,
      bytesSent: DRAWER_KICK_BYTES.length,
      command: "ESC p 0 25 250",
    });
  } catch (e: any) {
    console.error(
      `[Drawer] kick failed printer=${printerName}:`,
      e?.message ?? e,
    );
    res.status(500).json({
      ok: false,
      error: "drawer open failed",
      detail: e?.message ?? String(e),
    });
  }
};
for (const route of DRAWER_ROUTES) {
  app.post(route, requireApiKey, handleOpenDrawer);
}

// ─── Duplicate-print guard (server) ────────────────────────────────────────
// Same (invoiceNo, printerName) within this window is treated as a duplicate
// and not sent to the printer a second time. Protects against frontend
// double-clicks, retried POSTs, or auto-print + manual-print racing.
const DUPLICATE_WINDOW_MS = 3000;
type RecentPrint = { at: number };
const recentPrintsByKey = new Map<string, RecentPrint>();

function makePrintKey(invoiceNo: string, printerName: string) {
  return `${invoiceNo}__${printerName}`;
}

function isRecentDuplicatePrint(key: string): boolean {
  const last = recentPrintsByKey.get(key);
  if (!last) return false;
  if (Date.now() - last.at < DUPLICATE_WINDOW_MS) return true;
  recentPrintsByKey.delete(key);
  return false;
}

// Periodic sweep so the map cannot grow unbounded under heavy traffic.
setInterval(() => {
  const cutoff = Date.now() - DUPLICATE_WINDOW_MS;
  for (const [k, v] of recentPrintsByKey) {
    if (v.at < cutoff) recentPrintsByKey.delete(k);
  }
}, 10_000).unref();

// ─── Invoice / receipt print handler (shared by all aliases) ───────────────
// Frontend renders Invoice80/Invoice58 React components off-screen via
// html2canvas, base64-encodes the PNG, and posts it here. We rasterise →
// ESC/POS GS v 0 → printer driver. This is the only pipeline that supports
// full Arabic shaping/RTL on a thermal printer.
const handleInvoicePrint: RequestHandler = async (req, res) => {
  const {
    printerName,
    paperWidth: rawPaperWidth,
    invoiceNo: rawInvoiceNo,
    imageBase64,
  } = req.body ?? {};

  const paperWidth: PaperWidth =
    rawPaperWidth === "58mm" ? "58mm" : "80mm";

  if (!printerName || typeof printerName !== "string") {
    res.status(400).json({ ok: false, error: "printerName is required" });
    return;
  }
  if (typeof imageBase64 !== "string" || imageBase64.length < 100) {
    res.status(400).json({ ok: false, error: "imageBase64 is required (PNG, base64)" });
    return;
  }

  const invoiceNo = String(rawInvoiceNo ?? "");
  const dupKey = makePrintKey(invoiceNo, printerName);
  console.log(
    `[Print] image request invoice=${invoiceNo} printer=${printerName} ` +
      `paperWidth=${paperWidth} b64chars=${imageBase64.length}`,
  );

  if (invoiceNo && isRecentDuplicatePrint(dupKey)) {
    console.log(
      `[Print] duplicate ignored invoice=${invoiceNo} printer=${printerName}`,
    );
    res.json({ ok: true, ignoredDuplicate: true });
    return;
  }

  // Reserve the slot before the (async) raster build + print so a second
  // request that lands mid-print is recognised as a duplicate.
  if (invoiceNo) recentPrintsByKey.set(dupKey, { at: Date.now() });

  try {
    const pngBuffer = Buffer.from(imageBase64, "base64");
    if (pngBuffer.length === 0) {
      throw new Error("decoded PNG buffer is empty");
    }
    // Invoice prints always kick the cash drawer — the rasteriser injects the
    // ESC/POS pulse between the feed lines and the cut so it lands in the
    // same RAW print job as the receipt.
    const raster = await pngToEscposRaster(
      pngBuffer,
      paperWidth,
      undefined,
      true,
    );
    console.log(
      `[Print] rasterised ${paperWidth} ${raster.widthDots}×${raster.heightRows} ` +
        `→ ${raster.bytes.length} bytes (${raster.blocks} GS-v-0 blocks, drawer-kick=on)`,
    );
    await printRawBytes(printerName, raster.bytes);
    if (invoiceNo) recentPrintsByKey.set(dupKey, { at: Date.now() });
    console.log(
      `[Print] invoice sent to printer invoice=${invoiceNo} bytes=${raster.bytes.length}`,
    );
    console.log(
      `[Drawer] kick embedded in invoice print invoice=${invoiceNo} printer=${printerName}`,
    );
    res.json({
      ok: true,
      bytesSent: raster.bytes.length,
      widthDots: raster.widthDots,
      heightRows: raster.heightRows,
      drawerKick: true,
    });
  } catch (e: any) {
    // Print failed — clear the guard so the cashier can retry immediately.
    if (invoiceNo) recentPrintsByKey.delete(dupKey);
    console.error("[print/invoice] failed:", e);
    res.status(500).json({
      ok: false,
      error: "invoice print failed",
      detail: e?.message ?? String(e),
    });
  }
};

// All these paths must accept the same payload — older builds of the cashier
// app, plus a few different code paths in the current frontend, hit different
// URLs for what is logically the same operation.
const INVOICE_ROUTES = [
  "/print/invoice",
  "/api/print/invoice",
  "/api/local-print/invoice",
  "/print/receipt",
  "/api/print/receipt",
  "/print/invoice-image",
  "/api/print/invoice-image",
];
for (const route of INVOICE_ROUTES) {
  app.post(route, requireApiKey, handleInvoicePrint);
}

// ─── TSC structured-label handler (productName / priceOMR / barcode) ───────
// New shape introduced in v2.2 — the cashier sends product data and the
// service builds the SVG → PNG → TSPL itself. Rendered server-side so every
// cashier prints an identical "لمسة أنوثة"-branded label without depending on
// browser font availability or html2canvas quirks.
const handleStructuredLabelPrint: RequestHandler = async (req, res) => {
  const body = req.body ?? {};
  const productName = typeof body.productName === "string" ? body.productName.trim() : "";
  const priceOMR = typeof body.priceOMR === "number" ? body.priceOMR : NaN;
  const barcode = typeof body.barcode === "string" ? body.barcode.trim() : "";
  const copiesRaw = body.copies;
  const copies =
    typeof copiesRaw === "number" && Number.isFinite(copiesRaw)
      ? Math.floor(copiesRaw)
      : 1;
  // v2.3: optional variant fields. `productVariant` (pre-built string) wins
  // over the structured `color`/`size` pair. Any combination is fine — the
  // renderer composes the final variant line itself.
  const productVariant =
    typeof body.productVariant === "string" ? body.productVariant.trim() : "";
  const color = typeof body.color === "string" ? body.color.trim() : "";
  const size = typeof body.size === "string" ? body.size.trim() : "";
  const printerName =
    typeof body.printerName === "string" && body.printerName.trim().length > 0
      ? body.printerName.trim()
      : LABEL_PRINTER_NAME;

  // Validation — keep the error messages aligned with the spec so the
  // cashier UI can surface them verbatim.
  if (!productName || productName.length > 50) {
    res.status(400).json({ ok: false, error: "Invalid productName" });
    return;
  }
  if (!Number.isFinite(priceOMR) || priceOMR <= 0 || priceOMR > 9999) {
    res.status(400).json({ ok: false, error: "Invalid price" });
    return;
  }
  if (
    !barcode ||
    barcode.length < 8 ||
    barcode.length > 20 ||
    !/^[A-Za-z0-9]+$/.test(barcode)
  ) {
    res.status(400).json({ ok: false, error: "Invalid barcode" });
    return;
  }
  if (!Number.isFinite(copies) || copies < 1 || copies > 100) {
    res.status(400).json({ ok: false, error: "Invalid copies (1–100)" });
    return;
  }
  // Soft validation on variant fields — keep them roomy enough that a real
  // SKU like "Color: Midnight Navy | Size: 42" still fits, but reject
  // multi-line / overlong abuse so the label layout stays predictable.
  if (productVariant.length > 60) {
    res.status(400).json({ ok: false, error: "Invalid productVariant (max 60 chars)" });
    return;
  }
  if (color.length > 30) {
    res.status(400).json({ ok: false, error: "Invalid color (max 30 chars)" });
    return;
  }
  if (size.length > 20) {
    res.status(400).json({ ok: false, error: "Invalid size (max 20 chars)" });
    return;
  }

  // Confirm the label printer is actually installed — the most common silent
  // failure mode is a renamed queue.
  let installed: { Name: string }[] = [];
  try {
    installed = await listPrinters();
  } catch (e: any) {
    console.error("[Label] failed to enumerate printers:", e);
  }
  if (
    installed.length > 0 &&
    !installed.some((p) => p.Name === printerName)
  ) {
    res.status(503).json({
      ok: false,
      error: "Label printer not found in Windows",
      detail: `Printer '${printerName}' is not installed.`,
      availablePrinters: installed.map((p) => p.Name),
    });
    return;
  }

  try {
    await printTscLabel(printerName, {
      productName,
      priceOMR,
      barcode,
      copies,
      productVariant: productVariant || undefined,
      color: color || undefined,
      size: size || undefined,
    });
    console.log("[Label] success");
    res.json({
      ok: true,
      printer: printerName,
      barcode,
      copies,
      size: `${59}x${39}mm`,
    });
  } catch (e: any) {
    if (e?.code === "ETIMEDOUT") {
      console.error("[Label] error: timeout");
      res.status(408).json({ ok: false, error: "Printer timeout (15s)" });
      return;
    }
    console.error("[Label] error:", e);
    res.status(500).json({
      ok: false,
      error: "Printer error",
      detail: e?.message ?? String(e),
    });
  }
};

// ─── Label / barcode print handler (legacy + image fallback) ───────────────
// Two payload shapes are accepted:
//   1. { printerName, imageBase64, labelSize?: { widthMm, heightMm } }
//      → rasterise the PNG at the requested width and send raw bytes.
//   2. { printerName, items, labelSize, columns }
//      → 501 with a clear next-step JSON, never 404. The cashier's browser
//      still has the window.print() fallback for this shape.
//
// We *always* validate that printerName resolves to an installed printer so
// the cashier sees a real error instead of "the request was sent but nothing
// printed."
const handleLabelPrint: RequestHandler = async (req, res) => {
  // New structured payload takes precedence. We detect it by the presence of
  // BOTH productName and barcode — that combination only ever appears in the
  // v2.2 cashier client.
  const body = req.body ?? {};
  if (typeof body.productName === "string" && typeof body.barcode === "string") {
    return handleStructuredLabelPrint(req, res, () => {});
  }

  const {
    printerName,
    imageBase64,
    labelSize,
    columns,
    items,
  } = body;

  if (!printerName || typeof printerName !== "string") {
    res.status(400).json({ ok: false, error: "printerName is required" });
    return;
  }

  // Validate printerName against the installed printer list — this is the
  // single most common source of silent label-print failures.
  let installed: { Name: string }[] = [];
  try {
    installed = await listPrinters();
  } catch (e: any) {
    console.error("[print/label] failed to enumerate printers:", e);
    // Fall through — listPrinters can fail on locked-down hosts, and we'd
    // rather try to print than reject every request.
  }
  if (
    installed.length > 0 &&
    !installed.some((p) => p.Name === printerName)
  ) {
    res.status(400).json({
      ok: false,
      error: "printer not found",
      detail: `Printer '${printerName}' is not installed on this PC.`,
      availablePrinters: installed.map((p) => p.Name),
    });
    return;
  }

  const widthMm =
    labelSize && typeof labelSize.widthMm === "number" ? labelSize.widthMm : 39;
  const heightMm =
    labelSize && typeof labelSize.heightMm === "number" ? labelSize.heightMm : 58;
  const cols = typeof columns === "number" && columns > 0 ? columns : 1;

  console.log(
    `[Label] request printer=${printerName} size=${widthMm}×${heightMm}mm ` +
      `cols=${cols} hasImage=${typeof imageBase64 === "string"} ` +
      `itemCount=${Array.isArray(items) ? items.length : 0}`,
  );

  // ── Path A: PNG payload → raster print ──────────────────────────────────
  if (typeof imageBase64 === "string" && imageBase64.length >= 100) {
    try {
      const pngBuffer = Buffer.from(imageBase64, "base64");
      if (pngBuffer.length === 0) throw new Error("decoded PNG buffer is empty");
      // Label printers vary wildly — use the closest standard width bucket.
      // 39mm @ 203dpi ≈ 312 dots, but we round to one of our raster presets
      // (58mm = 384 dots, 80mm = 576 dots) and let the driver scale.
      const raster = await pngToEscposRaster(
        pngBuffer,
        widthMm <= 50 ? "58mm" : "80mm",
      );
      await printRawBytes(printerName, raster.bytes);
      console.log(
        `[Label] sent printer=${printerName} bytes=${raster.bytes.length}`,
      );
      res.json({
        ok: true,
        bytesSent: raster.bytes.length,
        widthDots: raster.widthDots,
        heightRows: raster.heightRows,
      });
      return;
    } catch (e: any) {
      console.error("[print/label] raster print failed:", e);
      res.status(500).json({
        ok: false,
        error: "label print failed",
        detail: e?.message ?? String(e),
      });
      return;
    }
  }

  // ── Path B: structured items, no image — frontend should fall back to
  // window.print() for now. Return a clear 501 (NOT 404) so the cashier
  // knows the route is wired but this payload shape isn't yet rendered.
  if (Array.isArray(items) && items.length > 0) {
    res.status(501).json({
      ok: false,
      error: "label items rendering not implemented on this service version",
      detail:
        "Send `imageBase64` (PNG of the rendered label) instead, or use the " +
        "browser's window.print() fallback. printerName was validated.",
      printerName,
      labelSize: { widthMm, heightMm },
      columns: cols,
    });
    return;
  }

  res.status(400).json({
    ok: false,
    error: "imageBase64 or items[] is required",
  });
};

const LABEL_ROUTES = [
  "/print/label",
  "/api/print/label",
  "/print/barcode-label",
  "/api/print/barcode-label",
  "/print/labels",
  "/api/print/labels",
];
for (const route of LABEL_ROUTES) {
  app.post(route, requireApiKey, handleLabelPrint);
}

// ─── 404 handler ───────────────────────────────────────────────────────────
// Detailed JSON so a wrong path in the cashier's browser console shows what
// the service actually accepts.
const AVAILABLE_ROUTES = [
  "GET  /health",
  "GET  /printers",
  "POST /print/test",
  ...INVOICE_ROUTES.map((r) => `POST ${r}`),
  ...LABEL_ROUTES.map((r) => `POST ${r}`),
  ...DRAWER_ROUTES.map((r) => `POST ${r}`),
];

app.use((req: Request, res: Response) => {
  res.status(404).json({
    ok: false,
    error: "Route not found",
    method: req.method,
    path: req.path,
    availableRoutes: AVAILABLE_ROUTES,
  });
});

// CORS rejections come through here as plain errors with our message prefix.
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (typeof err?.message === "string" && err.message.startsWith("origin not allowed")) {
    return res.status(403).json({ ok: false, error: err.message });
  }
  console.error("[unhandled]", err);
  res.status(500).json({ ok: false, error: "internal error" });
});

// Bind to loopback only — the cloud POS runs JS in the cashier's browser, which
// hits 127.0.0.1 from the same machine. Other LAN hosts cannot reach this port,
// which is the intended security posture for Phase 1.
app.listen(PORT, "127.0.0.1", () => {
  console.log(`[Lamsa Local Print] listening on http://127.0.0.1:${PORT}`);
  console.log(`[Lamsa Local Print] CORS allow-all: ${ALLOW_ALL}`);
  console.log(
    `[Lamsa Local Print] ${RASTER_BUILD_MARKER} ` +
      `paper widths: 80mm=${PAPER_WIDTH_DOTS["80mm"]}dots, 58mm=${PAPER_WIDTH_DOTS["58mm"]}dots`,
  );
  console.log(`[Lamsa Local Print] invoice routes: ${INVOICE_ROUTES.join(", ")}`);
  console.log(`[Lamsa Local Print] label routes:   ${LABEL_ROUTES.join(", ")}`);
  console.log(`[Lamsa Local Print] drawer routes:  ${DRAWER_ROUTES.join(", ")}`);
  if (!process.env.LOCAL_PRINT_API_KEY) {
    console.log(
      "[Lamsa Local Print] using built-in default x-lamsa-print-key (123456). " +
      "Set LOCAL_PRINT_API_KEY in .env to override."
    );
  }
});
