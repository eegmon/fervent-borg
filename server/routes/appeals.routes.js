/**
 * server/routes/appeals.routes.js
 * 항고 및 재항고 관리 라우트 (24개 전체 필드 완벽 지원 및 영속화)
 */
import { Router } from "express";
import { randomUUID } from "crypto";
import { db } from "../db.js";
import {
  requireAuth,
  requireSecretariat,
  requireRecordScope,
  scopedQuery,
} from "../middlewares/auth.js";
import {
  hasGlobalDataAccess,
  hasSecretariatWorkAccess,
  isManagementAccount,
} from "../config/roles.js";
import {
  toCamel,
  asyncWrap,
} from "../utils/helpers.js";
import { sendNotificationToUser } from "../services/notificationService.js";
import { writeAuditLog } from "../services/auditService.js";

const router = Router();

// ── 1. 항고 목록 조회 (GET /api/appeals) ──────────────────────────────
router.get(
  "/",
  requireAuth,
  asyncWrap(async (req, res) => {
    const result = await db.execute(scopedQuery("appeals", req.user));
    const rows = result.rows.map((row) => {
      const a = toCamel(row);
      // 프론트엔드 호환성을 위한 양방향 alias 보장
      a.appealNo = a.appealNo || a.jibulhangNo || "";
      a.jibulhangNo = a.jibulhangNo || a.appealNo || "";
      a.status = a.appealStatus || a.status || "항고접수";
      a.appealStatus = a.appealStatus || a.status || "항고접수";
      a.disposition = a.appealDisposition || a.disposition || "";
      a.appealDisposition = a.appealDisposition || a.disposition || "";
      a.dispositionDate = a.appealDate || a.dispositionDate || "";
      a.appealDate = a.appealDate || a.dispositionDate || "";
      a.basisUrl = a.appealNoticeUrl || a.appealBasisUrl || a.basisUrl || "";
      return a;
    });
    res.json(rows);
  }),
);

// ── 2. 항고 등록 (POST /api/appeals) ──────────────────────────────────
router.post(
  "/",
  requireAuth,
  asyncWrap(async (req, res) => {
    const a = req.body || {};

    try {
      const canAssignOthers =
        hasGlobalDataAccess(req.user) ||
        hasSecretariatWorkAccess(req.user) ||
        isManagementAccount(req.user);
      const assignedName = canAssignOthers
        ? a.prosecutorName || req.user.name
        : req.user.name;

      const id = `APL-${Date.now()}-${randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString().replace("T", " ").substring(0, 19);

      const appealNo = a.appealNo || a.jibulhangNo || `2026지불항${Date.now().toString().slice(-4)}`;
      const jibulhangNo = a.jibulhangNo || appealNo;
      const status = a.appealStatus || a.status || "항고접수";
      const appealStatus = status;
      const disposition = a.appealDisposition || a.disposition || "항고 접수 심리 중";
      const appealDisposition = disposition;
      const dispositionDate = a.appealDate || a.dispositionDate || "";
      const appealDate = dispositionDate;
      const basisUrl = a.appealNoticeUrl || a.appealBasisUrl || a.basisUrl || "";

      await db.execute({
        sql: `INSERT INTO appeals (
              id, appeal_no, jibulhang_no, gobulhang_no, jaebulhang_no, daejaebulhang_no,
              suje_no, hyeongje_no, beobwon_no, charge_name, prosecutor_name,
              chief_prosecutor, prosecutor_general, suspect_name, suspect_uuid,
              status, appeal_status, disposition, appeal_disposition,
              disposition_date, appeal_date, basis_url, appeal_basis_url,
              appeal_decision, appeal_notice_url, original_status, intake_date,
              intake_basis_url, indictment_status, indictment_doc_url, created_at, deleted_at
            ) VALUES (
              ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,''
            )`,
        args: [
          id,
          appealNo,
          jibulhangNo,
          a.gobulhangNo || "",
          a.jaebulhangNo || "",
          a.daejaebulhangNo || "",
          a.sujeNo || "",
          a.hyeongjeNo || "",
          a.beobwonNo || "",
          a.chargeName || "",
          assignedName,
          a.chiefProsecutor || "",
          a.prosecutorGeneral || "",
          a.suspectName || "",
          a.suspectUuid || "",
          status,
          appealStatus,
          disposition,
          appealDisposition,
          dispositionDate,
          appealDate,
          basisUrl,
          a.appealBasisUrl || "",
          a.appealDecision || "",
          a.appealNoticeUrl || "",
          a.originalStatus || "종국:불기소",
          a.intakeDate || "",
          a.intakeBasisUrl || "",
          a.indictmentStatus || "",
          a.indictmentDocUrl || "",
          now,
        ],
      });

      await writeAuditLog({
        action: "CREATE",
        entityType: "appeal",
        entityId: id,
        entityLabel: appealNo,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `항고 사건 접수: ${appealNo} (피의자: ${a.suspectName || "-"}, 죄명: ${a.chargeName || "-"})`,
      });

      try {
        const prosecutorRow = await db.execute({
          sql: "SELECT id FROM prosecutors WHERE name=? AND status != 'RETIRED'",
          args: [assignedName],
        });
        const prosecutorId = prosecutorRow.rows[0]?.id;
        if (prosecutorId && prosecutorId !== req.user.id) {
          await sendNotificationToUser({
            userId: prosecutorId,
            type: "APPEAL_UPDATED",
            title: "항고 접수",
            message: `[${a.hyeongjeNo || a.sujeNo || appealNo}] (피의자: ${a.suspectName || "-"}) 항고가 접수되었습니다.`,
            linkTab: "appeals",
            linkId: id,
          });
        }
      } catch (e) {
        console.warn("[SSE APPEAL_UPDATED (new) send error]", e.message);
      }

      res.json({
        success: true,
        appeal: {
          ...a,
          id,
          appealNo,
          jibulhangNo,
          status,
          appealStatus,
          disposition,
          appealDisposition,
          dispositionDate,
          appealDate,
          basisUrl,
          prosecutorName: assignedName,
          createdAt: now,
        },
      });
    } catch (err) {
      console.error("[POST /appeals]", err);
      res
        .status(500)
        .json({ success: false, message: err.message || "서버 오류가 발생했습니다." });
    }
  }),
);

// ── 3. 항고 수정 (PATCH /api/appeals/:id) ─────────────────────────────
router.patch(
  "/:id",
  requireAuth,
  requireRecordScope("appeals"),
  async (req, res) => {
    const fields = {
      appealNo: "appeal_no",
      jibulhangNo: "jibulhang_no",
      gobulhangNo: "gobulhang_no",
      jaebulhangNo: "jaebulhang_no",
      daejaebulhangNo: "daejaebulhang_no",
      sujeNo: "suje_no",
      hyeongjeNo: "hyeongje_no",
      beobwonNo: "beobwon_no",
      chargeName: "charge_name",
      prosecutorName: "prosecutor_name",
      chiefProsecutor: "chief_prosecutor",
      prosecutorGeneral: "prosecutor_general",
      suspectName: "suspect_name",
      suspectUuid: "suspect_uuid",
      status: "status",
      appealStatus: "appeal_status",
      disposition: "disposition",
      appealDisposition: "appeal_disposition",
      dispositionDate: "disposition_date",
      appealDate: "appeal_date",
      basisUrl: "basis_url",
      appealBasisUrl: "appeal_basis_url",
      appealDecision: "appeal_decision",
      appealNoticeUrl: "appeal_notice_url",
      originalStatus: "original_status",
      intakeDate: "intake_date",
      intakeBasisUrl: "intake_basis_url",
      indictmentStatus: "indictment_status",
      indictmentDocUrl: "indictment_doc_url",
    };

    const updates = Object.entries(fields)
      .filter(([field]) => req.body[field] !== undefined)
      .map(([field, column]) => ({ column, value: req.body[field] }));

    if (updates.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "변경할 값이 없습니다." });
    }

    try {
      await db.execute({
        sql: `UPDATE appeals SET ${updates.map(({ column }) => `${column}=?`).join(", ")} WHERE id=? AND deleted_at=''`,
        args: [...updates.map(({ value }) => value), req.params.id],
      });

      await writeAuditLog({
        action: "UPDATE",
        entityType: "appeal",
        entityId: req.params.id,
        entityLabel: req.body.appealNo || req.body.jibulhangNo || req.params.id,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `항고 사건 수정: ${updates.map(({ column }) => column).join(", ")}`,
      });

      try {
        const appealRow = await db.execute({
          sql: "SELECT prosecutor_name, hyeongje_no, suje_no, suspect_name, appeal_no FROM appeals WHERE id=? AND deleted_at=''",
          args: [req.params.id],
        });
        if (appealRow.rows.length > 0) {
          const aRow = toCamel(appealRow.rows[0]);
          const targetName = req.body.prosecutorName || aRow.prosecutorName;
          const prosecutorRow = await db.execute({
            sql: "SELECT id FROM prosecutors WHERE name=? AND status != 'RETIRED'",
            args: [targetName || ""],
          });
          const prosecutorId = prosecutorRow.rows[0]?.id;
          if (prosecutorId && prosecutorId !== req.user.id) {
            await sendNotificationToUser({
              userId: prosecutorId,
              type: "APPEAL_UPDATED",
              title: "항고 사건 수정",
              message: `[${aRow.hyeongjeNo || aRow.sujeNo || aRow.appealNo || "-"}] (피의자: ${aRow.suspectName || "-"}) 항고 사건이 수정되었습니다.`,
              linkTab: "appeals",
              linkId: req.params.id,
            });
          }
        }
      } catch (e) {
        console.warn("[SSE APPEAL_UPDATED (patch) send error]", e.message);
      }

      res.json({ success: true, appeal: { ...req.body, id: req.params.id } });
    } catch (err) {
      console.error("[PATCH /appeals]", err);
      res.status(500).json({ success: false, message: "서버 오류" });
    }
  },
);

// ── 4. 항고 삭제 (DELETE /api/appeals/:id) ─────────────────────────────
router.delete(
  "/:id",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    try {
      const existing = await db.execute({
        sql: "SELECT appeal_no, jibulhang_no, suspect_name FROM appeals WHERE id = ? AND deleted_at = ''",
        args: [req.params.id],
      });
      if (existing.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "삭제할 항고 사건을 찾을 수 없습니다." });
      }
      await db.execute({
        sql: "UPDATE appeals SET deleted_at = ? WHERE id = ? AND deleted_at = ''",
        args: [new Date().toISOString(), req.params.id],
      });
      const label =
        existing.rows[0]?.appeal_no ||
        existing.rows[0]?.jibulhang_no ||
        req.params.id;
      await writeAuditLog({
        action: "DELETE",
        entityType: "appeal",
        entityId: req.params.id,
        entityLabel: label,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `항고 기록 삭제: ${label} (피의자: ${existing.rows[0]?.suspect_name || "-"})`,
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[DELETE /appeals]", err);
      res
        .status(500)
        .json({ success: false, message: "서버 오류가 발생했습니다." });
    }
  },
);

export default router;
