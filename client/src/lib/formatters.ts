const AR_INDIC = /[\u0660-\u0669]/g;
const AR_EXT_INDIC = /[\u06F0-\u06F9]/g;

export function normalizeDigitsToEn(val: unknown): string {
  const s = String(val ?? "");
  return s
    .replace(AR_INDIC, (c) => String(c.charCodeAt(0) - 0x0660))
    .replace(AR_EXT_INDIC, (c) => String(c.charCodeAt(0) - 0x06F0));
}

export function fmtNum(v: string | number | null | undefined): string {
  const num = Number(normalizeDigitsToEn(v));
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat("en-US", { useGrouping: false }).format(num);
}

export function fmtNumGrouped(v: string | number | null | undefined): string {
  const num = Number(normalizeDigitsToEn(v));
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat("en-US", { useGrouping: true }).format(num);
}

export function fmtCurrency(v: string | number | null | undefined): string {
  const num = parseFloat(normalizeDigitsToEn(v) || "0");
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
    useGrouping: true,
  }).format(num);
}

/** عرض المبلغ مع رمز الريال السعودي — مثال: 12.500 ر.س */
export function fmtOMR(v: string | number | null | undefined): string {
  return `${fmtCurrency(v)} ر.س`;
}
export const fmtSAR = fmtOMR;

export function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "\u2014";
  try {
    const raw = normalizeDigitsToEn(dateStr);
    const d = new Date(raw.includes("T") ? raw : raw + "T00:00:00");
    if (isNaN(d.getTime())) return "\u2014";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear());
    return `${year}-${month}-${day}`;
  } catch {
    return "\u2014";
  }
}

export function fmtDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "\u2014";
  try {
    const raw = normalizeDigitsToEn(dateStr);
    const d = new Date(raw);
    if (isNaN(d.getTime())) return "\u2014";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = String(d.getFullYear());
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${mins}`;
  } catch {
    return "\u2014";
  }
}

export function fmtDateLocale(
  dateStr: string | null | undefined,
  opts?: Intl.DateTimeFormatOptions
): string {
  if (!dateStr) return "\u2014";
  try {
    const raw = normalizeDigitsToEn(dateStr);
    const d = new Date(raw.includes("T") ? raw : raw + "T00:00:00");
    if (isNaN(d.getTime())) return "\u2014";
    return d.toLocaleString("en-US", opts);
  } catch {
    return "\u2014";
  }
}

export function fmtMonthYear(
  month: string | number,
  year: string | number,
  monthNames: string[]
): string {
  const m = parseInt(normalizeDigitsToEn(month));
  const y = normalizeDigitsToEn(year);
  const name = monthNames[m - 1] || "";
  return `${name} ${y}`;
}

export function toEnDigits(str: string): string {
  return normalizeDigitsToEn(str);
}
