/**
 * Opening Stock Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Initializes inventory for a branch without a purchase invoice.
 * Follows the service-layer pattern; all DB work happens inside a single
 * transaction so a partial failure leaves no orphaned rows.
 *
 * Lifecycle:  draft  →  committed  (→  reset → draft again)
 */

import { pool } from "../db";
import { createAutoJournal } from "../autoJournal";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OpeningStockItem {
  productId: number;
  quantity: number;   // units (positive)
  unitCost: number;   // cost per unit in branch currency
}

export interface OpeningStockEntry {
  id: number;
  branchId: number;
  branchName: string;
  status: "draft" | "committed" | "reset";
  notes: string | null;
  createdBy: number;
  createdByName: string;
  createdAt: string;
  committedAt: string | null;
  items: OpeningStockItemRow[];
  totalValue: number;
  itemCount: number;
}

export interface OpeningStockItemRow {
  id: number;
  entryId: number;
  productId: number;
  productName: string;
  barcode: string | null;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

// ─── Validation ───────────────────────────────────────────────────────────────

function validateItems(items: OpeningStockItem[]): void {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("يجب إدخال منتج واحد على الأقل");
  }
  for (const item of items) {
    if (!item.productId || typeof item.productId !== "number") {
      throw new Error(`productId غير صالح: ${item.productId}`);
    }
    if (typeof item.quantity !== "number" || item.quantity <= 0) {
      throw new Error(`الكمية يجب أن تكون أكبر من صفر للمنتج ${item.productId}`);
    }
    if (typeof item.unitCost !== "number" || item.unitCost < 0) {
      throw new Error(`تكلفة الوحدة يجب أن تكون صفراً أو أكثر للمنتج ${item.productId}`);
    }
  }
  // Duplicate product check
  const seen = new Set<number>();
  for (const item of items) {
    if (seen.has(item.productId)) {
      throw new Error(`المنتج ${item.productId} مكرر — ادمج الكميات في سطر واحد`);
    }
    seen.add(item.productId);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getBranchDefaultLocationId(
  client: any,
  branchId: number
): Promise<number> {
  const res = await client.query(
    `SELECT id FROM locations
     WHERE branch_id = $1 AND is_branch_default = true AND active = true
     LIMIT 1`,
    [branchId]
  );
  if (res.rows.length > 0) return res.rows[0].id;

  // Fallback: first active location for the branch
  const fallback = await client.query(
    `SELECT id FROM locations WHERE branch_id = $1 AND active = true ORDER BY id LIMIT 1`,
    [branchId]
  );
  if (fallback.rows.length > 0) return fallback.rows[0].id;

  throw new Error(`لا يوجد مخزن مرتبط بالفرع ${branchId}`);
}

// ─── Core service functions ───────────────────────────────────────────────────

/**
 * Create (or overwrite) a DRAFT opening stock entry for a branch.
 * If a committed entry already exists → throws (use resetOpeningStock first).
 */
export async function initializeOpeningStock(
  branchId: number,
  items: OpeningStockItem[],
  createdBy: number,
  notes?: string
): Promise<{ entryId: number }> {
  // ── Validate input ──────────────────────────────────────────────────────────
  if (!branchId) throw new Error("branchId مطلوب");
  if (!createdBy) throw new Error("createdBy مطلوب");
  validateItems(items);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── Guard: block if committed entry exists ──────────────────────────────
    const existing = await client.query(
      `SELECT id, status FROM opening_stock_entries WHERE branch_id = $1 ORDER BY id DESC LIMIT 1`,
      [branchId]
    );
    if (existing.rows.length > 0) {
      const { id: existingId, status } = existing.rows[0];
      if (status === "committed") {
        throw new Error(
          `يوجد مخزون افتتاحي مُثبَّت للفرع (id=${existingId}). استخدم إعادة تعيين المخزون الافتتاحي أولاً.`
        );
      }
      // If draft → delete old draft and recreate (overwrite)
      if (status === "draft") {
        await client.query(
          `DELETE FROM opening_stock_entries WHERE id = $1`,
          [existingId]
        );
      }
    }

    // ── Verify all productIds exist ─────────────────────────────────────────
    const productIds = items.map((i) => i.productId);
    const prodCheck = await client.query(
      `SELECT id FROM products WHERE id = ANY($1::int[])`,
      [productIds]
    );
    const foundIds = new Set(prodCheck.rows.map((r: any) => r.id));
    for (const pid of productIds) {
      if (!foundIds.has(pid)) throw new Error(`المنتج ${pid} غير موجود`);
    }

    // ── Insert entry header ──────────────────────────────────────────────────
    const entryRes = await client.query(
      `INSERT INTO opening_stock_entries
         (branch_id, created_by, notes, status, created_at)
       VALUES ($1, $2, $3, 'draft', NOW())
       RETURNING id`,
      [branchId, createdBy, notes ?? null]
    );
    const entryId: number = entryRes.rows[0].id;

    // ── Insert items ─────────────────────────────────────────────────────────
    for (const item of items) {
      await client.query(
        `INSERT INTO opening_stock_items
           (entry_id, product_id, quantity, unit_cost)
         VALUES ($1, $2, $3, $4)`,
        [entryId, item.productId, item.quantity, item.unitCost]
      );
    }

    // ── Audit log ────────────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO opening_stock_audit
         (entry_id, action, performed_by, performed_at, notes)
       VALUES ($1, 'created_draft', $2, NOW(), $3)`,
      [entryId, createdBy, `مسودة مخزون افتتاحي — ${items.length} منتج`]
    );

    await client.query("COMMIT");
    return { entryId };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Commit a DRAFT entry: applies stock to location_inventory,
 * updates product avg_cost, and generates the accounting journal.
 */
export async function commitOpeningStock(
  entryId: number,
  committedBy: number
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // ── Load entry ───────────────────────────────────────────────────────────
    const entryRes = await client.query(
      `SELECT * FROM opening_stock_entries WHERE id = $1 FOR UPDATE`,
      [entryId]
    );
    if (entryRes.rows.length === 0) throw new Error("المدخل غير موجود");
    const entry = entryRes.rows[0];

    if (entry.status === "committed") {
      throw new Error("هذا المخزون الافتتاحي مُثبَّت بالفعل");
    }
    if (entry.status === "reset") {
      throw new Error("هذا المخزون الافتتاحي تم إعادة تعيينه");
    }

    // ── Load items ───────────────────────────────────────────────────────────
    const itemsRes = await client.query(
      `SELECT osi.*, p.name AS product_name, p.avg_cost, p.stock_qty,
              p.barcode
       FROM opening_stock_items osi
       JOIN products p ON p.id = osi.product_id
       WHERE osi.entry_id = $1`,
      [entryId]
    );
    if (itemsRes.rows.length === 0) throw new Error("لا توجد أصناف");

    const locationId = await getBranchDefaultLocationId(client, entry.branch_id);
    let totalValue = 0;

    for (const item of itemsRes.rows) {
      const qty = parseFloat(item.quantity);
      const cost = parseFloat(item.unit_cost);
      const lineCost = qty * cost;
      totalValue += lineCost;

      // ── Check if product has variants ─────────────────────────────────────
      const variantCheck = await client.query(
        `SELECT id FROM product_variants WHERE product_id = $1 LIMIT 1`,
        [item.product_id]
      );
      const hasVariants = variantCheck.rows.length > 0;

      if (!hasVariants) {
        // UPSERT into location_inventory
        const existing = await client.query(
          `SELECT qty_on_hand FROM location_inventory
           WHERE location_id = $1 AND product_id = $2`,
          [locationId, item.product_id]
        );
        const currentQty = parseFloat(existing.rows[0]?.qty_on_hand ?? "0");
        const newQty = currentQty + qty;

        await client.query(
          `INSERT INTO location_inventory (location_id, product_id, qty_on_hand, reorder_level, updated_at)
           VALUES ($1, $2, $3, 5, NOW())
           ON CONFLICT (location_id, product_id)
           DO UPDATE SET qty_on_hand = $3, updated_at = NOW()`,
          [locationId, item.product_id, newQty]
        );

        // Update product: weighted average cost + stock_qty
        const currentAvgCost = parseFloat(item.avg_cost ?? "0");
        const currentStockQty = parseFloat(item.stock_qty ?? "0");
        const newStock = currentStockQty + qty;
        const newAvgCost =
          newStock > 0
            ? (currentStockQty * currentAvgCost + qty * cost) / newStock
            : cost;

        await client.query(
          `UPDATE products
           SET avg_cost = $1, stock_qty = $2, cost_default = $3
           WHERE id = $4`,
          [newAvgCost.toFixed(3), Math.round(newStock), cost.toFixed(3), item.product_id]
        );
      }
      // Note: products with variants require per-variant opening stock
      // (variant_id column can be added to opening_stock_items in a future iteration)
    }

    // ── Mark entry as committed ──────────────────────────────────────────────
    await client.query(
      `UPDATE opening_stock_entries
       SET status = 'committed', committed_at = NOW(), committed_by = $1
       WHERE id = $2`,
      [committedBy, entryId]
    );

    // ── Audit log ────────────────────────────────────────────────────────────
    await client.query(
      `INSERT INTO opening_stock_audit
         (entry_id, action, performed_by, performed_at, notes)
       VALUES ($1, 'committed', $2, NOW(), $3)`,
      [entryId, committedBy, `تثبيت مخزون افتتاحي — إجمالي قيمة: ${totalValue.toFixed(3)}`]
    );

    await client.query("COMMIT");

    // ── Accounting Journal (outside transaction to avoid deadlock) ───────────
    // Debit: Inventory (1301)  Credit: Opening Balance Equity (3100)
    if (totalValue > 0) {
      await createAutoJournal({
        date: new Date().toISOString().slice(0, 10),
        description: `مخزون افتتاحي — الفرع ${entry.branch_id}`,
        sourceType: "opening_stock",
        sourceId: entryId,
        branchId: entry.branch_id,
        createdBy: committedBy,
        lines: [
          {
            accountCode: "1301",
            debit: totalValue,
            credit: 0,
            description: "مخزون افتتاحي — مدين",
          },
          {
            accountCode: "3100",
            debit: 0,
            credit: totalValue,
            description: "رأس المال الافتتاحي — دائن",
          },
        ],
      });
    }
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Reset (reverse) a committed opening stock entry.
 * Subtracts the quantities from location_inventory and re-opens the branch
 * for a fresh initialization.
 */
export async function resetOpeningStock(
  branchId: number,
  resetBy: number
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const entryRes = await client.query(
      `SELECT * FROM opening_stock_entries
       WHERE branch_id = $1 AND status = 'committed'
       ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [branchId]
    );
    if (entryRes.rows.length === 0) {
      throw new Error("لا يوجد مخزون افتتاحي مُثبَّت لهذا الفرع");
    }
    const entry = entryRes.rows[0];

    const itemsRes = await client.query(
      `SELECT osi.*, p.avg_cost, p.stock_qty
       FROM opening_stock_items osi
       JOIN products p ON p.id = osi.product_id
       WHERE osi.entry_id = $1`,
      [entry.id]
    );

    const locationId = await getBranchDefaultLocationId(client, branchId);

    for (const item of itemsRes.rows) {
      const qty = parseFloat(item.quantity);

      const variantCheck = await client.query(
        `SELECT id FROM product_variants WHERE product_id = $1 LIMIT 1`,
        [item.product_id]
      );
      if (variantCheck.rows.length > 0) continue; // skip variant products

      // Reduce location_inventory
      await client.query(
        `UPDATE location_inventory
         SET qty_on_hand = GREATEST(0, qty_on_hand - $1), updated_at = NOW()
         WHERE location_id = $2 AND product_id = $3`,
        [qty, locationId, item.product_id]
      );

      // Reduce product stock_qty
      const currentStock = parseFloat(item.stock_qty ?? "0");
      const newStock = Math.max(0, currentStock - qty);
      await client.query(
        `UPDATE products SET stock_qty = $1 WHERE id = $2`,
        [Math.round(newStock), item.product_id]
      );
    }

    // Mark as reset
    await client.query(
      `UPDATE opening_stock_entries
       SET status = 'reset', reset_at = NOW(), reset_by = $1
       WHERE id = $2`,
      [resetBy, entry.id]
    );

    await client.query(
      `INSERT INTO opening_stock_audit
         (entry_id, action, performed_by, performed_at, notes)
       VALUES ($1, 'reset', $2, NOW(), 'إعادة تعيين المخزون الافتتاحي')`,
      [entry.id, resetBy]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get the latest opening stock entry + items for a branch.
 */
export async function getOpeningStock(branchId: number): Promise<OpeningStockEntry | null> {
  const entryRes = await pool.query(
    `SELECT ose.*,
            b.name  AS branch_name,
            u.name  AS created_by_name
     FROM   opening_stock_entries ose
     JOIN   branches b ON b.id = ose.branch_id
     JOIN   users    u ON u.id = ose.created_by
     WHERE  ose.branch_id = $1
     ORDER  BY ose.id DESC
     LIMIT  1`,
    [branchId]
  );
  if (entryRes.rows.length === 0) return null;

  const e = entryRes.rows[0];

  const itemsRes = await pool.query(
    `SELECT osi.*, p.name AS product_name, p.barcode
     FROM opening_stock_items osi
     JOIN products p ON p.id = osi.product_id
     WHERE osi.entry_id = $1
     ORDER BY p.name`,
    [e.id]
  );

  const items: OpeningStockItemRow[] = itemsRes.rows.map((r: any) => ({
    id: r.id,
    entryId: r.entry_id,
    productId: r.product_id,
    productName: r.product_name,
    barcode: r.barcode,
    quantity: parseFloat(r.quantity),
    unitCost: parseFloat(r.unit_cost),
    totalCost: parseFloat(r.quantity) * parseFloat(r.unit_cost),
  }));

  const totalValue = items.reduce((s, i) => s + i.totalCost, 0);

  return {
    id: e.id,
    branchId: e.branch_id,
    branchName: e.branch_name,
    status: e.status,
    notes: e.notes,
    createdBy: e.created_by,
    createdByName: e.created_by_name,
    createdAt: e.created_at,
    committedAt: e.committed_at ?? null,
    items,
    totalValue,
    itemCount: items.length,
  };
}

/**
 * List all branches with their opening stock status.
 */
export async function listOpeningStockStatus(): Promise<
  { branchId: number; branchName: string; status: string | null; entryId: number | null; totalValue: number; itemCount: number }[]
> {
  const res = await pool.query(`
    SELECT
      b.id   AS branch_id,
      b.name AS branch_name,
      ose.id AS entry_id,
      ose.status,
      COALESCE(
        (SELECT SUM(osi.quantity::numeric * osi.unit_cost::numeric)
         FROM opening_stock_items osi
         WHERE osi.entry_id = ose.id), 0
      ) AS total_value,
      COALESCE(
        (SELECT COUNT(*) FROM opening_stock_items osi WHERE osi.entry_id = ose.id), 0
      ) AS item_count
    FROM branches b
    LEFT JOIN LATERAL (
      SELECT id, status FROM opening_stock_entries
      WHERE branch_id = b.id
      ORDER BY id DESC LIMIT 1
    ) ose ON true
    ORDER BY b.name
  `);

  return res.rows.map((r: any) => ({
    branchId: r.branch_id,
    branchName: r.branch_name,
    entryId: r.entry_id ?? null,
    status: r.status ?? null,
    totalValue: parseFloat(r.total_value ?? "0"),
    itemCount: parseInt(r.item_count ?? "0"),
  }));
}

/**
 * Parse a CSV buffer into OpeningStockItem[].
 * Expected header: barcode,quantity,unit_cost  (or: product_id,quantity,unit_cost)
 */
export async function parseCsvToItems(csvText: string): Promise<OpeningStockItem[]> {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) throw new Error("الملف فارغ أو لا يحتوي على بيانات");

  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const barcodeIdx = header.indexOf("barcode");
  const productIdIdx = header.indexOf("product_id");
  const qtyIdx = header.indexOf("quantity");
  const costIdx = header.indexOf("unit_cost");

  if (qtyIdx === -1 || costIdx === -1) {
    throw new Error("الملف يجب أن يحتوي على أعمدة: quantity و unit_cost");
  }
  if (barcodeIdx === -1 && productIdIdx === -1) {
    throw new Error("الملف يجب أن يحتوي على عمود: barcode أو product_id");
  }

  const items: OpeningStockItem[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    const qty = parseFloat(cols[qtyIdx]);
    const cost = parseFloat(cols[costIdx]);

    if (isNaN(qty) || qty <= 0) {
      errors.push(`سطر ${i + 1}: الكمية غير صالحة`);
      continue;
    }
    if (isNaN(cost) || cost < 0) {
      errors.push(`سطر ${i + 1}: التكلفة غير صالحة`);
      continue;
    }

    if (productIdIdx !== -1) {
      const pid = parseInt(cols[productIdIdx]);
      if (isNaN(pid)) { errors.push(`سطر ${i + 1}: product_id غير صالح`); continue; }
      items.push({ productId: pid, quantity: qty, unitCost: cost });
    } else {
      // Resolve barcode → product_id
      const barcode = cols[barcodeIdx];
      if (!barcode) { errors.push(`سطر ${i + 1}: الباركود فارغ`); continue; }
      const prodRes = await pool.query(
        `SELECT id FROM products WHERE barcode = $1 LIMIT 1`,
        [barcode]
      );
      if (prodRes.rows.length === 0) {
        errors.push(`سطر ${i + 1}: باركود غير موجود (${barcode})`);
        continue;
      }
      items.push({ productId: prodRes.rows[0].id, quantity: qty, unitCost: cost });
    }
  }

  if (errors.length > 0) {
    throw new Error(`أخطاء في الملف:\n${errors.join("\n")}`);
  }
  if (items.length === 0) throw new Error("لم يتم استخراج أي منتجات من الملف");

  return items;
}
