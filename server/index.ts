import express, { type Request, Response, NextFunction } from "express";
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
})();
