import { Request, Response, NextFunction } from "express";
import { logger } from "../logger";
import { ERROR_REGISTRY, type ErrorCode, errMsg, errStatus } from "../lib/errorCodes";

// ── Language detection ────────────────────────────────────────────────────────
export function getLang(req: Request): "ar" | "en" {
  const q = req.query?.lang as string | undefined;
  if (q === "en") return "en";
  if (q === "ar") return "ar";
  const accept = (req.headers?.["accept-language"] ?? "") as string;
  return accept.startsWith("en") ? "en" : "ar";
}

// ── AppError ──────────────────────────────────────────────────────────────────
export class AppError extends Error {
  statusCode: number;
  code: string;
  details: unknown;

  // Code-first: new AppError("PRODUCT_NOT_FOUND", details?)
  constructor(code: ErrorCode, details?: unknown);
  // Legacy:     new AppError(statusCode, message, code, details?)
  constructor(statusCode: number, message: string, code: string, details?: unknown);
  constructor(
    statusCodeOrCode: number | ErrorCode,
    messageOrDetails?: string | unknown,
    codeOrUndefined?: string,
    details?: unknown
  ) {
    if (typeof statusCodeOrCode === "string") {
      const code = statusCodeOrCode as ErrorCode;
      super(errMsg(code, "ar"));
      this.statusCode = errStatus(code);
      this.code = code;
      this.details = messageOrDetails ?? null;
    } else {
      super(messageOrDetails as string);
      this.statusCode = statusCodeOrCode;
      this.code = codeOrUndefined ?? "INTERNAL_ERROR";
      this.details = details ?? null;
    }
    this.name = "AppError";
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

  const lang      = getLang(_req);
  const statusCode = err.statusCode || err.status || 500;
  const code      = resolveCode(statusCode, err);
  const details   = err.details ?? null;

  // Pick localized message: prefer registry lookup over err.message
  let message: string;
  if (code in ERROR_REGISTRY) {
    message = errMsg(code as ErrorCode, lang);
  } else {
    message = err.message || errMsg("INTERNAL_ERROR", lang);
  }

  if (statusCode >= 500) {
    logger.error(err.message || message, { code, details, stack: err?.stack });
  } else if (statusCode === 401 || statusCode === 403) {
    logger.warn(err.message || message, { code, path: _req.path, method: _req.method });
  }

  return res.status(statusCode).json({ success: false, message, code, details });
}
