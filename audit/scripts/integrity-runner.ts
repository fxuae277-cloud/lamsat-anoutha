#!/usr/bin/env tsx
/**
 * Phase 1: Data Integrity Runner
 * يشغّل فحوصات سلامة البيانات ويولّد تقريراً
 */
import { query, closePool, printTable } from "./db-connect.js";
import * as fs from "fs";
import * as path from "path";

const REPORT_DIR = path.join(process.cwd(), "audit", "reports");
const ISSUES_FILE = path.join(process.cwd(), "audit", "ISSUES.md");

interface CheckResult {
  check_name: string;
  count: number;
  status: "PASS" | "FAIL" | "WARN";
}

interface IssueRecord {
  checkName: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "WARN";
  count: number;
  details: Record<string, unknown>[];
}

const issues: IssueRecord[] = [];
const startTime = Date.now();

async function runCheck(
  checkName: string,
  sql: string,
  severity: IssueRecord["severity"] = "HIGH"
): Promise<CheckResult[]> {
  try {
    const { rows, duration } = await query<CheckResult>(sql);
    const results = rows.filter((r) => r.check_name !== undefined);

    for (const result of results) {
      const icon = result.status === "PASS" ? "✅" : result.status === "WARN" ? "⚠️" : "❌";
      console.log(`  ${icon} ${result.check_name}: ${result.count} — ${result.status} (${duration}ms)`);

      if (result.status !== "PASS" && result.count > 0) {
        issues.push({
          checkName: result.check_name,
          severity,
          count: result.count,
          details: [],
        });
      }
    }
    return results;
  } catch (err) {
    console.error(`  ❌ خطأ في ${checkName}: ${(err as Error).message}`);
    return [];
  }
}

async function runDetailQuery(sql: string): Promise<Record<string, unknown>[]> {
  try {
    const { rows } = await query<Record<string, unknown>>(sql);
    return rows;
  } catch (err) {
    console.error(`  ⚠️ تعذّر تشغيل الاستعلام التفصيلي: ${(err as Error).message}`);
    return [];
  }
}

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("🔍 PHASE 1: Data Integrity Checks");
  console.log("═".repeat(60));

  // ──── A. Orphan Records ────
  console.log("\n📁 A. سجلات يتيمة:");
  await runCheck("orphan_sale_items", `
    SELECT 'A1_orphan_sale_items' AS check_name,
           COUNT(*) AS count,
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
    FROM sale_items si LEFT JOIN sales s ON si.sale_id = s.id WHERE s.id IS NULL
  `, "CRITICAL");

  await runCheck("orphan_purchase_items", `
    SELECT 'A3_orphan_purchase_items' AS check_name,
           COUNT(*) AS count,
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
    FROM purchase_items pi2 LEFT JOIN purchase_invoices pi ON pi2.purchase_id = pi.id WHERE pi.id IS NULL
  `, "CRITICAL");

  await runCheck("orphan_order_items", `
    SELECT 'A4_orphan_order_items' AS check_name,
           COUNT(*) AS count,
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
    FROM order_items oi LEFT JOIN orders o ON oi.order_id = o.id WHERE o.id IS NULL
  `, "HIGH");

  await runCheck("sale_items_deleted_product", `
    SELECT 'A2_sale_items_deleted_product' AS check_name,
           COUNT(*) AS count,
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
    FROM sale_items si LEFT JOIN products p ON si.product_id = p.id WHERE p.id IS NULL
  `, "HIGH");

  await runCheck("orphan_journal_lines", `
    SELECT 'A9_orphan_journal_lines' AS check_name,
           COUNT(*) AS count,
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
    FROM journal_entry_lines jel LEFT JOIN journal_entries je ON jel.entry_id = je.id WHERE je.id IS NULL
  `, "HIGH");

  // ──── B. Duplicates ────
  console.log("\n📁 B. تكرارات:");
  await runCheck("duplicate_invoice_numbers", `
    SELECT 'B1_duplicate_invoice_numbers' AS check_name,
           COUNT(*) AS count,
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
    FROM (SELECT invoice_number FROM sales GROUP BY invoice_number HAVING COUNT(*) > 1) d
  `, "CRITICAL");

  await runCheck("duplicate_product_barcodes", `
    SELECT 'B2_duplicate_product_barcodes' AS check_name,
           COUNT(*) AS count,
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
    FROM (SELECT barcode FROM products WHERE barcode IS NOT NULL AND barcode != ''
          GROUP BY barcode HAVING COUNT(*) > 1) d
  `, "HIGH");

  await runCheck("duplicate_purchase_numbers", `
    SELECT 'B4_duplicate_purchase_numbers' AS check_name,
           COUNT(*) AS count,
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
    FROM (SELECT invoice_number, supplier_id FROM purchase_invoices
          GROUP BY invoice_number, supplier_id HAVING COUNT(*) > 1) d
  `, "MEDIUM");

  // ──── C. NULL/Empty ────
  console.log("\n📁 C. حقول فارغة حرجة:");
  await runCheck("sales_no_invoice_number", `
    SELECT 'C1_sales_no_invoice_number' AS check_name,
           COUNT(*) AS count,
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
    FROM sales WHERE invoice_number IS NULL OR invoice_number = ''
  `, "CRITICAL");

  await runCheck("products_zero_price", `
    SELECT 'C2_products_zero_or_neg_price' AS check_name,
           COUNT(*) AS count,
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END AS status
    FROM products WHERE price::decimal <= 0 AND active = true
  `, "HIGH");

  await runCheck("negative_sale_totals", `
    SELECT 'C3_negative_sale_totals' AS check_name,
           COUNT(*) AS count,
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
    FROM sales WHERE total::decimal < 0 AND status NOT IN ('cancelled', 'refunded')
  `, "CRITICAL");

  await runCheck("products_null_cost", `
    SELECT 'C7_products_null_cost' AS check_name,
           COUNT(*) AS count,
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END AS status
    FROM products WHERE (cost_default IS NULL OR cost_default::decimal = 0) AND active = true
  `, "MEDIUM");

  // ──── D. Logical Anomalies ────
  console.log("\n📁 D. شذوذات منطقية:");
  await runCheck("negative_location_inventory", `
    SELECT 'D1_negative_location_inventory' AS check_name,
           COUNT(*) AS count,
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
    FROM location_inventory WHERE qty_on_hand < 0
  `, "HIGH");

  await runCheck("negative_stock_qty", `
    SELECT 'D2_negative_stock_qty' AS check_name,
           COUNT(*) AS count,
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
    FROM products WHERE stock_qty < 0 AND active = true
  `, "HIGH");

  await runCheck("sales_total_mismatch", `
    SELECT 'D3_sales_total_mismatch' AS check_name,
           COUNT(*) AS count,
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
    FROM sales
    WHERE ABS(total::decimal - (subtotal::decimal
      - CASE WHEN discount_type = 'percentage'
          THEN subtotal::decimal * discount::decimal / 100
          ELSE COALESCE(discount::decimal, 0) END
      + COALESCE(vat::decimal, 0))) > 0.01
  `, "CRITICAL");

  await runCheck("cogs_mismatch", `
    SELECT 'D5_cogs_total_mismatch' AS check_name,
           COUNT(*) AS count,
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
    FROM sales s
    WHERE ABS(s.cogs_total::decimal - COALESCE(
      (SELECT SUM(si.line_cogs::decimal) FROM sale_items si WHERE si.sale_id = s.id), 0)
    ) > 0.01 AND s.status != 'cancelled'
  `, "HIGH");

  await runCheck("return_exceeds_sale", `
    SELECT 'D7_return_exceeds_sale' AS check_name,
           COUNT(*) AS count,
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
    FROM sale_returns sr JOIN sales s ON sr.sale_id = s.id
    WHERE sr.refund_amount::decimal > s.total::decimal
  `, "CRITICAL");

  // ──── E. Referential Integrity ────
  console.log("\n📁 E. سلامة المراجع:");
  await runCheck("orders_invalid_invoice_id", `
    SELECT 'E1_orders_invalid_invoice_id' AS check_name,
           COUNT(*) AS count,
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
    FROM orders o WHERE o.invoice_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM sales s WHERE s.id = o.invoice_id)
  `, "HIGH");

  await runCheck("purchase_items_invalid_variant", `
    SELECT 'E2_purchase_items_invalid_variant' AS check_name,
           COUNT(*) AS count,
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
    FROM purchase_items pi2 WHERE pi2.variant_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM product_variants pv WHERE pv.id = pi2.variant_id)
  `, "MEDIUM");

  // ──── تقرير نهائي ────
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const passed = issues.filter(() => true).length === 0 ?
    "كل الفحوصات نجحت" : `${issues.length} مشكلة مكتشفة`;

  const criticalIssues = issues.filter((i) => i.severity === "CRITICAL");
  const highIssues = issues.filter((i) => i.severity === "HIGH");
  const mediumIssues = issues.filter((i) => i.severity === "MEDIUM");

  console.log("\n" + "═".repeat(60));
  console.log("📊 ملخص Phase 1:");
  console.log(`  المدة: ${duration}s`);
  console.log(`  🔴 CRITICAL: ${criticalIssues.length}`);
  console.log(`  🟠 HIGH: ${highIssues.length}`);
  console.log(`  🟡 MEDIUM: ${mediumIssues.length}`);
  console.log(`  الإجمالي: ${issues.length} مشكلة`);
  console.log("═".repeat(60));

  // حفظ التقرير
  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = path.join(REPORT_DIR, `integrity-${new Date().toISOString().split("T")[0]}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ issues, duration, timestamp: new Date().toISOString() }, null, 2));
  console.log(`\n💾 التقرير محفوظ: ${reportPath}`);

  await closePool();
  process.exit(criticalIssues.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("❌ خطأ فادح:", err);
  process.exit(1);
});
