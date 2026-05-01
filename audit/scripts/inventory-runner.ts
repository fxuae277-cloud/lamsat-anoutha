#!/usr/bin/env tsx
/**
 * Phase 3: Inventory Audit Runner
 * يفحص سلامة المخزون ويولّد ملف الجرد الفعلي
 */
import { query, withTransaction, closePool } from "./db-connect.js";
import * as fs from "fs";
import * as path from "path";

const REPORT_DIR = path.join(process.cwd(), "audit", "reports");
const startTime = Date.now();

interface InventoryDiscrepancy {
  product_id: number;
  name: string;
  barcode: string | null;
  products_stock_qty: number;
  location_sum: number;
  diff: number;
}

interface NegativeInventory {
  product_id: number;
  name: string;
  location_name: string;
  qty_on_hand: number;
  cost_impact_omr: number;
}

async function checkStockQtyVsLocationSum(): Promise<InventoryDiscrepancy[]> {
  console.log("\n📁 I1: products.stock_qty vs SUM(location_inventory.qty_on_hand)");

  const { rows } = await query<InventoryDiscrepancy>(`
    SELECT p.id AS product_id, p.name, p.barcode,
           p.stock_qty AS products_stock_qty,
           COALESCE(SUM(li.qty_on_hand), 0)::int AS location_sum,
           (p.stock_qty - COALESCE(SUM(li.qty_on_hand), 0))::int AS diff
    FROM products p
    LEFT JOIN location_inventory li ON li.product_id = p.id
    WHERE p.active = true
    GROUP BY p.id, p.name, p.barcode, p.stock_qty
    HAVING p.stock_qty != COALESCE(SUM(li.qty_on_hand), 0)
    ORDER BY ABS(p.stock_qty - COALESCE(SUM(li.qty_on_hand), 0)) DESC
  `);

  if (rows.length === 0) {
    console.log("  ✅ لا توجد فروق — المخزون متزامن تماماً");
  } else {
    console.log(`  ❌ ${rows.length} منتج بفرق في المخزون:`);
    rows.slice(0, 10).forEach((r) => {
      console.log(`    - ${r.name} (ID:${r.product_id}): system=${r.products_stock_qty}, locations=${r.location_sum}, diff=${r.diff}`);
    });
  }
  return rows;
}

async function checkNegativeInventory(): Promise<NegativeInventory[]> {
  console.log("\n📁 D1: مخزون سالب");

  const { rows } = await query<NegativeInventory>(`
    SELECT p.id AS product_id, p.name, l.name AS location_name,
           li.qty_on_hand,
           ROUND(ABS(li.qty_on_hand) * COALESCE(p.avg_cost::decimal, 0), 3)::float AS cost_impact_omr
    FROM location_inventory li
    JOIN products p ON li.product_id = p.id
    JOIN locations l ON l.id = li.location_id
    WHERE li.qty_on_hand < 0
    ORDER BY li.qty_on_hand
  `);

  if (rows.length === 0) {
    console.log("  ✅ لا يوجد مخزون سالب");
  } else {
    const totalImpact = rows.reduce((s, r) => s + r.cost_impact_omr, 0);
    console.log(`  ❌ ${rows.length} سجل بمخزون سالب | التأثير المالي: ${totalImpact.toFixed(3)} OMR`);
    rows.forEach((r) => {
      console.log(`    - ${r.name} @ ${r.location_name}: ${r.qty_on_hand} وحدة (${r.cost_impact_omr} OMR)`);
    });
  }
  return rows;
}

async function getInventorySummary() {
  console.log("\n📁 I2: قيمة المخزون الإجمالية");

  const { rows } = await query<{
    products_count: number;
    total_units: number;
    inventory_cost_value_omr: string;
    inventory_retail_value_omr: string;
    potential_gross_profit_omr: string;
  }>(`
    SELECT
      COUNT(DISTINCT p.id)::int AS products_count,
      SUM(p.stock_qty)::int AS total_units,
      ROUND(SUM(p.stock_qty * COALESCE(p.avg_cost::decimal, p.cost_default::decimal, 0)), 3) AS inventory_cost_value_omr,
      ROUND(SUM(p.stock_qty * p.price::decimal), 3) AS inventory_retail_value_omr,
      ROUND(SUM(p.stock_qty * p.price::decimal) - SUM(p.stock_qty * COALESCE(p.avg_cost::decimal, 0)), 3) AS potential_gross_profit_omr
    FROM products p WHERE p.active = true AND p.stock_qty > 0
  `);

  if (rows[0]) {
    const r = rows[0];
    console.log(`  📦 المنتجات: ${r.products_count} | الوحدات: ${r.total_units}`);
    console.log(`  💰 قيمة التكلفة: ${r.inventory_cost_value_omr} OMR`);
    console.log(`  🏷️  قيمة البيع: ${r.inventory_retail_value_omr} OMR`);
    console.log(`  📈 ربح محتمل: ${r.potential_gross_profit_omr} OMR`);
  }
  return rows[0];
}

async function getSlowMovingProducts() {
  console.log("\n📁 I3: منتجات بطيئة الحركة (>90 يوم)");

  const { rows } = await query<{
    id: number; name: string; stock_qty: number;
    stuck_cost_omr: number; last_sale_date: string | null;
    days_since_last_sale: number | null;
  }>(`
    SELECT p.id, p.name,
           p.stock_qty,
           ROUND(COALESCE(p.avg_cost::decimal, 0) * p.stock_qty, 3)::float AS stuck_cost_omr,
           MAX(s.created_at)::date::text AS last_sale_date,
           (CURRENT_DATE - MAX(s.created_at)::date)::int AS days_since_last_sale
    FROM products p
    LEFT JOIN sale_items si ON si.product_id = p.id
    LEFT JOIN sales s ON s.id = si.sale_id AND s.status != 'cancelled'
    WHERE p.active = true AND p.stock_qty > 0
    GROUP BY p.id, p.name, p.stock_qty, p.avg_cost
    HAVING (MAX(s.created_at) IS NULL OR MAX(s.created_at) < NOW() - INTERVAL '90 days')
    ORDER BY stuck_cost_omr DESC
    LIMIT 20
  `);

  console.log(`  ⚠️  ${rows.length} منتج بطيء الحركة`);
  const totalStuck = rows.reduce((s, r) => s + r.stuck_cost_omr, 0);
  console.log(`  💰 قيمة مجمّدة: ${totalStuck.toFixed(3)} OMR`);
  return rows;
}

async function generatePhysicalCountSheet() {
  console.log("\n📁 I8: توليد ملف الجرد الفعلي");

  const { rows } = await query<Record<string, unknown>>(`
    SELECT
      p.id AS product_id, p.barcode, p.name AS product_name,
      c.name AS category, l.name AS location, l.code AS location_code,
      li.qty_on_hand AS system_qty,
      NULL AS counted_qty,
      NULL AS difference,
      ROUND(COALESCE(p.avg_cost::decimal, 0), 3) AS unit_cost,
      ROUND(p.price::decimal, 3) AS unit_price,
      ROUND(li.qty_on_hand * COALESCE(p.avg_cost::decimal, 0), 3) AS total_cost_value
    FROM products p
    JOIN location_inventory li ON li.product_id = p.id
    JOIN locations l ON l.id = li.location_id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.active = true
    ORDER BY c.name, p.name, l.code
  `);

  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });

  // حفظ CSV (يمكن فتحه في Excel)
  const dateStr = new Date().toISOString().split("T")[0];
  const csvPath = path.join(REPORT_DIR, `physical-count-${dateStr}.csv`);
  const headers = ["product_id", "barcode", "product_name", "category", "location", "location_code",
    "system_qty", "counted_qty", "difference", "unit_cost", "unit_price", "total_cost_value"];
  const csvContent = [
    headers.join(","),
    ...rows.map((r) =>
      headers.map((h) => {
        const val = r[h];
        if (val === null || val === undefined) return "";
        const str = String(val);
        return str.includes(",") ? `"${str}"` : str;
      }).join(",")
    ),
  ].join("\n");

  // إضافة BOM للدعم العربي في Excel
  fs.writeFileSync(csvPath, "﻿" + csvContent, "utf8");
  console.log(`  ✅ ملف الجرد: ${csvPath}`);
  console.log(`  📊 ${rows.length} سطر`);

  return { path: csvPath, count: rows.length };
}

async function fixNegativeInventory(issues: NegativeInventory[]): Promise<void> {
  if (issues.length === 0) return;

  console.log("\n🔧 إصلاح المخزون السالب...");

  await withTransaction(async (txQuery) => {
    for (const issue of issues) {
      // تعديل qty إلى 0 مع تسجيل السبب
      await txQuery(`
        UPDATE location_inventory SET qty_on_hand = 0
        WHERE product_id = $1 AND qty_on_hand < 0
      `, [issue.product_id]);

      await txQuery(`
        INSERT INTO inventory_adjustments (branch_id, location_id, product_id, type, qty_before, qty_change, qty_after, reason, created_at)
        SELECT
          l.branch_id, li.location_id, $1,
          'increase',
          li.qty_on_hand, ABS(li.qty_on_hand), 0,
          'Audit reconciliation - Phase 3: negative inventory correction',
          NOW()
        FROM location_inventory li
        JOIN locations l ON l.id = li.location_id
        WHERE li.product_id = $1
        LIMIT 1
      `, [issue.product_id]);

      console.log(`  ✅ تم إصلاح: ${issue.name} @ ${issue.location_name}: ${issue.qty_on_hand} → 0`);
    }

    // تحديث products.stock_qty
    await txQuery(`
      UPDATE products p
      SET stock_qty = (
        SELECT COALESCE(SUM(li.qty_on_hand), 0)
        FROM location_inventory li WHERE li.product_id = p.id
      )
      WHERE p.id = ANY($1::int[])
    `, [issues.map((i) => i.product_id)]);
  });

  console.log(`  ✅ تم إصلاح ${issues.length} سجل مخزون سالب`);
}

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("📦 PHASE 3: Inventory Audit");
  console.log("═".repeat(60));

  const discrepancies = await checkStockQtyVsLocationSum();
  const negativeInventory = await checkNegativeInventory();
  const summary = await getInventorySummary();
  const slowMoving = await getSlowMovingProducts();
  const countSheet = await generatePhysicalCountSheet();

  // إصلاح المخزون السالب تلقائياً
  if (negativeInventory.length > 0) {
    await fixNegativeInventory(negativeInventory);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log("\n" + "═".repeat(60));
  console.log("📊 ملخص Phase 3:");
  console.log(`  المدة: ${duration}s`);
  console.log(`  🔴 فروق stock_qty: ${discrepancies.length}`);
  console.log(`  🔴 مخزون سالب: ${negativeInventory.length}`);
  console.log(`  ⚠️  بطيء الحركة: ${slowMoving.length}`);
  console.log(`  📄 ملف الجرد: ${countSheet.path}`);
  console.log("═".repeat(60));

  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = path.join(REPORT_DIR, `inventory-${new Date().toISOString().split("T")[0]}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({
    discrepancies: discrepancies.length,
    negativeInventory: negativeInventory.length,
    slowMoving: slowMoving.length,
    inventorySummary: summary,
    countSheetPath: countSheet.path,
    timestamp: new Date().toISOString(),
  }, null, 2));

  await closePool();
  process.exit(discrepancies.length > 0 || negativeInventory.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("❌ خطأ فادح:", err);
  process.exit(1);
});
