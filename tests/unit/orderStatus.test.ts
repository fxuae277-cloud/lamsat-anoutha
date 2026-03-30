// Phase 8.3 — Order status transition guard logic
// Tests the exact boolean conditions from routes.ts:1654-1661
// No DB, no HTTP — pure logic

import { describe, it, expect } from "vitest";
import { orderStatusSchema } from "../../server/validation";

// ── Mirror the exact guard conditions from routes.ts ──────────────────────────
// routes.ts:1654  if (status === "completed" && oldStatus !== "completed")
// routes.ts:1659  if (status === "cancelled" && oldStatus === "completed")

function shouldDeductInventory(newStatus: string, oldStatus: string): boolean {
  return newStatus === "completed" && oldStatus !== "completed";
}

function shouldRestoreInventory(newStatus: string, oldStatus: string): boolean {
  return newStatus === "cancelled" && oldStatus === "completed";
}

// ── Deduction guard ───────────────────────────────────────────────────────────

describe("shouldDeductInventory", () => {
  it("new → completed: deducts inventory", () => {
    expect(shouldDeductInventory("completed", "new")).toBe(true);
  });

  it("processing → completed: deducts inventory", () => {
    expect(shouldDeductInventory("completed", "processing")).toBe(true);
  });

  it("ready → completed: deducts inventory", () => {
    expect(shouldDeductInventory("completed", "ready")).toBe(true);
  });

  it("completed → completed: NO deduction (idempotent — prevents double deduct)", () => {
    expect(shouldDeductInventory("completed", "completed")).toBe(false);
  });

  it("new → processing: no deduction", () => {
    expect(shouldDeductInventory("processing", "new")).toBe(false);
  });

  it("new → ready: no deduction", () => {
    expect(shouldDeductInventory("ready", "new")).toBe(false);
  });

  it("new → cancelled: no deduction", () => {
    expect(shouldDeductInventory("cancelled", "new")).toBe(false);
  });

  it("completed → cancelled: no deduction (restore path, not deduct)", () => {
    expect(shouldDeductInventory("cancelled", "completed")).toBe(false);
  });
});

// ── Restoration guard ─────────────────────────────────────────────────────────

describe("shouldRestoreInventory", () => {
  it("completed → cancelled: restores inventory", () => {
    expect(shouldRestoreInventory("cancelled", "completed")).toBe(true);
  });

  it("new → cancelled: NO restore (nothing was deducted)", () => {
    expect(shouldRestoreInventory("cancelled", "new")).toBe(false);
  });

  it("processing → cancelled: NO restore", () => {
    expect(shouldRestoreInventory("cancelled", "processing")).toBe(false);
  });

  it("ready → cancelled: NO restore", () => {
    expect(shouldRestoreInventory("cancelled", "ready")).toBe(false);
  });

  it("cancelled → cancelled: NO restore (idempotent — prevents double restore)", () => {
    expect(shouldRestoreInventory("cancelled", "cancelled")).toBe(false);
  });

  it("new → completed: no restore (deduct path)", () => {
    expect(shouldRestoreInventory("completed", "new")).toBe(false);
  });
});

// ── Both guards are mutually exclusive ───────────────────────────────────────

describe("guard mutual exclusivity", () => {
  const transitions: [string, string][] = [
    ["new", "processing"],
    ["processing", "ready"],
    ["ready", "completed"],
    ["completed", "cancelled"],
    ["new", "cancelled"],
    ["completed", "completed"],
    ["cancelled", "cancelled"],
  ];

  it.each(transitions)(
    "%s → %s: deduct and restore are never both true",
    (old, next) => {
      const deduct = shouldDeductInventory(next, old);
      const restore = shouldRestoreInventory(next, old);
      expect(deduct && restore).toBe(false);
    }
  );
});

// ── orderStatusSchema — validates all allowed statuses ───────────────────────

describe("orderStatusSchema", () => {
  const valid = ["new", "processing", "ready", "completed", "paid", "cancelled"];

  it.each(valid)("accepts '%s'", (status) => {
    expect(orderStatusSchema.safeParse({ status }).success).toBe(true);
  });

  it("rejects 'shipped' (not in enum)", () => {
    expect(orderStatusSchema.safeParse({ status: "shipped" }).success).toBe(false);
  });

  it("rejects 'COMPLETED' (case-sensitive)", () => {
    expect(orderStatusSchema.safeParse({ status: "COMPLETED" }).success).toBe(false);
  });

  it("rejects missing status field", () => {
    expect(orderStatusSchema.safeParse({}).success).toBe(false);
  });

  it("rejects null status", () => {
    expect(orderStatusSchema.safeParse({ status: null }).success).toBe(false);
  });
});
