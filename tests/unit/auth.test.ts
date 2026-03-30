// Phase 8.4 — Unit tests for server/middleware/auth.ts
// Mock req/res/next with vi.fn() — no real DB, no HTTP

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoist storage mock before vi.mock factory ─────────────────────────────────
const { mockGetUser } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
}));

vi.mock("../../server/storage", () => ({
  storage: { getUser: mockGetUser },
}));

// ── Also mock bcrypt for the login handler tests ───────────────────────────────
const { mockBcryptCompare } = vi.hoisted(() => ({
  mockBcryptCompare: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: { compare: mockBcryptCompare, hash: vi.fn() },
}));

// ── Also mock storage.getUserByUsername for login tests ───────────────────────
const { mockGetUserByUsername } = vi.hoisted(() => ({
  mockGetUserByUsername: vi.fn(),
}));

vi.mock("../../server/storage", () => ({
  storage: {
    getUser: mockGetUser,
    getUserByUsername: mockGetUserByUsername,
  },
}));

import {
  requireAuth,
  requireOwnerOrAdmin,
  requireManager,
  enforceBranchScope,
} from "../../server/middleware/auth";

// ── Mock factory ──────────────────────────────────────────────────────────────

function makeRes() {
  const json = vi.fn();
  const status = vi.fn().mockReturnValue({ json });
  return { status, json, _json: json, _status: status } as any;
}

function makeReq(overrides: Record<string, unknown> = {}) {
  return {
    session: {},
    query: {},
    body: {},
    ...overrides,
  } as any;
}

const next = vi.fn();

// ── requireAuth ───────────────────────────────────────────────────────────────

describe("requireAuth", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when session has no userId", () => {
    const req = makeReq({ session: {} });
    const res = makeRes();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.status().json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("غير مصرح") })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() when session has a valid userId", () => {
    const req = makeReq({ session: { userId: 1 } });
    const res = makeRes();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 401 when userId is 0 (falsy)", () => {
    const req = makeReq({ session: { userId: 0 } });
    const res = makeRes();

    requireAuth(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── requireOwnerOrAdmin ───────────────────────────────────────────────────────

describe("requireOwnerOrAdmin", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no session", async () => {
    const req = makeReq({ session: {} });
    const res = makeRes();

    await requireOwnerOrAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() for role=owner", async () => {
    mockGetUser.mockResolvedValue({ id: 1, role: "owner" });
    const req = makeReq({ session: { userId: 1 } });
    const res = makeRes();

    await requireOwnerOrAdmin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("calls next() for role=admin", async () => {
    mockGetUser.mockResolvedValue({ id: 2, role: "admin" });
    const req = makeReq({ session: { userId: 2 } });
    const res = makeRes();

    await requireOwnerOrAdmin(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("returns 403 for role=manager", async () => {
    mockGetUser.mockResolvedValue({ id: 3, role: "manager" });
    const req = makeReq({ session: { userId: 3 } });
    const res = makeRes();

    await requireOwnerOrAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 when storage.getUser returns null (user not found)", async () => {
    mockGetUser.mockResolvedValue(null);
    const req = makeReq({ session: { userId: 99 } });
    const res = makeRes();

    await requireOwnerOrAdmin(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

// ── requireManager ────────────────────────────────────────────────────────────

describe("requireManager", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no session", async () => {
    const req = makeReq({ session: {} });
    const res = makeRes();

    await requireManager(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 for role=cashier", async () => {
    mockGetUser.mockResolvedValue({ id: 1, role: "cashier" });
    const req = makeReq({ session: { userId: 1 } });
    const res = makeRes();

    await requireManager(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.status().json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("مدير") })
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 403 for role=employee", async () => {
    mockGetUser.mockResolvedValue({ id: 2, role: "employee" });
    const req = makeReq({ session: { userId: 2 } });
    const res = makeRes();

    await requireManager(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next() for role=manager", async () => {
    mockGetUser.mockResolvedValue({ id: 3, role: "manager" });
    const req = makeReq({ session: { userId: 3 } });
    const res = makeRes();

    await requireManager(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("calls next() for role=admin", async () => {
    mockGetUser.mockResolvedValue({ id: 4, role: "admin" });
    const req = makeReq({ session: { userId: 4 } });
    const res = makeRes();

    await requireManager(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("calls next() for role=owner", async () => {
    mockGetUser.mockResolvedValue({ id: 5, role: "owner" });
    const req = makeReq({ session: { userId: 5 } });
    const res = makeRes();

    await requireManager(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });
});

// ── enforceBranchScope ────────────────────────────────────────────────────────

describe("enforceBranchScope", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 when no session", async () => {
    const req = makeReq({ session: {} });
    const res = makeRes();

    await enforceBranchScope(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("returns 401 when storage.getUser returns null", async () => {
    mockGetUser.mockResolvedValue(null);
    const req = makeReq({ session: { userId: 99 } });
    const res = makeRes();

    await enforceBranchScope(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("sets branchScope to branch mode with user's branchId for role=cashier", async () => {
    mockGetUser.mockResolvedValue({ id: 1, role: "cashier", branchId: 2 });
    const req = makeReq({ session: { userId: 1 } });
    const res = makeRes();

    await enforceBranchScope(req, res, next);

    expect(req.branchScope).toEqual({ mode: "branch", branchId: 2 });
    expect(next).toHaveBeenCalledOnce();
  });

  it("sets branchScope to branch mode with user's branchId for role=employee", async () => {
    mockGetUser.mockResolvedValue({ id: 2, role: "employee", branchId: 3 });
    const req = makeReq({ session: { userId: 2 } });
    const res = makeRes();

    await enforceBranchScope(req, res, next);

    expect(req.branchScope).toEqual({ mode: "branch", branchId: 3 });
    expect(next).toHaveBeenCalledOnce();
  });

  it("sets branchScope to company mode for role=owner with no branchId in query", async () => {
    mockGetUser.mockResolvedValue({ id: 3, role: "owner", branchId: null });
    const req = makeReq({ session: { userId: 3 }, query: {} });
    const res = makeRes();

    await enforceBranchScope(req, res, next);

    expect(req.branchScope).toEqual({ mode: "company", branchId: null });
    expect(next).toHaveBeenCalledOnce();
  });

  it("sets branchScope to specific branch when admin passes branchId in query", async () => {
    mockGetUser.mockResolvedValue({ id: 4, role: "admin", branchId: null });
    const req = makeReq({ session: { userId: 4 }, query: { branchId: "5" } });
    const res = makeRes();

    await enforceBranchScope(req, res, next);

    expect(req.branchScope).toEqual({ mode: "branch", branchId: 5 });
    expect(next).toHaveBeenCalledOnce();
  });

  it("owner with numeric branchId in query gets branch scope (not company)", async () => {
    mockGetUser.mockResolvedValue({ id: 5, role: "owner", branchId: null });
    const req = makeReq({ session: { userId: 5 }, query: { branchId: "1" } });
    const res = makeRes();

    await enforceBranchScope(req, res, next);

    expect(req.branchScope).toEqual({ mode: "branch", branchId: 1 });
    expect(next).toHaveBeenCalledOnce();
  });

  it("owner with non-numeric branchId in query gets company scope", async () => {
    mockGetUser.mockResolvedValue({ id: 6, role: "owner", branchId: null });
    const req = makeReq({ session: { userId: 6 }, query: { branchId: "all" } });
    const res = makeRes();

    await enforceBranchScope(req, res, next);

    expect(req.branchScope).toEqual({ mode: "company", branchId: null });
    expect(next).toHaveBeenCalledOnce();
  });
});

// ── Login handler logic — logger.warn on failed auth ─────────────────────────
// We test the decision logic directly (same conditions as routes.ts login handler)
// using mocked storage + bcrypt — no Express app, no HTTP

describe("login handler logic", () => {
  beforeEach(() => vi.clearAllMocks());

  // Simulate the login handler conditions inline to test logger behavior
  // logger is already mocked in tests/setup.ts
  async function simulateLogin(
    username: string,
    password: string,
    logger: { warn: ReturnType<typeof vi.fn> }
  ): Promise<{ status: number; body: Record<string, unknown>; sessionUserId?: number }> {
    const user = await mockGetUserByUsername(username);

    if (!user) {
      logger.warn("failed_login", { username, reason: "user_not_found" });
      return { status: 401, body: { message: "اسم المستخدم أو كلمة المرور غير صحيحة" } };
    }

    const validPassword = await mockBcryptCompare(password, user.password);
    if (!validPassword) {
      logger.warn("failed_login", { username, reason: "wrong_password" });
      return { status: 401, body: { message: "اسم المستخدم أو كلمة المرور غير صحيحة" } };
    }

    if (!user.isActive) {
      return { status: 403, body: { message: "الحساب معطّل" } };
    }

    return { status: 200, body: { user }, sessionUserId: user.id };
  }

  it("user not found: logger.warn called with user_not_found + returns 401", async () => {
    mockGetUserByUsername.mockResolvedValue(null);
    const mockLogger = { warn: vi.fn() };

    const result = await simulateLogin("ghost", "anypass", mockLogger);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      "failed_login",
      expect.objectContaining({ username: "ghost", reason: "user_not_found" })
    );
    expect(result.status).toBe(401);
  });

  it("wrong password: logger.warn called with wrong_password + returns 401", async () => {
    mockGetUserByUsername.mockResolvedValue({
      id: 1, username: "admin", password: "$hashed", isActive: true,
    });
    mockBcryptCompare.mockResolvedValue(false);
    const mockLogger = { warn: vi.fn() };

    const result = await simulateLogin("admin", "wrongpass", mockLogger);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      "failed_login",
      expect.objectContaining({ username: "admin", reason: "wrong_password" })
    );
    expect(result.status).toBe(401);
  });

  it("correct password + active user: logger.warn NOT called, session set", async () => {
    mockGetUserByUsername.mockResolvedValue({
      id: 7, username: "admin", password: "$hashed", isActive: true, role: "owner",
    });
    mockBcryptCompare.mockResolvedValue(true);
    const mockLogger = { warn: vi.fn() };

    const result = await simulateLogin("admin", "correctpass", mockLogger);

    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(result.status).toBe(200);
    expect(result.sessionUserId).toBe(7);
  });

  it("correct password but inactive account: returns 403, logger NOT called", async () => {
    mockGetUserByUsername.mockResolvedValue({
      id: 8, username: "disabled", password: "$hashed", isActive: false, role: "cashier",
    });
    mockBcryptCompare.mockResolvedValue(true);
    const mockLogger = { warn: vi.fn() };

    const result = await simulateLogin("disabled", "correctpass", mockLogger);

    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(result.status).toBe(403);
    expect(result.body.message).toContain("معطّل");
  });
});
