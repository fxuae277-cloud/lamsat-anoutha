import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarcodeScanButton } from "@/components/BarcodeScanButton";
import { ArrowRightLeft, Plus, Trash2, Send, Loader2, Camera, CheckCircle } from "lucide-react";

type TransferItem = {
  variantId: number;
  name: string;
  barcode: string;
  qty: number;
  color?: string;
  size?: string;
};

export default function MobileTransfers() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [fromLocationId, setFromLocationId] = useState("");
  const [toLocationId, setToLocationId] = useState("");
  const [items, setItems] = useState<TransferItem[]>([]);
  const [notes, setNotes] = useState("");
  const [tab, setTab] = useState<"create" | "list">("create");

  const { data: locations = [] } = useQuery<any[]>({
    queryKey: ["/api/locations"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: transfers = [] } = useQuery<any[]>({
    queryKey: ["/api/stock-transfers"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: variants = [] } = useQuery<any[]>({
    queryKey: ["/api/variants"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: products = [] } = useQuery<any[]>({
    queryKey: ["/api/products"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const handleBarcode = useCallback((barcode: string) => {
    const variant = variants.find((v: any) => v.barcode === barcode);
    if (variant) {
      const product = products.find((p: any) => p.id === variant.productId);
      const existing = items.find(i => i.variantId === variant.id);
      if (existing) {
        setItems(prev => prev.map(i => i.variantId === variant.id ? { ...i, qty: i.qty + 1 } : i));
      } else {
        setItems(prev => [...prev, {
          variantId: variant.id, name: product?.name || "", barcode,
          qty: 1, color: variant.color, size: variant.size,
        }]);
      }
      toast({ title: t("mobile.product_added") });
      return;
    }
    toast({ title: t("mobile.product_not_found"), variant: "destructive" });
  }, [variants, products, items, toast, t]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/stock-transfers", {
        fromLocationId: Number(fromLocationId),
        toLocationId: Number(toLocationId),
        notes,
      });
      const transfer = await res.json();
      for (const item of items) {
        await apiRequest("POST", `/api/stock-transfers/${transfer.id}/lines`, {
          variantId: item.variantId,
          qty: item.qty,
        });
      }
      await apiRequest("POST", `/api/stock-transfers/${transfer.id}/approve`);
      return transfer;
    },
    onSuccess: () => {
      toast({ title: t("mobile.transfer_sent") });
      setItems([]); setNotes("");
      queryClient.invalidateQueries({ queryKey: ["/api/stock-transfers"] });
    },
    onError: (err: Error) => {
      toast({ title: t("mobile.error"), description: err.message, variant: "destructive" });
    },
  });

  const locLabel = (loc: any) => {
    if (loc.isCentral) return loc.name;
    return loc.branchName ? `${loc.branchName} - ${loc.name}` : loc.name;
  };

  const statusColor = (s: string) => {
    if (s === "approved") return "bg-emerald-100 text-emerald-800";
    if (s === "draft") return "bg-yellow-100 text-yellow-800";
    return "bg-gray-100 text-gray-800";
  };

  return (
    <div className="p-4 pb-24 space-y-4" dir="rtl">
      <div className="flex gap-2 mb-2">
        <Button variant={tab === "create" ? "default" : "outline"} className="flex-1" onClick={() => setTab("create")}>{t("mobile.new_transfer")}</Button>
        <Button variant={tab === "list" ? "default" : "outline"} className="flex-1" onClick={() => setTab("list")}>{t("mobile.transfer_history")}</Button>
      </div>

      {tab === "create" ? (
        <>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <Label className="text-sm">{t("mobile.from")}</Label>
              <Select value={fromLocationId} onValueChange={setFromLocationId}>
                <SelectTrigger data-testid="select-from-location"><SelectValue placeholder={t("mobile.select_source")} /></SelectTrigger>
                <SelectContent>
                  {locations.map((loc: any) => <SelectItem key={loc.id} value={String(loc.id)}>{locLabel(loc)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">{t("mobile.to")}</Label>
              <Select value={toLocationId} onValueChange={setToLocationId}>
                <SelectTrigger data-testid="select-to-location"><SelectValue placeholder={t("mobile.select_destination")} /></SelectTrigger>
                <SelectContent>
                  {locations.filter((l: any) => String(l.id) !== fromLocationId).map((loc: any) => <SelectItem key={loc.id} value={String(loc.id)}>{locLabel(loc)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <BarcodeScanButton onScan={handleBarcode} size="default" className="h-12 w-14 shrink-0" />
            <p className="text-sm text-muted-foreground">{t("mobile.scan_to_add")}</p>
          </div>

          {items.length > 0 && (
            <div className="space-y-2">
              {items.map((item, idx) => (
                <Card key={idx}>
                  <CardContent className="p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{item.name}</p>
                      {(item.color || item.size) && <p className="text-xs text-muted-foreground">{[item.color, item.size].filter(Boolean).join(" / ")}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Input type="number" value={item.qty} onChange={e => {
                        const v = parseInt(e.target.value) || 1;
                        setItems(prev => prev.map((it, i) => i === idx ? { ...it, qty: v } : it));
                      }} className="w-16 h-9 text-center" />
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Input placeholder={t("mobile.notes")} value={notes} onChange={e => setNotes(e.target.value)} />
              <Button className="w-full h-12 gap-2" onClick={() => sendMutation.mutate()} disabled={sendMutation.isPending || !fromLocationId || !toLocationId} data-testid="button-send-transfer">
                {sendMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {t("mobile.send_transfer")}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-2">
          {transfers.map((tr: any) => (
            <Card key={tr.id}>
              <CardContent className="p-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">#{tr.id}</span>
                  <Badge className={statusColor(tr.status)}>{tr.status === "approved" ? t("mobile.completed") : tr.status === "draft" ? t("mobile.draft") : tr.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{new Date(tr.createdAt).toLocaleDateString("ar-OM")}</p>
              </CardContent>
            </Card>
          ))}
          {transfers.length === 0 && <p className="text-center text-muted-foreground py-8">{t("mobile.no_transfers")}</p>}
        </div>
      )}
    </div>
  );
}
