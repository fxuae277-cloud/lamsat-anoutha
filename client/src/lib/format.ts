import { i18n } from "@/lib/i18n";

const AR_INDIC = /[٠-٩]/g;
const AR_EXT_INDIC = /[۰-۹]/g;
const EM_DASH = "—";

export function normalizeDigitsToEn(val: unknown): string {
  const s = String(val ?? "");
  return s
    .replace(AR_INDIC, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(AR_EXT_INDIC, (c) => String(c.charCodeAt(0) - 0x06F0));
}

function currentLang(): "ar" | "en" {
  return (i18n?.language === "en" ? "en" : "ar");
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function parseDate(input: string | Date | null | undefined): Date | null {
  if (input == null || input === "") return null;
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
  const raw = normalizeDigitsToEn(input);
  const d = new Date(raw.includes("T") ? raw : raw + "T00:00:00");
  return isNaN(d.getTime()) ? null : d;
}

export function formatNumber(
  v: string | number | null | undefined,
  opts: { grouping?: boolean; minFractionDigits?: number; maxFractionDigits?: number } = {}
): string {
  const num = Number(normalizeDigitsToEn(v));
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat("en-US", {
    useGrouping: opts.grouping ?? true,
    minimumFractionDigits: opts.minFractionDigits ?? 0,
    maximumFractionDigits: opts.maxFractionDigits ?? 3,
  }).format(num);
}

export function formatCurrency(
  v: string | number | null | undefined,
  options: { lang?: "ar" | "en"; fractionDigits?: number } = {}
): string {
  const lang = options.lang ?? currentLang();
  const fractionDigits = options.fractionDigits ?? 0;
  const num = parseFloat(normalizeDigitsToEn(v) || "0");
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    useGrouping: true,
  }).format(num);
  const symbol = lang === "en" ? "OMR" : "ر.ع";
  return lang === "en" ? `${symbol} ${formatted}` : `${formatted} ${symbol}`;
}

export function formatDate(input: string | Date | null | undefined): string {
  const d = parseDate(input);
  if (!d) return EM_DASH;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatDateTime(input: string | Date | null | undefined): string {
  const d = parseDate(input);
  if (!d) return EM_DASH;
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatTime(input: string | Date | null | undefined): string {
  const d = parseDate(input);
  if (!d) return EM_DASH;
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function formatDateLocale(
  input: string | Date | null | undefined,
  opts?: Intl.DateTimeFormatOptions,
  lang?: "ar" | "en"
): string {
  const d = parseDate(input);
  if (!d) return EM_DASH;
  const locale = (lang ?? currentLang()) === "en" ? "en-US" : "ar-u-nu-latn";
  return d.toLocaleString(locale, opts);
}

export function formatMonthYear(
  month: string | number,
  year: string | number,
  monthNames: string[]
): string {
  const m = parseInt(normalizeDigitsToEn(month));
  const y = normalizeDigitsToEn(year);
  const name = monthNames[m - 1] || "";
  return `${name} ${y}`;
}
