import express, { type Request, Response, NextFunction } from "express";
import path from "path";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { seedDatabase } from "./seed";
import { initBackupScheduler } from "./backup";
import { apiLimiter } from "./middleware/rateLimiter";
import { globalErrorHandler } from "./middleware/errorHandler";
import { logger } from "./logger";
import { pool } from "./db";

const app = express();
const httpServer = createServer(app);

// Required for Railway (and any reverse proxy): trust X-Forwarded-* headers
// so req.ip is the real client IP (fixes rate limiter buckets) and
// secure cookies are set correctly over HTTPS.
app.set("trust proxy", 1);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

declare module "express-session" {
  interface SessionData {
    userId: number;
    user?: { id: number; name: string; role: string; branchId?: number | null; [key: string]: any };
    userName?: string;
  }
}

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));
app.use(apiLimiter);

const PgStore = connectPgSimple(session);
const isProduction = process.env.NODE_ENV === "production";
app.use(
  session({
    store: new PgStore({
      pool,
      createTableIfMissing: true,
      errorLog: (err: Error) => {
        console.error("[session-store] ERROR:", err.message, err.stack);
      },
    }),
    secret: process.env.SESSION_SECRET || "lamsat-onothah-secret-2024",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "lax",
      path: "/",
    },
  })
);

app.use((req, res, next) => {
  const start = Date.now();
  const reqPath = req.path;

  res.on("finish", () => {
    if (!reqPath.startsWith("/api")) return;
    const duration = Date.now() - start;
    const meta = {
      method: req.method,
      path: reqPath,
      status: res.statusCode,
      duration,
      userId: req.session?.userId ?? null,
      ip: req.ip,
    };
    if (duration > 500) {
      logger.warn("SLOW_REQUEST", meta);
    } else {
      logger.info("request", meta);
    }
  });

  next();
});

// Health check — must be registered BEFORE the async startup so Railway
// can probe it even if the DB connection is slow.
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", ts: new Date().toISOString() });
});

(async () => {
  // Startup diagnostics — visible in Railway logs
  console.log("[startup] NODE_ENV =", process.env.NODE_ENV);
  console.log("[startup] DATABASE_URL set?", !!process.env.DATABASE_URL);
  console.log("[startup] SESSION_SECRET set?", !!process.env.SESSION_SECRET);

  // Explicitly create the session table before anything else.
  // connect-pg-simple's createTableIfMissing runs silently and can fail on
  // managed databases (Railway) without surfacing the error.
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "session" (
        "sid"    varchar      NOT NULL,
        "sess"   json         NOT NULL,
        "expire" timestamp(6) NOT NULL,
        CONSTRAINT "session_pkey" PRIMARY KEY ("sid")
      );
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `);
    console.log("[startup] session table ready");
  } catch (err) {
    console.error("[startup] FAILED to create session table:", err);
  }

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key        TEXT PRIMARY KEY,
        value      TEXT NOT NULL DEFAULT '',
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      INSERT INTO settings (key, value) VALUES
        ('store_name',    'لمسة أنوثة'),
        ('store_phone',   ''),
        ('store_address', ''),
        ('currency',      'ر.ع'),
        ('vat_rate',      '5'),
        ('invoice_notes', '')
      ON CONFLICT (key) DO NOTHING;
    `);
    console.log("[startup] settings table ready");
  } catch (err) {
    console.error("[startup] FAILED to create settings table:", err);
  }

  // Migration 0018 — add description + cost_default + min_qty to products (idempotent)
  try {
    await pool.query(`
      ALTER TABLE products ADD COLUMN IF NOT EXISTS description  TEXT;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_default DECIMAL(10,3) DEFAULT 0;
      ALTER TABLE products ADD COLUMN IF NOT EXISTS min_qty      INTEGER DEFAULT 5;
    `);
    console.log("[startup] migration 0018: products description+cost_default+min_qty ready");
  } catch (err) {
    console.error("[startup] migration 0018 failed:", err);
  }

  // Migration 0019 — add address + phone to branches (idempotent)
  try {
    await pool.query(`
      ALTER TABLE branches ADD COLUMN IF NOT EXISTS address TEXT;
      ALTER TABLE branches ADD COLUMN IF NOT EXISTS phone   TEXT;
    `);
    console.log("[startup] migration 0019: branches address+phone ready");
  } catch (err) {
    console.error("[startup] migration 0019 failed:", err);
  }

  // Migration 0020 — add attachment_url to purchase_invoices (idempotent)
  try {
    await pool.query(`
      ALTER TABLE purchase_invoices ADD COLUMN IF NOT EXISTS attachment_url TEXT;
    `);
    console.log("[startup] migration 0020: purchase_invoices attachment_url ready");
  } catch (err) {
    console.error("[startup] migration 0020 failed:", err);
  }

  // Migration purchase_attachments — جدول مرفقات الفواتير الدائمة (PostgreSQL-backed)
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS purchase_attachments (
        id           SERIAL PRIMARY KEY,
        purchase_id  INTEGER NOT NULL REFERENCES purchase_invoices(id) ON DELETE CASCADE,
        filename     TEXT NOT NULL,
        content_type TEXT NOT NULL DEFAULT 'image/jpeg',
        data         TEXT NOT NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_purchase_attachments_purchase_id
        ON purchase_attachments(purchase_id);
    `);
    console.log("[startup] purchase_attachments table ready");
  } catch (err) {
    console.error("[startup] purchase_attachments migration failed:", err);
  }

  // Migration 0021 — ensure central location exists (idempotent)
  // approvePurchaseInvoice requires a location with is_central = true
  try {
    const { rows } = await pool.query(`SELECT id FROM locations WHERE is_central = true LIMIT 1`);
    if (rows.length === 0) {
      // إنشاء مخزن مركزي مرتبط بالفرع الرئيسي
      const branchRes = await pool.query(`SELECT id FROM branches WHERE is_main = true ORDER BY id LIMIT 1`);
      const branchId = branchRes.rows[0]?.id ?? null;
      await pool.query(`
        INSERT INTO locations (branch_id, code, name, is_central, is_branch_default, active)
        VALUES ($1, 'central', 'المخزن المركزي', true, false, true)
        ON CONFLICT DO NOTHING
      `, [branchId]);
      console.log("[startup] migration 0021: central location created");
    } else {
      console.log("[startup] migration 0021: central location already exists (id=" + rows[0].id + ")");
    }
  } catch (err) {
    console.error("[startup] migration 0021 failed:", err);
  }

  // Ensure every branch has exactly one is_branch_default location.
  // This fixes "لا يوجد مخزن افتراضي للفرع" that blocks all POS sales.
  try {
    await pool.query(`
      UPDATE locations l
      SET    is_branch_default = true
      WHERE  l.active = true
        AND  l.branch_id IS NOT NULL
        AND  l.id = (
          SELECT id FROM locations l2
          WHERE  l2.branch_id = l.branch_id AND l2.active = true
          ORDER BY id ASC
          LIMIT 1
        )
        AND NOT EXISTS (
          SELECT 1 FROM locations l3
          WHERE  l3.branch_id = l.branch_id AND l3.is_branch_default = true AND l3.active = true
        );
    `);
    console.log("[startup] branch default locations ensured");
  } catch (err) {
    console.error("[startup] FAILED to set branch default locations:", err);
  }

  // Migration 0022 — إضافة أدوار cashier و admin (idempotent)
  try {
    // أضف الأدوار الناقصة
    await pool.query(`
      INSERT INTO roles (name, description) VALUES
        ('admin',   'المدير — صلاحيات كاملة ما عدا إدارة المستخدمين والفروع'),
        ('cashier', 'كاشير — نقطة البيع والفواتير والعملاء')
      ON CONFLICT (name) DO NOTHING;
    `);

    // صلاحيات المدير (كل شيء ما عدا users.manage و branches.manage)
    await pool.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r CROSS JOIN permissions p
      WHERE r.name = 'admin'
        AND p.code NOT IN ('users.manage','branches.manage')
      ON CONFLICT DO NOTHING;
    `);

    // صلاحيات الكاشير
    await pool.query(`
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r
      JOIN permissions p ON p.code IN (
        'pos.access','invoice.create','invoice.print','invoice.return',
        'products.view','inventory.view',
        'customers.view','customers.create',
        'shift.open','shift.close','discount.apply'
      )
      WHERE r.name = 'cashier'
      ON CONFLICT DO NOTHING;
    `);

    // تحديث role_id للمستخدمين الحاليين الذين دورهم admin أو cashier
    await pool.query(`
      UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'admin')
      WHERE role = 'admin' AND role_id IS NULL;

      UPDATE users SET role_id = (SELECT id FROM roles WHERE name = 'cashier')
      WHERE role = 'cashier' AND role_id IS NULL;
    `);

    console.log("[startup] migration 0022: cashier + admin roles ready");
  } catch (err) {
    console.error("[startup] migration 0022 failed:", err);
  }

  // Migration 0023 — Opening Stock tables + Opening Equity account
  try {
    await pool.query(`
      -- Entry header (one per branch per init cycle)
      CREATE TABLE IF NOT EXISTS opening_stock_entries (
        id           SERIAL PRIMARY KEY,
        branch_id    INTEGER NOT NULL REFERENCES branches(id),
        status       TEXT    NOT NULL DEFAULT 'draft',   -- draft | committed | reset
        notes        TEXT,
        created_by   INTEGER REFERENCES users(id),
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        committed_at TIMESTAMPTZ,
        committed_by INTEGER REFERENCES users(id),
        reset_at     TIMESTAMPTZ,
        reset_by     INTEGER REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_ose_branch ON opening_stock_entries(branch_id);

      -- Line items
      CREATE TABLE IF NOT EXISTS opening_stock_items (
        id         SERIAL PRIMARY KEY,
        entry_id   INTEGER NOT NULL REFERENCES opening_stock_entries(id) ON DELETE CASCADE,
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity   DECIMAL(12,3) NOT NULL DEFAULT 0,
        unit_cost  DECIMAL(12,3) NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_osi_entry ON opening_stock_items(entry_id);

      -- Audit trail
      CREATE TABLE IF NOT EXISTS opening_stock_audit (
        id           SERIAL PRIMARY KEY,
        entry_id     INTEGER NOT NULL REFERENCES opening_stock_entries(id) ON DELETE CASCADE,
        action       TEXT    NOT NULL,                   -- created_draft | committed | reset
        performed_by INTEGER REFERENCES users(id),
        performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        notes        TEXT
      );

      -- Opening Balance Equity account (3100) — credit side of journal
      INSERT INTO accounts (code, name, name_en, type, level, is_system, active)
      VALUES ('3100', 'رأس المال الافتتاحي', 'Opening Balance Equity', 'equity', 1, true, true)
      ON CONFLICT (code) DO NOTHING;
    `);
    console.log("[startup] migration 0023: opening stock tables ready");
  } catch (err) {
    console.error("[startup] migration 0023 failed:", err);
  }

  // ضمان أن حسابات المالك دائماً نشطة (لا يمكن تعطيلها)
  try {
    await pool.query(`UPDATE users SET is_active = true WHERE role = 'owner'`);
    console.log("[startup] owner accounts ensured active");
  } catch (err) {
    console.error("[startup] FAILED to ensure owner accounts active:", err);
  }

  // خدمة مجلد uploads/attachments كملفات ثابتة (صور الفواتير الورقية)
  app.use("/uploads", express.static(path.resolve("uploads")));

  await seedDatabase();
  await registerRoutes(httpServer, app);
  initBackupScheduler();

  app.use(globalErrorHandler);

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      // reusePort not supported on Windows
      ...(process.platform !== "win32" && { reusePort: true }),
    },
    () => {
      logger.info(`serving on port ${port}`);
    },
  );
})().catch(err => {
  console.error("[startup] FATAL startup error:", err);
  process.exit(1);
});
