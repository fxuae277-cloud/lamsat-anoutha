import { useState } from "react";
import { Plus, Search, Edit, Trash, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";
import { getQueryFn, apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Product, Category } from "@shared/schema";

export default function Products() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const [newProduct, setNewProduct] = useState({ barcode: "", name: "", categoryId: "", price: "", active: true });
  const [addOpen, setAddOpen] = useState(false);

  const { data: products = [] } = useQuery<Product[]>({ queryKey: ["/api/products"], queryFn: getQueryFn({ on401: "throw" }) });
  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ["/api/categories"], queryFn: getQueryFn({ on401: "throw" }) });

  const filteredProducts = products.filter(p => {
    const matchSearch = !search || p.name.includes(search) || (p.barcode && p.barcode.includes(search));
    const matchCat = filterCat === "all" || p.categoryId === parseInt(filterCat);
    return matchSearch && matchCat;
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/products", {
        ...newProduct,
        categoryId: newProduct.categoryId ? parseInt(newProduct.categoryId) : null,
      });
    },
    onSuccess: () => {
      toast({ title: "تمت الإضافة", description: "تم إضافة المنتج بنجاح." });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
      setAddOpen(false);
      setNewProduct({ barcode: "", name: "", categoryId: "", price: "", active: true });
    },
    onError: (err: Error) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/products/${id}`);
    },
    onSuccess: () => {
      toast({ title: "تم الحذف" });
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, active }: { id: number; active: boolean }) => {
      await apiRequest("PATCH", `/api/products/${id}`, { active });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    },
  });

  const getCategoryName = (catId: number | null) => categories.find(c => c.id === catId)?.name || "-";

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-products-title">المنتجات والأسعار</h1>
          <p className="text-muted-foreground mt-1">إدارة قائمة المنتجات وتوحيد الأسعار لجميع الفروع.</p>
        </div>
        
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" data-testid="button-add-product">
              <Plus className="w-4 h-4" />
              إضافة منتج جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>إضافة منتج</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">الباركود</label>
                <Input placeholder="امسح أو اكتب الباركود..." value={newProduct.barcode} onChange={e => setNewProduct({...newProduct, barcode: e.target.value})} data-testid="input-product-barcode" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">اسم المنتج</label>
                <Input placeholder="مثال: خاتم فضة 925" value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} data-testid="input-product-name" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">الفئة</label>
                <Select value={newProduct.categoryId} onValueChange={v => setNewProduct({...newProduct, categoryId: v})}>
                  <SelectTrigger><SelectValue placeholder="اختر الفئة" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">السعر (الريال العماني)</label>
                <Input type="number" step="0.001" placeholder="0.000" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} data-testid="input-product-price" />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newProduct.name || !newProduct.price} data-testid="button-save-product">
                {createMutation.isPending ? "جارِ الحفظ..." : "حفظ المنتج"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b flex items-center gap-4">
          <div className="relative w-72">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم أو الباركود..." className="pr-9" value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search-products" />
          </div>
          <Select value={filterCat} onValueChange={setFilterCat}>
            <SelectTrigger className="w-40"><SelectValue placeholder="الفئة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الفئات</SelectItem>
              {categories.map(c => (
                <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>الباركود</TableHead>
              <TableHead>اسم المنتج</TableHead>
              <TableHead>الفئة</TableHead>
              <TableHead>السعر (OMR)</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead className="text-left">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد منتجات</TableCell>
              </TableRow>
            ) : filteredProducts.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-mono text-muted-foreground">{p.barcode || "-"}</TableCell>
                <TableCell className="font-bold">{p.name}</TableCell>
                <TableCell>{getCategoryName(p.categoryId)}</TableCell>
                <TableCell className="font-bold text-primary">{parseFloat(p.price).toFixed(3)}</TableCell>
                <TableCell>
                  <button onClick={() => toggleActiveMutation.mutate({ id: p.id, active: !p.active })}>
                    <Badge variant={p.active ? "default" : "secondary"} className={p.active ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 cursor-pointer" : "cursor-pointer"}>
                      {p.active ? "نشط" : "غير نشط"}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell className="text-left">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => deleteMutation.mutate(p.id)} data-testid={`button-delete-product-${p.id}`}>
                      <Trash className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
