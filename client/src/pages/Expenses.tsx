import { Plus, Receipt, Search, Image as ImageIcon, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const expenses = [
  { id: "EXP-001", date: "2023-10-25", branch: "لوى", category: "إيجار", amount: 350.000, notes: "إيجار شهر أكتوبر", hasReceipt: true },
  { id: "EXP-002", date: "2023-10-24", branch: "شناص", category: "كهرباء", amount: 45.500, notes: "فاتورة الكهرباء", hasReceipt: true },
  { id: "EXP-003", date: "2023-10-22", branch: "الرئيسي", category: "منظفات", amount: 12.000, notes: "أدوات تنظيف للمحل", hasReceipt: false },
];

export default function Expenses() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">المصروفات</h1>
          <p className="text-muted-foreground mt-1">سجل نفقات الفروع التشغيلية والإدارية.</p>
        </div>
        
        <Dialog>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-rose-600 hover:bg-rose-700 text-white">
              <Plus className="w-4 h-4" />
              إضافة مصروف
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>تسجيل مصروف جديد</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">الفرع</label>
                  <Select defaultValue="liwa">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="liwa">لوى</SelectItem>
                      <SelectItem value="shinas">شناص</SelectItem>
                      <SelectItem value="main">المخزن الرئيسي</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">التاريخ</label>
                  <div className="relative">
                    <Input type="date" defaultValue={new Date().toISOString().split('T')[0]} />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">التصنيف</label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="اختر التصنيف" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rent">إيجار</SelectItem>
                      <SelectItem value="electricity">كهرباء / ماء</SelectItem>
                      <SelectItem value="salaries">رواتب</SelectItem>
                      <SelectItem value="maintenance">صيانة</SelectItem>
                      <SelectItem value="cleaning">منظفات</SelectItem>
                      <SelectItem value="other">نثريات أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">المبلغ (OMR)</label>
                  <Input type="number" placeholder="0.000" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">ملاحظات / تفاصيل</label>
                <Input placeholder="اكتب تفاصيل المصروف..." />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">صورة الفاتورة (اختياري)</label>
                <div className="border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 cursor-pointer transition">
                  <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                  <span className="text-sm font-medium">اضغط لرفع الفاتورة</span>
                  <span className="text-xs mt-1 opacity-70">JPG, PNG, PDF</span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full">حفظ المصروف</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border shadow-sm rounded-xl overflow-hidden">
        <div className="p-4 border-b flex items-center gap-4 bg-muted/20">
          <div className="relative w-72">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="بحث في المصروفات..." className="pr-9 bg-background" />
          </div>
          <Select defaultValue="this-month">
            <SelectTrigger className="w-40 bg-background"><SelectValue placeholder="الفترة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="this-month">هذا الشهر</SelectItem>
              <SelectItem value="last-month">الشهر الماضي</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>الرقم</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead>الفرع</TableHead>
              <TableHead>التصنيف</TableHead>
              <TableHead>المبلغ (OMR)</TableHead>
              <TableHead>الملاحظات</TableHead>
              <TableHead className="text-left">الفاتورة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((exp) => (
              <TableRow key={exp.id}>
                <TableCell className="font-mono text-muted-foreground">{exp.id}</TableCell>
                <TableCell>{exp.date}</TableCell>
                <TableCell>{exp.branch}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="bg-muted">
                    {exp.category}
                  </Badge>
                </TableCell>
                <TableCell className="font-bold text-red-600">{exp.amount.toFixed(3)}</TableCell>
                <TableCell className="text-muted-foreground max-w-[200px] truncate" title={exp.notes}>
                  {exp.notes}
                </TableCell>
                <TableCell className="text-left">
                  {exp.hasReceipt ? (
                    <Button variant="ghost" size="sm" className="text-blue-600">
                      <Receipt className="w-4 h-4 ml-1" />
                      عرض
                    </Button>
                  ) : (
                    <span className="text-xs text-muted-foreground px-2">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
