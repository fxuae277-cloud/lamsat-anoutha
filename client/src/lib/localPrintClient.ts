/**
 * localPrintClient.ts — calls the Lamsa Local Print Service running on the
 * cashier PC. Default base URL is http://127.0.0.1:3030, but the cashier
 * can override it from Settings; the resolved config is cached in
 * localStorage under `lamsa.localPrintConfig`.
 *
 * Why fetch to localhost works from a Railway HTTPS page:
 *   Modern Chrome/Firefox treat http://127.0.0.1 and http://localhost as
 *   "potentially trustworthy" origins, so they are exempt from mixed-content
 *   blocking even when the host page is served over HTTPS. CORS is also
 *   allowed by the local service (see local-print-service/src/index.ts).
 *
 * The cashier's browser must run on the same PC as the local service —
 * fetching 127.0.0.1 from another machine on the LAN will always fail.
 */

const LOCAL_PRINT_CONFIG_KEY = "lamsa.localPrintConfig";
const DEVICE_PROFILE_KEY = "lamsa.deviceProfile";
export const DEFAULT_LOCAL_PRINT_URL = "http://127.0.0.1:3030";
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
  return trimmed || DEFAULT_LOCAL_PRINT_URL;
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
  if (status === 401) return "مفتاح x-lamsa-print-key خاطئ في خدمة الطباعة.";
  if (status === 400) return "بيانات الفاتورة ناقصة أو غير صالحة.";
  if (status === 403) return "خدمة الطباعة رفضت الطلب (CORS). راجع الإعدادات.";
  if (status && status >= 500) return "فشل الطباعة في الطابعة. تحقق من حالتها.";
  return msg || "خطأ غير معروف في الطباعة";
}

// ─── Public API ───────────────────────────────────────────────────────────

export interface HealthResult {
  ok: boolean;
  baseUrl: string;
  error?: string;
}

/** Probe GET /health on the configured local print service (3s timeout). */
export async function checkLocalPrintHealth(
  baseUrlOverride?: string
): Promise<HealthResult> {
  const baseUrl = normalizeBaseUrl(baseUrlOverride ?? getLocalPrintConfig().baseUrl);
  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/health`,
      { method: "GET" },
      3000
    );
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
  const apiKey = apiKeyOverride ?? cfg.apiKey;
  try {
    const res = await fetchWithTimeout(
      `${baseUrl}/printers`,
      { method: "GET", headers: { "x-lamsa-print-key": apiKey } },
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

/** Send an invoice to the local print service. Never throws — always resolves. */
export async function printInvoiceLocal(
  receipt: ReceiptInput,
  printerNameOverride?: string,
  paperWidthOverride?: PaperWidth,
): Promise<PrintResult> {
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
  console.log(
    `[Print] invoice request sending invoice=${invoiceNo} printer=${resolvedPrinter} paperWidth=${resolvedPaperWidth} url=${profile.baseUrl}`,
  );

  try {
    const res = await fetchWithTimeout(
      `${profile.baseUrl}/print/invoice`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-lamsa-print-key": profile.apiKey,
        },
        body: JSON.stringify({
          printerName: resolvedPrinter,
          paperWidth: resolvedPaperWidth,
          invoice,
        }),
      },
      REQUEST_TIMEOUT_MS,
    );

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const detail =
        (body && (body.detail || body.error)) || `HTTP ${res.status}`;
      return {
        ok: false,
        error: arabicError(body?.error ?? detail, res.status),
        detail,
      };
    }
    const body = await res.json().catch(() => ({}));
    if (invoiceNo) recentPrints.set(invoiceNo, Date.now());
    if (body?.ignoredDuplicate) {
      console.log(`[Print] duplicate ignored by service invoice=${invoiceNo}`);
      return { ok: true, ignoredDuplicate: true };
    }
    console.log(`[Print] invoice sent to printer invoice=${invoiceNo}`);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: arabicError(e), detail: String(e?.message || e) };
  } finally {
    if (invoiceNo) inFlightPrints.delete(invoiceNo);
  }
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
