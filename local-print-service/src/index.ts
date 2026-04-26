import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import { listPrinters } from "./printers.js";
import { printText, printRawBytes } from "./rawPrint.js";
import { buildInvoiceBytes, type Invoice } from "./printInvoice.js";

const PORT = Number(process.env.PORT ?? 3030);
const API_KEY = process.env.LOCAL_PRINT_API_KEY ?? "";
const ALLOW_ALL = process.env.LOCAL_PRINT_ALLOW_ALL === "true";

const ALLOWED_ORIGINS = [
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "http://192.168.100.170:5000",
  "https://lamsa-pos-production.up.railway.app",
  "https://lamsa-pos.com",
];

const app = express();
app.use(express.json({ limit: "1mb" }));

app.use(
  cors({
    origin: (origin, cb) => {
      // Same-origin / curl / Postman requests have no Origin header — allow.
      if (!origin) return cb(null, true);
      if (ALLOW_ALL) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      cb(new Error(`origin not allowed: ${origin}`));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "x-lamsa-print-key"],
  })
);

// Auth gate for write endpoints. Read endpoints (/health, /printers) stay open
// so the POS UI can probe the service before the user enters the key.
function requireApiKey(req: Request, res: Response, next: NextFunction) {
  if (!API_KEY) {
    return res.status(500).json({
      ok: false,
      error: "LOCAL_PRINT_API_KEY is not configured on the print service",
    });
  }
  if (req.header("x-lamsa-print-key") !== API_KEY) {
    return res
      .status(401)
      .json({ ok: false, error: "invalid or missing x-lamsa-print-key" });
  }
  next();
}

// ─── Routes ────────────────────────────────────────────────────────────────

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "Lamsa Local Print Service",
    version: "1.0.0",
  });
});

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

app.post("/print/invoice", requireApiKey, async (req, res) => {
  const { printerName, invoice } = req.body ?? {};

  if (!printerName || typeof printerName !== "string") {
    return res
      .status(400)
      .json({ ok: false, error: "printerName is required" });
  }
  if (!invoice || typeof invoice !== "object") {
    return res
      .status(400)
      .json({ ok: false, error: "invoice is required" });
  }

  const required = [
    "invoiceNo", "date", "cashier", "branch",
    "items", "subtotal", "discount", "tax", "grandTotal", "paymentMethod",
  ] as const;
  for (const k of required) {
    if (!(k in invoice)) {
      return res
        .status(400)
        .json({ ok: false, error: `invoice.${k} is required` });
    }
  }
  if (!Array.isArray(invoice.items) || invoice.items.length === 0) {
    return res
      .status(400)
      .json({ ok: false, error: "invoice.items must be a non-empty array" });
  }

  try {
    const bytes = buildInvoiceBytes(invoice as Invoice);
    await printRawBytes(printerName, bytes);
    res.json({ ok: true, bytesSent: bytes.length });
  } catch (e: any) {
    console.error("[print/invoice] failed:", e);
    res.status(500).json({
      ok: false,
      error: "invoice print failed",
      detail: e?.message ?? String(e),
    });
  }
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
  if (!API_KEY) {
    console.warn(
      "[Lamsa Local Print] WARNING: LOCAL_PRINT_API_KEY is empty — POST endpoints will reject every call"
    );
  }
});
