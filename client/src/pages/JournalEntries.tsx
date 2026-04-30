import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getQueryFn } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { JournalEntry, JournalEntryLine, Account, Branch } from "@shared/schema";
import { format } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  FileText, Plus, Search, Calendar, Filter, Eye, CheckCircle2, Trash2, AlertCircle
} from "lucide-react";

type EntryWithUser = JournalEntry & { created_by_name?: string };
type EntryDetail = JournalEntry & { 
  lines: (JournalEntryLine & { account_code: string; account_name: string })[] 
};

export default function JournalEntries() {
  const { t, lang } = useI18n();
  const { data } = useAuth();
  const user = data?.user;
  const { toast } = useToast();

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("all");
  const [sourceType, setSourceType] = useState("all");

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedEntryId, setSelectedEntryId] = useState<number | null>(null);

  // Add Entry Form State
  const [entryForm, setEntryForm] = useState({
    date: format(new Date(), "yyyy-MM-dd"),
    description: "",
    branchId: user?.branchId ? String(user.branchId) : "",
    lines: [
      { accountId: "", debit: "0", credit: "0", description: "" },
      { accountId: "", debit: "0", credit: "0", description: "" },
    ]
  });

  const queryParams = new URLSearchParams();
  if (from) queryParams.set("from", from);
  if (to) queryParams.set("to", to);
  if (status !== "all") queryParams.set("status", status);
  if (sourceType !== "all") queryParams.set("sourceType", sourceType);

  const { data: entries = [], isLoading } = useQuery<EntryWithUser[]>({
    queryKey: ["/api/journal-entries", queryParams.toString()],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: branches = [] } = useQuery<Branch[]>({
    queryKey: ["/api/branches"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const { data: entryDetail } = useQuery<EntryDetail>({
    queryKey: [`/api/journal-entries/${selectedEntryId}`],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!selectedEntryId && isDetailOpen,
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/journal-entries", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create entry");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      setIsAddOpen(false);
      setEntryForm({
        date: format(new Date(), "yyyy-MM-dd"),
        description: "",
        branchId: user?.branchId ? String(user.branchId) : "",
        lines: [
          { accountId: "", debit: "0", credit: "0", description: "" },
          { accountId: "", debit: "0", credit: "0", description: "" },
        ]
      });
      toast({ title: t("common.success") });
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  });

  const retroMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/journal-entries/generate-retroactive", {});
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message);
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      toast({ title: t("common.success"), description: data.message || `${t("journal.generated")}: ${data.generated}` });
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  });

  const postMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/journal-entries/${id}/post`, {});
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to post entry");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/journal-entries"] });
      if (selectedEntryId) {
        queryClient.invalidateQueries({ queryKey: [`/api/journal-entries/${selectedEntryId}`] });
      }
      toast({ title: t("common.success") });
    },
    onError: (err: Error) => {
      toast({ title: t("common.error"), description: err.message, variant: "destructive" });
    }
  });

  const totals = useMemo(() => {
    const d = entryForm.lines.reduce((sum, l) => sum + parseFloat(l.debit || "0"), 0);
    const c = entryForm.lines.reduce((sum, l) => sum + parseFloat(l.credit || "0"), 0);
    return { debit: d, credit: c, balanced: Math.abs(d - c) < 0.0001 && d > 0 };
  }, [entryForm.lines]);

  const handleAddLine = () => {
    setEntryForm(f => ({
      ...f,
      lines: [...f.lines, { accountId: "", debit: "0", credit: "0", description: "" }]
    }));
  };

  const handleRemoveLine = (index: number) => {
    if (entryForm.lines.length <= 2) return;
    setEntryForm(f => ({
      ...f,
      lines: f.lines.filter((_, i) => i !== index)
    }));
  };

  const handleLineChange = (index: number, field: string, value: string) => {
    const newLines = [...entryForm.lines];
    (newLines[index] as any)[field] = value;
    setEntryForm(f => ({ ...f, lines: newLines }));
  };

  const handleSubmit = () => {
    if (!totals.balanced) return;
    createMutation.mutate({
      ...entryForm,
      branchId: entryForm.branchId ? parseInt(entryForm.branchId) : null,
      lines: entryForm.lines.map(l => ({
        ...l,
        accountId: parseInt(l.accountId),
        debit: parseFloat(l.debit),
        credit: parseFloat(l.credit)
      }))
    });
  };

  const f3 = (n: any) => parseFloat(String(n || 0)).toFixed(3);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <FileText className="w-6 h-6 text-primary" />
            {t("journal.title")}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => retroMutation.mutate()} disabled={retroMutation.isPending} className="gap-2" data-testid="button-generate-retro">
            <CheckCircle2 className="w-4 h-4" /> {t("journal.generate_retro")}
          </Button>
          <Button onClick={() => setIsAddOpen(true)} className="gap-2" data-testid="button-add-entry">
            <Plus className="w-4 h-4" /> {t("journal.add_entry")}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
          <div className="space-y-1.5">
            <Label className="text-xs">{t("common.from")}</Label>
            <DateInput value={from} onChange={e => setFrom(e.target.value)} className="w-40" data-testid="filter-from" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("common.to")}</Label>
            <DateInput value={to} onChange={e => setTo(e.target.value)} className="w-40" data-testid="filter-to" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("journal.status")}</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-32" data-testid="filter-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                <SelectItem value="draft">{t("journal.draft")}</SelectItem>
                <SelectItem value="posted">{t("journal.posted")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("journal.source_type")}</Label>
            <Select value={sourceType} onValueChange={setSourceType}>
              <SelectTrigger className="w-32" data-testid="filter-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.all")}</SelectItem>
                <SelectItem value="manual">{t("journal.manual")}</SelectItem>
                <SelectItem value="sale">{t("journal.sale")}</SelectItem>
                <SelectItem value="purchase">{t("journal.purchase")}</SelectItem>
                <SelectItem value="expense">{t("journal.expense")}</SelectItem>
                <SelectItem value="return">{t("journal.return")}</SelectItem>
                <SelectItem value="supplier_payment">{t("journal.supplier_payment")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="icon" onClick={() => { setFrom(""); setTo(""); setStatus("all"); setSourceType("all"); }}>
            <Filter className="w-4 h-4" />
          </Button>
        </CardContent>
      </Card>

      <div className="border rounded-lg overflow-hidden bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("journal.entry_number")}</TableHead>
              <TableHead>{t("journal.date")}</TableHead>
              <TableHead>{t("journal.description")}</TableHead>
              <TableHead>{t("journal.status")}</TableHead>
              <TableHead className="text-start">{t("journal.total_debit")}</TableHead>
              <TableHead className="text-start">{t("journal.total_credit")}</TableHead>
              <TableHead>{t("journal.source_type")}</TableHead>
              <TableHead>{t("common.employee")}</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8">{t("common.loading")}</TableCell></TableRow>
            ) : entries.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center py-8">{t("journal.no_entries")}</TableCell></TableRow>
            ) : (
              entries.map(entry => (
                <TableRow 
                  key={entry.id} 
                  className="cursor-pointer hover:bg-muted/50" 
                  onClick={() => { setSelectedEntryId(entry.id); setIsDetailOpen(true); }}
                  data-testid={`row-entry-${entry.id}`}
                >
                  <TableCell className="font-mono font-medium">{entry.entryNumber}</TableCell>
                  <TableCell>{entry.date}</TableCell>
                  <TableCell className="max-w-xs truncate">{entry.description}</TableCell>
                  <TableCell>
                    <Badge variant={entry.status === "posted" ? "default" : "outline"} className={entry.status === "posted" ? "bg-green-100 text-green-800 hover:bg-green-100" : "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"}>
                      {t(`journal.${entry.status}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-start font-mono">{f3(entry.totalDebit)}</TableCell>
                  <TableCell className="text-start font-mono">{f3(entry.totalCredit)}</TableCell>
                  <TableCell>{entry.sourceType ? t(`journal.${entry.sourceType}`) : t("journal.manual")}</TableCell>
                  <TableCell>{entry.created_by_name || "---"}</TableCell>
                  <TableCell onClick={e => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => { setSelectedEntryId(entry.id); setIsDetailOpen(true); }} data-testid={`button-view-${entry.id}`}>
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Entry Dialog */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("journal.add_entry")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-2">
              <Label>{t("journal.date")}</Label>
              <DateInput value={entryForm.date} onChange={e => setEntryForm(f => ({ ...f, date: e.target.value }))} data-testid="input-entry-date" />
            </div>
            <div className="space-y-2">
              <Label>{t("common.branch")}</Label>
              <Select value={entryForm.branchId} onValueChange={v => setEntryForm(f => ({ ...f, branchId: v }))}>
                <SelectTrigger data-testid="select-entry-branch">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {branches.map(b => <SelectItem key={b.id} value={String(b.id)}>{b.name}{b.address ? " - " + b.address : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("journal.description")}</Label>
              <Textarea 
                value={entryForm.description} 
                onChange={e => setEntryForm(f => ({ ...f, description: e.target.value }))}
                placeholder={t("journal.description")}
                className="h-10 min-h-[40px]"
                data-testid="input-entry-desc"
              />
            </div>
          </div>

          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-[300px]">{t("journal.account")}</TableHead>
                  <TableHead className="w-[120px]">{t("journal.debit")}</TableHead>
                  <TableHead className="w-[120px]">{t("journal.credit")}</TableHead>
                  <TableHead>{t("journal.line_description")}</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entryForm.lines.map((line, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <Select value={line.accountId} onValueChange={v => handleLineChange(index, "accountId", v)}>
                        <SelectTrigger data-testid={`line-account-${index}`}>
                          <SelectValue placeholder={t("journal.account")} />
                        </SelectTrigger>
                        <SelectContent>
                          {accounts.map(a => (
                            <SelectItem key={a.id} value={String(a.id)}>
                              {a.code} - {lang === "ar" ? a.name : (a.nameEn || a.name)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        step="0.001" 
                        value={line.debit} 
                        onChange={e => handleLineChange(index, "debit", e.target.value)} 
                        className="font-mono text-start"
                        data-testid={`line-debit-${index}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        type="number" 
                        step="0.001" 
                        value={line.credit} 
                        onChange={e => handleLineChange(index, "credit", e.target.value)} 
                        className="font-mono text-start"
                        data-testid={`line-credit-${index}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Input 
                        value={line.description} 
                        onChange={e => handleLineChange(index, "description", e.target.value)}
                        placeholder={t("journal.line_description")}
                        data-testid={`line-desc-${index}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="text-destructive hover:text-destructive" 
                        onClick={() => handleRemoveLine(index)}
                        disabled={entryForm.lines.length <= 2}
                        data-testid={`button-remove-line-${index}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="flex justify-between items-center mt-4">
            <Button variant="outline" size="sm" onClick={handleAddLine} data-testid="button-add-line">
              <Plus className="w-4 h-4 ms-1" /> {t("journal.add_line")}
            </Button>

            <div className="flex gap-6 items-center bg-muted/30 p-3 rounded-lg border">
              <div className="text-sm">
                <span className="text-muted-foreground ms-2">{t("journal.total_debit")}:</span>
                <span className="font-mono font-bold">{f3(totals.debit)}</span>
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground ms-2">{t("journal.total_credit")}:</span>
                <span className="font-mono font-bold">{f3(totals.credit)}</span>
              </div>
              <div className="flex items-center gap-2">
                {totals.balanced ? (
                  <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200"><CheckCircle2 className="w-3 h-3 ms-1" /> {t("journal.balanced")}</Badge>
                ) : (
                  <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200"><AlertCircle className="w-3 h-3 ms-1" /> {t("journal.not_balanced")}</Badge>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>{t("common.cancel")}</Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!totals.balanced || createMutation.isPending}
              data-testid="button-submit-entry"
            >
              {createMutation.isPending ? t("common.saving") : t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-4xl overflow-y-auto">
          <DialogHeader>
            <div className="flex justify-between items-center">
              <DialogTitle>{t("journal.title")} - {entryDetail?.entryNumber}</DialogTitle>
              {entryDetail?.status === "draft" && (
                <Button 
                  size="sm" 
                  className="bg-emerald-600 hover:bg-emerald-700" 
                  onClick={() => {
                    if (confirm(t("journal.post_confirm"))) {
                      postMutation.mutate(entryDetail.id);
                    }
                  }}
                  disabled={postMutation.isPending}
                  data-testid="button-post-entry"
                >
                  <CheckCircle2 className="w-4 h-4 ms-1" /> {t("journal.post_entry")}
                </Button>
              )}
            </div>
          </DialogHeader>
          
          {entryDetail && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-lg">
                <div>
                  <Label className="text-xs text-muted-foreground">{t("journal.date")}</Label>
                  <p className="font-medium">{entryDetail.date}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{t("journal.status")}</Label>
                  <div>
                    <Badge variant={entryDetail.status === "posted" ? "default" : "outline"} className={entryDetail.status === "posted" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
                      {t(`journal.${entryDetail.status}`)}
                    </Badge>
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{t("journal.source_type")}</Label>
                  <p className="font-medium">{entryDetail.sourceType ? t(`journal.${entryDetail.sourceType}`) : t("journal.manual")}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">{t("common.branch")}</Label>
                  <p className="font-medium">{(() => { const b = branches.find(b => b.id === entryDetail.branchId); return b ? (b.address ? `${b.name} - ${b.address}` : b.name) : "---"; })()}</p>
                </div>
                <div className="col-span-full">
                  <Label className="text-xs text-muted-foreground">{t("journal.description")}</Label>
                  <p className="font-medium">{entryDetail.description}</p>
                </div>
              </div>

              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead>{t("journal.account")}</TableHead>
                      <TableHead className="text-start">{t("journal.debit")}</TableHead>
                      <TableHead className="text-start">{t("journal.credit")}</TableHead>
                      <TableHead>{t("journal.line_description")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entryDetail.lines.map((line, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <span className="font-mono text-sm text-muted-foreground ms-2">{line.account_code}</span>
                          <span className="font-medium">{line.account_name}</span>
                        </TableCell>
                        <TableCell className="text-start font-mono">{f3(line.debit)}</TableCell>
                        <TableCell className="text-start font-mono">{f3(line.credit)}</TableCell>
                        <TableCell className="text-sm">{line.description || "---"}</TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-muted/30 font-bold">
                      <TableCell className="text-start">{t("common.total")}</TableCell>
                      <TableCell className="text-start font-mono">{f3(entryDetail.totalDebit)}</TableCell>
                      <TableCell className="text-start font-mono">{f3(entryDetail.totalCredit)}</TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
