// Error code registry — single source of truth for all API error messages.
// Each entry maps a code → { ar, en, status }.
// Usage:
//   throw new AppError("PRODUCT_NOT_FOUND");
//   return res.status(404).json(errJson("PRODUCT_NOT_FOUND", getLang(req)));

export const ERROR_REGISTRY = {
  // ── Auth ──────────────────────────────────────────────────────────────────
  INVALID_CREDENTIALS:          { status: 401, ar: "اسم المستخدم أو كلمة المرور غير صحيحة",              en: "Invalid username or password" },
  ACCOUNT_LOCKED:               { status: 403, ar: "الحساب مقفل مؤقتاً. حاول مجدداً بعد {{minutes}} دقيقة", en: "Account temporarily locked. Try again in {{minutes}} minute(s)" },
  ACCOUNT_DISABLED:             { status: 403, ar: "الحساب معطّل",                                          en: "Account is disabled" },
  SESSION_SAVE_FAILED:          { status: 500, ar: "خطأ في حفظ الجلسة",                                    en: "Failed to save session" },
  LOGGED_OUT:                   { status: 200, ar: "تم تسجيل الخروج",                                       en: "Logged out successfully" },
  UNAUTHENTICATED:              { status: 401, ar: "غير مصرح - يجب تسجيل الدخول",                          en: "Authentication required" },
  PERMISSION_DENIED:            { status: 403, ar: "ليس لديك صلاحية تنفيذ هذا الإجراء",                    en: "Permission denied" },
  OWNER_ONLY:                   { status: 403, ar: "فقط المالك يمكنه تنفيذ هذا الإجراء",                    en: "Only the owner can perform this action" },
  MANAGER_ONLY:                 { status: 403, ar: "غير مصرح لك. هذه العملية للمدير فقط.",                  en: "Not authorized. Manager access required." },

  // ── Users ─────────────────────────────────────────────────────────────────
  USER_NOT_FOUND:               { status: 404, ar: "المستخدم غير موجود",                                    en: "User not found" },
  USERNAME_TAKEN:               { status: 409, ar: "اسم المستخدم مستخدم بالفعل",                             en: "Username already taken" },
  PIN_TAKEN:                    { status: 409, ar: "رقم PIN مستخدم بالفعل من موظف آخر",                      en: "PIN already used by another employee" },
  PIN_TAKEN_SHORT:              { status: 409, ar: "رقم PIN مستخدم بالفعل",                                  en: "PIN already in use" },
  PIN_REQUIRED:                 { status: 400, ar: "رقم PIN مطلوب",                                          en: "PIN is required" },
  INVALID_PIN:                  { status: 401, ar: "رقم PIN غير صحيح",                                       en: "Invalid PIN" },
  WRONG_PASSWORD:               { status: 401, ar: "كلمة المرور القديمة غير صحيحة",                          en: "Current password is incorrect" },
  PASSWORD_FIELDS_REQUIRED:     { status: 400, ar: "كلمة المرور القديمة والجديدة مطلوبتان",                  en: "Old and new passwords are required" },
  PASSWORD_TOO_SHORT:           { status: 400, ar: "كلمة المرور يجب أن تكون 6 أحرف على الأقل",               en: "Password must be at least 6 characters" },
  NEW_PASSWORD_TOO_SHORT:       { status: 400, ar: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل",       en: "New password must be at least 6 characters" },
  PASSWORD_CHANGED:             { status: 200, ar: "تم تغيير كلمة المرور بنجاح",                             en: "Password changed successfully" },
  PASSWORD_RESET:               { status: 200, ar: "تم إعادة تعيين كلمة المرور بنجاح",                       en: "Password reset successfully" },
  CANNOT_DELETE_SELF:           { status: 400, ar: "لا يمكنك حذف حسابك الخاص",                               en: "Cannot delete your own account" },
  CANNOT_DEACTIVATE_OWNER:      { status: 400, ar: "لا يمكن تعطيل حساب المالك",                               en: "Cannot deactivate the owner account" },
  CANNOT_DELETE_OWNER:          { status: 400, ar: "لا يمكن حذف حساب المالك",                                en: "Cannot delete the owner account" },
  OWNER_PERMISSIONS_IMMUTABLE:  { status: 403, ar: "لا يمكن تعديل صلاحيات المالك",                           en: "Owner permissions cannot be modified" },
  UPDATE_FAILED:                { status: 404, ar: "فشل التحديث",                                             en: "Update failed" },
  ROLE_ID_REQUIRED:             { status: 400, ar: "roleId مطلوب",                                            en: "roleId is required" },

  // ── Branches ──────────────────────────────────────────────────────────────
  BRANCH_NOT_FOUND:             { status: 404, ar: "لم يتم العثور على الفرع",                                en: "Branch not found" },
  BRANCH_DELETE_FAILED:         { status: 400, ar: "لا يمكن حذف الفرع",                                     en: "Cannot delete branch" },
  INVALID_BRANCH_ID:            { status: 400, ar: "branchId غير صالح",                                      en: "Invalid branch ID" },
  BRANCH_ID_REQUIRED:           { status: 400, ar: "branchId مطلوب",                                         en: "branchId is required" },

  // ── Categories ────────────────────────────────────────────────────────────
  CATEGORY_NOT_FOUND:           { status: 404, ar: "الفئة غير موجودة",                                       en: "Category not found" },

  // ── Products ──────────────────────────────────────────────────────────────
  PRODUCT_NOT_FOUND:            { status: 404, ar: "المنتج غير موجود",                                       en: "Product not found" },
  DUPLICATE_PRODUCT_NAME:       { status: 409, ar: "يوجد منتج بنفس الاسم بالفعل",                             en: "A product with this name already exists" },
  DUPLICATE_BARCODE:            { status: 409, ar: "الباركود مستخدم بالفعل",                                  en: "Barcode already in use" },
  DUPLICATE_SKU:                { status: 409, ar: "رمز SKU مستخدم بالفعل",                                   en: "SKU already in use" },
  BARCODE_NOT_FOUND:            { status: 404, ar: "الباركود غير موجود",                                      en: "Barcode not found" },
  PRODUCT_CREATE_FAILED:        { status: 500, ar: "خطأ في إنشاء المنتج",                                     en: "Failed to create product" },
  PRODUCT_UPDATE_FAILED:        { status: 500, ar: "خطأ في تحديث المنتج",                                     en: "Failed to update product" },
  PRODUCT_DELETED:              { status: 200, ar: "تم حذف المنتج",                                           en: "Product deleted" },
  PRODUCT_DELETE_FAILED:        { status: 500, ar: "فشل حذف المنتج",                                          en: "Failed to delete product" },
  PRODUCT_INSUFFICIENT_STOCK:   { status: 400, ar: "مخزون المنتج غير كافٍ",                                   en: "Insufficient stock for product" },

  // ── Variants ──────────────────────────────────────────────────────────────
  VARIANT_NOT_FOUND:            { status: 404, ar: "المتغير غير موجود",                                       en: "Variant not found" },
  VARIANT_DELETED:              { status: 200, ar: "تم حذف المتغير",                                          en: "Variant deleted" },
  VARIANT_IN_USE:               { status: 400, ar: "لا يمكن حذف المتغير لأنه مستخدم في طلبات أو مخزون",        en: "Cannot delete variant — referenced by orders or inventory" },
  VARIANT_DELETE_FAILED:        { status: 500, ar: "خطأ في حذف المتغير",                                      en: "Failed to delete variant" },

  // ── Transfers / Inventory ─────────────────────────────────────────────────
  LOCATION_NOT_FOUND:           { status: 404, ar: "الموقع غير موجود",                                       en: "Location not found" },
  TRANSFER_NOT_FOUND:           { status: 404, ar: "التحويل غير موجود",                                      en: "Transfer not found" },
  TRANSFER_NOT_EDITABLE:        { status: 400, ar: "لا يمكن التعديل على هذا التحويل",                          en: "Transfer cannot be edited in its current state" },
  TRANSFER_NO_ITEMS:            { status: 400, ar: "لم يتم تحديد أصناف للتحويل",                               en: "No items selected for transfer" },
  TRANSFER_COMMIT_FAILED:       { status: 400, ar: "فشل اعتماد التحويل",                                      en: "Failed to commit transfer" },
  TRANSFER_APPROVE_FAILED:      { status: 400, ar: "لا يمكن اعتماد التحويل",                                  en: "Cannot approve transfer" },
  INSUFFICIENT_STOCK:           { status: 400, ar: "الكمية غير كافية",                                        en: "Insufficient stock" },
  NO_CENTRAL_WAREHOUSE:         { status: 400, ar: "لا يوجد مخزن مركزي",                                      en: "No central warehouse configured" },
  TRANSFER_DELETED:             { status: 200, ar: "تم الحذف",                                                en: "Deleted successfully" },
  INVALID_MOVEMENT_TYPE:        { status: 400, ar: "نوع حركة غير صالح",                                       en: "Invalid movement type" },

  // ── Orders / Invoices / POS ───────────────────────────────────────────────
  ORDER_NOT_FOUND:              { status: 404, ar: "الطلب غير موجود",                                         en: "Order not found" },
  ORDER_NOT_DELIVERED:          { status: 400, ar: "الطلب يجب أن يكون في حالة 'تم التسليم' أولاً",            en: "Order must be in 'delivered' status first" },
  ORDER_ALREADY_INVOICED:       { status: 400, ar: "الطلب محول لفاتورة مسبقاً",                               en: "Order already converted to an invoice" },
  ORDER_NO_ITEMS:               { status: 400, ar: "الطلب لا يحتوي على منتجات",                               en: "Order has no items" },
  CART_EMPTY:                   { status: 400, ar: "السلة فارغة",                                              en: "Cart is empty" },
  PENDING_INVOICE_NOT_FOUND:    { status: 404, ar: "الفاتورة المعلقة غير موجودة",                             en: "Pending invoice not found" },
  INVALID_STATUS:               { status: 400, ar: "حالة غير صالحة",                                          en: "Invalid status" },
  UNSUPPORTED_TYPE:             { status: 400, ar: "نوع غير مدعوم",                                           en: "Unsupported type" },
  UNSUPPORTED_TABLE:            { status: 400, ar: "جدول غير مدعوم",                                          en: "Unsupported table" },
  CANCELLED_BY_REQUIRED:        { status: 400, ar: "cancelledBy مطلوب",                                       en: "cancelledBy is required" },

  // ── Shifts / Finance ─────────────────────────────────────────────────────
  MONTH_YEAR_REQUIRED:          { status: 400, ar: "الشهر والسنة مطلوبة",                                     en: "Month and year are required" },
  DATE_RANGE_REQUIRED:          { status: 400, ar: "from & to مطلوبان (YYYY-MM-DD)",                           en: "from & to are required (YYYY-MM-DD)" },
  DATE_REQUIRED:                { status: 400, ar: "date مطلوب",                                               en: "date is required" },
  ACCOUNT_ID_REQUIRED:          { status: 400, ar: "يجب تحديد الحساب",                                        en: "Account ID is required" },

  // ── Accounting ────────────────────────────────────────────────────────────
  ACCOUNT_NOT_FOUND:            { status: 404, ar: "الحساب غير موجود",                                        en: "Account not found" },
  ACCOUNT_CODE_DUPLICATE:       { status: 400, ar: "رمز الحساب موجود مسبقاً",                                  en: "Account code already exists" },
  ACCOUNT_FIELDS_REQUIRED:      { status: 400, ar: "بيانات الحساب ناقصة (code, name, type مطلوبة)",            en: "Account fields required (code, name, type)" },
  JOURNAL_ENTRY_NOT_FOUND:      { status: 404, ar: "القيد غير موجود",                                          en: "Journal entry not found" },
  JOURNAL_ENTRY_INVALID:        { status: 400, ar: "القيد يجب أن يحتوي على تاريخ ووصف وسطرين على الأقل",       en: "Journal entry must have a date, description, and at least 2 lines" },
  JOURNAL_ENTRY_UNBALANCED:     { status: 400, ar: "القيد غير متوازن - المدين لا يساوي الدائن",                en: "Journal entry is unbalanced — debits must equal credits" },
  JOURNAL_POST_FAILED:          { status: 400, ar: "خطأ في ترحيل القيد",                                       en: "Failed to post journal entry" },

  // ── Employees / Payroll ───────────────────────────────────────────────────
  EMPLOYEE_NOT_FOUND:           { status: 404, ar: "الموظف غير موجود",                                        en: "Employee not found" },
  OWNER_ONLY_OPENING_BALANCES:  { status: 403, ar: "فقط المالك يمكنه تعديل الأرصدة الافتتاحية",                en: "Only the owner can modify opening balances" },

  // ── Roles ─────────────────────────────────────────────────────────────────
  ROLE_NOT_FOUND:               { status: 404, ar: "الدور غير موجود",                                         en: "Role not found" },
  PERMISSIONS_ARRAY_REQUIRED:   { status: 400, ar: "permissionIds يجب أن يكون مصفوفة",                        en: "permissionIds must be an array" },

  // ── Generic ───────────────────────────────────────────────────────────────
  MISSING_FIELDS:               { status: 400, ar: "بيانات ناقصة",                                            en: "Missing required fields" },
  INVALID_TYPE:                 { status: 400, ar: "نوع غير صالح",                                            en: "Invalid type" },
  FETCH_ERROR:                  { status: 500, ar: "خطأ في جلب البيانات",                                     en: "Failed to fetch data" },
  INTERNAL_ERROR:               { status: 500, ar: "خطأ في الخادم",                                           en: "Internal server error" },
  MIGRATION_FAILED:             { status: 500, ar: "خطأ في تشغيل المايجريشن",                                  en: "Migration failed" },
  QZ_KEY_MISSING:               { status: 500, ar: "QZ_PRIVATE_KEY غير مضبوط في إعدادات الخادم",               en: "QZ_PRIVATE_KEY is not configured on the server" },
  REQUEST_STRING_REQUIRED:      { status: 400, ar: "request string مطلوب",                                    en: "Request string is required" },
} as const;

export type ErrorCode = keyof typeof ERROR_REGISTRY;

// ── Helpers ───────────────────────────────────────────────────────────────────

export function errMsg(
  code: ErrorCode,
  lang: "ar" | "en" = "ar",
  subs?: Record<string, string | number>
): string {
  const entry = ERROR_REGISTRY[code];
  if (!entry) return code;
  let msg: string = entry[lang] ?? entry.ar;
  if (subs) {
    for (const [k, v] of Object.entries(subs)) {
      msg = msg.replace(`{{${k}}}`, String(v));
    }
  }
  return msg;
}

export function errStatus(code: ErrorCode): number {
  return ERROR_REGISTRY[code]?.status ?? 500;
}

/** Build a JSON body for an inline res.json() call */
export function errJson(
  code: ErrorCode,
  lang: "ar" | "en" = "ar",
  subs?: Record<string, string | number>
): { success: false; message: string; code: ErrorCode } {
  return { success: false, message: errMsg(code, lang, subs), code };
}
