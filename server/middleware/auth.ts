import type { Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { logger } from "../logger";

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

export { logger };
