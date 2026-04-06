import rateLimit from "express-rate-limit";

const rateLimitedBody = (message: string) => ({
  success: false,
  message,
  code: "RATE_LIMITED",
  details: null,
});

// Global limiter — applied to all /api/* routes
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !req.path.startsWith("/api"),
  message: rateLimitedBody("طلبات كثيرة جداً، حاول بعد دقيقة"),
});

// Auth limiter — login brute-force protection
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'development' || req.ip === '127.0.0.1' || req.ip === '::1',
  message: rateLimitedBody("محاولات دخول كثيرة جداً، حاول بعد 15 دقيقة"),
});

// Password limiter — change/reset password endpoints
export const passwordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitedBody("محاولات كثيرة جداً، حاول بعد 15 دقيقة"),
});

// Upload limiter — OCR invoice parsing (expensive operation)
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,        // 1 minute
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: rateLimitedBody("طلبات رفع ملفات كثيرة جداً، حاول بعد دقيقة"),
});
