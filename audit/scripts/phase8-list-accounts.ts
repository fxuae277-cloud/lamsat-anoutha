import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL!, ssl: { rejectUnauthorized: false } });
const client = await pool.connect();
const res = await client.query("SELECT code, name, type FROM accounts ORDER BY code");
res.rows.forEach(r => console.log(`${r.code} | ${r.type.padEnd(12)} | ${r.name}`));
client.release();
await pool.end();
