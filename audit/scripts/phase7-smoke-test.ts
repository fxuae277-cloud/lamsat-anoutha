/**
 * Phase 7 Smoke Test — diagnostic queries on Production DB
 * Runs before and after fixes to measure impact
 */
import { Pool } from "pg";
import fs from "fs";
import path from "path";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});

interface Check {
  id: string;
  label: string;
  query: string;
  expectZero?: boolean;
}

const CHECKS: Check[] = [
  {
    id: "stock_qty_drift",
    label: "منتجات stock_qty != SUM(location_inventory)",
    query: `
      SELECT COUNT(*) as count,
             COALESCE(SUM(ABS(p.stock_qty::numeric - COALESCE(li.sum_qty, 0))), 0) as total_drift
      FROM products p
      LEFT JOIN (
        SELECT product_id, SUM(qty_on_hand) as sum_qty
        FROM location_inventory GROUP BY product_id
      ) li ON li.product_id = p.id
      WHERE ABS(p.stock_qty::numeric - COALESCE(li.sum_qty, 0)) > 0.001
    `,
    expectZero: true,
  },
  {
    id: "customer_spent_drift",
    label: "عملاء total_spent != مجموع مبيعاتهم الفعلية",
    query: `
      SELECT COUNT(*) as count,
             COALESCE(SUM(ABS(c.total_spent::numeric - COALESCE(s.actual, 0))), 0) as total_drift
      FROM customers c
      LEFT JOIN (
        SELECT customer_id, SUM(total::numeric) as actual
        FROM sales WHERE customer_id IS NOT NULL
        GROUP BY customer_id
      ) s ON s.customer_id = c.id
      WHERE ABS(COALESCE(c.total_spent::numeric, 0) - COALESCE(s.actual, 0)) > 0.01
    `,
    expectZero: true,
  },
  {
    id: "journal_card_in_cash",
    label: "قيود card/wallet مصنّفة في CASH (ISS-014)",
    query: `
      SELECT COUNT(*) as count, COALESCE(SUM(jel.debit::numeric), 0) as total_amount
      FROM journal_entry_lines jel
      JOIN journal_entries je ON je.id = jel.entry_id
      JOIN accounts a ON a.id = jel.account_id
      JOIN sales s ON s.id = je.source_id AND je.source_type = 'sale'
      WHERE a.code = '1101'
        AND s.payment_method IN ('card', 'bank_transfer', 'wallet', 'cheque')
        AND jel.debit > 0
    `,
    expectZero: true,
  },
  {
    id: "zero_avg_cost_with_sales",
    label: "منتجات avg_cost=0 لها مبيعات",
    query: `
      SELECT COUNT(DISTINCT p.id) as count
      FROM products p
      JOIN sale_items si ON si.product_id = p.id
      WHERE (p.avg_cost IS NULL OR p.avg_cost::numeric = 0)
    `,
    expectZero: false,
  },
  {
    id: "negative_stock",
    label: "منتجات stock_qty < 0",
    query: `
      SELECT COUNT(*) as count FROM products WHERE stock_qty::numeric < 0
    `,
    expectZero: true,
  },
  {
    id: "warehouses_data",
    label: "هل warehouses table فيها بيانات؟ (ISS-004)",
    query: `
      SELECT COUNT(*) as count FROM warehouses
    `,
    expectZero: false,
  },
  {
    id: "inventory_old_system",
    label: "بيانات في نظام inventory القديم",
    query: `
      SELECT COUNT(*) as count FROM inventory
    `,
    expectZero: false,
  },
  {
    id: "journal_entries_total",
    label: "إجمالي journal_entries في النظام",
    query: `SELECT COUNT(*) as count FROM journal_entries`,
    expectZero: false,
  },
  {
    id: "sales_by_payment",
    label: "توزيع المبيعات حسب طريقة الدفع",
    query: `
      SELECT payment_method, COUNT(*) as count, SUM(total::numeric) as total
      FROM sales GROUP BY payment_method ORDER BY count DESC
    `,
    expectZero: false,
  },
  {
    id: "supplier_total_drift",
    label: "موردون total_purchases != مجموع فواتيرهم",
    query: `
      SELECT COUNT(*) as count
      FROM suppliers s
      LEFT JOIN (
        SELECT supplier_id, SUM(grand_total::numeric) as actual
        FROM purchase_invoices WHERE status NOT IN ('draft', 'cancelled')
        GROUP BY supplier_id
      ) pi ON pi.supplier_id = s.id
      WHERE ABS(COALESCE(s.total_purchases::numeric, 0) - COALESCE(pi.actual, 0)) > 0.01
    `,
    expectZero: true,
  },
];

async function runSmokTests(label: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`SMOKE TEST: ${label}`);
  console.log("=".repeat(60));

  const results: Record<string, any> = { label, timestamp: new Date().toISOString(), checks: {} };

  for (const check of CHECKS) {
    try {
      const res = await pool.query(check.query);
      const row = res.rows[0];
      const count = parseInt(row.count ?? "0");
      const status = check.expectZero ? (count === 0 ? "✅" : "❌") : "ℹ️";
      console.log(`  ${status} [${check.id}] ${check.label}`);
      console.log(`     →`, JSON.stringify(row));
      results.checks[check.id] = { label: check.label, ...row, status: check.expectZero ? (count === 0 ? "OK" : "NEEDS_FIX") : "INFO" };
    } catch (e: any) {
      console.log(`  ⚠️  [${check.id}] ERROR: ${e.message}`);
      results.checks[check.id] = { error: e.message, status: "ERROR" };
    }
  }

  return results;
}

async function main() {
  const label = process.argv[2] === "post" ? "Post-Fix Verification" : "Pre-Fix Diagnosis";
  const outName = process.argv[2] === "post" ? "phase-7-post-fix-verification.json" : "phase-7-pre-fix-diagnosis.json";
  const results = await runSmokTests(label);
  const outFile = path.join("audit", "reports", outName);
  fs.mkdirSync(path.join("audit", "reports"), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2));
  console.log(`\n✅ Diagnosis saved: ${outFile}`);
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
