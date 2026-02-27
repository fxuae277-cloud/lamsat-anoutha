import { Plus, Search, Edit, Trash, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const products = [
  { id: "1001", barcode: "893456789012", name: "عقد ذهبي وردي", category: "عقود", price: 12.000, status: "نشط" },
  { id: "1002", barcode: "893456789013", name: "إسورة لؤلؤ زراعي", category: "أساور", price: 8.500, status: "نشط" },
  { id: "1003", barcode: "893456789014", name: "طقم زفاف ناعم", category: "أطقم", price: 45.000, status: "غير نشط" },
];

export default function Products() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">المنتجات والأسعار</h1>
          <p className="text-muted-foreground mt-1">إدارة قائمة المنتجات وتوحيد الأسعار لجميع الفروع.</p>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              إضافة منتج جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>إضافة منتج</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2 flex justify-center mb-4">
                <div className="w-32 h-32 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/30 text-muted-foreground cursor-pointer hover:bg-muted transition">
                  <div className="flex flex-col items-center gap-2">
                    <ImageIcon className="w-6 h-6" />
                    <span className="text-xs">رفع صورة</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">الباركود</label>
                <Input placeholder="امسح أو اكتب الباركود..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">اسم المنتج</label>
                <Input placeholder="مثال: خاتم فضة 925" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">الفئة</label>
                <Select>
                  <SelectTrigger><SelectValue placeholder="اختر الفئة" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="c1">عقود</SelectItem>
                    <SelectItem value="c2">أساور</SelectItem>
                    <SelectItem value="c3">خواتم</SelectItem>
                    <SelectItem value="c4">أطقم</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">السعر (الريال العماني)</label>
                <Input type="number" placeholder="0.000" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit">حفظ المنتج</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b flex items-center gap-4">
          <div className="relative w-72">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث بالاسم أو الباركود..." className="pr-9" />
          </div>
          <Select defaultValue="all">
            <SelectTrigger className="w-40"><SelectValue placeholder="الفئة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الفئات</SelectItem>
              <SelectItem value="c1">عقود</SelectItem>
              <SelectItem value="c2">أساور</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="w-16">الصورة</TableHead>
              <TableHead>الباركود</TableHead>
              <TableHead>اسم المنتج</TableHead>
              <TableHead>الفئة</TableHead>
              <TableHead>السعر (OMR)</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead className="text-left">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center text-muted-foreground">
                    <ImageIcon className="w-5 h-5 opacity-50" />
                  </div>
                </TableCell>
                <TableCell className="font-mono text-muted-foreground">{p.barcode}</TableCell>
                <TableCell className="font-bold">{p.name}</TableCell>
                <TableCell>{p.category}</TableCell>
                <TableCell className="font-bold text-primary">{p.price.toFixed(3)}</TableCell>
                <TableCell>
                  <Badge variant={p.status === "نشط" ? "default" : "secondary"} className={p.status === "نشط" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}>
                    {p.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-left">
                  <div className="flex items-center justify-end gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50">
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
