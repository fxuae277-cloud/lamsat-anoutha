export function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
    if (isNaN(d.getTime())) return "—";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${year}-${month}-${day}`;
  } catch {
    return "—";
  }
}

export function fmtDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const mins = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day} ${hours}:${mins}`;
  } catch {
    return "—";
  }
}

export function fmtCurrency(v: string | number | null | undefined): string {
  return parseFloat(String(v || "0")).toFixed(3);
}

export function fmtNum(v: string | number | null | undefined): string {
  const num = Number(v);
  if (isNaN(num)) return "0";
  return String(num);
}

export function fmtMonthYear(month: string | number, year: string | number, monthNames: string[]): string {
  const m = parseInt(String(month));
  const name = monthNames[m - 1] || "";
  return `${name} ${year}`;
}

export function toEnDigits(str: string): string {
  return str.replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660));
}
