-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 0011: نظام الأدوار والصلاحيات الدقيقة
-- ═══════════════════════════════════════════════════════════════════════════

-- ── جدول الأدوار ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS roles (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── جدول الصلاحيات ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS permissions (
  id         SERIAL PRIMARY KEY,
  code       VARCHAR(100) UNIQUE NOT NULL,
  name       VARCHAR(200) NOT NULL,
  category   VARCHAR(100) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ربط الأدوار بالصلاحيات ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id       INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ── سجل كلمات المرور السابقة (آخر 5) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_history (
  id            SERIAL PRIMARY KEY,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── أعمدة جديدة في جدول المستخدمين ──────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_id           INTEGER REFERENCES roles(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until      TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login        TIMESTAMPTZ;

-- ═══════════════════════════════════════════════════════════════════════════
-- البذر: الأدوار
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO roles (name, description) VALUES
  ('owner', 'المالك — صلاحية كاملة على جميع أقسام النظام'),
  ('sales', 'البيع — صلاحيات محدودة: نقطة البيع والفواتير والعملاء فقط')
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- البذر: الصلاحيات (39 صلاحية في 8 فئات)
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO permissions (code, name, category) VALUES
-- ── المبيعات ───────────────────────────────────────────────────────────────
('pos.access',        'دخول نقطة البيع',            'sales'),
('invoice.create',    'إنشاء فاتورة',               'sales'),
('invoice.edit',      'تعديل فاتورة',               'sales'),
('invoice.delete',    'حذف فاتورة',                 'sales'),
('invoice.return',    'إرجاع فاتورة',               'sales'),
('invoice.print',     'طباعة فاتورة',               'sales'),
('discount.apply',    'تطبيق خصومات',               'sales'),
-- ── المنتجات ───────────────────────────────────────────────────────────────
('products.view',     'عرض المنتجات',               'products'),
('products.create',   'إضافة منتج',                 'products'),
('products.edit',     'تعديل منتج',                 'products'),
('products.delete',   'حذف منتج',                   'products'),
('categories.manage', 'إدارة الفئات',               'products'),
-- ── المخزون ────────────────────────────────────────────────────────────────
('inventory.view',    'عرض المخزون',                'inventory'),
('inventory.edit',    'تعديل كميات المخزون',        'inventory'),
('inventory.transfer','تحويل بين الفروع',           'inventory'),
('inventory.count',   'جرد وتسويات',                'inventory'),
-- ── المشتريات ──────────────────────────────────────────────────────────────
('purchases.view',    'عرض المشتريات',              'purchases'),
('purchases.create',  'إنشاء فواتير شراء',          'purchases'),
('purchases.edit',    'تعديل فواتير الشراء',        'purchases'),
('purchases.delete',  'حذف فواتير الشراء',          'purchases'),
('suppliers.manage',  'إدارة الموردين',              'purchases'),
-- ── المالية ────────────────────────────────────────────────────────────────
('expenses.create',   'تسجيل مصروف',               'finance'),
('expenses.edit',     'تعديل مصروف',               'finance'),
('expenses.delete',   'حذف مصروف',                  'finance'),
('cash.deposit',      'إيداع في الصندوق',           'finance'),
('cash.withdraw',     'سحب من الصندوق',             'finance'),
('shift.open',        'فتح وردية',                  'finance'),
('shift.close',       'إغلاق وردية',                'finance'),
('reports.view',      'عرض التقارير',               'finance'),
('reports.export',    'تصدير التقارير',             'finance'),
-- ── العملاء ────────────────────────────────────────────────────────────────
('customers.view',    'عرض العملاء',                'customers'),
('customers.create',  'إضافة عميل',                 'customers'),
('customers.edit',    'تعديل بيانات العميل',        'customers'),
('customers.delete',  'حذف عميل',                   'customers'),
-- ── الإدارة ────────────────────────────────────────────────────────────────
('users.manage',      'إدارة المستخدمين',           'admin'),
('branches.manage',   'إدارة الفروع',               'admin'),
('settings.manage',   'الإعدادات العامة',            'admin'),
('audit.view',        'سجل المراجعة',               'admin'),
('payroll.manage',    'إدارة الرواتب',              'admin')
ON CONFLICT (code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- المالك: كل الصلاحيات
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r CROSS JOIN permissions p
WHERE r.name = 'owner'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- البيع: 10 صلاحيات فقط
-- ═══════════════════════════════════════════════════════════════════════════
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.code IN (
  'pos.access',
  'invoice.create',
  'invoice.return',
  'invoice.print',
  'products.view',
  'inventory.view',
  'customers.view',
  'customers.create',
  'shift.open',
  'reports.view'
)
WHERE r.name = 'sales'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- تحديث role_id للمستخدمين الحاليين
-- ═══════════════════════════════════════════════════════════════════════════
UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'owner')
WHERE role IN ('owner', 'admin') AND role_id IS NULL;

UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'sales')
WHERE role NOT IN ('owner', 'admin') AND role_id IS NULL;

-- نسخ كلمات المرور الحالية إلى سجل التاريخ
INSERT INTO password_history (user_id, password_hash)
SELECT id, password FROM users
ON CONFLICT DO NOTHING;
