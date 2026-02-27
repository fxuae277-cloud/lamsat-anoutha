import { ArrowLeftRight, PackagePlus, AlertCircle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

const inventory = [
  { id: "1001", name: "عقد ذهبي وردي", main: 150, branch1: 20, branch2: 15, total: 185 },
  { id: "1002", name: "إسورة لؤلؤ زراعي", main: 80, branch1: 5, branch2: 0, total: 85, alert: true },
  { id: "1003", name: "طقم زفاف ناعم", main: 10, branch1: 2, branch2: 1, total: 13 },
];

export default function Inventory() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">إدارة المخزون</h1>
          <p className="text-muted-foreground mt-1">تتبع الكميات في المخزن الرئيسي وفروع البيع.</p>
        </div>
        
        <div className="flex gap-3">
          <Button variant="outline" className="gap-2">
            <PackagePlus className="w-4 h-4" />
            استلام بضاعة (رئيسي)
          </Button>
          
          <Dialog>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <ArrowLeftRight className="w-4 h-4" />
                تحويل مخزون لفرع
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>تحويل مخزون من الرئيسي إلى فرع</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">الفرع المستلم</label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="b1">لمسة أنوثة - لوى</SelectItem>
                      <SelectItem value="b2">لمسة أنوثة - شناص</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">المنتج (بحث بالباركود)</label>
                  <Input placeholder="امسح الباركود..." autoFocus />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">الكمية المحولة</label>
                  <Input type="number" placeholder="1" />
                </div>
              </div>
              <DialogFooter>
                <Button>تأكيد التحويل</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">إجمالي القطع</p>
              <h3 className="text-2xl font-bold mt-1">1,452</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">المخزن الرئيسي</p>
              <h3 className="text-2xl font-bold mt-1">980</h3>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">فرع لوى</p>
              <h3 className="text-2xl font-bold mt-1">240</h3>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-red-50 border-red-100">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-600">نواقص تحتاج إعادة طلب</p>
              <h3 className="text-2xl font-bold text-red-700 mt-1">12</h3>
            </div>
            <AlertCircle className="text-red-400 w-8 h-8 opacity-50" />
          </CardContent>
        </Card>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden mt-6">
        <div className="p-4 border-b flex items-center gap-4">
          <div className="relative w-72">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث في المخزون..." className="pr-9" />
          </div>
        </div>
        
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>رقم المنتج</TableHead>
              <TableHead>الاسم</TableHead>
              <TableHead className="text-center bg-primary/5">المخزن الرئيسي</TableHead>
              <TableHead className="text-center">فرع لوى</TableHead>
              <TableHead className="text-center">فرع شناص</TableHead>
              <TableHead className="text-center font-bold">الإجمالي</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventory.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-muted-foreground">#{item.id}</TableCell>
                <TableCell className="font-bold flex items-center gap-2">
                  {item.name}
                  {item.alert && <span className="flex h-2 w-2 rounded-full bg-red-600"></span>}
                </TableCell>
                <TableCell className="text-center font-medium bg-primary/5">{item.main}</TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {item.branch1 <= 5 ? <span className="text-red-500 font-bold">{item.branch1}</span> : item.branch1}
                </TableCell>
                <TableCell className="text-center text-muted-foreground">
                  {item.branch2 <= 5 ? <span className="text-red-500 font-bold">{item.branch2}</span> : item.branch2}
                </TableCell>
                <TableCell className="text-center font-bold text-lg">{item.total}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
