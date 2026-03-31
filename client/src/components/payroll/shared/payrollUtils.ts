import type { PaymentMethod } from "@/lib/payroll-types";

export const MONTHS_AR = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

const _now = new Date();
export const YEARS = [_now.getFullYear() - 1, _now.getFullYear(), _now.getFullYear() + 1];

export function formatOMR(n: number): string {
  return `${n.toFixed(3)} ر.ع`;
}

export const METHOD_LABELS: Record<PaymentMethod, string> = {
  cash:          "نقداً",
  bank_transfer: "تحويل بنكي",
  cheque:        "شيك",
};
