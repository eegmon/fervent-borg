/**
 * server/routes/bookings.routes.js
 * 입건 및 지휘부 관리 라우트
 */
import { Router } from "express";
import { randomUUID } from "crypto";
import { db } from "../db.js";
import {
  requireAuth,
  requireSecretariat,
  requireRecordScope,
} from "../middlewares/auth.js";
import {
  hasGlobalDataAccess,
  hasSecretariatWorkAccess,
  isManagementAccount,
} from "../config/roles.js";
import {
  toCamel,
  asyncWrap,
  validateFieldLengths,
  calculateDaysElapsedFromDate,
} from "../utils/helpers.js";
import { writeAuditLog } from "../services/auditService.js";

const router = Router();

// GET /api/bookings — 입건 목록
router.get(
  "/",
  requireAuth,
  asyncWrap(async (req, res) => {
    const result = await db.execute({
      sql: `SELECT b.*
            FROM bookings b
            LEFT JOIN cases c ON (
              c.deleted_at = '' AND (
                c.hyeongje_no = b.hyeongje_no OR
                c.suje_no = b.hyeongje_no OR
                c.hyeongje_no = b.suspect_uuid OR
                c.suje_no = b.suspect_uuid
              )
            )
            WHERE b.deleted_at = ''
              AND (c.id IS NULL OR c.is_archived = 0)
            ORDER BY b.booking_date DESC, b.rowid DESC`,
      args: [],
    });
    const rows = result.rows.map(toCamel).map((row) => ({
      ...row,
      daysElapsed: calculateDaysElapsedFromDate(
        row.bookingDate || row.booking_date,
      ),
    }));
    res.json(rows);
  }),
);

// POST /api/bookings — 입건 등록
router.post(
  "/",
  requireAuth,
  asyncWrap(async (req, res) => {
    const b = req.body;
    const lenErr = validateFieldLengths(b, {
      hyeongjeNo: "short",
      suspectName: "short",
      suspectUuid: "short",
      dispositionStatus: "short",
      bookingDate: "short",
      basisUrl: "url",
      indictmentDecision: "medium",
    });
    if (lenErr)
      return res.status(400).json({ success: false, message: lenErr });

    const canAssignOthers =
      hasGlobalDataAccess(req.user) ||
      hasSecretariatWorkAccess(req.user) ||
      isManagementAccount(req.user);
    const assignedName = canAssignOthers
      ? b.prosecutorName || req.user.name
      : req.user.name;
    const computedDaysElapsed = calculateDaysElapsedFromDate(
      b.bookingDate || "",
    );

    const id = `BKG-${Date.now()}-${randomUUID().slice(0, 8)}`;
    await db.execute({
      sql: `INSERT INTO bookings (id, hyeongje_no, prosecutor_name, suspect_name,
            suspect_uuid, disposition_status, booking_date, basis_url,
            days_elapsed, indictment_decision, deleted_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        id,
        b.hyeongjeNo || "",
        assignedName,
        b.suspectName || "",
        b.suspectUuid || "",
        b.dispositionStatus || "",
        b.bookingDate || "",
        b.basisUrl || "",
        computedDaysElapsed,
        b.indictmentDecision || "",
        "",
      ],
    });
    res.json({ success: true, booking: { ...b, id } });
  }),
);

// PATCH /api/bookings/:id — 입건 수정
router.patch(
  "/:id",
  requireAuth,
  requireSecretariat,
  requireRecordScope("bookings"),
  async (req, res) => {
    const fields = {
      hyeongjeNo: "hyeongje_no",
      prosecutorName: "prosecutor_name",
      suspectName: "suspect_name",
      suspectUuid: "suspect_uuid",
      dispositionStatus: "disposition_status",
      bookingDate: "booking_date",
      basisUrl: "basis_url",
      daysElapsed: "days_elapsed",
      indictmentDecision: "indictment_decision",
    };
    if (req.body.bookingDate !== undefined) {
      req.body.daysElapsed = calculateDaysElapsedFromDate(req.body.bookingDate);
    }
    const updates = Object.entries(fields).filter(
      ([field]) => req.body[field] !== undefined,
    );
    if (!updates.length)
      return res
        .status(400)
        .json({ success: false, message: "변경할 값이 없습니다." });
    try {
      await db.execute({
        sql: `UPDATE bookings SET ${updates.map(([, column]) => `${column}=?`).join(", ")} WHERE id=?`,
        args: [...updates.map(([field]) => req.body[field]), req.params.id],
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[PATCH /bookings]", err);
      res.status(500).json({ success: false, message: "서버 오류" });
    }
  },
);

// DELETE /api/bookings/:id — 입건 삭제
router.delete(
  "/:id",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    try {
      const existing = await db.execute({
        sql: "SELECT hyeongje_no, suspect_name FROM bookings WHERE id = ? AND deleted_at = ''",
        args: [req.params.id],
      });
      await db.execute({
        sql: "UPDATE bookings SET deleted_at = ? WHERE id = ? AND deleted_at = ''",
        args: [new Date().toISOString(), req.params.id],
      });
      const label = existing.rows[0]?.hyeongje_no || req.params.id;
      await writeAuditLog({
        action: "DELETE",
        entityType: "booking",
        entityId: req.params.id,
        entityLabel: label,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `입건 기록 삭제: ${label} (피의자: ${existing.rows[0]?.suspect_name || "-"})`,
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[DELETE /bookings]", err);
      res
        .status(500)
        .json({ success: false, message: "서버 오류가 발생했습니다." });
    }
  },
);

export default router;
