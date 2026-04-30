import {
  formatCurrency,
  formatDate,
  formatDateLocale,
  formatDateTime,
  formatMonthYear,
  formatNumber,
  formatTime,
  normalizeDigitsToEn,
} from "@/lib/format";

export { normalizeDigitsToEn };

export function fmtNum(v: string | number | null | undefined): string {
  return formatNumber(v, { grouping: false });
}

export function fmtNumGrouped(v: string | number | null | undefined): string {
  return formatNumber(v, { grouping: true });
}

export function fmtCurrency(v: string | number | null | undefined): string {
  return formatNumber(v, { grouping: true, minFractionDigits: 0, maxFractionDigits: 0 });
}

export function fmtOMR(v: string | number | null | undefined): string {
  return formatCurrency(v);
}

export function fmtDate(dateStr: string | null | undefined): string {
  return formatDate(dateStr);
}

export function fmtDateTime(dateStr: string | null | undefined): string {
  return formatDateTime(dateStr);
}

export function fmtTime(dateStr: string | Date | null | undefined): string {
  return formatTime(dateStr);
}

export function fmtDateLocale(
  dateStr: string | null | undefined,
  opts?: Intl.DateTimeFormatOptions
): string {
  return formatDateLocale(dateStr, opts);
}

export function fmtMonthYear(
  month: string | number,
  year: string | number,
  monthNames: string[]
): string {
  return formatMonthYear(month, year, monthNames);
}

export function toEnDigits(str: string): string {
  return normalizeDigitsToEn(str);
}
