/**
 * server/routes/reports.routes.js
 * 지휘보고 및 수사보고 라우트
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
} from "../utils/helpers.js";
import { writeAuditLog } from "../services/auditService.js";

const router = Router();

// GET /api/reports — 보고서 목록
router.get(
  "/",
  requireAuth,
  asyncWrap(async (req, res) => {
    const result = await db.execute({
      sql: `SELECT r.*
            FROM reports r
            LEFT JOIN cases c ON (
              c.deleted_at = '' AND (
                c.hyeongje_no = r.hyeongje_no OR
                c.suje_no = r.hyeongje_no OR
                c.hyeongje_no = r.suje_no OR
                c.suje_no = r.suje_no
              )
            )
            WHERE r.deleted_at = ''
              AND (c.id IS NULL OR c.is_archived = 0)
            ORDER BY r.created_at DESC`,
      args: [],
    });
    res.json(result.rows.map(toCamel));
  }),
);

// POST /api/reports — 보고서 등록
router.post(
  "/",
  requireAuth,
  asyncWrap(async (req, res) => {
    const r = req.body;
    const lenErr = validateFieldLengths(r, {
      reportNo: "short",
      hyeongjeNo: "short",
      title: "medium",
      suspectName: "short",
      suspectUuid: "short",
      status: "short",
      basisUrl: "url",
      period: "short",
      confiscation: "medium",
    });
    if (lenErr)
      return res.status(400).json({ success: false, message: lenErr });

    const canAssignOthers =
      hasGlobalDataAccess(req.user) ||
      hasSecretariatWorkAccess(req.user) ||
      isManagementAccount(req.user);
    const assignedName = canAssignOthers
      ? r.prosecutorName || req.user.name
      : req.user.name;

    const id = `RPT-${Date.now()}-${randomUUID().slice(0, 8)}`;
    await db.execute({
      sql: `INSERT INTO reports (id, report_no, hyeongje_no, suje_no, title, prosecutor_name,
            suspect_name, suspect_uuid, status, created_at, basis_url, period, confiscation, deleted_at)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        id,
        r.reportNo || "",
        r.hyeongjeNo || "",
        r.sujeNo || r.hyeongjeNo || "",
        r.title || "",
        assignedName,
        r.suspectName || "",
        r.suspectUuid || "",
        r.status || "",
        r.createdAt || "",
        r.basisUrl || "",
        r.period || "",
        r.confiscation || "",
        "",
      ],
    });
    res.json({ success: true, report: { ...r, id } });
  }),
);

// PATCH /api/reports/:id — 보고서 수정
router.patch(
  "/:id",
  requireAuth,
  requireSecretariat,
  requireRecordScope("reports"),
  async (req, res) => {
    const fields = {
      reportNo: "report_no",
      hyeongjeNo: "hyeongje_no",
      sujeNo: "suje_no",
      title: "title",
      prosecutorName: "prosecutor_name",
      suspectName: "suspect_name",
      suspectUuid: "suspect_uuid",
      status: "status",
      basisUrl: "basis_url",
      period: "period",
      confiscation: "confiscation",
    };
    const updates = Object.entries(fields).filter(
      ([field]) => req.body[field] !== undefined,
    );
    if (!updates.length)
      return res
        .status(400)
        .json({ success: false, message: "변경할 값이 없습니다." });
    try {
      await db.execute({
        sql: `UPDATE reports SET ${updates.map(([, column]) => `${column}=?`).join(", ")} WHERE id=?`,
        args: [...updates.map(([field]) => req.body[field]), req.params.id],
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[PATCH /reports]", err);
      res.status(500).json({ success: false, message: "서버 오류" });
    }
  },
);

// DELETE /api/reports/:id — 보고서 삭제
router.delete(
  "/:id",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    try {
      const existing = await db.execute({
        sql: "SELECT report_no, suspect_name FROM reports WHERE id = ? AND deleted_at = ''",
        args: [req.params.id],
      });
      await db.execute({
        sql: "UPDATE reports SET deleted_at = ? WHERE id = ? AND deleted_at = ''",
        args: [new Date().toISOString(), req.params.id],
      });
      const label = existing.rows[0]?.report_no || req.params.id;
      await writeAuditLog({
        action: "DELETE",
        entityType: "report",
        entityId: req.params.id,
        entityLabel: label,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `입건 보고서 삭제: ${label} (피의자: ${existing.rows[0]?.suspect_name || "-"})`,
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[DELETE /reports]", err);
      res
        .status(500)
        .json({ success: false, message: "서버 오류가 발생했습니다." });
    }
  },
);

export default router;
