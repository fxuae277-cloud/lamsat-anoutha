import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { Account, AccountType } from "@shared/schema";
import { format } from "date-fns";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, Scale, Calendar, Search, Filter } from "lucide-react";

type GeneralLedgerEntry = {
  id: number;
  date: string;
  entry_number: string;
  description: string;
  debit: string;
  credit: string;
};

type TrialBalanceEntry = {
  account_id: number;
  account_code: string;
  account_name: string;
  account_name_en: string | null;
  account_type: AccountType;
  total_debit: string;
  total_credit: string;
  balance: string;
};

export default function GeneralLedger() {
  const { t, lang } = useI18n();
  const [activeTab, setActiveTab] = useState("gl");

  // Filters for General Ledger
  const [glAccountId, setGlAccountId] = useState<string>("");
  const [glFrom, setGlFrom] = useState<string>("");
  const [glTo, setGlTo] = useState<string>("");

  // Filters for Trial Balance
  const [tbFrom, setTbFrom] = useState<string>("");
  const [tbTo, setTbTo] = useState<string>("");

  const { data: accounts = [] } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const glQueryStr = `/api/general-ledger?accountId=${glAccountId}&from=${glFrom}&to=${glTo}`;
  const { data: glEntries = [], isLoading: isLoadingGl } = useQuery<GeneralLedgerEntry[]>({
    queryKey: [glQueryStr],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: !!glAccountId,
  });

  const tbQueryStr = `/api/trial-balance?from=${tbFrom}&to=${tbTo}`;
  const { data: tbEntries = [], isLoading: isLoadingTb } = useQuery<TrialBalanceEntry[]>({
    queryKey: [tbQueryStr],
    queryFn: getQueryFn({ on401: "throw" }),
    enabled: activeTab === "tb",
  });

  const selectedAccount = useMemo(() => 
    accounts.find(a => String(a.id) === glAccountId), 
  [accounts, glAccountId]);

  const glWithRunningBalance = useMemo(() => {
    if (!selectedAccount) return [];
    
    let balance = 0;
    const isDebitNormal = ["asset", "expense"].includes(selectedAccount.type as string);

    return glEntries.map(entry => {
      const debit = parseFloat(entry.debit || "0");
      const credit = parseFloat(entry.credit || "0");
      
      if (isDebitNormal) {
        balance += (debit - credit);
      } else {
        balance += (credit - debit);
      }
      
      return { ...entry, running_balance: balance };
    });
  }, [glEntries, selectedAccount]);

  const glTotals = useMemo(() => {
    return glEntries.reduce((acc, entry) => ({
      debit: acc.debit + parseFloat(entry.debit || "0"),
      credit: acc.credit + parseFloat(entry.credit || "0"),
    }), { debit: 0, credit: 0 });
  }, [glEntries]);

  const tbGrouped = useMemo(() => {
    const groups: Record<string, TrialBalanceEntry[]> = {
      asset: [],
      liability: [],
      equity: [],
      revenue: [],
      expense: [],
    };
    
    tbEntries.forEach(entry => {
      if (groups[entry.account_type]) {
        groups[entry.account_type].push(entry);
      }
    });
    
    return groups;
  }, [tbEntries]);

  const tbTotals = useMemo(() => {
    return tbEntries.reduce((acc, entry) => ({
      debit: acc.debit + parseFloat(entry.total_debit || "0"),
      credit: acc.credit + parseFloat(entry.total_credit || "0"),
    }), { debit: 0, credit: 0 });
  }, [tbEntries]);

  const f3 = (n: number | string | null | undefined) => parseFloat(String(n || "0")).toFixed(3);
  const fD = (d: any) => d ? format(new Date(d), "yyyy-MM-dd") : "---";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <BookOpen className="w-6 h-6 text-primary" />
            {t("ledger.title")}
          </h1>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="gl" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            {t("ledger.general_ledger")}
          </TabsTrigger>
          <TabsTrigger value="tb" className="flex items-center gap-2">
            <Scale className="w-4 h-4" />
            {t("ledger.trial_balance")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gl" className="space-y-4 mt-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-medium flex items-center gap-2">
                <Filter className="w-4 h-4" />
                {t("ledger.filter")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[250px]">
                  <Select value={glAccountId} onValueChange={setGlAccountId}>
                    <SelectTrigger data-testid="select-account-gl">
                      <SelectValue placeholder={t("ledger.select_account")} />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map(acc => (
                        <SelectItem key={acc.id} value={String(acc.id)}>
                          {acc.code} - {lang === "ar" ? acc.name : (acc.nameEn || acc.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <DateInput
                    value={glFrom}
                    onChange={e => setGlFrom(e.target.value)}
                    className="w-40"
                    data-testid="input-gl-from"
                  />
                  <span className="text-muted-foreground">{t("ledger.to")}</span>
                  <DateInput
                    value={glTo}
                    onChange={e => setGlTo(e.target.value)}
                    className="w-40"
                    data-testid="input-gl-to"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="border rounded-lg overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("ledger.date")}</TableHead>
                    <TableHead>{t("ledger.entry_number")}</TableHead>
                    <TableHead>{t("ledger.description")}</TableHead>
                    <TableHead className="text-start">{t("ledger.debit")}</TableHead>
                    <TableHead className="text-start">{t("ledger.credit")}</TableHead>
                    <TableHead className="text-start">{t("ledger.running_balance")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingGl ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8">{t("common.loading")}</TableCell></TableRow>
                  ) : !glAccountId ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("ledger.select_account")}</TableCell></TableRow>
                  ) : glWithRunningBalance.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center py-8">{t("ledger.no_entries")}</TableCell></TableRow>
                  ) : (
                    <>
                      {glWithRunningBalance.map(entry => (
                        <TableRow key={entry.id} data-testid={`row-gl-entry-${entry.id}`}>
                          <TableCell className="whitespace-nowrap">{fD(entry.date)}</TableCell>
                          <TableCell className="font-mono text-xs">{entry.entry_number}</TableCell>
                          <TableCell className="max-w-xs truncate" title={entry.description}>{entry.description}</TableCell>
                          <TableCell className="text-start font-mono">{f3(entry.debit)}</TableCell>
                          <TableCell className="text-start font-mono">{f3(entry.credit)}</TableCell>
                          <TableCell className="text-start font-mono font-semibold">{f3(entry.running_balance)}</TableCell>
                        </TableRow>
                      ))}
                      <TableRow className="bg-muted/50 font-bold">
                        <TableCell colSpan={3} className="text-end">{t("common.total")}</TableCell>
                        <TableCell className="text-start font-mono">{f3(glTotals.debit)}</TableCell>
                        <TableCell className="text-start font-mono">{f3(glTotals.credit)}</TableCell>
                        <TableCell className="text-start font-mono text-primary">
                          {glWithRunningBalance.length > 0 ? f3(glWithRunningBalance[glWithRunningBalance.length - 1].running_balance) : "0.000"}
                        </TableCell>
                      </TableRow>
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="tb" className="space-y-4 mt-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t("ledger.from")}:</span>
                  <DateInput
                    value={tbFrom}
                    onChange={e => setTbFrom(e.target.value)}
                    className="w-40"
                    data-testid="input-tb-from"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t("ledger.to")}:</span>
                  <DateInput
                    value={tbTo}
                    onChange={e => setTbTo(e.target.value)}
                    className="w-40"
                    data-testid="input-tb-to"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="border rounded-lg overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("ledger.account_code")}</TableHead>
                    <TableHead>{t("ledger.account_name")}</TableHead>
                    <TableHead className="text-start">{t("ledger.total_debits")}</TableHead>
                    <TableHead className="text-start">{t("ledger.total_credits")}</TableHead>
                    <TableHead className="text-start">{t("ledger.balance")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingTb ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8">{t("common.loading")}</TableCell></TableRow>
                  ) : tbEntries.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center py-8">{t("ledger.no_data")}</TableCell></TableRow>
                  ) : (
                    <>
                      {Object.entries(tbGrouped).map(([type, entries]) => (
                        entries.length > 0 && (
                          <div key={type} className="contents">
                            <TableRow className="bg-muted/30">
                              <TableCell colSpan={5} className="font-bold text-primary">
                                {t(`ledger.account_types.${type}`)}
                              </TableCell>
                            </TableRow>
                            {entries.map(entry => (
                              <TableRow key={entry.account_id} data-testid={`row-tb-entry-${entry.account_id}`}>
                                <TableCell className="font-mono text-xs">{entry.account_code}</TableCell>
                                <TableCell>{lang === "ar" ? entry.account_name : (entry.account_name_en || entry.account_name)}</TableCell>
                                <TableCell className="text-start font-mono">{f3(entry.total_debit)}</TableCell>
                                <TableCell className="text-start font-mono">{f3(entry.total_credit)}</TableCell>
                                <TableCell className="text-start font-mono font-semibold">{f3(entry.balance)}</TableCell>
                              </TableRow>
                            ))}
                          </div>
                        )
                      ))}
                      <TableRow className="bg-primary/10 font-bold border-t-2">
                        <TableCell colSpan={2} className="text-end uppercase">{t("common.total")}</TableCell>
                        <TableCell className="text-start font-mono text-lg">{f3(tbTotals.debit)}</TableCell>
                        <TableCell className="text-start font-mono text-lg">{f3(tbTotals.credit)}</TableCell>
                        <TableCell className="text-start font-mono text-lg">
                          {f3(tbTotals.debit - tbTotals.credit)}
                        </TableCell>
                      </TableRow>
                      {Math.abs(tbTotals.debit - tbTotals.credit) > 0.001 && (
                        <TableRow className="bg-red-50">
                          <TableCell colSpan={5} className="text-center text-red-600 text-sm font-medium">
                            Warning: Trial balance does not match! Difference: {f3(tbTotals.debit - tbTotals.credit)}
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
