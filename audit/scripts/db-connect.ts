/**
 * اتصال مشترك بقاعدة البيانات لسكريبتات التدقيق
 * يقرأ DATABASE_URL من البيئة أو من .env.audit
 */
import { Pool, QueryResult } from "pg";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";

// تحميل .env.audit إن وُجد (للتشغيل المحلي)
const auditEnvPath = path.join(process.cwd(), ".env.audit");
if (fs.existsSync(auditEnvPath)) {
  const lines = fs.readFileSync(auditEnvPath, "utf8").split("\n");
  for (const line of lines) {
    const [key, ...valueParts] = line.split("=");
    if (key && valueParts.length > 0) {
      const value = valueParts.join("=").trim().replace(/^["']|["']$/g, "");
      if (!process.env[key.trim()]) process.env[key.trim()] = value;
    }
  }
}

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error(`
╔══════════════════════════════════════════════════════════╗
║  ❌  DATABASE_URL غير متوفر                              ║
╠══════════════════════════════════════════════════════════╣
║  للتشغيل المحلي، أنشئ ملف .env.audit في جذر المشروع:   ║
║                                                          ║
║  DATABASE_URL=postgresql://user:pass@host:port/db         ║
║                                                          ║
║  أو شغّل مع المتغير مباشرة:                              ║
║  DATABASE_URL=... npm run audit:integrity                ║
╚══════════════════════════════════════════════════════════╝
`);
  process.exit(1);
}

// فحص أن الـ URL ليس مجرد placeholder
if (DATABASE_URL.includes("USER:PASSWORD") || DATABASE_URL.includes("change-me")) {
  console.error("❌ DATABASE_URL يبدو placeholder وليس اتصال حقيقي.");
  process.exit(1);
}

const isLocal =
  DATABASE_URL.includes("localhost") ||
  DATABASE_URL.includes("127.0.0.1") ||
  DATABASE_URL.includes("railway.internal");

export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: isLocal ? undefined : { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 30000,
});

/** تشغيل استعلام بأمان مع وقت تنفيذ */
export async function query<T extends object = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<{ rows: T[]; duration: number; rowCount: number }> {
  const start = Date.now();
  const client = await pool.connect();
  try {
    const result: QueryResult<T> = await client.query(sql, params);
    return {
      rows: result.rows,
      duration: Date.now() - start,
      rowCount: result.rowCount ?? 0,
    };
  } finally {
    client.release();
  }
}

/** تشغيل استعلام في transaction مع rollback تلقائي عند الفشل */
export async function withTransaction<T>(
  fn: (q: typeof query) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const txQuery = async <R extends object = Record<string, unknown>>(
      sql: string,
      params: unknown[] = []
    ) => {
      const start = Date.now();
      const result: QueryResult<R> = await client.query(sql, params);
      return {
        rows: result.rows,
        duration: Date.now() - start,
        rowCount: result.rowCount ?? 0,
      };
    };
    const result = await fn(txQuery as typeof query);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/** طباعة نتائج استعلام بشكل جدول */
export function printTable(
  rows: Record<string, unknown>[],
  title?: string
): void {
  if (title) console.log(`\n${"─".repeat(60)}\n📊 ${title}`);
  if (rows.length === 0) {
    console.log("  ✅ لا توجد نتائج (صفر مشاكل)");
    return;
  }
  console.table(rows);
}

/** أغلق الاتصال عند الانتهاء */
export async function closePool(): Promise<void> {
  await pool.end();
}
