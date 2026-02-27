import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

export default function Settings() {
  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-bold">الإعدادات العامة</h1>
        <p className="text-muted-foreground mt-1">تكوين إعدادات النظام، الفروع، والضرائب.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">إعدادات المنشأة</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>اسم المنشأة التجاري</Label>
              <Input defaultValue="لمسة أنوثة إكسسوارات لوى" />
            </div>
            <div className="space-y-2">
              <Label>رقم التسجيل التجاري</Label>
              <Input defaultValue="123456789" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>العملة الافتراضية</Label>
              <Input defaultValue="ريال عماني (OMR)" disabled />
            </div>
            <div className="space-y-2">
              <Label>الرقم الضريبي (VAT)</Label>
              <Input defaultValue="OM-987654321" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">الضرائب</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="text-base">تطبيق ضريبة القيمة المضافة (VAT)</Label>
              <p className="text-sm text-muted-foreground">سيتم احتساب الضريبة تلقائياً في نقطة البيع.</p>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-bold">5%</span>
              <Switch defaultChecked />
            </div>
          </div>
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <Label className="text-base">الأسعار تشمل الضريبة</Label>
              <p className="text-sm text-muted-foreground">هل الأسعار المدخلة للمنتجات تتضمن الضريبة مسبقاً؟</p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">الفروع النشطة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { name: "لمسة أنوثة - لوى (الرئيسي)", address: "ولاية لوى، الشارع العام" },
              { name: "لمسة أنوثة - شناص", address: "ولاية شناص، بجوار المركز الصحي" },
              { name: "الفرع الثالث (قيد التجهيز)", address: "-" },
            ].map((branch, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-muted/30 border rounded-lg">
                <div>
                  <p className="font-bold">{branch.name}</p>
                  <p className="text-sm text-muted-foreground">{branch.address}</p>
                </div>
                <Button variant="outline" size="sm">تعديل</Button>
              </div>
            ))}
            <Button className="w-full mt-2" variant="secondary">إضافة فرع جديد</Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button variant="outline">إلغاء التغييرات</Button>
        <Button>حفظ الإعدادات</Button>
      </div>
    </div>
  );
}
