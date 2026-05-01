#!/usr/bin/env tsx
/**
 * Phase 2: Accounting Reconciliation Runner
 * يشغّل 10 معادلات ذهبية ويرصد الفروق
 */
import { query, closePool } from "./db-connect.js";
import * as fs from "fs";
import * as path from "path";

const TOLERANCE = 0.001; // 1 بيسة
const REPORT_DIR = path.join(process.cwd(), "audit", "reports");
const startTime = Date.now();

interface EquationResult {
  equation: string;
  discrepancies: number;
  totalDiffOmr?: number;
  status: "PASS" | "FAIL" | "WARN";
}

const results: EquationResult[] = [];

async function runEquation(name: string, sql: string): Promise<void> {
  try {
    const { rows, duration } = await query<EquationResult>(sql);
    const row = rows[0];
    if (!row) return;

    const icon = row.status === "PASS" ? "✅" : row.status === "WARN" ? "⚠️" : "❌";
    const diffStr = row.totalDiffOmr !== undefined ? ` | الفرق: ${row.totalDiffOmr} OMR` : "";
    console.log(`  ${icon} ${name}: ${row.discrepancies} فرق${diffStr} (${duration}ms)`);
    results.push(row);
  } catch (err) {
    console.error(`  ❌ ${name}: ${(err as Error).message}`);
  }
}

async function main() {
  console.log("\n" + "═".repeat(60));
  console.log("💰 PHASE 2: Accounting Reconciliation");
  console.log(`  Tolerance: ${TOLERANCE} OMR (1 بيسة)`);
  console.log("═".repeat(60));

  // معادلة 1: رأس الفاتورة = مجموع البنود
  await runEquation("EQ1 — رأس الفاتورة vs البنود", `
    SELECT 'EQ1_header_vs_items' AS equation,
           COUNT(*) AS discrepancies,
           ROUND(COALESCE(SUM(ABS(diff)), 0), 3) AS "totalDiffOmr",
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
    FROM (
      SELECT s.id, s.subtotal::decimal - SUM(si.total::decimal) AS diff
      FROM sales s JOIN sale_items si ON si.sale_id = s.id
      WHERE s.status NOT IN ('cancelled')
      GROUP BY s.id, s.subtotal
      HAVING ABS(s.subtotal::decimal - SUM(si.total::decimal)) > ${TOLERANCE}
    ) d
  `);

  // معادلة 2: المدفوعات vs المبيعات النقدية
  await runEquation("EQ2 — المدفوعات vs المبيعات", `
    SELECT 'EQ2_payments_vs_sales' AS equation,
           COUNT(*) AS discrepancies,
           ROUND(COALESCE(SUM(ABS(amount_paid::decimal - total::decimal)), 0), 3) AS "totalDiffOmr",
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END AS status
    FROM sales
    WHERE status = 'completed' AND payment_method = 'cash'
      AND ABS(amount_paid::decimal - total::decimal) > 0.01
      AND change_amount::decimal = 0
  `);

  // معادلة 3: أرصدة العملاء
  await runEquation("EQ3 — total_spent العملاء", `
    SELECT 'EQ3_customer_total_spent' AS equation,
           COUNT(*) AS discrepancies,
           ROUND(COALESCE(SUM(ABS(diff)), 0), 3) AS "totalDiffOmr",
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
    FROM (
      SELECT c.id,
             c.total_spent::decimal - COALESCE(SUM(s.total::decimal), 0) AS diff
      FROM customers c
      LEFT JOIN sales s ON s.customer_id = c.id AND s.status NOT IN ('cancelled')
      WHERE c.active = true
      GROUP BY c.id, c.total_spent
      HAVING ABS(c.total_spent::decimal - COALESCE(SUM(s.total::decimal), 0)) > ${TOLERANCE}
    ) d
  `);

  // معادلة 4: عدد فواتير العملاء
  await runEquation("EQ4 — invoice_count العملاء", `
    SELECT 'EQ4_customer_invoice_count' AS equation,
           COUNT(*) AS discrepancies,
           NULL AS "totalDiffOmr",
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
    FROM (
      SELECT c.id
      FROM customers c
      LEFT JOIN sales s ON s.customer_id = c.id AND s.status NOT IN ('cancelled')
      WHERE c.active = true
      GROUP BY c.id, c.invoice_count
      HAVING ABS(c.invoice_count - COUNT(s.id)) > 0
    ) d
  `);

  // معادلة 5: رصيد الموردين
  await runEquation("EQ5 — total_purchases الموردين", `
    SELECT 'EQ5_supplier_total_purchases' AS equation,
           COUNT(*) AS discrepancies,
           ROUND(COALESCE(SUM(ABS(diff)), 0), 3) AS "totalDiffOmr",
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
    FROM (
      SELECT sup.id,
             sup.total_purchases::decimal - COALESCE(SUM(pi.grand_total::decimal), 0) AS diff
      FROM suppliers sup
      LEFT JOIN purchase_invoices pi ON pi.supplier_id = sup.id
        AND pi.status IN ('received', 'partial')
      WHERE sup.active = true
      GROUP BY sup.id, sup.total_purchases
      HAVING ABS(sup.total_purchases::decimal - COALESCE(SUM(pi.grand_total::decimal), 0)) > ${TOLERANCE}
    ) d
  `);

  // معادلة 6: COGS الإجمالي
  await runEquation("EQ6 — COGS الإجمالي", `
    SELECT 'EQ6_system_cogs' AS equation,
           CASE WHEN ABS(SUM(s.cogs_total::decimal) - SUM(ic.total_cogs)) < 1 THEN 0 ELSE 1 END AS discrepancies,
           ROUND(ABS(SUM(s.cogs_total::decimal) - SUM(ic.total_cogs)), 3) AS "totalDiffOmr",
           CASE WHEN ABS(SUM(s.cogs_total::decimal) - SUM(ic.total_cogs)) < 1 THEN 'PASS' ELSE 'FAIL' END AS status
    FROM sales s
    JOIN (SELECT sale_id, SUM(line_cogs::decimal) AS total_cogs FROM sale_items GROUP BY sale_id) ic
      ON ic.sale_id = s.id
    WHERE s.status NOT IN ('cancelled')
  `);

  // معادلة 7: صحة المرتجعات
  await runEquation("EQ7 — صحة المرتجعات", `
    SELECT 'EQ7_returns_validity' AS equation,
           COUNT(*) AS discrepancies,
           NULL AS "totalDiffOmr",
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
    FROM (
      SELECT sr.id FROM sale_returns sr
      JOIN sales s ON sr.sale_id = s.id
      WHERE sr.refund_amount::decimal > s.total::decimal
      UNION ALL
      SELECT sr.id FROM sale_returns sr
      JOIN sales s ON sr.sale_id = s.id
      WHERE s.status = 'cancelled'
    ) x
  `);

  // معادلة 8: سلامة الخصومات
  await runEquation("EQ8 — سلامة الخصومات", `
    SELECT 'EQ8_discount_sanity' AS equation,
           COUNT(*) AS discrepancies,
           NULL AS "totalDiffOmr",
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END AS status
    FROM (
      SELECT id FROM sales WHERE discount_type = 'percentage' AND discount::decimal > 100
      UNION ALL
      SELECT id FROM sales WHERE discount_type = 'value'
        AND discount::decimal > subtotal::decimal AND status NOT IN ('cancelled')
    ) x
  `);

  // معادلة 9: توازن القيود المحاسبية
  await runEquation("EQ9 — توازن القيود (Debit=Credit)", `
    SELECT 'EQ9_journal_balance' AS equation,
           COUNT(*) AS discrepancies,
           ROUND(COALESCE(SUM(ABS(total_debit - total_credit)), 0), 3) AS "totalDiffOmr",
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS status
    FROM (
      SELECT je.id,
             SUM(jel.debit::decimal) AS total_debit,
             SUM(jel.credit::decimal) AS total_credit
      FROM journal_entries je
      JOIN journal_entry_lines jel ON jel.entry_id = je.id
      WHERE je.status = 'posted'
      GROUP BY je.id
      HAVING ABS(SUM(jel.debit::decimal) - SUM(jel.credit::decimal)) > ${TOLERANCE}
    ) x
  `);

  // معادلة 10: COGS per sale_item (line check)
  await runEquation("EQ10 — line_cogs = qty × unit_cost", `
    SELECT 'EQ10_line_cogs_calc' AS equation,
           COUNT(*) AS discrepancies,
           ROUND(COALESCE(SUM(ABS(line_cogs::decimal - (quantity * unit_cost_at_sale::decimal))), 0), 3) AS "totalDiffOmr",
           CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END AS status
    FROM sale_items
    WHERE unit_cost_at_sale::decimal > 0
      AND ABS(line_cogs::decimal - (quantity * unit_cost_at_sale::decimal)) > ${TOLERANCE}
  `);

  // ──── تقرير ────
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const passed = results.filter((r) => r.status === "PASS").length;
  const failed = results.filter((r) => r.status === "FAIL").length;
  const warned = results.filter((r) => r.status === "WARN").length;

  console.log("\n" + "═".repeat(60));
  console.log("📊 ملخص Phase 2:");
  console.log(`  المدة: ${duration}s`);
  console.log(`  ✅ نجح: ${passed}/10`);
  console.log(`  ❌ فشل: ${failed}/10`);
  console.log(`  ⚠️  تحذير: ${warned}/10`);
  console.log("═".repeat(60));

  if (!fs.existsSync(REPORT_DIR)) fs.mkdirSync(REPORT_DIR, { recursive: true });
  const reportPath = path.join(REPORT_DIR, `accounting-${new Date().toISOString().split("T")[0]}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ results, duration, timestamp: new Date().toISOString() }, null, 2));
  console.log(`💾 التقرير: ${reportPath}`);

  await closePool();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("❌ خطأ فادح:", err);
  process.exit(1);
});
