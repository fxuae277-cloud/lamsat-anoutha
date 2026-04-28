import "dotenv/config";
import express from "express";
import cors from "cors";
import { listPrinters } from "./printers.js";
import { printText, printRawBytes } from "./rawPrint.js";
import { pngToEscposRaster, RASTER_BUILD_MARKER, PAPER_WIDTH_DOTS, } from "./escposRaster.js";
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
app.use((req, _res, next) => {
    console.log(`[LocalPrint] ${req.method} ${req.path}`);
    next();
});
// Private Network Access (PNA) preflight header. The cashier's browser loads
// the POS over HTTPS (Railway) and then calls this loopback service — Chrome/
// Edge require an explicit opt-in via this header on the OPTIONS preflight,
// otherwise the preflight is rejected with a misleading "header not allowed"
// error before the cors() middleware below ever gets to inspect the request.
app.use((req, res, next) => {
    if (req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Private-Network", "true");
    }
    next();
});
app.use(cors({
    origin: (origin, cb) => {
        // Same-origin / curl / Postman requests have no Origin header — allow.
        if (!origin)
            return cb(null, true);
        if (ALLOW_ALL)
            return cb(null, true);
        if (ALLOWED_ORIGINS.includes(origin))
            return cb(null, true);
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
}));
// Auth gate for write endpoints. Read endpoints (/health, /printers) stay open
// so the POS UI can probe the service before the user enters the key.
// API_KEY is guaranteed non-empty (defaults to 123456 above) so we can't
// land in a "key not configured" trap that produces 500 on every print.
function requireApiKey(req, res, next) {
    const provided = req.header("x-api-key") ?? req.header("x-lamsa-print-key") ?? "";
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
app.use((req, _res, next) => {
    if (req.method === "POST" &&
        req.body &&
        typeof req.body === "object" &&
        req.body.data &&
        typeof req.body.data === "object" &&
        !Array.isArray(req.body.data)) {
        req.body = { ...req.body.data, ...req.body };
    }
    next();
});
// ─── Routes ────────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
    res.json({
        ok: true,
        service: "Lamsa Local Print Service",
        version: "2.1.0",
        pipeline: "raster",
    });
});
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "Lamsa Local Print Service", version: "2.1.0", pipeline: "raster" }));
app.get("/printers", async (_req, res) => {
    try {
        const printers = await listPrinters();
        res.json({ ok: true, printers });
    }
    catch (e) {
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
    }
    catch (e) {
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
    }
    catch (e) {
        console.error("[print/test] failed:", e);
        res.status(500).json({
            ok: false,
            error: "print failed",
            detail: e?.message ?? String(e),
        });
    }
});
// ─── Duplicate-print guard (server) ────────────────────────────────────────
// Same (invoiceNo, printerName) within this window is treated as a duplicate
// and not sent to the printer a second time. Protects against frontend
// double-clicks, retried POSTs, or auto-print + manual-print racing.
const DUPLICATE_WINDOW_MS = 3000;
const recentPrintsByKey = new Map();
function makePrintKey(invoiceNo, printerName) {
    return `${invoiceNo}__${printerName}`;
}
function isRecentDuplicatePrint(key) {
    const last = recentPrintsByKey.get(key);
    if (!last)
        return false;
    if (Date.now() - last.at < DUPLICATE_WINDOW_MS)
        return true;
    recentPrintsByKey.delete(key);
    return false;
}
// Periodic sweep so the map cannot grow unbounded under heavy traffic.
setInterval(() => {
    const cutoff = Date.now() - DUPLICATE_WINDOW_MS;
    for (const [k, v] of recentPrintsByKey) {
        if (v.at < cutoff)
            recentPrintsByKey.delete(k);
    }
}, 10_000).unref();
// ─── Invoice / receipt print handler (shared by all aliases) ───────────────
// Frontend renders Invoice80/Invoice58 React components off-screen via
// html2canvas, base64-encodes the PNG, and posts it here. We rasterise →
// ESC/POS GS v 0 → printer driver. This is the only pipeline that supports
// full Arabic shaping/RTL on a thermal printer.
const handleInvoicePrint = async (req, res) => {
    const { printerName, paperWidth: rawPaperWidth, invoiceNo: rawInvoiceNo, imageBase64, } = req.body ?? {};
    const paperWidth = rawPaperWidth === "58mm" ? "58mm" : "80mm";
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
    console.log(`[Print] image request invoice=${invoiceNo} printer=${printerName} ` +
        `paperWidth=${paperWidth} b64chars=${imageBase64.length}`);
    if (invoiceNo && isRecentDuplicatePrint(dupKey)) {
        console.log(`[Print] duplicate ignored invoice=${invoiceNo} printer=${printerName}`);
        res.json({ ok: true, ignoredDuplicate: true });
        return;
    }
    // Reserve the slot before the (async) raster build + print so a second
    // request that lands mid-print is recognised as a duplicate.
    if (invoiceNo)
        recentPrintsByKey.set(dupKey, { at: Date.now() });
    try {
        const pngBuffer = Buffer.from(imageBase64, "base64");
        if (pngBuffer.length === 0) {
            throw new Error("decoded PNG buffer is empty");
        }
        const raster = await pngToEscposRaster(pngBuffer, paperWidth);
        console.log(`[Print] rasterised ${paperWidth} ${raster.widthDots}×${raster.heightRows} ` +
            `→ ${raster.bytes.length} bytes (${raster.blocks} GS-v-0 blocks)`);
        await printRawBytes(printerName, raster.bytes);
        if (invoiceNo)
            recentPrintsByKey.set(dupKey, { at: Date.now() });
        console.log(`[Print] invoice sent to printer invoice=${invoiceNo} bytes=${raster.bytes.length}`);
        res.json({
            ok: true,
            bytesSent: raster.bytes.length,
            widthDots: raster.widthDots,
            heightRows: raster.heightRows,
        });
    }
    catch (e) {
        // Print failed — clear the guard so the cashier can retry immediately.
        if (invoiceNo)
            recentPrintsByKey.delete(dupKey);
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
// ─── Label / barcode print handler ─────────────────────────────────────────
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
const handleLabelPrint = async (req, res) => {
    const { printerName, imageBase64, labelSize, columns, items, } = req.body ?? {};
    if (!printerName || typeof printerName !== "string") {
        res.status(400).json({ ok: false, error: "printerName is required" });
        return;
    }
    // Validate printerName against the installed printer list — this is the
    // single most common source of silent label-print failures.
    let installed = [];
    try {
        installed = await listPrinters();
    }
    catch (e) {
        console.error("[print/label] failed to enumerate printers:", e);
        // Fall through — listPrinters can fail on locked-down hosts, and we'd
        // rather try to print than reject every request.
    }
    if (installed.length > 0 &&
        !installed.some((p) => p.Name === printerName)) {
        res.status(400).json({
            ok: false,
            error: "printer not found",
            detail: `Printer '${printerName}' is not installed on this PC.`,
            availablePrinters: installed.map((p) => p.Name),
        });
        return;
    }
    const widthMm = labelSize && typeof labelSize.widthMm === "number" ? labelSize.widthMm : 39;
    const heightMm = labelSize && typeof labelSize.heightMm === "number" ? labelSize.heightMm : 58;
    const cols = typeof columns === "number" && columns > 0 ? columns : 1;
    console.log(`[Label] request printer=${printerName} size=${widthMm}×${heightMm}mm ` +
        `cols=${cols} hasImage=${typeof imageBase64 === "string"} ` +
        `itemCount=${Array.isArray(items) ? items.length : 0}`);
    // ── Path A: PNG payload → raster print ──────────────────────────────────
    if (typeof imageBase64 === "string" && imageBase64.length >= 100) {
        try {
            const pngBuffer = Buffer.from(imageBase64, "base64");
            if (pngBuffer.length === 0)
                throw new Error("decoded PNG buffer is empty");
            // Label printers vary wildly — use the closest standard width bucket.
            // 39mm @ 203dpi ≈ 312 dots, but we round to one of our raster presets
            // (58mm = 384 dots, 80mm = 576 dots) and let the driver scale.
            const raster = await pngToEscposRaster(pngBuffer, widthMm <= 50 ? "58mm" : "80mm");
            await printRawBytes(printerName, raster.bytes);
            console.log(`[Label] sent printer=${printerName} bytes=${raster.bytes.length}`);
            res.json({
                ok: true,
                bytesSent: raster.bytes.length,
                widthDots: raster.widthDots,
                heightRows: raster.heightRows,
            });
            return;
        }
        catch (e) {
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
            detail: "Send `imageBase64` (PNG of the rendered label) instead, or use the " +
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
];
app.use((req, res) => {
    res.status(404).json({
        ok: false,
        error: "Route not found",
        method: req.method,
        path: req.path,
        availableRoutes: AVAILABLE_ROUTES,
    });
});
// CORS rejections come through here as plain errors with our message prefix.
app.use((err, _req, res, _next) => {
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
    console.log(`[Lamsa Local Print] ${RASTER_BUILD_MARKER} ` +
        `paper widths: 80mm=${PAPER_WIDTH_DOTS["80mm"]}dots, 58mm=${PAPER_WIDTH_DOTS["58mm"]}dots`);
    console.log(`[Lamsa Local Print] invoice routes: ${INVOICE_ROUTES.join(", ")}`);
    console.log(`[Lamsa Local Print] label routes:   ${LABEL_ROUTES.join(", ")}`);
    if (!process.env.LOCAL_PRINT_API_KEY) {
        console.log("[Lamsa Local Print] using built-in default x-lamsa-print-key (123456). " +
            "Set LOCAL_PRINT_API_KEY in .env to override.");
    }
});
//# sourceMappingURL=index.js.map