/**
 * Phase D: Migrate routes.ts Arabic error messages to errJson() error codes.
 * Run: node scripts/migrate-routes-errors.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, "..", "server", "routes.ts");

let src = readFileSync(filePath, "utf-8");

// ── 1. Add imports if not present ────────────────────────────────────────────
if (!src.includes("from \"./lib/errorCodes\"")) {
  src = src.replace(
    `import { registerExportRoutes } from "./exports";`,
    `import { getLang } from "./middleware/errorHandler";\nimport { errJson } from "./lib/errorCodes";\nimport { registerExportRoutes } from "./exports";`
  );
}

// ── 2. formatZodError: add getLang(req) arg ───────────────────────────────────
src = src.replace(/formatZodError\(parsed\.error\)/g, "formatZodError(parsed.error, getLang(req))");
// Also handle item-level formatZodError in itemParsed contexts
src = src.replace(/formatZodError\(itemParsed\.error\)/g, "formatZodError(itemParsed.error, getLang(req))");

// ── 3. Error message mapping ──────────────────────────────────────────────────
// Maps exact Arabic message strings → errJson("CODE", getLang(req))
// Pattern matched: { message: "ARABIC" }  or  { message: "ARABIC", ...}
// (only the message value is replaced, surrounding res.status(N).json() kept)

const MSG_MAP = /** @type {[string, string][]} */ ([
  // ── Auth ──────────────────────────────────────────────────────────────────
  ["غير مصرح",                                           "UNAUTHENTICATED"],
  ["غير مسجل دخول",                                      "UNAUTHENTICATED"],
  // ── Users ─────────────────────────────────────────────────────────────────
  ["المستخدم غير موجود",                                 "USER_NOT_FOUND"],
  ["اسم المستخدم مستخدم بالفعل",                        "USERNAME_TAKEN"],
  ["اسم المستخدم أو كلمة المرور غير صحيحة",             "INVALID_CREDENTIALS"],
  ["الحساب معطّل",                                       "ACCOUNT_DISABLED"],
  ["رقم PIN مطلوب",                                     "PIN_REQUIRED"],
  ["رقم PIN مستخدم بالفعل من موظف آخر",                  "PIN_TAKEN"],
  ["رقم PIN مستخدم بالفعل",                              "PIN_TAKEN_SHORT"],
  ["رقم PIN غير صحيح",                                  "INVALID_PIN"],
  ["رقم الهاتف مستخدم بالفعل",                          "PHONE_TAKEN"],
  ["تم تغيير كلمة المرور بنجاح",                        "PASSWORD_CHANGED"],
  ["تم إعادة تعيين كلمة المرور بنجاح",                  "PASSWORD_RESET"],
  ["roleId مطلوب",                                      "ROLE_ID_REQUIRED"],
  // ── Branches ──────────────────────────────────────────────────────────────
  ["branchId مطلوب",                                    "BRANCH_ID_REQUIRED"],
  ["الفرع مطلوب",                                       "BRANCH_ID_REQUIRED"],
  ["branchId غير صالح",                                 "INVALID_BRANCH_ID"],
  // ── Categories ────────────────────────────────────────────────────────────
  ["الفئة غير موجودة",                                   "CATEGORY_NOT_FOUND"],
  // ── Products ──────────────────────────────────────────────────────────────
  ["المنتج غير موجود",                                   "PRODUCT_NOT_FOUND"],
  ["الباركود مستخدم بالفعل",                             "DUPLICATE_BARCODE"],
  ["رمز SKU مستخدم بالفعل",                              "DUPLICATE_SKU"],
  ["الباركود غير موجود",                                 "BARCODE_NOT_FOUND"],
  ["يوجد منتج بنفس الاسم بالفعل",                        "DUPLICATE_PRODUCT_NAME"],
  ["تم حذف المنتج",                                     "PRODUCT_DELETED"],
  // ── Variants ──────────────────────────────────────────────────────────────
  ["المتغير غير موجود",                                  "VARIANT_NOT_FOUND"],
  ["تم حذف المتغير",                                     "VARIANT_DELETED"],
  // ── Customers ─────────────────────────────────────────────────────────────
  ["العميل غير موجود",                                   "CUSTOMER_NOT_FOUND"],
  // ── Suppliers ─────────────────────────────────────────────────────────────
  ["المورد غير موجود",                                   "SUPPLIER_NOT_FOUND"],
  ["يوجد مورد بنفس الاسم",                               "DUPLICATE_SUPPLIER"],
  // ── Purchases ─────────────────────────────────────────────────────────────
  ["فاتورة المشتريات غير موجودة",                        "PURCHASE_NOT_FOUND"],
  // ── Employees ─────────────────────────────────────────────────────────────
  ["الموظف غير موجود",                                   "EMPLOYEE_NOT_FOUND"],
  ["تفاصيل الراتب غير موجودة",                           "SALARY_NOT_FOUND"],
  ["يوجد خصم متكرر بنفس السبب لنفس الفترة",              "DUPLICATE_DEDUCTION"],
  // ── Shifts ────────────────────────────────────────────────────────────────
  ["الوردية غير موجودة",                                 "SHIFT_NOT_FOUND"],
  ["الشفت غير موجود",                                   "SHIFT_NOT_FOUND"],
  // ── Transfers / Inventory ─────────────────────────────────────────────────
  ["التحويل غير موجود",                                  "TRANSFER_NOT_FOUND"],
  ["الموقع غير موجود",                                   "LOCATION_NOT_FOUND"],
  ["الصنف غير موجود",                                   "PRODUCT_NOT_FOUND"],
  ["العنصر غير موجود",                                   "PRODUCT_NOT_FOUND"],
  ["لا يوجد موقع نشط للفرع المحدد",                      "NO_ACTIVE_LOCATION"],
  ["الكمية الناتجة لا يمكن أن تكون سالبة",               "INSUFFICIENT_STOCK"],
  ["تم الحذف",                                          "TRANSFER_DELETED"],
  ["تم النقل بنجاح",                                    "TRANSFER_COMPLETED"],
  ["تم إضافة البضاعة",                                  "INVENTORY_ADDED"],
  // ── Orders / Invoices ─────────────────────────────────────────────────────
  ["الطلب غير موجود",                                   "ORDER_NOT_FOUND"],
  ["الطلب يجب أن يكون في حالة 'تم التسليم' أولاً",      "ORDER_NOT_DELIVERED"],
  ["الطلب محول لفاتورة مسبقاً",                          "ORDER_ALREADY_INVOICED"],
  ["الطلب لا يحتوي على منتجات",                          "ORDER_NO_ITEMS"],
  ["السلة فارغة",                                        "CART_EMPTY"],
  ["الفاتورة المعلقة غير موجودة",                        "PENDING_INVOICE_NOT_FOUND"],
  ["الفاتورة غير موجودة",                                "PENDING_INVOICE_NOT_FOUND"],
  ["يمكن اعتماد الفواتير بحالة (pending) فقط",           "INVALID_STATUS"],
  ["طريقة الدفع غير مسموحة",                            "INVALID_STATUS"],
  ["طريقة الدفع غير صالحة. الخيارات: cash, card, bank_transfer", "INVALID_STATUS"],
  ["cancelledBy مطلوب",                                  "CANCELLED_BY_REQUIRED"],
  ["سبب الإلغاء مطلوب",                                  "CANCELLED_BY_REQUIRED"],
  // ── Finance / Accounting ─────────────────────────────────────────────────
  ["الشهر والسنة مطلوبة",                               "MONTH_YEAR_REQUIRED"],
  ["month و year مطلوبان",                               "MONTH_YEAR_REQUIRED"],
  ["التاريخ مطلوب بصيغة YYYY-MM-DD (from & to)",         "DATE_RANGE_REQUIRED"],
  ["from & to مطلوبان (YYYY-MM-DD)",                      "DATE_RANGE_REQUIRED"],
  ["from & to مطلوبان",                                   "DATE_RANGE_REQUIRED"],
  ["التاريخ مطلوب بصيغة YYYY-MM-DD",                     "DATE_REQUIRED"],
  ["المصروف غير موجود",                                  "EXPENSE_NOT_FOUND"],
  ["المرتجع غير موجود",                                  "RETURN_NOT_FOUND"],
  ["القيد غير موجود",                                   "JOURNAL_ENTRY_NOT_FOUND"],
  ["القيد يجب أن يحتوي على تاريخ ووصف وسطرين على الأقل", "JOURNAL_ENTRY_INVALID"],
  ["القيد غير متوازن - المدين لا يساوي الدائن",          "JOURNAL_ENTRY_UNBALANCED"],
  ["الحساب غير موجود",                                  "ACCOUNT_NOT_FOUND"],
  ["رمز الحساب موجود مسبقاً",                            "ACCOUNT_CODE_DUPLICATE"],
  ["يجب تحديد الحساب",                                  "ACCOUNT_ID_REQUIRED"],
  // ── Roles ─────────────────────────────────────────────────────────────────
  ["الدور غير موجود",                                   "ROLE_NOT_FOUND"],
  ["permissionIds يجب أن يكون مصفوفة",                   "PERMISSIONS_ARRAY_REQUIRED"],
  // ── Generic ───────────────────────────────────────────────────────────────
  ["بيانات ناقصة",                                      "MISSING_FIELDS"],
  ["البيانات ناقصة أو غير صحيحة",                        "MISSING_FIELDS"],
  ["بيانات المستخدم ناقصة",                              "MISSING_FIELDS"],
  ["بيانات المستخدم ناقصة (الفرع أو الجهاز)",            "MISSING_FIELDS"],
  ["بيانات المستخدم ناقصة (الفرع)",                       "MISSING_FIELDS"],
  ["اسم المورد مطلوب",                                  "MISSING_FIELDS"],
  ["تاريخ الفاتورة مطلوب",                               "MISSING_FIELDS"],
  ["shiftId مطلوب",                                     "MISSING_FIELDS"],
  ["يجب إدخال المبلغ النقدي الفعلي (actualCash)",        "MISSING_FIELDS"],
  ["النقد الافتتاحي مطلوب ولا يقل عن الصفر",             "MISSING_FIELDS"],
  ["المبلغ مطلوب",                                      "MISSING_FIELDS"],
  ["المبلغ مطلوب ويجب أن يكون أكبر من صفر",              "MISSING_FIELDS"],
  ["المبلغ يجب أن يكون أكبر من صفر",                     "MISSING_FIELDS"],
  ["الكمية المعدودة مطلوبة",                             "MISSING_FIELDS"],
  ["الفرع والمنتج والكمية والسبب مطلوبة",                "MISSING_FIELDS"],
  ["المستخدم غير مرتبط بفرع",                           "BRANCH_ID_REQUIRED"],
  ["يجب تحديد عناصر المرتجع",                           "MISSING_FIELDS"],
  ["id مطلوب",                                          "MISSING_FIELDS"],
  ["csvText مطلوب",                                     "MISSING_FIELDS"],
  ["entryId غير صالح",                                  "MISSING_FIELDS"],
  ["date, type, amount مطلوبة",                          "MISSING_FIELDS"],
  ["request string مطلوب",                              "REQUEST_STRING_REQUIRED"],
  ["حالة غير صالحة",                                    "INVALID_STATUS"],
  ["نوع غير صالح",                                      "INVALID_TYPE"],
  ["نوع غير مدعوم",                                     "UNSUPPORTED_TYPE"],
  ["جدول غير مدعوم",                                    "UNSUPPORTED_TABLE"],
  ["يجب اعتماد الفاتورة أولاً قبل الاستلام",             "INVALID_STATUS"],
  ["خطأ في جلب الفاتورة",                                "FETCH_ERROR"],
  ["تم تسجيل الخروج",                                   "LOGGED_OUT"],
  // ── Auth/Password ──────────────────────────────────────────────────────────
  ["كلمة المرور القديمة والجديدة مطلوبتان",              "PASSWORD_FIELDS_REQUIRED"],
  ["كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل",  "NEW_PASSWORD_TOO_SHORT"],
  ["كلمة المرور القديمة غير صحيحة",                     "WRONG_PASSWORD"],
  ["كلمة المرور يجب أن تكون 6 أحرف على الأقل",          "PASSWORD_TOO_SHORT"],
  // ── Branches ──────────────────────────────────────────────────────────────
  ["لم يتم العثور على الفرع",                           "BRANCH_NOT_FOUND"],
  // ── Variants ──────────────────────────────────────────────────────────────
  ["لا يمكن حذف المتغير لأنه مستخدم في طلبات أو مخزون", "VARIANT_IN_USE"],
  // ── Transfers ─────────────────────────────────────────────────────────────
  ["لا يمكن التعديل",                                   "TRANSFER_NOT_EDITABLE"],
  ["لم يتم تحديد أصناف للتحويل",                        "TRANSFER_NO_ITEMS"],
  ["فشل اعتماد التحويل",                                "TRANSFER_COMMIT_FAILED"],
  ["لا يمكن اعتماد التحويل",                            "TRANSFER_APPROVE_FAILED"],
  ["لا يوجد مخزن مركزي",                                "NO_CENTRAL_WAREHOUSE"],
  // ── Orders / Sales ────────────────────────────────────────────────────────
  ["لا توجد منتجات في الفاتورة",                        "CART_EMPTY"],
  ["لا توجد منتجات في الطلب",                           "ORDER_NO_ITEMS"],
  ["ليس لديك صلاحية إلغاء الطلبات",                     "PERMISSION_DENIED"],
  ["طريقة دفع غير صحيحة",                              "INVALID_STATUS"],
  ["مصدر غير صالح. الخيارات: cash, card, bank_transfer", "INVALID_TYPE"],
  // ── Shifts ────────────────────────────────────────────────────────────────
  ["لا يمكن تعديل النقد الافتتاحي لوردية مغلقة",        "INVALID_STATUS"],
  // ── Purchases ─────────────────────────────────────────────────────────────
  ["لا يمكن تعديل فاتورة معتمدة أو ملغاة",              "INVALID_STATUS"],
  ["لا يمكن إضافة أصناف لفاتورة معتمدة أو مستلمة",      "INVALID_STATUS"],
  ["لا يمكن تعديل أصناف فاتورة معتمدة أو ملغاة",        "INVALID_STATUS"],
  ["لا يمكن حذف أصناف من فاتورة معتمدة أو ملغاة",       "INVALID_STATUS"],
  // ── Stocktake ─────────────────────────────────────────────────────────────
  ["لا يمكن اعتماد هذا الجرد",                          "INVALID_STATUS"],
  // ── Payroll ───────────────────────────────────────────────────────────────
  ["كشف الرواتب غير موجود",                             "PAYROLL_NOT_FOUND"],
  ["لا يمكن إعادة احتساب كشف معتمد",                    "INVALID_STATUS"],
  ["لا يمكن اعتماد هذا الكشف",                          "INVALID_STATUS"],
  ["لا يمكن مراجعة هذا الكشف",                          "INVALID_STATUS"],
  ["فقط المالك يمكنه إعادة فتح الكشف",                  "OWNER_ONLY"],
  ["لا يمكن إعادة فتح هذا الكشف",                       "INVALID_STATUS"],
  ["فقط المالك يمكنه إلغاء الكشف",                      "OWNER_ONLY"],
  ["لا يمكن إلغاء هذا الكشف",                           "INVALID_STATUS"],
  ["لا يمكن الدفع إلا لكشف معتمد أو تمت مراجعته",       "INVALID_STATUS"],
  // ── Users ─────────────────────────────────────────────────────────────────
  ["فقط المالك يمكنه تعديل الأرصدة الافتتاحية",         "OWNER_ONLY_OPENING_BALANCES"],
  ["لا يمكن تعديل صلاحيات المالك",                      "OWNER_PERMISSIONS_IMMUTABLE"],
  ["لا يمكن تعطيل حساب المالك",                         "CANNOT_DEACTIVATE_OWNER"],
  ["فشل التحديث",                                       "UPDATE_FAILED"],
  ["لا يمكنك حذف حسابك الخاص",                          "CANNOT_DELETE_SELF"],
  ["لا يمكن حذف حساب المالك",                           "CANNOT_DELETE_OWNER"],
]);

// Apply replacements: { message: "ARABIC" }  →  errJson("CODE", getLang(req))
// Also handle: { success: false, message: "ARABIC" }  and { ok: false, message: "ARABIC" }
for (const [arabic, code] of MSG_MAP) {
  const escaped = arabic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  // { message: "ARABIC" }
  const re1 = new RegExp(`\\{\\s*message:\\s*"${escaped}"\\s*\\}`, "g");
  src = src.replace(re1, `errJson("${code}", getLang(req))`);

  // { success: false, message: "ARABIC" }
  const re2 = new RegExp(`\\{\\s*success:\\s*false,\\s*message:\\s*"${escaped}"\\s*\\}`, "g");
  src = src.replace(re2, `errJson("${code}", getLang(req))`);

  // { ok: false, message: "ARABIC" }
  const re3 = new RegExp(`\\{\\s*ok:\\s*false,\\s*message:\\s*"${escaped}"\\s*\\}`, "g");
  src = src.replace(re3, `errJson("${code}", getLang(req))`);
}

// ── 4. Generic catch-block fallbacks ─────────────────────────────────────────
// { message: err?.message ?? "Arabic fallback" }  →  errJson("INTERNAL_ERROR", getLang(req))
src = src.replace(
  /\{\s*message:\s*err\?\.message\s*\?\?\s*"[^"]*"\s*\}/g,
  `errJson("INTERNAL_ERROR", getLang(req))`
);
// { success: false, message: err?.message ?? "..." }
src = src.replace(
  /\{\s*success:\s*false,\s*message:\s*err\?\.message\s*\?\?\s*"[^"]*"\s*\}/g,
  `errJson("INTERNAL_ERROR", getLang(req))`
);

// ── 5. Write result ───────────────────────────────────────────────────────────
writeFileSync(filePath, src, "utf-8");

// ── 6. Report remaining Arabic patterns ──────────────────────────────────────
const lines = src.split("\n");
let remaining = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (/message:\s*"[^"]*[؀-ۿ][^"]*"/.test(line) && !line.includes("success: true")) {
    remaining++;
    console.log(`  Line ${i + 1}: ${line.trim()}`);
  }
}
console.log(`\nDone. Remaining Arabic message patterns: ${remaining}`);
