import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { logger } from "../logger";
import { pool } from "../db";
import { getLang } from "./errorHandler";
import { errJson } from "../lib/errorCodes";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json(errJson("UNAUTHENTICATED", getLang(req)));
  }
  next();
}

export async function requireOwnerOrAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json(errJson("UNAUTHENTICATED", getLang(req)));
  }
  const user = await storage.getUser(req.session.userId);
  if (!user || (user.role !== "owner" && user.role !== "admin")) {
    return res.status(403).json(errJson("PERMISSION_DENIED", getLang(req)));
  }
  next();
}

export function requireRole(allowedRoles: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.userId) {
      return res.status(401).json(errJson("UNAUTHENTICATED", getLang(req)));
    }
    const user = await storage.getUser(req.session.userId);
    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json(errJson("MANAGER_ONLY", getLang(req)));
    }
    next();
  };
}

export const requireManager = requireRole(["owner", "admin", "manager"]);

export async function enforceBranchScope(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId) {
    return res.status(401).json(errJson("UNAUTHENTICATED", getLang(req)));
  }
  const user = await storage.getUser(req.session.userId);
  if (!user) {
    return res.status(401).json(errJson("USER_NOT_FOUND", getLang(req)));
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
      return res.status(401).json(errJson("UNAUTHENTICATED", getLang(req)));
    }
    try {
      const userRow = await pool.query(
        "SELECT role, role_id, is_active FROM users WHERE id = $1",
        [req.session.userId]
      );
      if (!userRow.rows.length || !userRow.rows[0].is_active) {
        return res.status(401).json(errJson("UNAUTHENTICATED", getLang(req)));
      }
      const { role, role_id } = userRow.rows[0];
      if (role === "owner" || role === "admin") return next();

      const effectiveRoleId = role_id ?? (await pool.query(
        "SELECT id FROM roles WHERE name = $1", [role]
      )).rows[0]?.id ?? null;

      if (!role_id && effectiveRoleId) {
        await pool.query("UPDATE users SET role_id = $1 WHERE id = $2", [effectiveRoleId, req.session.userId]);
      }

      if (effectiveRoleId) {
        const perm = await pool.query(
          `SELECT 1 FROM role_permissions rp
           JOIN permissions p ON p.id = rp.permission_id
           WHERE rp.role_id = $1 AND p.code = $2`,
          [effectiveRoleId, permCode]
        );
        if (perm.rows.length > 0) return next();
      }

      return res.status(403).json(errJson("PERMISSION_DENIED", getLang(req)));
    } catch {
      const fallback = await pool.query(
        "SELECT role FROM users WHERE id = $1", [req.session.userId]
      );
      if (fallback.rows[0]?.role === "owner") return next();
      return res.status(403).json(errJson("PERMISSION_DENIED", getLang(req)));
    }
  };
}

export { logger };
