import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { logger } from "../logger";
import { pool } from "../db";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "غير مصرح - يجب تسجيل الدخول" });
  }
  next();
}

export async function requireOwnerOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "غير مصرح - يجب تسجيل الدخول" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user || (user.role !== "owner" && user.role !== "admin")) {
    return res.status(403).json({ message: "غير مصرح - صلاحيات غير كافية" });
  }
  next();
}

export function requireRole(allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "غير مصرح - يجب تسجيل الدخول" });
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({ message: "غير مصرح لك. هذه العملية للمدير فقط." });
    }
    next();
  };
}

export const requireManager = requireRole(["owner", "admin", "manager"]);

export async function enforceBranchScope(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "غير مصرح - يجب تسجيل الدخول" });
  }
  const user = await storage.getUser(req.session.userId);
  if (!user) {
    return res.status(401).json({ message: "المستخدم غير موجود" });
  }
  if (user.role === "owner" || user.role === "admin") {
    const qb = (req.query.branchId || req.query.branch_id || req.body?.branchId) as string | undefined;
    if (qb && !isNaN(Number(qb))) {
      req.branchScope = { mode: "branch", branchId: Number(qb) };
    } else {
      req.branchScope = { mode: "company", branchId: null };
    }
  } else {
    req.branchScope = { mode: "branch", branchId: user.branchId ?? 0 };
  }
  next();
}

// ── requirePermission: فحص صلاحية محددة بالكود ──────────────────────────────
export function requirePermission(permCode: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "غير مصرح - يجب تسجيل الدخول" });
    }
    try {
      // المالك دائماً يملك كل الصلاحيات (backward compat)
      const userRow = await pool.query(
        "SELECT role, role_id, is_active FROM users WHERE id = $1",
        [req.session.userId]
      );
      if (!userRow.rows.length || !userRow.rows[0].is_active) {
        return res.status(401).json({ message: "غير مصرح" });
      }
      const { role, role_id } = userRow.rows[0];
      if (role === "owner" || role === "admin") return next();

      // فحص الصلاحية عبر جدول role_permissions
      if (role_id) {
        const perm = await pool.query(
          `SELECT 1 FROM role_permissions rp
           JOIN permissions p ON p.id = rp.permission_id
           WHERE rp.role_id = $1 AND p.code = $2`,
          [role_id, permCode]
        );
        if (perm.rows.length > 0) return next();
      }

      return res.status(403).json({ message: "ليس لديك صلاحية تنفيذ هذا الإجراء" });
    } catch {
      // إذا الجداول غير موجودة بعد (قبل تشغيل migration)
      const fallback = await pool.query(
        "SELECT role FROM users WHERE id = $1", [req.session.userId]
      );
      if (fallback.rows[0]?.role === "owner") return next();
      return res.status(403).json({ message: "ليس لديك صلاحية تنفيذ هذا الإجراء" });
    }
  };
}

export { logger };
