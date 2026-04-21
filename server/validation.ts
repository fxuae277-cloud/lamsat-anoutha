import { z } from "zod";

// ── Arabic field name map ─────────────────────────────────────────────────────
const FIELD_NAMES_AR: Record<string, string> = {
  name:               "الاسم",
  username:           "اسم المستخدم",
  password:           "كلمة المرور",
  newPassword:        "كلمة المرور الجديدة",
  role:               "الدور الوظيفي",
  branchId:           "الفرع",
  phone:              "رقم الهاتف",
  pin:                "رقم PIN",
  salary:             "الراتب",
  price:              "السعر",
  unitPrice:          "سعر الوحدة",
  costDefault:        "التكلفة الافتراضية",
  barcode:            "الباركود",
  sku:                "رمز SKU",
  productId:          "المنتج",
  productName:        "اسم المنتج",
  quantity:           "الكمية",
  total:              "الإجمالي",
  amount:             "المبلغ",
  categoryId:         "الفئة",
  orderNumber:        "رقم الطلب",
  customerName:       "اسم العميل",
  customerPhone:      "هاتف العميل",
  status:             "الحالة",
  terminalName:       "اسم الطرفية",
  productType:        "نوع المنتج",
  unitOfMeasure:      "وحدة القياس",
  isComposite:        "منتج مركب",
  unitCostBase:       "تكلفة الوحدة الأساسية",
  supplierId:         "المورد",
  invoiceDate:        "تاريخ الفاتورة",
  description:        "الوصف",
  image:              "الصورة",
  isActive:           "الحالة",
  parentId:           "الفئة الأب",
  sortOrder:          "الترتيب",
};

// ── Arabic error formatter ────────────────────────────────────────────────────
export function formatZodError(error: z.ZodError): string {
  const first = error.errors[0];
  const fieldKey = first.path.at(-1) as string | undefined;
  const fieldAr = fieldKey ? (FIELD_NAMES_AR[fieldKey] ?? fieldKey) : "";
  const prefix = fieldAr ? `${fieldAr}: ` : "";

  switch (first.code) {
    case "too_small":
      if (first.type === "string")
        return `${prefix}يجب أن يحتوي على ${first.minimum} حرف على الأقل`;
      return `${prefix}يجب أن تكون القيمة ${first.minimum} على الأقل`;
    case "too_big":
      if (first.type === "string")
        return `${prefix}الحد الأقصى ${first.maximum} حرفاً`;
      return `${prefix}يجب أن تكون القيمة ${first.maximum} كحد أقصى`;
    case "invalid_type":
      if (first.received === "undefined") return `${prefix}هذا الحقل مطلوب`;
      return `${prefix}نوع البيانات غير صحيح`;
    case "invalid_enum_value":
      return first.message;
    case "invalid_string":
      return `${prefix}التنسيق غير صحيح`;
    default:
      return first.message || `${prefix}قيمة غير صالحة`;
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const loginSchema = z.object({
  username: z.string({ required_error: "اسم المستخدم مطلوب" }).min(1, "اسم المستخدم مطلوب").max(100),
  password: z.string({ required_error: "كلمة المرور مطلوبة" }).min(1, "كلمة المرور مطلوبة").max(200),
});

// ── Users ─────────────────────────────────────────────────────────────────────
export const createUserSchema = z.object({
  name:         z.string({ required_error: "الاسم مطلوب" }).min(2, "الاسم يجب أن يحتوي على حرفين على الأقل"),
  username:     z.string({ required_error: "اسم المستخدم مطلوب" })
                  .min(3, "اسم المستخدم 3 أحرف على الأقل")
                  .max(30, "اسم المستخدم 30 حرفاً كحد أقصى")
                  .regex(/^[a-zA-Z0-9_]+$/, "اسم المستخدم: أحرف إنجليزية وأرقام وشرطة سفلية فقط"),
  password:     z.string({ required_error: "كلمة المرور مطلوبة" }).min(6, "كلمة المرور 6 أحرف على الأقل"),
  role:         z.enum(["owner", "admin", "manager", "cashier", "employee"], {
                  errorMap: () => ({ message: "الدور الوظيفي غير صالح" }),
                }).optional(),
  branchId:     z.number().int().positive("يجب تحديد الفرع").optional().nullable(),
  terminalName: z.string().optional().nullable(),
  isActive:     z.boolean().optional(),
  pin:          z.string().regex(/^[0-9]{4,6}$/, "PIN يجب أن يكون 4-6 أرقام").optional().nullable(),
  phone:        z.string().optional().nullable(),
  salary:       z.coerce.number().min(0, "الراتب لا يمكن أن يكون سالباً").optional(),
});

export const updateUserSchema = createUserSchema
  .omit({ password: true })
  .partial();

// ── Products ──────────────────────────────────────────────────────────────────
export const updateProductSchema = z.object({
  name:         z.string().min(2, "الاسم يجب أن يحتوي على حرفين على الأقل").optional(),
  categoryId:   z.number().int().positive().optional().nullable(),
  price:        z.coerce.number().min(0, "السعر لا يمكن أن يكون سالباً").optional(),
  unitCostBase: z.coerce.number().min(0).optional(),
  barcode:      z.string().max(50, "الباركود 50 حرفاً كحد أقصى").optional().nullable().transform(v => v === "" ? null : v),
  active:       z.boolean().optional(),
  image:        z.string().optional().nullable(),
  branchId:     z.number().int().positive().optional().nullable(),
  description:  z.string().max(1000).optional().nullable(),
  costDefault:  z.coerce.number().min(0).optional().nullable(),
  minQty:       z.coerce.number().int().min(0).optional().nullable(),
  modelNumber:  z.string().max(100).optional().nullable().transform(v => v === "" ? null : v),
});

// ── Product Variants ──────────────────────────────────────────────────────────
export const createProductVariantSchema = z.object({
  price:        z.coerce.number({ required_error: "السعر مطلوب" }).min(0, "السعر لا يمكن أن يكون سالباً"),
  barcode:      z.string().max(50, "الباركود 50 حرفاً كحد أقصى").optional().nullable(),
  sku:          z.string().max(50, "رمز SKU 50 حرفاً كحد أقصى").optional().nullable(),
  color:        z.string().optional().nullable(),
  size:         z.string().optional().nullable(),
  costDefault:  z.coerce.number().min(0).optional().nullable(),
  active:       z.boolean().optional(),
});

export const updateProductVariantSchema = createProductVariantSchema.partial();

export const quickCreateVariantSchema = z.object({
  productName:  z.string({ required_error: "اسم المنتج مطلوب" }).min(1, "اسم المنتج مطلوب"),
  categoryId:   z.number().int().positive().optional().nullable(),
  barcode:      z.string().max(50).optional().nullable(),
  sku:          z.string().max(50).optional().nullable(),
  color:        z.string().optional().nullable(),
  size:         z.string().optional().nullable(),
  price:        z.coerce.number().min(0).optional(),
  costDefault:  z.coerce.number().min(0).optional().nullable(),
});

// ── Categories ────────────────────────────────────────────────────────────────
export const createCategorySchema = z.object({
  name:        z.string({ required_error: "الاسم مطلوب" }).min(2, "الاسم يجب أن يحتوي على حرفين على الأقل").max(100),
  description: z.string().max(500).optional().nullable(),
  image:       z.string().optional().nullable(),
  parentId:    z.number().int().positive().optional().nullable(),
  isActive:    z.boolean().optional().default(true),
  sortOrder:   z.number().int().min(0).optional().default(0),
});
export const updateCategorySchema = createCategorySchema.partial();

// ── Customers ─────────────────────────────────────────────────────────────────
export const updateCustomerSchema = z.object({
  name:     z.string().min(2, "الاسم يجب أن يحتوي على حرفين على الأقل").optional(),
  phone:    z.string().regex(/^[0-9+\s\-]{7,15}$/, "رقم الهاتف غير صالح").optional().nullable(),
  notes:    z.string().optional().nullable(),
  active:   z.boolean().optional(),
  branchId: z.number().int().positive().optional().nullable(),
});

// ── Products (create) ─────────────────────────────────────────────────────────
export const createProductSchema = z.object({
  name:          z.string({ required_error: "الاسم مطلوب" }).min(2, "الاسم يجب أن يحتوي على حرفين على الأقل"),
  price:         z.coerce.number({ required_error: "السعر مطلوب" }).min(0, "السعر لا يمكن أن يكون سالباً"),
  barcode:       z.string().max(50, "الباركود 50 حرفاً كحد أقصى").optional().nullable().transform(v => v === "" ? null : v),
  categoryId:    z.number().int().positive().optional().nullable(),
  branchId:      z.number().int().positive().optional().nullable(),
  productType:   z.enum(["simple", "variable", "composite"]).default("simple"),
  unitOfMeasure: z.string().default("piece"),
  isComposite:   z.boolean().default(false),
  active:        z.boolean().optional().default(true),
  image:         z.string().optional().nullable(),
  description:   z.string().max(1000).optional().nullable(),
  costDefault:   z.coerce.number().min(0).optional().nullable(),
  minQty:        z.coerce.number().int().min(0).optional().nullable(),
  modelNumber:   z.string().max(100).optional().nullable().transform(v => v === "" ? null : v),
  variants: z.array(z.object({
    price:       z.coerce.number().min(0, "السعر لا يمكن أن يكون سالباً"),
    barcode:     z.string().max(50).optional().nullable(),
    sku:         z.string().max(50).optional().nullable(),
    color:       z.string().optional().nullable(),
    size:        z.string().optional().nullable(),
    costDefault: z.coerce.number().min(0).optional().nullable(),
    isDefault:   z.boolean().optional(),
  })).optional().default([]),
});

// ── Purchase Items ────────────────────────────────────────────────────────────
export const addPurchaseItemSchema = z.object({
  productId:    z.number({ required_error: "المنتج مطلوب" }).int().positive("رقم المنتج يجب أن يكون موجباً"),
  qty:          z.number({ required_error: "الكمية مطلوبة" }).int().min(1, "الكمية يجب أن تكون 1 على الأقل"),
  unitCostBase: z.coerce.number({ required_error: "تكلفة الوحدة مطلوبة" }).min(0, "التكلفة لا يمكن أن تكون سالبة"),
  variantId:    z.number().int().positive().optional().nullable(),
});

// ── Purchase Status ───────────────────────────────────────────────────────────
export const patchPurchaseStatusSchema = z.object({
  status: z.enum(["approved", "received"], {
    errorMap: () => ({ message: "الحالة غير صالحة. القيم المسموحة: approved, received" }),
  }),
  note: z.string().optional(),
});

// ── Orders ────────────────────────────────────────────────────────────────────
export const orderItemSchema = z.object({
  productId: z.number({ required_error: "المنتج مطلوب" }).int().positive("رقم المنتج يجب أن يكون موجباً"),
  quantity:  z.number({ required_error: "الكمية مطلوبة" }).int().min(1, "الكمية يجب أن تكون 1 على الأقل"),
  unitPrice: z.coerce.number().min(0, "سعر الوحدة لا يمكن أن يكون سالباً"),
  total:     z.coerce.number().min(0).optional(),
});

export const orderStatusSchema = z.object({
  status: z.enum(["new", "processing", "ready", "completed", "paid", "cancelled"], {
    errorMap: () => ({ message: "حالة الطلب غير صالحة. القيم المسموحة: new, processing, ready, completed, paid, cancelled" }),
  }),
});
