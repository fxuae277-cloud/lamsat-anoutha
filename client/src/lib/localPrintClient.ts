/**
 * localPrintClient.ts — calls the Lamsa Local Print Service running on the
 * cashier PC. Default base URL is http://localhost:3001 (the production
 * cashier-PC convention). Cashiers can still override it from Settings;
 * the resolved config is cached in localStorage under
 * `lamsa.localPrintConfig`.
 *
 * Why fetch to localhost works from a Railway HTTPS page:
 *   Modern Chrome/Firefox treat http://localhost and http://127.0.0.1 as
 *   "potentially trustworthy" origins, so they are exempt from mixed-content
 *   blocking even when the host page is served over HTTPS. CORS is also
 *   allowed by the local service (see local-print-service/src/index.ts).
 *
 * The cashier's browser must run on the same PC as the local service —
 * fetching localhost from another machine on the LAN will always fail.
 *
 * Endpoints we hit:
 *   POST /print/invoice         — receipts/invoices
 *   POST /print/label           — generic label print
 *   POST /print/barcode-label   — single barcode label
 *   GET  /health                — connectivity probe
 *   GET  /printers              — installed-printer enumeration
 *
 * Body shape (every POST):
 *   { "printerName": "<windows printer name>", "data": { ... } }
 *
 * Headers:
 *   Content-Type: application/json
 *   x-api-key: <apiKey>          (canonical)
 *   x-lamsa-print-key: <apiKey>  (legacy — kept so existing services accept us)
 *
 * Status handling rules baked into callPrintRoute() below:
 *   404 → "Print service route not found" (route missing on the service)
 *   400 → ignored as success (means the API works, only printerName is missing)
 *   401 → invalid/missing API key
 *   200 → ok
 */

import { renderInvoiceToPng } from "./renderInvoiceToPng";

const LOCAL_PRINT_CONFIG_KEY = "lamsa.localPrintConfig";
const DEVICE_PROFILE_KEY = "lamsa.deviceProfile";
export const DEFAULT_LOCAL_PRINT_URL = "http://localhost:3001";
export const DEFAULT_LOCAL_PRINT_API_KEY = "123456";
const REQUEST_TIMEOUT_MS = 15000;

export type PaperWidth = "58mm" | "80mm";

export interface LocalPrintConfig {
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
}

/** Per-device print profile saved in localStorage on each cashier PC. */
export interface DeviceProfile extends LocalPrintConfig {
  receiptPrinterName: string;
  labelPrinterName: string;
  paperWidth: PaperWidth;
  cashierDeviceName: string;
}

const DEFAULT_PROFILE: DeviceProfile = {
  enabled: true,
  baseUrl: DEFAULT_LOCAL_PRINT_URL,
  apiKey: DEFAULT_LOCAL_PRINT_API_KEY,
  receiptPrinterName: "",
  labelPrinterName: "",
  paperWidth: "80mm",
  cashierDeviceName: "",
};

function normalizeBaseUrl(u: string | undefined | null): string {
  const trimmed = (u || "").trim().replace(/\/+$/, "");
  if (!trimmed) return DEFAULT_LOCAL_PRINT_URL;
  // The print service moved from port 3030 → 3001. If a cashier saved the
  // old URL in localStorage, silently rewrite it so the next request hits
  // the live service instead of failing every time. Same for 127.0.0.1
  // hosts: keep them, just rewrite the port.
  return trimmed.replace(/:3030(\b|\/)/, ":3001$1");
}

function normalizePaperWidth(v: unknown): PaperWidth {
  return v === "58mm" ? "58mm" : "80mm";
}

/** Read the device profile from localStorage. Migrates legacy `lamsa.localPrintConfig`. */
export function getDeviceProfile(): DeviceProfile {
  if (typeof localStorage === "undefined") return { ...DEFAULT_PROFILE };
  try {
    const raw = localStorage.getItem(DEVICE_PROFILE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DeviceProfile>;
      return {
        enabled: parsed.enabled !== false,
        baseUrl: normalizeBaseUrl(parsed.baseUrl),
        apiKey: parsed.apiKey ?? DEFAULT_PROFILE.apiKey,
        receiptPrinterName: (parsed.receiptPrinterName ?? "").trim(),
        labelPrinterName: (parsed.labelPrinterName ?? "").trim(),
        paperWidth: normalizePaperWidth(parsed.paperWidth),
        cashierDeviceName: (parsed.cashierDeviceName ?? "").trim(),
      };
    }
    // Migrate legacy config (no printer/paperWidth fields).
    const legacy = localStorage.getItem(LOCAL_PRINT_CONFIG_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as Partial<LocalPrintConfig>;
      return {
        ...DEFAULT_PROFILE,
        baseUrl: normalizeBaseUrl(parsed.baseUrl),
        apiKey: parsed.apiKey ?? DEFAULT_PROFILE.apiKey,
        enabled: parsed.enabled !== false,
      };
    }
  } catch {
    /* fall through */
  }
  return { ...DEFAULT_PROFILE };
}

/** Persist (merge) the device profile in localStorage. */
export function setDeviceProfile(patch: Partial<DeviceProfile>): DeviceProfile {
  const merged: DeviceProfile = { ...getDeviceProfile(), ...patch };
  merged.baseUrl = normalizeBaseUrl(merged.baseUrl);
  merged.paperWidth = normalizePaperWidth(merged.paperWidth);
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(DEVICE_PROFILE_KEY, JSON.stringify(merged));
    // Keep legacy key in sync so any older reader still works.
    localStorage.setItem(
      LOCAL_PRINT_CONFIG_KEY,
      JSON.stringify({
        baseUrl: merged.baseUrl,
        apiKey: merged.apiKey,
        enabled: merged.enabled,
      } satisfies LocalPrintConfig),
    );
  }
  return merged;
}

/** Read the cached local-print config from localStorage (legacy shape). */
export function getLocalPrintConfig(): LocalPrintConfig {
  const p = getDeviceProfile();
  return { baseUrl: p.baseUrl, apiKey: p.apiKey, enabled: p.enabled };
}

/** Persist (merge) the local-print config — kept for callers that only know the legacy shape. */
export function setLocalPrintConfig(patch: Partial<LocalPrintConfig>): LocalPrintConfig {
  const merged = setDeviceProfile(patch);
  return { baseUrl: merged.baseUrl, apiKey: merged.apiKey, enabled: merged.enabled };
}

// ─── Types ────────────────────────────────────────────────────────────────

/** Schema accepted by POST /print/invoice on the local service. */
export interface LocalPrintItem {
  name: string;
  sku?: string;
  qty: number;
  price: number;
  total: number;
}

export interface LocalInvoice {
  invoiceNo: string;
  date: string;
  cashier: string;
  branch: string;
  customerName?: string;
  items: LocalPrintItem[];
  subtotal: number;
  discount: number;
  tax: number;
  grandTotal: number;
  paymentMethod: string;
}

/** Rich receipt shape used by the POS UI (color, size, vatRate, …). */
export interface ReceiptInputItem {
  productName: string;
  quantity: number;
  unitPrice: number | string;
  color?: string;
  size?: string;
}

export interface ReceiptInput {
  invoiceNumber: string;
  items: ReceiptInputItem[];
  subtotal?: number;
  discount?: number | string;
  vat?: number | string;
  total: number | string;
  amountPaid?: number | string;
  changeAmount?: number | string;
  paymentMethod?: string;
  customerName?: string | null;
  cashierName?: string;
  branchName?: string;
  createdAt?: string;
}

export interface PrintResult {
  ok: boolean;
  error?: string;
  detail?: string;
  ignoredDuplicate?: boolean;
}

// ─── Duplicate-print guard (frontend) ─────────────────────────────────────
// Same invoice within this window is treated as a duplicate and dropped.
const DUPLICATE_WINDOW_MS = 3000;
// invoiceNo → last successfully-sent timestamp
const recentPrints = new Map<string, number>();
// invoiceNo currently in flight → suppress concurrent duplicates
const inFlightPrints = new Set<string>();

function isRecentDuplicate(invoiceNo: string): boolean {
  if (!invoiceNo) return false;
  const last = recentPrints.get(invoiceNo);
  if (!last) return false;
  if (Date.now() - last < DUPLICATE_WINDOW_MS) return true;
  recentPrints.delete(invoiceNo);
  return false;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

const toNum = (v: number | string | null | undefined): number =>
  parseFloat(String(v ?? 0)) || 0;

function fetchWithTimeout(
  url: string,
  init: RequestInit,
  ms: number
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() =>
    clearTimeout(t)
  );
}

function fmtDate(s?: string): string {
  const d = s ? new Date(s) : new Date();
  if (Number.isNaN(d.getTime())) return s ?? "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const HH = String(d.getHours()).padStart(2, "0");
  const MM = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${HH}:${MM}`;
}

const PAYMENT_LABEL: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  bank_transfer: "Bank Transfer",
};

/** Map the rich POS receipt shape into the flat schema the local service wants. */
export function toLocalInvoice(receipt: ReceiptInput): LocalInvoice {
  const items: LocalPrintItem[] = receipt.items.map((i) => {
    const variantSuffix = [i.color, i.size]
      .filter(Boolean)
      .map((p) => `${p}`)
      .join(" ");
    const name = variantSuffix
      ? `${i.productName} (${variantSuffix})`
      : i.productName;
    const price = toNum(i.unitPrice);
    return {
      name,
      qty: i.quantity,
      price,
      total: price * i.quantity,
    };
  });

  const subtotal =
    typeof receipt.subtotal === "number"
      ? receipt.subtotal
      : items.reduce((s, i) => s + i.total, 0);

  const pmKey = receipt.paymentMethod || "cash";
  const paymentMethod = PAYMENT_LABEL[pmKey] ?? pmKey;

  return {
    invoiceNo: receipt.invoiceNumber || "",
    date: fmtDate(receipt.createdAt),
    cashier: receipt.cashierName || "",
    branch: receipt.branchName || "",
    customerName: receipt.customerName || undefined,
    items,
    subtotal,
    discount: toNum(receipt.discount),
    tax: toNum(receipt.vat),
    grandTotal: toNum(receipt.total),
    paymentMethod,
  };
}

function arabicError(e: unknown, status?: number): string {
  const msg = String((e as any)?.message || e || "");
  if ((e as any)?.name === "AbortError" || /timeout|abort/i.test(msg)) {
    return "خدمة الطباعة المحلية غير متصلة";
  }
  if (/failed to fetch|networkerror|load failed|blocked by client/i.test(msg)) {
    return "خدمة الطباعة المحلية غير متصلة";
  }
  if (status === 401) return "مفتاح API خاطئ في خدمة الطباعة (x-api-key).";
  if (status === 404) return "Print service route not found";
  if (status === 400) return "بيانات الفاتورة ناقصة أو غير صالحة.";
  if (status === 403) return "خدمة الطباعة رفضت الطلب (CORS). راجع الإعدادات.";
  if (status && status >= 500) return "فشل الطباعة في الطابعة. تحقق من حالتها.";
  return msg || "خطأ غير معروف في الطباعة";
}

// ─── Universal POST helper ────────────────────────────────────────────────
// Every print POST goes through here. Centralising the headers + body shape
// + status-code rules guarantees /print/invoice, /print/label, and
// /print/barcode-label all behave identically.
//
//   Body shape:  { printerName, data }
//   Headers:     Content-Type: application/json
//                x-api-key: <key>           (new canonical header)
//                x-lamsa-print-key: <key>   (legacy — older services need it)
//
//   404 → resolves with { ok: false, error: "Print service route not found" }
//   400 → resolves with { ok: true, ignored: true }   (API works; we forgive)
//   any other non-2xx → mapped via arabicError()
async function callPrintRoute(
  baseUrl: string,
  route: string,
  apiKey: string,
  printerName: string,
  data: unknown,
): Promise<PrintResult & { status?: number }> {
  const url = `${baseUrl}${route}`;
  console.log("Local print baseUrl:", baseUrl);
  console.log(`Calling ${route}:`, url);
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "x-lamsa-print-key": apiKey,
        },
        body: JSON.stringify({ printerName, data }),
      },
      REQUEST_TIMEOUT_MS,
    );

    if (res.status === 404) {
      console.error(`[Print] 404 — ${url}`);
      return { ok: false, error: "Print service route not found", status: 404 };
    }
    if (res.status === 400) {
      // Per project rule: 400 is "API works, just missing printerName" and
      // is treated as a no-op success. Real callers should pre-validate
      // printerName so they never hit this path with intent to print.
      console.warn(`[Print] 400 ignored at ${route} — API reachable.`);
      return { ok: true, ignoredDuplicate: false, status: 400 };
    }
    if (res.status === 401) {
      const body = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: arabicError(body?.error ?? "unauthorized", 401),
        detail: body?.detail,
        status: 401,
      };
    }
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const detail = (body && (body.detail || body.error)) || `HTTP ${res.status}`;
      return {
        ok: false,
        error: arabicError(body?.error ?? detail, res.status),
        detail,
        status: res.status,
      };
    }
    const body = await res.json().catch(() => ({}));
    return { ok: true, ignoredDuplicate: !!body?.ignoredDuplicate, status: res.status };
  } catch (e: any) {
    return { ok: false, error: arabicError(e), detail: String(e?.message || e) };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface HealthResult {
  ok: boolean;
  baseUrl: string;
  error?: string;
}

/**
 * Probe GET /health on the configured local print service (3s timeout).
 * /health intentionally sends NO `x-lamsa-print-key` header — the backend
 * leaves /health open so the POS can verify connectivity before the cashier
 * has set or fixed their API key.
 */
export async function checkLocalPrintHealth(
  baseUrlOverride?: string
): Promise<HealthResult> {
  const baseUrl = normalizeBaseUrl(baseUrlOverride ?? getLocalPrintConfig().baseUrl);
  const url = `${baseUrl}/health`;
  console.log("Local print baseUrl:", baseUrl);
  console.log("Calling health endpoint:", url);
  try {
    const res = await fetchWithTimeout(url, { method: "GET" }, 3000);
    if (!res.ok) return { ok: false, baseUrl, error: `HTTP ${res.status}` };
    const json = await res.json().catch(() => null);
    if (json && json.ok === false) return { ok: false, baseUrl, error: "service reported not ok" };
    return { ok: true, baseUrl };
  } catch (e: any) {
    return { ok: false, baseUrl, error: String(e?.message || e) };
  }
}

export interface LoadPrintersResult {
  ok: boolean;
  baseUrl: string;
  printers: string[];
  error?: string;
}

/** Fetch GET /printers from the configured local print service. */
export async function loadPrintersLocal(
  baseUrlOverride?: string,
  apiKeyOverride?: string
): Promise<LoadPrintersResult> {
  const cfg = getLocalPrintConfig();
  const baseUrl = normalizeBaseUrl(baseUrlOverride ?? cfg.baseUrl);
  const apiKey = (apiKeyOverride ?? cfg.apiKey) || DEFAULT_LOCAL_PRINT_API_KEY;
  const url = `${baseUrl}/printers`;
  console.log("Local print baseUrl:", baseUrl);
  console.log("Calling printers endpoint:", url);
  try {
    const res = await fetchWithTimeout(
      url,
      {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "x-lamsa-print-key": apiKey,
        },
      },
      5000
    );
    if (!res.ok) {
      return { ok: false, baseUrl, printers: [], error: `HTTP ${res.status}` };
    }
    const body = await res.json().catch(() => ({}));
    const list: string[] = Array.isArray(body?.printers)
      ? body.printers.map((p: any) => (typeof p === "string" ? p : p?.name)).filter(Boolean)
      : [];
    return { ok: true, baseUrl, printers: list };
  } catch (e: any) {
    return { ok: false, baseUrl, printers: [], error: String(e?.message || e) };
  }
}

/**
 * Split a "YYYY-MM-DD HH:MM" string (output of toLocalInvoice / fmtDate) back
 * into two halves the new Invoice components want as separate fields.
 */
function splitDateTime(dt: string): { date: string; time: string } {
  const m = dt.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
  if (m) {
    const [, y, mo, d, hh, mm] = m;
    return { date: `${d}/${mo}/${y}`, time: `${hh}:${mm}` };
  }
  // Best-effort fallback: split on first space.
  const idx = dt.indexOf(" ");
  if (idx > 0) return { date: dt.slice(0, idx), time: dt.slice(idx + 1) };
  return { date: dt, time: "" };
}

/** Send an invoice to the local print service. Never throws — always resolves. */
export async function printInvoiceLocal(
  receipt: ReceiptInput,
  printerNameOverride?: string,
  paperWidthOverride?: PaperWidth,
): Promise<PrintResult> {
  // Always re-read the live profile from localStorage so the receipt test
  // and every real print use the current device settings — never a cached
  // / globally-shared snapshot.
  const profile = getDeviceProfile();
  if (!profile.enabled) {
    return {
      ok: false,
      error: "الطباعة المحلية معطّلة من الإعدادات. فعّلها أولاً.",
    };
  }
  const resolvedPrinter = (printerNameOverride ?? profile.receiptPrinterName ?? "").trim();
  if (!resolvedPrinter) {
    return { ok: false, error: "لم يتم اختيار طابعة الفواتير لهذا الجهاز" };
  }
  const resolvedPaperWidth = normalizePaperWidth(paperWidthOverride ?? profile.paperWidth);
  if (resolvedPaperWidth !== "58mm" && resolvedPaperWidth !== "80mm") {
    return { ok: false, error: "مقاس الورق غير محدد لهذا الجهاز" };
  }
  const baseUrl = normalizeBaseUrl(profile.baseUrl);
  const apiKey = (profile.apiKey || DEFAULT_LOCAL_PRINT_API_KEY).trim();

  console.log("Local print baseUrl:", baseUrl);
  console.log("Receipt printer:", resolvedPrinter);
  console.log("Paper width:", resolvedPaperWidth);
  console.log("Calling receipt print endpoint:", `${baseUrl}/print/invoice`);

  let invoice: LocalInvoice;
  try {
    invoice = toLocalInvoice(receipt);
  } catch (e: any) {
    return { ok: false, error: "تعذّر بناء بيانات الفاتورة", detail: e?.message };
  }

  const invoiceNo = invoice.invoiceNo || "";

  // Frontend duplicate guard — drop a second click/auto-print for the same
  // invoice within DUPLICATE_WINDOW_MS without ever hitting the network.
  if (invoiceNo && inFlightPrints.has(invoiceNo)) {
    console.log(`[Print] duplicate ignored (in-flight) invoice=${invoiceNo}`);
    return { ok: true, ignoredDuplicate: true };
  }
  if (isRecentDuplicate(invoiceNo)) {
    console.log(`[Print] duplicate ignored (recent) invoice=${invoiceNo}`);
    return { ok: true, ignoredDuplicate: true };
  }

  if (invoiceNo) inFlightPrints.add(invoiceNo);

  // ── Render the invoice off-screen → PNG (base64). ────────────────────────
  let imageBase64: string;
  let widthPx: number;
  try {
    const { date, time } = splitDateTime(invoice.date);
    const renderProps = {
      invoiceNumber: invoice.invoiceNo,
      date,
      time,
      cashier: invoice.cashier,
      branch: invoice.branch,
      items: invoice.items.map((i) => ({
        name: i.name,
        qty: i.qty,
        unitPrice: i.price,
        total: i.total,
      })),
      subtotal: invoice.subtotal,
      discount: invoice.discount,
      vat: invoice.tax,
      total: invoice.grandTotal,
      paymentMethod: invoice.paymentMethod,
      qrValue: invoice.invoiceNo,
    };
    const rendered = await renderInvoiceToPng(resolvedPaperWidth, renderProps);
    imageBase64 = rendered.base64;
    widthPx = rendered.widthPx;
    console.log(
      `[Print] rendered ${resolvedPaperWidth} invoice → PNG ` +
        `${rendered.widthPx}×${rendered.heightPx}px (${imageBase64.length} b64 chars)`,
    );
  } catch (e: any) {
    if (invoiceNo) inFlightPrints.delete(invoiceNo);
    const detail = String(e?.message || e);
    console.error("[Print] render-to-PNG failed:", detail);
    return {
      ok: false,
      error: "فشل إعداد صورة الفاتورة للطباعة",
      detail,
    };
  }

  try {
    const result = await callPrintRoute(baseUrl, "/print/invoice", apiKey, resolvedPrinter, {
      paperWidth: resolvedPaperWidth,
      invoiceNo,
      widthPx,
      imageBase64,
    });

    if (!result.ok) {
      console.error(
        `[Print] backend rejected status=${result.status} detail=${result.detail}`,
      );
      return result;
    }
    if (invoiceNo) recentPrints.set(invoiceNo, Date.now());
    if (result.ignoredDuplicate) {
      console.log(`[Print] duplicate ignored by service invoice=${invoiceNo}`);
    } else {
      console.log(`[Print] invoice sent to printer invoice=${invoiceNo}`);
    }
    return result;
  } catch (e: any) {
    // callPrintRoute never throws, but keep this guard so a future regression
    // in the helper doesn't take the cashier offline.
    const detail = String(e?.message || e);
    console.error("[Print] network error:", detail);
    const health = await checkLocalPrintHealth(baseUrl);
    if (health.ok) {
      return {
        ok: false,
        error: "تم الوصول للخدمة لكن فشل طلب الطباعة — راجع وحدة التحكم",
        detail,
      };
    }
    return { ok: false, error: arabicError(e), detail };
  } finally {
    if (invoiceNo) inFlightPrints.delete(invoiceNo);
  }
}

// ─── Label / barcode-label print ─────────────────────────────────────────
// New endpoints introduced alongside the invoice-route consolidation.
//
//   printLabelLocal()         — POST /print/label
//   printBarcodeLabelLocal()  — POST /print/barcode-label
//
// Both accept the same body shape: { printerName, data }.
// `data` is forwarded to the local service untouched, so callers can pass
// whatever the printer renderer expects (imageBase64 + labelSize for raster
// labels, or items[] + labelSize + columns for structured labels).

export interface LabelPrintData {
  /** PNG of the rendered label, base64-encoded — preferred path. */
  imageBase64?: string;
  labelSize?: { widthMm: number; heightMm: number };
  columns?: number;
  /** Structured items the service can render itself — reserved for the future. */
  items?: Array<Record<string, unknown>>;
  /** Anything else the renderer needs. */
  [key: string]: unknown;
}

/** Send a label to POST /print/label on the local print service. */
export async function printLabelLocal(
  printerName: string,
  data: LabelPrintData,
  baseUrlOverride?: string,
  apiKeyOverride?: string,
): Promise<PrintResult> {
  const cfg = getLocalPrintConfig();
  const baseUrl = normalizeBaseUrl(baseUrlOverride ?? cfg.baseUrl);
  const apiKey = (apiKeyOverride ?? cfg.apiKey ?? DEFAULT_LOCAL_PRINT_API_KEY).trim();
  if (!printerName?.trim()) {
    return { ok: false, error: "printerName is required" };
  }
  return callPrintRoute(baseUrl, "/print/label", apiKey, printerName.trim(), data);
}

/** Send a single barcode label to POST /print/barcode-label. */
export async function printBarcodeLabelLocal(
  printerName: string,
  data: LabelPrintData,
  baseUrlOverride?: string,
  apiKeyOverride?: string,
): Promise<PrintResult> {
  const cfg = getLocalPrintConfig();
  const baseUrl = normalizeBaseUrl(baseUrlOverride ?? cfg.baseUrl);
  const apiKey = (apiKeyOverride ?? cfg.apiKey ?? DEFAULT_LOCAL_PRINT_API_KEY).trim();
  if (!printerName?.trim()) {
    return { ok: false, error: "printerName is required" };
  }
  return callPrintRoute(
    baseUrl,
    "/print/barcode-label",
    apiKey,
    printerName.trim(),
    data,
  );
}

/** Convenience for Settings test print — fixed sample data. */
export async function printTestInvoiceLocal(
  printerName?: string,
  paperWidth?: PaperWidth,
): Promise<PrintResult> {
  const sample: ReceiptInput = {
    invoiceNumber: "TEST-001",
    items: [
      { productName: "Test Product", quantity: 1, unitPrice: 1.5 },
    ],
    subtotal: 1.5,
    discount: 0,
    vat: 0,
    total: 1.5,
    paymentMethod: "cash",
    cashierName: "Cashier",
    branchName: "Lamsa Branch",
    createdAt: new Date().toISOString(),
  };
  return printInvoiceLocal(sample, printerName, paperWidth);
}
