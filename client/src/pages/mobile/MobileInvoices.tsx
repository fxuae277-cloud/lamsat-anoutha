import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { fmtTime } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReceiptText, Loader2, FileText } from "lucide-react";

type Invoice = {
  id: number;
  invoiceNumber: string;
  total: string;
  paymentMethod: string;
  createdAt: string;
  branchName?: string;
};

export default function MobileInvoices() {
  const { t } = useI18n();

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/mobile/my-invoices"],
    queryFn: getQueryFn({ on401: "throw" }),
    refetchInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const paymentLabel = (m: string) => {
    if (m === "cash") return t("mobile.cash");
    if (m === "card") return t("mobile.card");
    return t("mobile.bank_transfer");
  };

  const paymentColor = (m: string) => {
    if (m === "cash") return "bg-emerald-100 text-emerald-800";
    if (m === "card") return "bg-blue-100 text-blue-800";
    return "bg-purple-100 text-purple-800";
  };

  return (
    <div className="p-4 pb-24 space-y-3" dir="rtl">
      <div className="flex items-center gap-2 mb-2">
        <ReceiptText className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-bold">{t("mobile.today_invoices_title")}</h2>
        <Badge variant="secondary" className="mr-auto">{invoices.length}</Badge>
      </div>

      {invoices.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">{t("mobile.no_invoices")}</p>
        </div>
      ) : (
        invoices.map((inv) => (
          <Card key={inv.id} data-testid={`card-invoice-${inv.id}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-sm" data-testid={`text-invoice-number-${inv.id}`}>#{inv.invoiceNumber}</span>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${paymentColor(inv.paymentMethod)}`}>
                  {paymentLabel(inv.paymentMethod)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {fmtTime(inv.createdAt)}
                </span>
                <span className="text-lg font-bold text-primary" data-testid={`text-invoice-total-${inv.id}`}>
                  {parseFloat(inv.total).toFixed(3)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
