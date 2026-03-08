import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/lib/i18n";
import { fmtCurrency } from "@/lib/formatters";

export function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function monthAgoStr() {
  const d = new Date();
  d.setMonth(d.getMonth() - 1);
  return d.toISOString().slice(0, 10);
}

export const fmt = fmtCurrency;

export function useMonthNames() {
  const { t } = useI18n();
  return [
    t("month_names.jan"), t("month_names.feb"), t("month_names.mar"), t("month_names.apr"), t("month_names.may"), t("month_names.jun"),
    t("month_names.jul"), t("month_names.aug"), t("month_names.sep"), t("month_names.oct"), t("month_names.nov"), t("month_names.dec"),
  ];
}

export function statusBadgePayroll(status: string, t: (k: string) => string) {
  const map: Record<string, { cls: string; key: string }> = {
    draft: { cls: "bg-yellow-50 text-yellow-700 border-yellow-200", key: "hr.status_draft" },
    reviewed: { cls: "bg-blue-50 text-blue-700 border-blue-200", key: "hr.status_reviewed" },
    approved: { cls: "bg-green-50 text-green-700 border-green-200", key: "hr.status_approved" },
    partial: { cls: "bg-orange-50 text-orange-700 border-orange-200", key: "hr.status_partial" },
    paid: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", key: "hr.status_paid" },
    cancelled: { cls: "bg-gray-100 text-gray-500 border-gray-200", key: "hr.status_cancelled" },
  };
  const s = map[status] || map.draft;
  return <Badge variant="outline" className={s.cls}>{t(s.key)}</Badge>;
}

export function paymentStatusBadge(status: string, t: (k: string) => string) {
  if (status === "paid") return <Badge className="bg-green-100 text-green-700 border-green-200 text-xs">{t("hr.status_paid")}</Badge>;
  if (status === "partial") return <Badge className="bg-orange-100 text-orange-700 border-orange-200 text-xs">{t("hr.status_partial")}</Badge>;
  return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">{t("hr.status_unpaid")}</Badge>;
}
