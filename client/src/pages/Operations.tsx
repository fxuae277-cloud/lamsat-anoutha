import { useState } from "react";
import { Search, Filter, Calendar, Building2, Clock, ShoppingBag, Package, Receipt, DoorOpen, DoorClosed, RotateCcw, Truck, ShoppingCart, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import type { Branch } from "@shared/schema";
import { useI18n } from "@/lib/i18n";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function weekAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}
function fmt(v: string | number | null | undefined) {
  if (!v || v === "0" || v === "0.000") return "";
  return parseFloat(String(v)).toFixed(3);
}

export default function Operations() {
  const { t, lang } = useI18n();

  const OP_TYPE_LABELS: Record<string, { label: string; color: string; icon: any }> = {
    sale:        { label: t("operations.op_types.sale"), color: "bg-green-100 text-green-700 border-green-200", icon: ShoppingBag },
    order:       { label: t("operations.op_types.order"), color: "bg-blue-100 text-blue-700 border-blue-200", icon: ShoppingCart },
    expense:     { label: t("operations.op_types.expense"), color: "bg-red-100 text-red-700 border-red-200", icon: Receipt },
    transfer:    { label: t("operations.op_types.transfer"), color: "bg-purple-100 text-purple-700 border-purple-200", icon: Package },
    shift_open:  { label: t("operations.op_types.shift_open"), color: "bg-amber-100 text-amber-700 border-amber-200", icon: DoorOpen },
    shift_close: { label: t("operations.op_types.shift_close"), color: "bg-orange-100 text-orange-700 border-orange-200", icon: DoorClosed },
    return:      { label: t("operations.op_types.return"), color: "bg-pink-100 text-pink-700 border-pink-200", icon: RotateCcw },
    purchase:    { label: t("operations.op_types.purchase"), color: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: Truck },
  };

  function formatDateTime(dt: string | null) {
    if (!dt) return "—";
    const d = new Date(dt);
    const date = d.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" });
    const time = d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
    return { date, time };
  }

  const [from, setFrom] = useState(weekAgoStr());
  const [to, setTo] = useState(todayStr());
  const [branchId, setBranchId] = useState("__all__");
  const [opType, setOpType] = useState("__all__");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const { data: branchesList = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const queryParams = new URLSearchParams();
  if (from) queryParams.set("from", from);
  if (to) queryParams.set("to", to);
  if (branchId && branchId !== "__all__") queryParams.set("branchId", branchId);
  if (opType && opType !== "__all__") queryParams.set("type", opType);
  if (search) queryParams.set("search", search);

  const url = `/api/recent-operations?${queryParams.toString()}`;

  const { data: operations = [], isLoading } = useQuery<any[]>({
    queryKey: [url],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const typeCounts: Record<string, number> = {};
  operations.forEach((op: any) => {
    typeCounts[op.op_type] = (typeCounts[op.op_type] || 0) + 1;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold" data-testid="text-operations-title">{t("operations.title")}</h1>
        <p className="text-muted-foreground mt-1">{t("operations.subtitle")}</p>
      </div>

      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
        {Object.entries(OP_TYPE_LABELS).map(([key, info]) => {
          const count = typeCounts[key] || 0;
          const Icon = info.icon;
          return (
            <Card
              key={key}
              className={`cursor-pointer transition-all hover:shadow-md ${opType === key ? "ring-2 ring-primary" : ""}`}
              onClick={() => setOpType(opType === key ? "__all__" : key)}
              data-testid={`card-type-${key}`}
            >
              <CardContent className="p-3 text-center">
                <Icon className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs font-medium truncate">{info.label}</p>
                <p className="text-lg font-bold">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap items-end gap-3 bg-card border rounded-xl p-4">
        <div className="space-y-1">
          <label className="text-xs font-medium flex items-center gap-1">
            <Calendar className="w-3 h-3" /> {t("operations.from_label")}
          </label>
          <Input type="date" className="w-40" value={from} onChange={e => setFrom(e.target.value)} data-testid="input-ops-from" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium">{t("operations.to_label")}</label>
          <Input type="date" className="w-40" value={to} onChange={e => setTo(e.target.value)} data-testid="input-ops-to" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium flex items-center gap-1">
            <Building2 className="w-3 h-3" /> {t("operations.branch_label")}
          </label>
          <Select value={branchId} onValueChange={setBranchId}>
            <SelectTrigger className="w-52" data-testid="select-ops-branch"><SelectValue placeholder={t("operations.all_branches")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("operations.all_branches")}</SelectItem>
              {branchesList.map(b => (
                <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium flex items-center gap-1">
            <Filter className="w-3 h-3" /> {t("operations.type_label")}
          </label>
          <Select value={opType} onValueChange={setOpType}>
            <SelectTrigger className="w-44" data-testid="select-ops-type"><SelectValue placeholder={t("operations.all_operations")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{t("operations.all_operations")}</SelectItem>
              {Object.entries(OP_TYPE_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 flex-1 min-w-[200px]">
          <label className="text-xs font-medium flex items-center gap-1">
            <Search className="w-3 h-3" /> {t("operations.search_label")}
          </label>
          <div className="flex gap-2">
            <Input
              placeholder={t("operations.search_placeholder")}
              className="bg-background"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") setSearch(searchInput); }}
              data-testid="input-ops-search"
            />
            <Button variant="secondary" size="sm" onClick={() => setSearch(searchInput)} data-testid="button-ops-search">
              {t("operations.search_btn")}
            </Button>
          </div>
        </div>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <div className="p-3 border-b bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="w-4 h-4" />
            <span>{operations.length} {t("operations.operation_count")}</span>
            {search && <Badge variant="outline" className="text-xs">{t("operations.search_tag")} {search}</Badge>}
          </div>
        </div>
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[160px]">{t("operations.table_datetime")}</TableHead>
              <TableHead>{t("operations.table_branch")}</TableHead>
              <TableHead>{t("operations.table_employee")}</TableHead>
              <TableHead>{t("operations.table_type")}</TableHead>
              <TableHead>{t("operations.table_ref")}</TableHead>
              <TableHead>{t("operations.table_amount")}</TableHead>
              <TableHead className="min-w-[250px]">{t("operations.table_note")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                  <p className="text-muted-foreground">{t("operations.loading")}</p>
                </TableCell>
              </TableRow>
            ) : operations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {t("operations.no_operations")}
                </TableCell>
              </TableRow>
            ) : operations.map((op: any, i: number) => {
              const typeInfo = OP_TYPE_LABELS[op.op_type] || { label: op.op_type, color: "bg-gray-100 text-gray-700", icon: Activity };
              const Icon = typeInfo.icon;
              const dt = formatDateTime(op.op_time);
              const amountStr = fmt(op.amount);
              return (
                <TableRow key={`${op.op_type}-${op.ref_number}-${i}`} data-testid={`row-op-${i}`} className="hover:bg-muted/30">
                  <TableCell>
                    {typeof dt === "object" ? (
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{dt.time}</p>
                          <p className="text-xs text-muted-foreground">{dt.date}</p>
                        </div>
                      </div>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{op.branch_name || "—"}</TableCell>
                  <TableCell>
                    <span className="text-sm font-medium">{op.user_name || "—"}</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-xs gap-1 ${typeInfo.color}`}>
                      <Icon className="w-3 h-3" />
                      {typeInfo.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-mono text-muted-foreground">{op.ref_number || "—"}</span>
                  </TableCell>
                  <TableCell>
                    {amountStr ? (
                      <span className="font-medium text-sm">{amountStr} <span className="text-xs text-muted-foreground">{t("common.omr")}</span></span>
                    ) : "—"}
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-muted-foreground leading-relaxed truncate max-w-[350px]" title={op.note}>
                      {op.note || "—"}
                    </p>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {operations.length > 0 && (
          <div className="p-3 border-t bg-muted/30 text-sm text-muted-foreground">
            {t("operations.showing_count").replace("{0}", operations.length.toString())}
          </div>
        )}
      </div>
    </div>
  );
}
