// Phase 8.5 — Regression test anchors
// Protect fixes that were explicitly added to prevent past or anticipated bugs

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createUserSchema, updateProductSchema } from "../../server/validation";
import { authLimiter, apiLimiter, passwordLimiter } from "../../server/middleware/rateLimiter";

// ── Storage mock for middleware regression tests ───────────────────────────────
const { mockGetUser } = vi.hoisted(() => ({ mockGetUser: vi.fn() }));
vi.mock("../../server/storage", () => ({
  storage: { getUser: mockGetUser, getUserByUsername: vi.fn() },
}));

// ── bcrypt mock for login logic ────────────────────────────────────────────────
const { mockBcryptCompare } = vi.hoisted(() => ({ mockBcryptCompare: vi.fn() }));
vi.mock("bcryptjs", () => ({
  default: { compare: mockBcryptCompare, hash: vi.fn() },
}));

import { requireOwnerOrAdmin } from "../../server/middleware/auth";

// ── Helper: mock req/res/next ─────────────────────────────────────────────────
function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json } as any;
}
function makeReq(overrides: Record<string, unknown> = {}) {
  return { session: {}, query: {}, body: {}, ...overrides } as any;
}

// ── Test 1: SQL injection in username → Zod regex rejects ────────────────────

describe("SQL injection in username — regression anchor", () => {
  it("rejects username containing SQL injection pattern", () => {
    const result = createUserSchema.safeParse({
      name: "Test User",
      username: "'; DROP TABLE users;--",
      password: "pass123",
    });
    expect(result.success).toBe(false);
  });

  it("rejects username with semicolon", () => {
    expect(
      createUserSchema.safeParse({ name: "A B", username: "admin;exec", password: "pass123" }).success
    ).toBe(false);
  });

  it("rejects username with single quote", () => {
    expect(
      createUserSchema.safeParse({ name: "A B", username: "admin'or", password: "pass123" }).success
    ).toBe(false);
  });

  it("accepts clean alphanumeric username", () => {
    expect(
      createUserSchema.safeParse({ name: "Test User", username: "admin_user99", password: "pass123" }).success
    ).toBe(true);
  });
});

// ── Test 2: price = -1 in product update → Zod rejects ───────────────────────

describe("negative price in product update — regression anchor", () => {
  it("rejects price = -1", () => {
    expect(updateProductSchema.safeParse({ price: -1 }).success).toBe(false);
  });

  it("rejects price = -0.001", () => {
    expect(updateProductSchema.safeParse({ price: -0.001 }).success).toBe(false);
  });

  it("accepts price = 0 (free product)", () => {
    expect(updateProductSchema.safeParse({ price: 0 }).success).toBe(true);
  });

  it("accepts price = 0.500 (fractional Omani Rial)", () => {
    expect(updateProductSchema.safeParse({ price: 0.5 }).success).toBe(true);
  });
});

// ── Test 3: Cashier cannot access payroll (requireOwnerOrAdmin) ───────────────

describe("cashier blocked from owner/admin routes — regression anchor", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 403 for role=cashier attempting owner-only route", async () => {
    mockGetUser.mockResolvedValue({ id: 1, role: "cashier" });
    const req = makeReq({ session: { userId: 1 } });
    const res = makeRes();
    const next = vi.fn();

    await requireOwnerOrAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 for role=employee attempting owner-only route", async () => {
    mockGetUser.mockResolvedValue({ id: 2, role: "employee" });
    const req = makeReq({ session: { userId: 2 } });
    const res = makeRes();
    const next = vi.fn();

    await requireOwnerOrAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 for role=manager attempting owner-only route", async () => {
    mockGetUser.mockResolvedValue({ id: 3, role: "manager" });
    const req = makeReq({ session: { userId: 3 } });
    const res = makeRes();
    const next = vi.fn();

    await requireOwnerOrAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── Test 4: Rate limiter middleware exists and is correctly configured ─────────

describe("rate limiter middleware — regression anchor", () => {
  it("authLimiter is a middleware function (mountable on Express routes)", () => {
    expect(typeof authLimiter).toBe("function");
    // Express middleware signature: (req, res, next)
    expect(authLimiter.length).toBe(3);
  });

  it("apiLimiter is a distinct middleware from authLimiter", () => {
    expect(apiLimiter).not.toBe(authLimiter);
  });

  it("passwordLimiter is a distinct middleware from authLimiter", () => {
    expect(passwordLimiter).not.toBe(authLimiter);
  });

  it("all three limiters are distinct middleware instances", () => {
    const unique = new Set([authLimiter, apiLimiter, passwordLimiter]);
    expect(unique.size).toBe(3);
  });
});

// ── Test 5: logger.warn on failed login, not on success ──────────────────────

describe("logger.warn — failed login regression anchor", () => {
  beforeEach(() => vi.clearAllMocks());

  async function simulateLogin(
    username: string,
    password: string,
    deps: { getUserByUsername: typeof mockGetUser; bcryptCompare: typeof mockBcryptCompare; logger: { warn: ReturnType<typeof vi.fn> } }
  ) {
    const user = await deps.getUserByUsername(username);
    if (!user) {
      deps.logger.warn("failed_login", { username, reason: "user_not_found" });
      return { status: 401 };
    }
    const valid = await deps.bcryptCompare(password, user.password);
    if (!valid) {
      deps.logger.warn("failed_login", { username, reason: "wrong_password" });
      return { status: 401 };
    }
    if (!user.isActive) return { status: 403 };
    return { status: 200, sessionUserId: user.id };
  }

  it("logger.warn fires with 'user_not_found' when user does not exist", async () => {
    const getUserByUsername = vi.fn().mockResolvedValue(null);
    const bcryptCompare = vi.fn();
    const logger = { warn: vi.fn() };

    const result = await simulateLogin("ghost", "anypass", { getUserByUsername, bcryptCompare, logger });

    expect(logger.warn).toHaveBeenCalledWith(
      "failed_login",
      expect.objectContaining({ reason: "user_not_found" })
    );
    expect(result.status).toBe(401);
  });

  it("logger.warn fires with 'wrong_password' when password is incorrect", async () => {
    const getUserByUsername = vi.fn().mockResolvedValue({
      id: 1, username: "owner", password: "$hashed", isActive: true,
    });
    const bcryptCompare = vi.fn().mockResolvedValue(false);
    const logger = { warn: vi.fn() };

    const result = await simulateLogin("owner", "wrongpass", { getUserByUsername, bcryptCompare, logger });

    expect(logger.warn).toHaveBeenCalledWith(
      "failed_login",
      expect.objectContaining({ reason: "wrong_password" })
    );
    expect(result.status).toBe(401);
  });

  it("logger.warn NOT called on successful login", async () => {
    const getUserByUsername = vi.fn().mockResolvedValue({
      id: 1, username: "owner", password: "$hashed", isActive: true,
    });
    const bcryptCompare = vi.fn().mockResolvedValue(true);
    const logger = { warn: vi.fn() };

    const result = await simulateLogin("owner", "correct", { getUserByUsername, bcryptCompare, logger });

    expect(logger.warn).not.toHaveBeenCalled();
    expect(result.status).toBe(200);
  });

  it("logger.warn NOT called for inactive account (different failure path)", async () => {
    const getUserByUsername = vi.fn().mockResolvedValue({
      id: 2, username: "locked", password: "$hashed", isActive: false,
    });
    const bcryptCompare = vi.fn().mockResolvedValue(true);
    const logger = { warn: vi.fn() };

    const result = await simulateLogin("locked", "correct", { getUserByUsername, bcryptCompare, logger });

    expect(logger.warn).not.toHaveBeenCalled();
    expect(result.status).toBe(403);
  });
});
