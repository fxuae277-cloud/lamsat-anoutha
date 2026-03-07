import React, { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, getQueryFn } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Account, AccountType, ACCOUNT_TYPES } from "@shared/schema";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus, Edit2, Database, ChevronRight, ChevronDown, Landmark,
} from "lucide-react";

interface AccountTreeNode extends Account {
  children: AccountTreeNode[];
}

export default function Accounts() {
  const { t, lang } = useI18n();
  const { toast } = useToast();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const [form, setForm] = useState({
    code: "",
    name: "",
    nameEn: "",
    type: "asset" as AccountType,
    parentId: "" as string | number,
    level: 1,
  });

  const { data: accounts = [], isLoading } = useQuery<Account[]>({
    queryKey: ["/api/accounts"],
    queryFn: getQueryFn({ on401: "throw" }),
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/accounts/seed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      toast({ title: t("common.success") });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiRequest("POST", "/api/accounts", data);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      setIsAddOpen(false);
      resetForm();
      toast({ title: t("common.success") });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await apiRequest("PATCH", `/api/accounts/${id}`, data);
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/accounts"] });
      setIsEditOpen(false);
      setEditingAccount(null);
      resetForm();
      toast({ title: t("common.success") });
    },
  });

  const resetForm = () => {
    setForm({
      code: "",
      name: "",
      nameEn: "",
      type: "asset",
      parentId: "",
      level: 1,
    });
  };

  const accountTree = useMemo(() => {
    const nodes: Record<number, AccountTreeNode> = {};
    const rootNodes: AccountTreeNode[] = [];

    accounts.forEach(acc => {
      nodes[acc.id] = { ...acc, children: [] };
    });

    accounts.forEach(acc => {
      if (acc.parentId && nodes[acc.parentId]) {
        nodes[acc.parentId].children.push(nodes[acc.id]);
      } else {
        rootNodes.push(nodes[acc.id]);
      }
    });

    // Sort by code
    const sortNodes = (arr: AccountTreeNode[]) => {
      arr.sort((a, b) => a.code.localeCompare(b.code));
      arr.forEach(node => sortNodes(node.children));
    };
    sortNodes(rootNodes);

    return rootNodes;
  }, [accounts]);

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleEdit = (acc: Account) => {
    if (acc.isSystem) return;
    setEditingAccount(acc);
    setForm({
      code: acc.code,
      name: acc.name,
      nameEn: acc.nameEn || "",
      type: acc.type as AccountType,
      parentId: acc.parentId || "",
      level: acc.level || 1,
    });
    setIsEditOpen(true);
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "asset": return "bg-blue-100 text-blue-800 border-blue-200";
      case "liability": return "bg-red-100 text-red-800 border-red-200";
      case "equity": return "bg-green-100 text-green-800 border-green-200";
      case "revenue": return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "expense": return "bg-orange-100 text-orange-800 border-orange-200";
      default: return "";
    }
  };

  const renderRow = (node: AccountTreeNode, depth: number = 0) => {
    const isExpanded = expandedIds.has(node.id);
    const hasChildren = node.children.length > 0;

    return (
      <React.Fragment key={node.id}>
        <TableRow className="group">
          <TableCell className="font-mono">
            <div className="flex items-center" style={{ paddingRight: lang === 'ar' ? `${depth * 20}px` : 0, paddingLeft: lang === 'en' ? `${depth * 20}px` : 0 }}>
              {hasChildren ? (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-6 w-6 p-0 ml-1" 
                  onClick={() => toggleExpand(node.id)}
                  data-testid={`button-toggle-expand-${node.id}`}
                >
                  {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </Button>
              ) : (
                <div className="w-7" />
              )}
              {node.code}
            </div>
          </TableCell>
          <TableCell>{node.name}</TableCell>
          <TableCell>{node.nameEn || "---"}</TableCell>
          <TableCell>
            <Badge variant="outline" className={getTypeBadgeColor(node.type)}>
              {t(`accounts.types.${node.type}`)}
            </Badge>
          </TableCell>
          <TableCell className="text-center">{node.level}</TableCell>
          <TableCell className="text-right">
            {!node.isSystem && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => handleEdit(node)}
                data-testid={`button-edit-account-${node.id}`}
              >
                <Edit2 className="h-4 w-4" />
              </Button>
            )}
            {node.isSystem && (
              <Badge variant="secondary" className="text-[10px]">{t("accounts.system_account")}</Badge>
            )}
          </TableCell>
        </TableRow>
        {isExpanded && node.children.map(child => renderRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  // Helper function to flat list for select
  const flatAccounts = useMemo(() => {
    const list: Account[] = [];
    const traverse = (nodes: AccountTreeNode[]) => {
      nodes.forEach(node => {
        list.push(node);
        traverse(node.children);
      });
    };
    traverse(accountTree);
    return list;
  }, [accountTree]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Landmark className="w-6 h-6 text-primary" />
            {t("accounts.title")}
          </h1>
        </div>
        <div className="flex gap-2">
          {accounts.length === 0 && (
            <Button 
              variant="outline" 
              onClick={() => seedMutation.mutate()} 
              disabled={seedMutation.isPending}
              data-testid="button-seed-accounts"
            >
              <Database className="w-4 h-4 ml-2" />
              {t("accounts.seed_accounts")}
            </Button>
          )}
          <Button onClick={() => { resetForm(); setIsAddOpen(true); }} className="gap-2" data-testid="button-add-account">
            <Plus className="w-4 h-4" />
            {t("accounts.add_account")}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("accounts.code")}</TableHead>
                  <TableHead>{t("accounts.name")}</TableHead>
                  <TableHead>{t("accounts.name_en")}</TableHead>
                  <TableHead>{t("accounts.type")}</TableHead>
                  <TableHead className="text-center">{t("accounts.level")}</TableHead>
                  <TableHead className="text-right">{t("common.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8">{t("common.loading")}</TableCell></TableRow>
                ) : accounts.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">{t("accounts.no_accounts")}</TableCell></TableRow>
                ) : (
                  accountTree.map(root => renderRow(root))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={isAddOpen || isEditOpen} onOpenChange={(open) => {
        if (!open) {
          setIsAddOpen(false);
          setIsEditOpen(false);
          setEditingAccount(null);
        }
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{isEditOpen ? t("accounts.edit_account") : t("accounts.add_account")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="code" className="text-right">{t("accounts.code")}</Label>
              <Input 
                id="code" 
                value={form.code} 
                onChange={e => setForm({...form, code: e.target.value})} 
                className="col-span-3" 
                data-testid="input-account-code"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">{t("accounts.name")}</Label>
              <Input 
                id="name" 
                value={form.name} 
                onChange={e => setForm({...form, name: e.target.value})} 
                className="col-span-3" 
                data-testid="input-account-name"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="nameEn" className="text-right">{t("accounts.name_en")}</Label>
              <Input 
                id="nameEn" 
                value={form.nameEn} 
                onChange={e => setForm({...form, nameEn: e.target.value})} 
                className="col-span-3" 
                data-testid="input-account-name-en"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">{t("accounts.type")}</Label>
              <Select 
                value={form.type} 
                onValueChange={v => setForm({...form, type: v as AccountType})}
              >
                <SelectTrigger className="col-span-3" data-testid="select-account-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map(type => (
                    <SelectItem key={type} value={type}>{t(`accounts.types.${type}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="parentId" className="text-right">{t("accounts.parent")}</Label>
              <Select 
                value={form.parentId ? String(form.parentId) : "none"} 
                onValueChange={v => setForm({...form, parentId: v === "none" ? "" : parseInt(v)})}
              >
                <SelectTrigger className="col-span-3" data-testid="select-account-parent">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">---</SelectItem>
                  {flatAccounts.filter(a => a.id !== editingAccount?.id).map(acc => (
                    <SelectItem key={acc.id} value={String(acc.id)}>{acc.code} - {lang === 'ar' ? acc.name : (acc.nameEn || acc.name)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="level" className="text-right">{t("accounts.level")}</Label>
              <Input 
                id="level" 
                type="number" 
                value={form.level} 
                onChange={e => setForm({...form, level: parseInt(e.target.value)})} 
                className="col-span-3" 
                data-testid="input-account-level"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setIsAddOpen(false); setIsEditOpen(false); }}>{t("common.cancel")}</Button>
            <Button 
              onClick={() => {
                const data = {
                  ...form,
                  parentId: form.parentId === "" ? null : form.parentId,
                };
                if (isEditOpen && editingAccount) {
                  updateMutation.mutate({ id: editingAccount.id, data });
                } else {
                  createMutation.mutate(data);
                }
              }}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save-account"
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
