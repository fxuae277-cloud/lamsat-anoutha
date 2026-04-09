-- ============================================================
-- Migration 0010: النظام المالي الكامل — دليل الحسابات الموسع
-- لمسة أنوثة POS/ERP — سلطنة عمان
-- ============================================================

-- ── 1. جدول أرصدة الحسابات (per-branch) ──────────────────────
CREATE TABLE IF NOT EXISTS account_balances (
  id            SERIAL PRIMARY KEY,
  account_id    INTEGER NOT NULL REFERENCES accounts(id),
  branch_id     INTEGER REFERENCES branches(id),
  debit_total   NUMERIC(14,3) NOT NULL DEFAULT 0,
  credit_total  NUMERIC(14,3) NOT NULL DEFAULT 0,
  balance       NUMERIC(14,3) NOT NULL DEFAULT 0,
  updated_at    TIMESTAMP DEFAULT NOW(),
  UNIQUE (account_id, branch_id)
);

-- ── 2. جدول تصنيفات المصروفات ──────────────────────────────────
CREATE TABLE IF NOT EXISTS expense_categories (
  id          SERIAL PRIMARY KEY,
  code        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  account_code TEXT,
  sort_order  INTEGER DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE
);

INSERT INTO expense_categories (code, name, account_code, sort_order) VALUES
  ('supplies',     'مستلزمات (تنظيف وتغليف وأكياس)',   '6700', 1),
  ('rent',         'إيجار',                              '6200', 2),
  ('salary',       'رواتب',                              '6110', 3),
  ('transport',    'مواصلات',                            '6800', 4),
  ('maintenance',  'صيانة',                              '6400', 5),
  ('electricity',  'كهرباء ومياه',                       '6310', 6),
  ('phone',        'اتصالات',                            '6330', 7),
  ('marketing',    'تسويق',                              '6500', 8),
  ('shipping',     'شحن',                                '6600', 9),
  ('taxes',        'ضرائب ورسوم',                        '7300', 10),
  ('other',        'أخرى',                               '6900', 11)
ON CONFLICT (code) DO NOTHING;

-- ── 3. دليل الحسابات الموسع — 7 مجموعات ───────────────────────
-- يستخدم ON CONFLICT DO NOTHING للحفاظ على البيانات الموجودة

INSERT INTO accounts (code, name, name_en, type, level, is_system, active) VALUES

-- ════ 1000 الأصول ════
('1000', 'الأصول',           'Assets',           'asset',     1, TRUE, TRUE),

-- 1100 النقدية والبنوك
('1100', 'النقدية والبنوك',  'Cash & Banks',     'asset',     2, TRUE, TRUE),
('1110', 'صندوق شناص',       'Shinas Cash Box',  'asset',     3, TRUE, TRUE),
('1120', 'صندوق لوى',        'Luwa Cash Box',    'asset',     3, TRUE, TRUE),
('1130', 'حساب بنكي',        'Bank Account',     'asset',     3, TRUE, TRUE),
('1140', 'بطاقات ائتمان',    'Credit Cards',     'asset',     3, TRUE, TRUE),

-- 1200 الذمم المدينة
('1200', 'الذمم المدينة',    'Accounts Receivable','asset',   2, TRUE, TRUE),

-- 1300 المخزون
('1300', 'المخزون',          'Inventory',        'asset',     2, TRUE, TRUE),
('1310', 'مخزون شناص',       'Shinas Inventory', 'asset',     3, TRUE, TRUE),
('1320', 'مخزون لوى',        'Luwa Inventory',   'asset',     3, TRUE, TRUE),

-- 1400 الأصول الثابتة
('1400', 'الأصول الثابتة',   'Fixed Assets',     'asset',     2, TRUE, TRUE),

-- ════ 2000 الخصوم ════
('2000', 'الخصوم',           'Liabilities',      'liability', 1, TRUE, TRUE),

-- 2100 ذمم دائنة موردون
('2100', 'الذمم الدائنة',    'Accounts Payable', 'liability', 2, TRUE, TRUE),

-- 2200 مصروفات مستحقة
('2200', 'مصروفات مستحقة',   'Accrued Expenses', 'liability', 2, TRUE, TRUE),
('2210', 'رواتب مستحقة',     'Accrued Salaries', 'liability', 3, TRUE, TRUE),
('2220', 'إيجار مستحق',      'Accrued Rent',     'liability', 3, TRUE, TRUE),
('2230', 'كهرباء ومياه مستحقة','Accrued Utilities','liability',3, TRUE, TRUE),

-- 2300 ضرائب ورسوم
('2300', 'ضرائب ورسوم',      'Taxes Payable',    'liability', 2, TRUE, TRUE),

-- ════ 3000 حقوق الملكية ════
('3000', 'حقوق الملكية',     'Equity',           'equity',    1, TRUE, TRUE),
('3100', 'رأس المال',        'Capital',          'equity',    2, TRUE, TRUE),
('3200', 'الأرباح المحتجزة', 'Retained Earnings','equity',    2, TRUE, TRUE),
('3300', 'سحوبات المالك',    'Owner Drawings',   'equity',    2, TRUE, TRUE),

-- ════ 4000 الإيرادات ════
('4000', 'الإيرادات',        'Revenue',          'revenue',   1, TRUE, TRUE),
('4100', 'المبيعات',         'Sales',            'revenue',   2, TRUE, TRUE),
('4110', 'مبيعات نقدية',     'Cash Sales',       'revenue',   3, TRUE, TRUE),
('4120', 'مبيعات بطاقة',     'Card Sales',       'revenue',   3, TRUE, TRUE),
('4130', 'مبيعات تحويل بنكي','Bank Transfer Sales','revenue', 3, TRUE, TRUE),
('4200', 'إيرادات أخرى',     'Other Revenue',    'revenue',   2, TRUE, TRUE),
('4300', 'مرتجعات مبيعات',   'Sales Returns',    'revenue',   2, TRUE, TRUE),

-- ════ 5000 تكلفة المبيعات ════
('5000', 'تكلفة المبيعات',   'Cost of Sales',    'expense',   1, TRUE, TRUE),
('5100', 'تكلفة البضاعة المباعة','COGS',          'expense',   2, TRUE, TRUE),
('5110', 'تكلفة مبيعات شناص','Shinas COGS',      'expense',   3, TRUE, TRUE),
('5120', 'تكلفة مبيعات لوى', 'Luwa COGS',        'expense',   3, TRUE, TRUE),
('5200', 'مرتجعات مشتريات',  'Purchase Returns', 'expense',   2, TRUE, TRUE),

-- ════ 6000 المصروفات التشغيلية ════
('6000', 'المصروفات التشغيلية','Operating Expenses','expense', 1, TRUE, TRUE),

-- 6100 الموظفون
('6100', 'مصروفات الموظفين', 'Staff Expenses',   'expense',   2, TRUE, TRUE),
('6110', 'الرواتب',          'Salaries',         'expense',   3, TRUE, TRUE),
('6120', 'التأمينات',        'Insurance',        'expense',   3, TRUE, TRUE),
('6130', 'البدلات',          'Allowances',       'expense',   3, TRUE, TRUE),

-- 6200 الإيجار
('6200', 'إيجار',            'Rent',             'expense',   2, TRUE, TRUE),

-- 6300 المرافق
('6300', 'مرافق',            'Utilities',        'expense',   2, TRUE, TRUE),
('6310', 'كهرباء',           'Electricity',      'expense',   3, TRUE, TRUE),
('6320', 'مياه',             'Water',            'expense',   3, TRUE, TRUE),
('6330', 'اتصالات',          'Communications',   'expense',   3, TRUE, TRUE),

-- 6400-6900
('6400', 'صيانة',            'Maintenance',      'expense',   2, TRUE, TRUE),
('6500', 'تسويق',            'Marketing',        'expense',   2, TRUE, TRUE),
('6600', 'شحن',              'Shipping',         'expense',   2, TRUE, TRUE),
('6700', 'مستلزمات',         'Supplies',         'expense',   2, TRUE, TRUE),
('6800', 'مواصلات',          'Transport',        'expense',   2, TRUE, TRUE),
('6900', 'مصروفات أخرى',     'Other Expenses',   'expense',   2, TRUE, TRUE),

-- ════ 7000 غير تشغيلية ════
('7000', 'غير تشغيلية',      'Non-Operating',    'expense',   1, TRUE, TRUE),
('7100', 'فوائد بنكية',      'Bank Interest',    'expense',   2, TRUE, TRUE),
('7200', 'رسوم بنكية',       'Bank Fees',        'expense',   2, TRUE, TRUE),
('7300', 'ضرائب ورسوم حكومية','Government Taxes', 'expense',   2, TRUE, TRUE)

ON CONFLICT (code) DO NOTHING;

-- ── 4. ربط الحسابات بآبائها (تحديث parent_id) ────────────────
DO $$
DECLARE
  v_id INTEGER;
  v_parent INTEGER;
BEGIN
  -- helper: update parent_id for child given parent code
  FOR v_id, v_parent IN
    SELECT c.id, p.id
    FROM accounts c
    JOIN accounts p ON p.code = CASE c.code
      WHEN '1100' THEN '1000' WHEN '1110' THEN '1100' WHEN '1120' THEN '1100'
      WHEN '1130' THEN '1100' WHEN '1140' THEN '1100'
      WHEN '1200' THEN '1000'
      WHEN '1300' THEN '1000' WHEN '1310' THEN '1300' WHEN '1320' THEN '1300'
      WHEN '1400' THEN '1000'
      WHEN '2100' THEN '2000'
      WHEN '2200' THEN '2000' WHEN '2210' THEN '2200' WHEN '2220' THEN '2200' WHEN '2230' THEN '2200'
      WHEN '2300' THEN '2000'
      WHEN '3100' THEN '3000' WHEN '3200' THEN '3000' WHEN '3300' THEN '3000'
      WHEN '4100' THEN '4000' WHEN '4110' THEN '4100' WHEN '4120' THEN '4100' WHEN '4130' THEN '4100'
      WHEN '4200' THEN '4000' WHEN '4300' THEN '4000'
      WHEN '5100' THEN '5000' WHEN '5110' THEN '5100' WHEN '5120' THEN '5100'
      WHEN '5200' THEN '5000'
      WHEN '6100' THEN '6000' WHEN '6110' THEN '6100' WHEN '6120' THEN '6100' WHEN '6130' THEN '6100'
      WHEN '6200' THEN '6000'
      WHEN '6300' THEN '6000' WHEN '6310' THEN '6300' WHEN '6320' THEN '6300' WHEN '6330' THEN '6300'
      WHEN '6400' THEN '6000' WHEN '6500' THEN '6000' WHEN '6600' THEN '6000'
      WHEN '6700' THEN '6000' WHEN '6800' THEN '6000' WHEN '6900' THEN '6000'
      WHEN '7100' THEN '7000' WHEN '7200' THEN '7000' WHEN '7300' THEN '7000'
      ELSE NULL
    END
    WHERE c.code IN (
      '1100','1110','1120','1130','1140','1200','1300','1310','1320','1400',
      '2100','2200','2210','2220','2230','2300',
      '3100','3200','3300',
      '4100','4110','4120','4130','4200','4300',
      '5100','5110','5120','5200',
      '6100','6110','6120','6130','6200','6300','6310','6320','6330',
      '6400','6500','6600','6700','6800','6900',
      '7100','7200','7300'
    )
  LOOP
    UPDATE accounts SET parent_id = v_parent WHERE id = v_id;
  END LOOP;
END $$;

-- ── 5. الحسابات القديمة المتوافقة مع autoJournal.ts ──────────
-- الحفاظ على الأكواد المستخدمة: 1101, 1102, 1301, 1401, 2101, 4100, 4200, 5100, 5200, 5400
-- ملاحظة: 1101, 1102 موجودان كالصندوق والبنك العام (يُبقى كما هو)
INSERT INTO accounts (code, name, name_en, type, level, is_system, active) VALUES
  ('1101', 'الصندوق (عام)',    'Cash General',   'asset',     3, TRUE, TRUE),
  ('1102', 'البنك (عام)',      'Bank General',   'asset',     3, TRUE, TRUE),
  ('1401', 'سلف الموظفين',    'Employee Advances','asset',   2, TRUE, TRUE)
ON CONFLICT (code) DO NOTHING;

-- ربط 1101, 1102 بـ 1100
DO $$
DECLARE p1100 INTEGER;
BEGIN
  SELECT id INTO p1100 FROM accounts WHERE code = '1100';
  IF p1100 IS NOT NULL THEN
    UPDATE accounts SET parent_id = p1100 WHERE code IN ('1101','1102') AND parent_id IS NULL;
  END IF;
END $$;
