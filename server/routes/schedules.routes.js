/**
 * server/routes/schedules.routes.js
 * 피의자/참고인 조사 및 신문 일정 관리 라우트
 */
import { Router } from "express";
import { db } from "../db.js";
import { requireAuth, requireReadWrite } from "../middlewares/auth.js";
import { toCamel, asyncWrap } from "../utils/helpers.js";
import { sendNotificationToUser } from "../services/notificationService.js";
import { writeAuditLog } from "../services/auditService.js";

const router = Router();

// GET /api/schedules — 조사 일정 목록 조회
router.get(
  "/",
  requireAuth,
  asyncWrap(async (req, res) => {
    const result = await db.execute(
      `SELECT * FROM investigation_schedules WHERE deleted_at = '' ORDER BY scheduled_at ASC`,
    );
    res.json({
      success: true,
      schedules: result.rows.map(toCamel),
    });
  }),
);

// POST /api/schedules — 조사 일정 등록
router.post(
  "/",
  requireAuth,
  requireReadWrite,
  asyncWrap(async (req, res) => {
    const body = req.body || {};
    const id = `SCH-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString();

    const caseId = String(body.caseId || "").trim();
    const hyeongjeNo = String(body.hyeongjeNo || "").trim();
    const targetType = String(body.targetType || "SUSPECT").trim();
    const targetName = String(body.targetName || "").trim();
    const targetContact = String(body.targetContact || "").trim();
    const scheduledAt = String(body.scheduledAt || "").trim();
    const location = String(body.location || "검사실").trim();
    const investigatorId = String(body.investigatorId || req.user.id).trim();
    const investigatorName = String(body.investigatorName || req.user.name).trim();
    const purpose = String(body.purpose || "").trim();
    const notes = String(body.notes || "").trim();

    if (!targetName || !scheduledAt) {
      return res.status(400).json({
        success: false,
        message: "대상자 성명과 조사 일시를 입력해주세요.",
      });
    }

    await db.execute({
      sql: `INSERT INTO investigation_schedules
            (id, case_id, hyeongje_no, target_type, target_name, target_contact, scheduled_at, location, investigator_id, investigator_name, purpose, status, summons_doc_no, summons_issued_at, notes, created_by, created_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'SCHEDULED', '', '', ?, ?, ?, '')`,
      args: [
        id,
        caseId,
        hyeongjeNo,
        targetType,
        targetName,
        targetContact,
        scheduledAt,
        location,
        investigatorId,
        investigatorName,
        purpose,
        notes,
        req.user.name,
        now,
      ],
    });

    const newSchedule = {
      id,
      caseId,
      hyeongjeNo,
      targetType,
      targetName,
      targetContact,
      scheduledAt,
      location,
      investigatorId,
      investigatorName,
      purpose,
      status: "SCHEDULED",
      summonsDocNo: "",
      summonsIssuedAt: "",
      notes,
      createdBy: req.user.name,
      createdAt: now,
    };

    await writeAuditLog({
      action: "CREATE",
      entityType: "schedule",
      entityId: id,
      entityLabel: `${hyeongjeNo || "조사"} | ${targetName}`,
      actorId: req.user.id,
      actorName: req.user.name,
      detail: `조사 일정 등록: ${targetType === "SUSPECT" ? "피의자" : "참고인"} ${targetName} (${scheduledAt})`,
    });

    if (investigatorId && investigatorId !== req.user.id) {
      await sendNotificationToUser({
        userId: investigatorId,
        type: "SCHEDULE",
        title: "📅 신규 조사·신문 일정 등록",
        message: `${req.user.name}님이 [${hyeongjeNo || "사건"}] ${targetName} 조사 일정(${scheduledAt})을 배정/등록했습니다.`,
        linkTab: "schedule",
        linkId: id,
      });
    }

    res.json({ success: true, schedule: newSchedule });
  }),
);

// PATCH /api/schedules/:id — 조사 일정 수정
router.patch(
  "/:id",
  requireAuth,
  requireReadWrite,
  asyncWrap(async (req, res) => {
    const id = req.params.id;
    const existing = await db.execute({
      sql: "SELECT * FROM investigation_schedules WHERE id = ? AND deleted_at = ''",
      args: [id],
    });
    if (existing.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "일정을 찾을 수 없습니다." });
    }

    const current = toCamel(existing.rows[0]);
    const body = req.body || {};

    const targetType = body.targetType !== undefined ? body.targetType : current.targetType;
    const targetName = body.targetName !== undefined ? body.targetName : current.targetName;
    const targetContact = body.targetContact !== undefined ? body.targetContact : current.targetContact;
    const scheduledAt = body.scheduledAt !== undefined ? body.scheduledAt : current.scheduledAt;
    const location = body.location !== undefined ? body.location : current.location;
    const investigatorId = body.investigatorId !== undefined ? body.investigatorId : current.investigatorId;
    const investigatorName = body.investigatorName !== undefined ? body.investigatorName : current.investigatorName;
    const purpose = body.purpose !== undefined ? body.purpose : current.purpose;
    const status = body.status !== undefined ? body.status : current.status;
    const summonsDocNo = body.summonsDocNo !== undefined ? body.summonsDocNo : current.summonsDocNo;
    const summonsIssuedAt = body.summonsIssuedAt !== undefined ? body.summonsIssuedAt : current.summonsIssuedAt;
    const notes = body.notes !== undefined ? body.notes : current.notes;

    await db.execute({
      sql: `UPDATE investigation_schedules SET
              target_type = ?, target_name = ?, target_contact = ?,
              scheduled_at = ?, location = ?, investigator_id = ?, investigator_name = ?,
              purpose = ?, status = ?, summons_doc_no = ?, summons_issued_at = ?, notes = ?
            WHERE id = ?`,
      args: [
        targetType,
        targetName,
        targetContact,
        scheduledAt,
        location,
        investigatorId,
        investigatorName,
        purpose,
        status,
        summonsDocNo,
        summonsIssuedAt,
        notes,
        id,
      ],
    });

    const updated = {
      ...current,
      targetType,
      targetName,
      targetContact,
      scheduledAt,
      location,
      investigatorId,
      investigatorName,
      purpose,
      status,
      summonsDocNo,
      summonsIssuedAt,
      notes,
    };

    res.json({ success: true, schedule: updated });
  }),
);

// DELETE /api/schedules/:id — 조사 일정 삭제
router.delete(
  "/:id",
  requireAuth,
  requireReadWrite,
  asyncWrap(async (req, res) => {
    const id = req.params.id;
    await db.execute({
      sql: `UPDATE investigation_schedules SET deleted_at = datetime('now') WHERE id = ?`,
      args: [id],
    });
    res.json({ success: true });
  }),
);

export default router;
