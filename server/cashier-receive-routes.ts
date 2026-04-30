// ============================================================================
// File: server/cashier-receive-routes.ts
// Purpose: راوتر استلام التحويلات بالباركود - متوافق مع schema المشروع الفعلي
// Pattern: دالة تسجيل تُستدعى من server/routes.ts
// ============================================================================
//
// التكامل في server/routes.ts:
//
//   import { registerCashierReceiveRoutes } from "./cashier-receive-routes";
//   ...
//   export async function registerRoutes(app: Express) {
//     // ... باقي المسارات الموجودة
//     registerCashierReceiveRoutes(app);
//   }
// ============================================================================

import type { Express, Request, Response } from "express";
import { z } from "zod";
import { pool } from "./db";
import { requireAuth, requireRole, enforceBranchScope } from "./middleware/auth";
import { logger } from "./logger";

// ----------------------------------------------------------------------------
// Helpers - استخراج الـ context من الـ session
// ----------------------------------------------------------------------------
function getUserId(req: Request): number {
  const uid = (req.session as any)?.userId;
  if (!uid) throw new Error("غير مصرح - يرجى تسجيل الدخول");
  return Number(uid);
}

function getBranchId(req: Request): number {
  const scope = (req as any).branchScope;
  if (!scope) throw new Error("لم يتم تحديد صلاحية الفرع - يرجى تسجيل الدخول");
  // الـ owner/admin يكون في وضع 'company' مع branchId = null افتراضياً.
  // لاستلام التحويلات يجب اختيار فرع محدد عبر ?branchId=X في الـ URL.
  if (scope.mode === "company" && !scope.branchId) {
    const err: any = new Error(
      "صلاحية المالك تتطلب تحديد فرع. أضف ?branchId=X في الرابط أو سجّل دخول كـ cashier للفرع."
    );
    err.code = "OWNER_BRANCH_REQUIRED";
    throw err;
  }
  if (!scope.branchId) throw new Error("لم يتم تحديد فرع المستخدم");
  return Number(scope.branchId);
}

// ----------------------------------------------------------------------------
// Validators
// ----------------------------------------------------------------------------
const scanSchema = z.object({
  barcode: z
    .string({ required_error: "الباركود مطلوب" })
    .trim()
    .min(1, "الباركود لا يمكن أن يكون فارغاً")
    .max(255, "الباركود طويل جداً"),
});

const finalizeSchema = z.object({
  notes: z.string().max(1000).optional(),
  allowPartial: z.boolean().optional().default(false),
});

const undoSchema = z.object({
  transferLineId: z.number().int().positive(),
});

// ============================================================================
// تسجيل المسارات على Express app
// ============================================================================
export function registerCashierReceiveRoutes(app: Express) {

  // --------------------------------------------------------------------------
  // GET /api/cashier/incoming-transfers
  // قائمة التحويلات الواردة لفرع الكاشير (تشمل كل locations الفرع)
  // --------------------------------------------------------------------------
  app.get(
    "/api/cashier/incoming-transfers",
    requireAuth,
    enforceBranchScope,
    requireRole(["cashier", "owner", "manager"]),
    async (req: Request, res: Response) => {
      try {
        const branchId = getBranchId(req);

        const sql = `
          SELECT
            st.id,
            st.status,
            st.created_at,
            st.from_location_id,
            fl.name AS from_location_name,
            fl.branch_id AS from_branch_id,
            fb.name AS from_branch_name,
            st.to_location_id,
            tl.name AS to_location_name,
            COALESCE(SUM(stll.qty), 0)::int          AS total_qty,
            COALESCE(SUM(stll.received_qty), 0)::int AS received_qty,
            COUNT(stll.id)::int                       AS lines_count
          FROM stock_transfers st
          JOIN locations tl ON tl.id = st.to_location_id
          LEFT JOIN locations fl ON fl.id = st.from_location_id
          LEFT JOIN branches  fb ON fb.id = fl.branch_id
          LEFT JOIN stock_transfer_lines stll ON stll.transfer_id = st.id
          WHERE tl.branch_id = $1
            AND st.status IN ('approved','in_transit','partially_received')
          GROUP BY st.id, fl.name, fl.branch_id, fb.name, tl.name
          ORDER BY st.created_at DESC
        `;
        const { rows } = await pool.query(sql, [branchId]);
        res.json({ success: true, data: rows });
      } catch (err: any) {
        logger.error("incoming-transfers error", { err: err.message });
        res.status(500).json({ success: false, error: err.message || "خطأ غير متوقع" });
      }
    }
  );

  // --------------------------------------------------------------------------
  // GET /api/cashier/incoming-transfers/:id
  // تفاصيل التحويل + كل المتغيرات بنفس مواصفات صفحة المنتجات
  // --------------------------------------------------------------------------
  app.get(
    "/api/cashier/incoming-transfers/:id",
    requireAuth,
    enforceBranchScope,
    requireRole(["cashier", "owner", "manager"]),
    async (req: Request, res: Response) => {
      try {
        const branchId = getBranchId(req);
        const transferId = parseInt(req.params.id as string, 10);
        if (Number.isNaN(transferId)) {
          return res.status(400).json({ success: false, error: "رقم تحويل غير صالح" });
        }

        // 1) رأس التحويل + التحقق أنه موجّه إلى location داخل فرع الكاشير
        const headerSql = `
          SELECT
            st.id, st.status, st.created_at, st.received_at, st.received_by,
            st.receive_notes,
            st.from_location_id, fl.name AS from_location_name,
            fl.branch_id AS from_branch_id, fb.name AS from_branch_name,
            st.to_location_id, tl.name AS to_location_name,
            tl.branch_id AS to_branch_id
          FROM stock_transfers st
          JOIN locations tl ON tl.id = st.to_location_id
          LEFT JOIN locations fl ON fl.id = st.from_location_id
          LEFT JOIN branches  fb ON fb.id = fl.branch_id
          WHERE st.id = $1 AND tl.branch_id = $2
        `;
        const headerRes = await pool.query(headerSql, [transferId, branchId]);
        if (headerRes.rowCount === 0) {
          return res.status(404).json({
            success: false,
            error: "التحويل غير موجود أو ليس موجهاً لفرعك",
          });
        }

        // 2) البنود مع كل مواصفات الـ variant + اسم/موديل المنتج
        const linesSql = `
          SELECT
            stll.id              AS transfer_line_id,
            stll.variant_id,
            stll.qty             AS quantity,
            stll.received_qty,
            p.id                 AS product_id,
            p.name               AS product_name,
            p.model_number       AS model,
            COALESCE(pv.barcode, p.barcode) AS barcode,
            pv.color,
            pv.size,
            pv.sku,
            COALESCE(pv.image_url, p.image) AS image_url
          FROM stock_transfer_lines stll
          JOIN product_variants pv ON pv.id = stll.variant_id
          JOIN products p          ON p.id  = pv.product_id
          WHERE stll.transfer_id = $1
          ORDER BY p.name ASC, pv.color ASC, pv.size ASC
        `;
        const linesRes = await pool.query(linesSql, [transferId]);

        res.json({
          success: true,
          data: {
            transfer: headerRes.rows[0],
            items: linesRes.rows,
          },
        });
      } catch (err: any) {
        logger.error("incoming-transfer detail error", { err: err.message });
        res.status(500).json({ success: false, error: err.message || "خطأ غير متوقع" });
      }
    }
  );

  // --------------------------------------------------------------------------
  // POST /api/cashier/incoming-transfers/:id/scan
  // تسجيل مسحة باركود لقطعة واحدة
  // --------------------------------------------------------------------------
  app.post(
    "/api/cashier/incoming-transfers/:id/scan",
    requireAuth,
    enforceBranchScope,
    requireRole(["cashier", "owner", "manager"]),
    async (req: Request, res: Response) => {
      const client = await pool.connect();
      try {
        const branchId = getBranchId(req);
        const userId = getUserId(req);
        const transferId = parseInt(req.params.id as string, 10);
        if (Number.isNaN(transferId)) {
          return res.status(400).json({ success: false, error: "رقم تحويل غير صالح" });
        }

        const parsed = scanSchema.safeParse(req.body);
        if (!parsed.success) {
          return res.status(400).json({
            success: false,
            error: parsed.error.issues[0]?.message || "بيانات غير صالحة",
          });
        }
        const barcode = parsed.data.barcode.trim();

        await client.query("BEGIN");

        // 1) قفل التحويل + التحقق من وجهته (داخل فرع الكاشير) وحالته
        const tCheck = await client.query(
          `SELECT st.id, st.status, st.to_location_id, tl.branch_id AS to_branch_id
           FROM stock_transfers st
           JOIN locations tl ON tl.id = st.to_location_id
           WHERE st.id = $1 AND tl.branch_id = $2
           FOR UPDATE OF st`,
          [transferId, branchId]
        );
        if (tCheck.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ success: false, error: "التحويل غير موجود" });
        }
        const tStatus = tCheck.rows[0].status;
        if (!["approved", "in_transit", "partially_received"].includes(tStatus)) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            success: false,
            error: `لا يمكن المسح. حالة التحويل الحالية: ${tStatus}`,
          });
        }

        // 2) ابحث عن البند المطابق للباركود (variant level)
        const lineRes = await client.query(
          `SELECT stll.id, stll.variant_id, stll.qty, stll.received_qty,
                  p.name AS product_name,
                  pv.color, pv.size,
                  COALESCE(pv.barcode, p.barcode) AS barcode
           FROM stock_transfer_lines stll
           JOIN product_variants pv ON pv.id = stll.variant_id
           JOIN products p          ON p.id  = pv.product_id
           WHERE stll.transfer_id = $1
             AND COALESCE(pv.barcode, p.barcode) = $2
           FOR UPDATE OF stll`,
          [transferId, barcode]
        );

        if (lineRes.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({
            success: false,
            error: "هذا الباركود غير موجود في هذا التحويل",
            code: "BARCODE_NOT_IN_TRANSFER",
          });
        }

        const line = lineRes.rows[0];
        if (line.received_qty >= line.qty) {
          await client.query("ROLLBACK");
          return res.status(409).json({
            success: false,
            error: `تم استلام الكمية الكاملة لهذا المنتج (${line.qty})`,
            code: "ALREADY_FULL",
            productName: line.product_name,
          });
        }

        // 3) زيادة received_qty
        const updLine = await client.query(
          `UPDATE stock_transfer_lines
           SET received_qty = received_qty + 1
           WHERE id = $1
           RETURNING received_qty, qty`,
          [line.id]
        );

        // 4) تسجيل المسحة
        await client.query(
          `INSERT INTO transfer_scans
            (transfer_id, transfer_line_id, variant_id, barcode, scanned_by, location_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [transferId, line.id, line.variant_id, barcode, userId, tCheck.rows[0].to_location_id]
        );

        // 5) تحديث حالة التحويل إلى partially_received إن لم تكن كذلك
        if (tStatus !== "partially_received") {
          await client.query(
            `UPDATE stock_transfers SET status = 'partially_received' WHERE id = $1`,
            [transferId]
          );
        }

        await client.query("COMMIT");

        res.json({
          success: true,
          data: {
            transferLineId: line.id,
            variantId: line.variant_id,
            productName: line.product_name,
            color: line.color,
            size: line.size,
            received: updLine.rows[0].received_qty,
            required: updLine.rows[0].qty,
            isComplete: updLine.rows[0].received_qty >= updLine.rows[0].qty,
          },
        });
      } catch (err: any) {
        await client.query("ROLLBACK").catch(() => {});
        logger.error("scan error", { err: err.message });
        res.status(500).json({ success: false, error: err.message || "خطأ غير متوقع" });
      } finally {
        client.release();
      }
    }
  );

  // --------------------------------------------------------------------------
  // POST /api/cashier/incoming-transfers/:id/finalize
  // التأكيد النهائي → تحديث inventory_balances + إغلاق التحويل + audit
  // --------------------------------------------------------------------------
  app.post(
    "/api/cashier/incoming-transfers/:id/finalize",
    requireAuth,
    enforceBranchScope,
    requireRole(["cashier", "owner", "manager"]),
    async (req: Request, res: Response) => {
      const client = await pool.connect();
      try {
        const branchId = getBranchId(req);
        const userId = getUserId(req);
        const transferId = parseInt(req.params.id as string, 10);
        if (Number.isNaN(transferId)) {
          return res.status(400).json({ success: false, error: "رقم تحويل غير صالح" });
        }

        const parsed = finalizeSchema.safeParse(req.body || {});
        if (!parsed.success) {
          return res.status(400).json({
            success: false,
            error: parsed.error.issues[0]?.message || "بيانات غير صالحة",
          });
        }
        const { notes, allowPartial } = parsed.data;

        await client.query("BEGIN");

        // 1) قفل التحويل + التحقق
        const tRes = await client.query(
          `SELECT st.id, st.status, st.to_location_id
           FROM stock_transfers st
           JOIN locations tl ON tl.id = st.to_location_id
           WHERE st.id = $1 AND tl.branch_id = $2
           FOR UPDATE OF st`,
          [transferId, branchId]
        );
        if (tRes.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ success: false, error: "التحويل غير موجود" });
        }
        if (tRes.rows[0].status === "received") {
          await client.query("ROLLBACK");
          return res.status(400).json({
            success: false,
            error: "تم استلام هذا التحويل مسبقاً",
          });
        }
        const toLocationId = tRes.rows[0].to_location_id;

        // 2) جلب البنود + التحقق من الاكتمال
        const linesRes = await client.query(
          `SELECT id, variant_id, qty, received_qty
           FROM stock_transfer_lines WHERE transfer_id = $1`,
          [transferId]
        );

        const incomplete = linesRes.rows.filter(
          (r: any) => r.received_qty < r.qty
        );
        if (incomplete.length > 0 && !allowPartial) {
          await client.query("ROLLBACK");
          return res.status(400).json({
            success: false,
            error: `يوجد ${incomplete.length} بند لم يكتمل مسحه. أكمل المسح أو فعّل خيار "تأكيد مع نقص"`,
            code: "INCOMPLETE_SCAN",
            incompleteCount: incomplete.length,
          });
        }

        // 3) تحديث inventory_balances في to_location_id
        for (const ln of linesRes.rows) {
          if (ln.received_qty <= 0) continue;

          // ملاحظة: inventory_balances لا يحتوي على updated_at - يطابق نمط routes.ts الموجود
          await client.query(
            `INSERT INTO inventory_balances (location_id, variant_id, qty_on_hand, qty_reserved)
             VALUES ($1, $2, $3, 0)
             ON CONFLICT (location_id, variant_id)
             DO UPDATE SET qty_on_hand = inventory_balances.qty_on_hand + EXCLUDED.qty_on_hand`,
            [toLocationId, ln.variant_id, ln.received_qty]
          );
        }

        // 4) إغلاق التحويل
        await client.query(
          `UPDATE stock_transfers
           SET status = 'received',
               received_by = $1,
               received_at = NOW(),
               receive_notes = $2
           WHERE id = $3`,
          [userId, notes || null, transferId]
        );

        // 5) audit (audit_log مفرد + details text)
        await client.query(
          `INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, created_at)
           VALUES ($1, 'transfer_received', 'stock_transfer', $2, $3, NOW())`,
          [
            userId,
            transferId,
            JSON.stringify({
              branchId,
              toLocationId,
              incompleteCount: incomplete.length,
              notes: notes || null,
            }),
          ]
        ).catch((e) => logger.warn("audit_log insert skipped", { e: e.message }));

        await client.query("COMMIT");

        logger.info("stock_transfer received", {
          transferId, userId, branchId, toLocationId,
          partial: incomplete.length > 0,
        });
        res.json({
          success: true,
          data: { transferId, partial: incomplete.length > 0 },
        });
      } catch (err: any) {
        await client.query("ROLLBACK").catch(() => {});
        logger.error("finalize error", { err: err.message });
        res.status(500).json({ success: false, error: err.message || "خطأ غير متوقع" });
      } finally {
        client.release();
      }
    }
  );

  // --------------------------------------------------------------------------
  // POST /api/cashier/incoming-transfers/:id/undo-scan
  // تراجع عن آخر مسحة لبند (في حالة الخطأ)
  // --------------------------------------------------------------------------
  app.post(
    "/api/cashier/incoming-transfers/:id/undo-scan",
    requireAuth,
    enforceBranchScope,
    requireRole(["cashier", "owner", "manager"]),
    async (req: Request, res: Response) => {
      const client = await pool.connect();
      try {
        const branchId = getBranchId(req);
        const transferId = parseInt(req.params.id as string, 10);

        const parsed = undoSchema.safeParse(req.body || {});
        if (!parsed.success || Number.isNaN(transferId)) {
          return res.status(400).json({ success: false, error: "بيانات غير صالحة" });
        }
        const transferLineId = parsed.data.transferLineId;

        await client.query("BEGIN");
        const t = await client.query(
          `SELECT st.id, st.status FROM stock_transfers st
           JOIN locations tl ON tl.id = st.to_location_id
           WHERE st.id = $1 AND tl.branch_id = $2 FOR UPDATE OF st`,
          [transferId, branchId]
        );
        if (t.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json({ success: false, error: "التحويل غير موجود" });
        }
        if (t.rows[0].status === "received") {
          await client.query("ROLLBACK");
          return res.status(400).json({ success: false, error: "تم الإغلاق ولا يمكن التراجع" });
        }

        const upd = await client.query(
          `UPDATE stock_transfer_lines
           SET received_qty = GREATEST(received_qty - 1, 0)
           WHERE id = $1 AND transfer_id = $2 AND received_qty > 0
           RETURNING received_qty, qty`,
          [transferLineId, transferId]
        );
        if (upd.rowCount === 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({ success: false, error: "لا يوجد ما يُتراجع عنه" });
        }

        await client.query(
          `DELETE FROM transfer_scans WHERE id = (
             SELECT id FROM transfer_scans
             WHERE transfer_line_id = $1
             ORDER BY scanned_at DESC LIMIT 1
           )`,
          [transferLineId]
        );

        await client.query("COMMIT");
        res.json({ success: true, data: upd.rows[0] });
      } catch (err: any) {
        await client.query("ROLLBACK").catch(() => {});
        logger.error("undo-scan error", { err: err.message });
        res.status(500).json({ success: false, error: err.message || "خطأ غير متوقع" });
      } finally {
        client.release();
      }
    }
  );
}
