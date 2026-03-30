// Phase 8.2 — Unit tests for server/validation.ts
// No DB, no network — pure schema validation

import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  formatZodError,
  loginSchema,
  createUserSchema,
  updateUserSchema,
  updateProductSchema,
  createProductVariantSchema,
  updateProductVariantSchema,
  quickCreateVariantSchema,
  updateCustomerSchema,
  orderItemSchema,
  orderStatusSchema,
} from "../server/validation";

// ── helpers ────────────────────────────────────────────────────────────────────

function zodErr(schema: z.ZodTypeAny, data: unknown): z.ZodError {
  const result = schema.safeParse(data);
  if (result.success) throw new Error("Expected parse to fail but it succeeded");
  return result.error;
}

// ── formatZodError ─────────────────────────────────────────────────────────────

describe("formatZodError", () => {
  it("returns Arabic field prefix for known fields", () => {
    const err = zodErr(loginSchema, { username: "", password: "abc" });
    const msg = formatZodError(err);
    expect(msg).toContain("اسم المستخدم");
  });

  it("handles too_small string correctly", () => {
    const err = zodErr(createUserSchema, {
      name: "A",
      username: "validuser",
      password: "pass12",
    });
    const msg = formatZodError(err);
    expect(msg).toMatch(/حرف/);
  });

  it("handles required/missing field (invalid_type undefined)", () => {
    const err = zodErr(loginSchema, { password: "abc" });
    const msg = formatZodError(err);
    expect(msg).toContain("مطلوب");
  });

  it("handles invalid_enum_value", () => {
    const err = zodErr(orderStatusSchema, { status: "unknown_status" });
    const msg = formatZodError(err);
    expect(typeof msg).toBe("string");
    expect(msg.length).toBeGreaterThan(0);
  });

  it("handles unknown field key by using the key itself", () => {
    const schema = z.object({ myCustomField: z.string().min(1) });
    const err = zodErr(schema, { myCustomField: "" });
    const msg = formatZodError(err);
    expect(msg).toContain("myCustomField");
  });
});

// ── loginSchema ────────────────────────────────────────────────────────────────

describe("loginSchema", () => {
  it("accepts valid credentials", () => {
    expect(loginSchema.safeParse({ username: "admin", password: "secret" }).success).toBe(true);
  });

  it("rejects empty username", () => {
    expect(loginSchema.safeParse({ username: "", password: "secret" }).success).toBe(false);
  });

  it("rejects empty password", () => {
    expect(loginSchema.safeParse({ username: "admin", password: "" }).success).toBe(false);
  });

  it("rejects missing both fields", () => {
    expect(loginSchema.safeParse({}).success).toBe(false);
  });
});

// ── createUserSchema ───────────────────────────────────────────────────────────

describe("createUserSchema", () => {
  const valid = {
    name: "مدير النظام",
    username: "admin_user",
    password: "pass123",
  };

  it("accepts valid user", () => {
    expect(createUserSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects username with spaces", () => {
    expect(createUserSchema.safeParse({ ...valid, username: "user name" }).success).toBe(false);
  });

  it("rejects username with Arabic characters", () => {
    expect(createUserSchema.safeParse({ ...valid, username: "مستخدم" }).success).toBe(false);
  });

  it("rejects username shorter than 3 chars", () => {
    expect(createUserSchema.safeParse({ ...valid, username: "ab" }).success).toBe(false);
  });

  it("rejects username longer than 30 chars", () => {
    expect(
      createUserSchema.safeParse({ ...valid, username: "a".repeat(31) }).success
    ).toBe(false);
  });

  it("rejects password shorter than 6 chars", () => {
    expect(createUserSchema.safeParse({ ...valid, password: "abc" }).success).toBe(false);
  });

  it("rejects name shorter than 2 chars", () => {
    expect(createUserSchema.safeParse({ ...valid, name: "A" }).success).toBe(false);
  });

  it("accepts valid optional role", () => {
    expect(
      createUserSchema.safeParse({ ...valid, role: "cashier" }).success
    ).toBe(true);
  });

  it("rejects invalid role", () => {
    expect(
      createUserSchema.safeParse({ ...valid, role: "superadmin" }).success
    ).toBe(false);
  });

  it("accepts valid PIN", () => {
    expect(createUserSchema.safeParse({ ...valid, pin: "1234" }).success).toBe(true);
    expect(createUserSchema.safeParse({ ...valid, pin: "123456" }).success).toBe(true);
  });

  it("rejects PIN with letters", () => {
    expect(createUserSchema.safeParse({ ...valid, pin: "123a" }).success).toBe(false);
  });

  it("rejects PIN shorter than 4 digits", () => {
    expect(createUserSchema.safeParse({ ...valid, pin: "123" }).success).toBe(false);
  });

  it("rejects negative salary", () => {
    expect(createUserSchema.safeParse({ ...valid, salary: -100 }).success).toBe(false);
  });

  it("accepts zero salary", () => {
    expect(createUserSchema.safeParse({ ...valid, salary: 0 }).success).toBe(true);
  });

  it("accepts null branchId", () => {
    expect(createUserSchema.safeParse({ ...valid, branchId: null }).success).toBe(true);
  });
});

// ── updateUserSchema ───────────────────────────────────────────────────────────

describe("updateUserSchema", () => {
  it("accepts empty object (all optional)", () => {
    expect(updateUserSchema.safeParse({}).success).toBe(true);
  });

  it("accepts partial update", () => {
    expect(updateUserSchema.safeParse({ name: "اسم جديد", isActive: false }).success).toBe(true);
  });

  it("does not have password field", () => {
    // password is omitted from updateUserSchema
    const schema = updateUserSchema as z.ZodTypeAny;
    const result = schema.safeParse({ password: "newpass" });
    // It's stripped/ignored (passthrough is off), so no error but password is not in output
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).password).toBeUndefined();
    }
  });
});

// ── updateProductSchema ────────────────────────────────────────────────────────

describe("updateProductSchema", () => {
  it("accepts empty object", () => {
    expect(updateProductSchema.safeParse({}).success).toBe(true);
  });

  it("rejects name shorter than 2 chars", () => {
    expect(updateProductSchema.safeParse({ name: "A" }).success).toBe(false);
  });

  it("rejects negative price", () => {
    expect(updateProductSchema.safeParse({ price: -1 }).success).toBe(false);
  });

  it("accepts zero price", () => {
    expect(updateProductSchema.safeParse({ price: 0 }).success).toBe(true);
  });

  it("rejects barcode longer than 50 chars", () => {
    expect(updateProductSchema.safeParse({ barcode: "B".repeat(51) }).success).toBe(false);
  });
});

// ── createProductVariantSchema ─────────────────────────────────────────────────

describe("createProductVariantSchema", () => {
  it("accepts valid variant with price only", () => {
    expect(createProductVariantSchema.safeParse({ price: 25.5 }).success).toBe(true);
  });

  it("rejects negative price", () => {
    expect(createProductVariantSchema.safeParse({ price: -1 }).success).toBe(false);
  });

  it("rejects missing price", () => {
    expect(createProductVariantSchema.safeParse({}).success).toBe(false);
  });

  it("accepts string price (coerced)", () => {
    expect(createProductVariantSchema.safeParse({ price: "30.5" }).success).toBe(true);
  });

  it("rejects barcode longer than 50 chars", () => {
    expect(
      createProductVariantSchema.safeParse({ price: 10, barcode: "X".repeat(51) }).success
    ).toBe(false);
  });
});

// ── updateProductVariantSchema ─────────────────────────────────────────────────

describe("updateProductVariantSchema", () => {
  it("accepts empty object", () => {
    expect(updateProductVariantSchema.safeParse({}).success).toBe(true);
  });

  it("rejects negative price", () => {
    expect(updateProductVariantSchema.safeParse({ price: -5 }).success).toBe(false);
  });
});

// ── quickCreateVariantSchema ───────────────────────────────────────────────────

describe("quickCreateVariantSchema", () => {
  it("requires productName", () => {
    expect(quickCreateVariantSchema.safeParse({}).success).toBe(false);
  });

  it("rejects empty productName", () => {
    expect(quickCreateVariantSchema.safeParse({ productName: "" }).success).toBe(false);
  });

  it("accepts minimal valid input", () => {
    expect(quickCreateVariantSchema.safeParse({ productName: "منتج" }).success).toBe(true);
  });

  it("accepts full valid input", () => {
    expect(
      quickCreateVariantSchema.safeParse({
        productName: "حقيبة جلد",
        categoryId: 3,
        barcode: "1234567890",
        color: "أحمر",
        size: "L",
        price: 45,
        costDefault: 22,
      }).success
    ).toBe(true);
  });
});

// ── updateCustomerSchema ───────────────────────────────────────────────────────

describe("updateCustomerSchema", () => {
  it("accepts empty object", () => {
    expect(updateCustomerSchema.safeParse({}).success).toBe(true);
  });

  it("accepts valid phone", () => {
    expect(updateCustomerSchema.safeParse({ phone: "+96812345678" }).success).toBe(true);
  });

  it("rejects phone with invalid chars", () => {
    expect(updateCustomerSchema.safeParse({ phone: "abc-def" }).success).toBe(false);
  });

  it("rejects phone shorter than 7 chars", () => {
    expect(updateCustomerSchema.safeParse({ phone: "123456" }).success).toBe(false);
  });

  it("rejects name shorter than 2 chars", () => {
    expect(updateCustomerSchema.safeParse({ name: "A" }).success).toBe(false);
  });
});

// ── orderItemSchema ────────────────────────────────────────────────────────────

describe("orderItemSchema", () => {
  const valid = { productId: 1, quantity: 2, unitPrice: 25 };

  it("accepts valid order item", () => {
    expect(orderItemSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects zero quantity", () => {
    expect(orderItemSchema.safeParse({ ...valid, quantity: 0 }).success).toBe(false);
  });

  it("rejects negative quantity", () => {
    expect(orderItemSchema.safeParse({ ...valid, quantity: -1 }).success).toBe(false);
  });

  it("rejects missing productId", () => {
    expect(orderItemSchema.safeParse({ quantity: 1, unitPrice: 10 }).success).toBe(false);
  });

  it("rejects non-integer productId", () => {
    expect(orderItemSchema.safeParse({ ...valid, productId: 1.5 }).success).toBe(false);
  });

  it("rejects negative unitPrice", () => {
    expect(orderItemSchema.safeParse({ ...valid, unitPrice: -5 }).success).toBe(false);
  });

  it("accepts zero unitPrice (free item)", () => {
    expect(orderItemSchema.safeParse({ ...valid, unitPrice: 0 }).success).toBe(true);
  });
});

// ── orderStatusSchema ──────────────────────────────────────────────────────────

describe("orderStatusSchema", () => {
  const validStatuses = ["new", "processing", "ready", "completed", "paid", "cancelled"];

  it.each(validStatuses)("accepts status=%s", (status) => {
    expect(orderStatusSchema.safeParse({ status }).success).toBe(true);
  });

  it("rejects unknown status", () => {
    expect(orderStatusSchema.safeParse({ status: "shipped" }).success).toBe(false);
  });

  it("rejects missing status", () => {
    expect(orderStatusSchema.safeParse({}).success).toBe(false);
  });
});
