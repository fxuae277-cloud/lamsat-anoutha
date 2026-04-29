import { useState } from "react";
import { Shield, Search, Calendar, AlertTriangle, RotateCcw, ShoppingCart, User, FileText, Filter, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { Branch } from "@shared/schema";
import { useI18n } from "@/lib/i18n";
import { fmtDateTime } from "@/lib/formatters";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function weekAgoStr() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

export default function AuditLog() {
  const { data } = useAuth();
  const user = data?.user;
  const { t, lang } = useI18n();
  const isOwnerAdmin = user?.role === "owner" || user?.role === "admin";

  const ACTION_LABELS: Record<string, { label: string; color: string; icon: any }> = {
    sale_return: { label: t("audit_log.action_labels.sale_return"), color: "bg-red-100 text-red-700 border-red-200", icon: RotateCcw },
    order_cancel: { label: t("audit_log.action_labels.order_cancel"), color: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertTriangle },
    order_status_change: { label: t("audit_log.action_labels.order_status_change"), color: "bg-blue-100 text-blue-700 border-blue-200", icon: ShoppingCart },
    user_update: { label: t("audit_log.action_labels.user_update"), color: "bg-purple-100 text-purple-700 border-purple-200", icon: User },
    password_reset: { label: t("audit_log.action_labels.password_reset"), color: "bg-orange-100 text-orange-700 border-orange-200", icon: Shield },
    price_change: { label: t("audit_log.action_labels.price_change"), color: "bg-indigo-100 text-indigo-700 border-indigo-200", icon: FileText },
  };

  const ENTITY_TYPES = [
    { value: "all", label: t("audit_log.entity_types.all") },
    { value: "sale_return", label: t("audit_log.entity_types.sale_return") },
    { value: "order", label: t("audit_log.entity_types.order") },
    { value: "user", label: t("audit_log.entity_types.user") },
    { value: "product", label: t("audit_log.entity_types.product") },
  ];

  const [from, setFrom] = useState(weekAgoStr());
  const [to, setTo] = useState(todayStr());
  const [entityType, setEntityType] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [search, setSearch] = useState("");

  const queryParams = new URLSearchParams();
  if (from) queryParams.set("from", from);
  if (to) queryParams.set("to", to);
  if (entityType !== "all") queryParams.set("entityType", entityType);
  if (branchFilter !== "all") queryParams.set("branchId", branchFilter);

  const { data: logs = [] } = useQuery<any[]>({
    queryKey: [`/api/audit-log?${queryParams.toString()}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: isOwnerAdmin,
  });
  const { data: branchesList = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const filtered = search
    ? logs.filter((l: any) =>
        (l.details || "").includes(search) ||
        (l.actor_name || "").includes(search) ||
        (l.action || "").includes(search)
      )
    : logs;

  if (!isOwnerAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Shield className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
        <p className="text-lg font-medium">{t("audit_log.restricted")}</p>
        <p className="text-sm mt-1">{t("audit_log.restricted_desc")}</p>
      </div>
    );
  }

  const actionCounts: Record<string, number> = {};
  logs.forEach((l: any) => {
    actionCounts[l.action] = (actionCounts[l.action] || 0) + 1;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-audit-title">
          <Shield className="w-6 h-6 text-primary" />
          {t("audit_log.title")}
        </h1>
        <p className="text-muted-foreground mt-1">{t("audit_log.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("audit_log.total_records")}</p>
              <p className="text-xl font-bold">{logs.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <RotateCcw className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("audit_log.returns_count")}</p>
              <p className="text-xl font-bold text-red-600">{actionCounts["sale_return"] || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("audit_log.cancellations")}</p>
              <p className="text-xl font-bold text-amber-600">{actionCounts["order_cancel"] || 0}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Filter className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("audit_log.status_changes")}</p>
              <p className="text-xl font-bold text-blue-600">{actionCounts["order_status_change"] || 0}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b flex flex-wrap items-center gap-3 bg-muted/20">
          <div className="space-y-1">
            <label className="text-xs font-medium">{t("audit_log.from_label")}</label>
            <DateInput value={from} onChange={e => setFrom(e.target.value)} className="w-40 bg-background" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">{t("audit_log.to_label")}</label>
            <DateInput value={to} onChange={e => setTo(e.target.value)} className="w-40 bg-background" />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">{t("audit_log.type_label")}</label>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger className="w-36 bg-background" data-testid="select-audit-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium">{t("audit_log.branch_label")}</label>
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-40 bg-background">
                <SelectValue placeholder={t("common.all_branches")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all_branches")}</SelectItem>
                {branchesList.map(b => <SelectItem key={b.id} value={b.id.toString()}>{b.name}{b.address ? " - " + b.address : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 flex-1 min-w-[200px]">
            <label className="text-xs font-medium">{t("audit_log.search_label")}</label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder={t("audit_log.search_placeholder")}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pe-9 bg-background"
                data-testid="input-search-audit"
              />
            </div>
          </div>
        </div>

        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-[50px]">{t("audit_log.table_num")}</TableHead>
              <TableHead>{t("audit_log.table_action")}</TableHead>
              <TableHead>{t("audit_log.table_type")}</TableHead>
              <TableHead>{t("audit_log.table_branch")}</TableHead>
              <TableHead>{t("audit_log.table_user")}</TableHead>
              <TableHead>{t("audit_log.table_details")}</TableHead>
              <TableHead>{t("audit_log.table_datetime")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">{t("audit_log.no_records")}</TableCell></TableRow>
            ) : filtered.map((log: any, i: number) => {
              const actionInfo = ACTION_LABELS[log.action] || { label: log.action, color: "bg-gray-100 text-gray-700 border-gray-200", icon: FileText };
              const Icon = actionInfo.icon;
              return (
                <TableRow key={log.id} data-testid={`row-audit-${log.id}`} className="hover:bg-muted/30">
                  <TableCell className="text-xs text-muted-foreground font-mono">{log.id}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`gap-1 text-xs ${actionInfo.color}`}>
                      <Icon className="w-3 h-3" />
                      {actionInfo.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {log.entity_type}
                      {log.entity_id ? ` #${log.entity_id}` : ""}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">{log.branch_name || "—"}</TableCell>
                  <TableCell className="text-sm font-medium">{log.actor_name || log.user_name || "—"}</TableCell>
                  <TableCell className="text-sm max-w-[300px]">
                    <span className="truncate block">{log.details || "—"}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {fmtDateTime(log.created_at)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {filtered.length > 0 && (
          <div className="p-3 border-t bg-muted/30 text-sm text-muted-foreground">
            {filtered.length} {t("audit_log.record_count")}
          </div>
        )}
      </div>
    </div>
  );
}
