import { toast } from "@/hooks/use-toast";

export function usePayrollToast() {
  return {
    successAdd(name?: string) {
      toast({
        title: "تمت الإضافة",
        description: name
          ? `تمت إضافة الحركة المالية للموظف "${name}" بنجاح`
          : "تمت إضافة الحركة المالية بنجاح",
      });
    },

    successCancel(name?: string) {
      toast({
        title: "تم الإلغاء",
        description: name
          ? `تم إلغاء الحركة المالية للموظف "${name}"`
          : "تم إلغاء الحركة المالية",
        variant: "destructive",
      });
    },

    successPayment(name?: string, amount?: string) {
      toast({
        title: "تم تسجيل الدفعة",
        description:
          name && amount
            ? `تم دفع ${amount} للموظف "${name}" بنجاح`
            : "تم تسجيل الدفعة بنجاح",
      });
    },

    successBulkPay(count: number) {
      toast({
        title: "تم الدفع الجماعي",
        description: `تم صرف رواتب ${count} موظف بنجاح`,
      });
    },

    errorGeneric(msg?: string) {
      toast({
        title: "حدث خطأ",
        description: msg ?? "يرجى التحقق من البيانات والمحاولة مرة أخرى",
        variant: "destructive",
      });
    },

    errorInsufficientAmount() {
      toast({
        title: "مبلغ غير صحيح",
        description: "يرجى إدخال مبلغ أكبر من صفر",
        variant: "destructive",
      });
    },
  };
}
