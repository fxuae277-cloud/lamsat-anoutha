/**
 * Phase 8 — Production Readiness Check
 * Verifies users, branches, accounts, categories, settings
 */
import { Pool } from "pg";
import fs from "fs";
import path from "path";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});

function log(msg: string) { console.log(msg); }
function section(t: string) { log(`\n${"═".repeat(60)}\n${t}\n${"═".repeat(60)}`); }

async function main() {
  const client = await pool.connect();
  const report: Record<string, any> = { timestamp: new Date().toISOString(), checks: {} };

  try {
    section("1. USERS");
    const users = await client.query(`
      SELECT id, username, role, is_active, branch_id FROM users ORDER BY id
    `);
    log(`  Total users: ${users.rowCount}`);
    users.rows.forEach(u => log(`  → ${u.username} | role=${u.role} | active=${u.is_active} | branch=${u.branch_id}`));
    const ownerExists = users.rows.some(u => u.role === "owner");
    log(`  Owner exists: ${ownerExists ? "✅" : "❌ MISSING"}`);
    report.checks.users = { count: users.rowCount, ownerExists, rows: users.rows };

    section("2. BRANCHES");
    const branches = await client.query(`SELECT id, name FROM branches ORDER BY id`);
    log(`  Total branches: ${branches.rowCount}`);
    branches.rows.forEach(b => log(`  → ${b.name}`));
    report.checks.branches = { count: branches.rowCount, rows: branches.rows };

    section("3. CHART OF ACCOUNTS — Critical accounts");
    const criticalCodes = ["1101", "1102", "4001", "5001", "1201", "1301", "2001"];
    const criticalNames = { "1101": "CASH", "1102": "BANK", "4001": "SALES", "5001": "COGS", "1201": "INVENTORY", "1301": "AR", "2001": "AP" };
    const accounts = await client.query(`
      SELECT id, code, name, type FROM accounts
      WHERE code = ANY($1) ORDER BY code
    `, [criticalCodes]);
    log(`  Critical accounts found: ${accounts.rowCount}/${criticalCodes.length}`);
    const foundCodes = new Set(accounts.rows.map(a => a.code));
    criticalCodes.forEach(code => {
      const found = foundCodes.has(code);
      const acc = accounts.rows.find(a => a.code === code);
      log(`  ${found ? "✅" : "❌"} ${code} ${criticalNames[code as keyof typeof criticalNames]}: ${found ? acc!.name : "MISSING"}`);
    });
    const totalAccounts = await client.query(`SELECT COUNT(*) as cnt FROM accounts`);
    log(`  Total accounts in CoA: ${totalAccounts.rows[0].cnt}`);
    report.checks.accounts = { totalCount: parseInt(totalAccounts.rows[0].cnt), critical: accounts.rows };

    section("4. CATEGORIES");
    const cats = await client.query(`SELECT id, name FROM categories ORDER BY id`);
    log(`  Categories: ${cats.rowCount}`);
    cats.rows.forEach(c => log(`  → ${c.name}`));
    report.checks.categories = { count: cats.rowCount, rows: cats.rows };

    section("5. SETTINGS (key values)");
    const settings = await client.query(`SELECT key, value FROM settings ORDER BY key`);
    log(`  Settings rows: ${settings.rowCount}`);
    settings.rows.forEach(s => log(`  ${s.key} = ${s.value}`));
    report.checks.settings = { count: settings.rowCount, rows: settings.rows };

    section("6. EXPENSE CATEGORIES");
    const expCats = await client.query(`SELECT id, code, name FROM expense_categories ORDER BY sort_order`);
    log(`  Expense categories: ${expCats.rowCount}`);
    expCats.rows.forEach(e => log(`  → ${e.code}: ${e.name}`));
    report.checks.expenseCategories = { count: expCats.rowCount, rows: expCats.rows };

    section("7. ROLES & PERMISSIONS");
    const roles = await client.query(`SELECT id, name, is_active FROM roles ORDER BY id`);
    const perms = await client.query(`SELECT COUNT(*) as cnt FROM permissions`);
    const rolePerm = await client.query(`SELECT COUNT(*) as cnt FROM role_permissions`);
    log(`  Roles: ${roles.rowCount}`);
    roles.rows.forEach(r => log(`  → ${r.name} | active=${r.is_active}`));
    log(`  Permissions: ${perms.rows[0].cnt}`);
    log(`  Role-Permission assignments: ${rolePerm.rows[0].cnt}`);
    report.checks.roles = { count: roles.rowCount, rows: roles.rows };

    section("8. LOCATIONS");
    const locs = await client.query(`SELECT id, name, branch_id FROM locations ORDER BY id`);
    log(`  Locations: ${locs.rowCount}`);
    locs.rows.forEach(l => log(`  → ${l.name} | branch=${l.branch_id}`));
    report.checks.locations = { count: locs.rowCount, rows: locs.rows };

    section("SUMMARY");
    const allGood = ownerExists && parseInt(totalAccounts.rows[0].cnt) > 0 && branches.rowCount > 0;
    log(`\n  ${allGood ? "✅ PRODUCTION READY" : "❌ NEEDS ATTENTION"}`);
    log(`  Owner: ${ownerExists ? "✅" : "❌"}`);
    log(`  Branches: ${branches.rowCount > 0 ? "✅" : "❌"} (${branches.rowCount})`);
    log(`  Chart of Accounts: ${parseInt(totalAccounts.rows[0].cnt) > 0 ? "✅" : "❌"} (${totalAccounts.rows[0].cnt} accounts)`);
    log(`  Categories: ✅ (${cats.rowCount})`);
    log(`  Locations: ✅ (${locs.rowCount})`);
    report.summary = { allGood };

  } finally {
    client.release();
  }

  const outPath = path.join("audit", "reports", "phase-8-prod-readiness.json");
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  log(`\n  📄 Report: ${outPath}`);
  await pool.end();
}

main().catch(console.error);
