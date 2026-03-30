import { Request, Response, NextFunction } from "express";

export class AppError extends Error {
  statusCode: number;
  code: string;
  details: unknown;

  constructor(statusCode: number, message: string, code: string, details?: unknown) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details ?? null;
  }
}

function resolveCode(statusCode: number, err: any): string {
  if (err.code && typeof err.code === "string" && err.code !== "ERR_HTTP_HEADERS_SENT") {
    return err.code;
  }
  switch (statusCode) {
    case 400: return "VALIDATION_ERROR";
    case 401: return "UNAUTHENTICATED";
    case 403: return "FORBIDDEN";
    case 404: return "NOT_FOUND";
    case 409: return "CONFLICT";
    case 429: return "RATE_LIMITED";
    default:  return "INTERNAL_ERROR";
  }
}

export function globalErrorHandler(
  err: any,
  _req: Request,
  res: Response,
  next: NextFunction
) {
  if (res.headersSent) return next(err);

  const statusCode = err.statusCode || err.status || 500;
  const message    = err.message   || "خطأ في الخادم";
  const code       = resolveCode(statusCode, err);
  const details    = err.details   ?? null;

  if (statusCode >= 500) {
    console.error("[ERROR]", err);
  }

  return res.status(statusCode).json({ success: false, message, code, details });
}
