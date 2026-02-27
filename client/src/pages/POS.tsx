import { useState } from "react";
import { Search, Plus, Minus, Trash2, Printer, CheckCircle2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";

const DUMMY_PRODUCTS = [
  { id: 1, name: "عقد ذهبي وردي", price: 12.000, category: "عقود", image: "🌸" },
  { id: 2, name: "إسورة لؤلؤ", price: 8.500, category: "أساور", image: "✨" },
  { id: 3, name: "حلق ألماس صناعي", price: 5.000, category: "حلقان", image: "💎" },
  { id: 4, name: "طقم زفاف ناعم", price: 45.000, category: "أطقم", image: "👑" },
  { id: 5, name: "خاتم فضة 925", price: 15.000, category: "خواتم", image: "💍" },
  { id: 6, name: "سلسال فراشة", price: 6.500, category: "عقود", image: "🦋" },
];

export default function POS() {
  const [cart, setCart] = useState<{product: any, qty: number}[]>([
    { product: DUMMY_PRODUCTS[0], qty: 1 }
  ]);
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.qty), 0);
  const vat = subtotal * 0.05;
  const total = subtotal + vat;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-4">
      {/* Top Bar Settings */}
      <div className="bg-card p-4 rounded-xl shadow-sm border border-border flex items-center justify-between shrink-0">
        <div className="flex gap-4 items-center">
          <div className="w-48">
            <Select defaultValue="branch1">
              <SelectTrigger>
                <SelectValue placeholder="اختر الفرع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="branch1">لمسة أنوثة - لوى</SelectItem>
                <SelectItem value="branch2">لمسة أنوثة - شناص</SelectItem>
                <SelectItem value="branch3">الفرع الثالث</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-48">
            <Select defaultValue="cashier1">
              <SelectTrigger>
                <SelectValue placeholder="الكاشير" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cashier1">مريم</SelectItem>
                <SelectItem value="cashier2">فاطمة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Button variant="outline" className="gap-2">
            إغلاق الوردية
          </Button>
        </div>
      </div>

      {/* POS Main Area */}
      <div className="flex gap-6 h-full min-h-0">
        {/* Products Section */}
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <div className="relative shrink-0">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input 
              placeholder="امسح الباركود واضغط Enter أو ابحث بالاسم..." 
              className="pr-10 h-12 text-lg bg-card shadow-sm border-transparent focus-visible:ring-primary"
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 shrink-0 hide-scrollbar">
            {["الكل", "عقود", "أساور", "خواتم", "حلقان", "أطقم"].map(cat => (
              <Button key={cat} variant={cat === "الكل" ? "default" : "secondary"} className="rounded-full">
                {cat}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pb-4 content-start">
            {DUMMY_PRODUCTS.map(p => (
              <button 
                key={p.id} 
                onClick={() => {
                  const existing = cart.find(i => i.product.id === p.id);
                  if (existing) {
                    setCart(cart.map(i => i.product.id === p.id ? {...i, qty: i.qty + 1} : i));
                  } else {
                    setCart([...cart, {product: p, qty: 1}]);
                  }
                }}
                className="bg-card hover:bg-accent hover:border-primary/50 transition-all border border-transparent p-4 rounded-xl shadow-sm flex flex-col items-center gap-3 text-center active:scale-95"
              >
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-3xl">
                  {p.image}
                </div>
                <div>
                  <h3 className="font-semibold text-sm line-clamp-1">{p.name}</h3>
                  <p className="text-primary font-bold mt-1">{p.price.toFixed(3)} OMR</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Cart Section */}
        <div className="w-96 bg-card border border-border shadow-sm rounded-xl flex flex-col shrink-0 overflow-hidden">
          <div className="p-4 border-b border-border bg-muted/30">
            <h2 className="font-bold text-lg">سلة المشتريات</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                <ShoppingCart className="w-12 h-12 opacity-20" />
                <p>السلة فارغة</p>
              </div>
            ) : (
              <div className="space-y-2">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 bg-background border rounded-lg">
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center text-xl">
                      {item.product.image}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold truncate">{item.product.name}</h4>
                      <div className="text-xs text-muted-foreground">{item.product.price.toFixed(3)} OMR</div>
                    </div>
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1 bg-muted rounded-md p-0.5">
                        <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-background"><Plus className="w-3 h-3"/></button>
                        <span className="w-6 text-center text-sm font-medium">{item.qty}</span>
                        <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-background"><Minus className="w-3 h-3"/></button>
                      </div>
                    </div>
                    <button className="text-red-500 p-2 hover:bg-red-50 rounded-md">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 bg-muted/10 border-t border-border space-y-3">
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">المجموع الفرعي:</span>
                <span className="font-medium">{subtotal.toFixed(3)} OMR</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">الخصم:</span>
                <span className="text-green-600">0.000 OMR</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">ضريبة القيمة المضافة (5%):</span>
                <span>{vat.toFixed(3)} OMR</span>
              </div>
            </div>
            
            <div className="pt-3 border-t border-border flex justify-between items-center">
              <span className="font-bold text-lg">الإجمالي:</span>
              <span className="font-bold text-2xl text-primary">{total.toFixed(3)} OMR</span>
            </div>

            <Dialog>
              <DialogTrigger asChild>
                <Button className="w-full h-12 text-lg font-bold mt-2" disabled={cart.length === 0}>
                  دفع وإنهاء
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>إتمام الدفع</DialogTitle>
                </DialogHeader>
                <div className="py-4 space-y-6">
                  <div className="text-center p-4 bg-primary/5 rounded-xl border border-primary/20">
                    <p className="text-sm text-muted-foreground mb-1">المبلغ المطلوب</p>
                    <p className="text-3xl font-bold text-primary">{total.toFixed(3)} OMR</p>
                  </div>
                  
                  <div className="space-y-3">
                    <label className="text-sm font-medium">طريقة الدفع</label>
                    <div className="grid grid-cols-2 gap-3">
                      <Button 
                        variant={paymentMethod === "cash" ? "default" : "outline"} 
                        onClick={() => setPaymentMethod("cash")}
                        className="h-12"
                      >
                        نقداً
                      </Button>
                      <Button 
                        variant={paymentMethod === "bank" ? "default" : "outline"} 
                        onClick={() => setPaymentMethod("bank")}
                        className="h-12"
                      >
                        تحويل بنكي
                      </Button>
                    </div>
                  </div>

                  {paymentMethod === "bank" && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium">رقم العملية (Txn ID)</label>
                        <Input placeholder="أدخل رقم التحويل..." />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">صورة الإيصال</label>
                        <div className="border-2 border-dashed border-border rounded-xl p-6 flex flex-col items-center justify-center text-muted-foreground hover:bg-muted/50 transition-colors cursor-pointer">
                          <ImageIcon className="w-8 h-8 mb-2 opacity-50" />
                          <span className="text-sm">اضغط لرفع صورة الإيصال</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button className="w-full h-12 gap-2 text-lg">
                    <CheckCircle2 className="w-5 h-5" />
                    تأكيد الدفع وطباعة
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
}
