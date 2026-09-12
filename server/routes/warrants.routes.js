/**
 * server/routes/warrants.routes.js
 * 체포/구속/압수수색 영장 관리 라우트
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
import { toCamel, asyncWrap } from "../utils/helpers.js";
import { sendNotificationToUser } from "../services/notificationService.js";
import { writeAuditLog } from "../services/auditService.js";

const router = Router();

// GET /api/warrants — 영장 목록
router.get(
  "/",
  requireAuth,
  asyncWrap(async (req, res) => {
    const result = await db.execute(scopedQuery("warrants", req.user));
    res.json(result.rows.map(toCamel));
  }),
);

// POST /api/warrants — 영장 청구 등록
router.post("/", requireAuth, async (req, res) => {
  const w = req.body || {};
  const canAssignOthers =
    hasGlobalDataAccess(req.user) ||
    hasSecretariatWorkAccess(req.user) ||
    isManagementAccount(req.user);
  const assignedName = canAssignOthers
    ? w.prosecutorName || req.user.name
    : req.user.name;

  const id = `WAR-${Date.now()}-${randomUUID().slice(0, 8)}`;
  try {
    await db.execute({
      sql: `INSERT INTO warrants (id,warrant_no,warrant_type,warrant_type_name,case_no,suspect_name,suspect_uuid,charge_name,prosecutor_name,target_place,status,requested_at,valid_until,judge_name,notes,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, '')`,
      args: [
        id,
        w.warrantNo || "",
        w.warrantType || "",
        w.warrantTypeName || "",
        w.caseNo || "",
        w.suspectName || "",
        w.suspectUuid || "",
        w.chargeName || "",
        assignedName,
        w.targetPlace || "",
        w.status || "청구중",
        w.requestedAt || new Date().toISOString().slice(0, 10),
        w.validUntil || "",
        w.judgeName || "",
        w.notes || "",
      ],
    });

    try {
      if (req.user.name !== assignedName) {
        const prosecutorRow = await db.execute({
          sql: "SELECT id FROM prosecutors WHERE name=? AND status != 'RETIRED'",
          args: [assignedName],
        });
        const prosecutorId = prosecutorRow.rows[0]?.id;
        if (prosecutorId) {
          await sendNotificationToUser({
            userId: prosecutorId,
            type: "WARRANT_UPDATED",
            title: "영장 청구 배당",
            message: `[${w.caseNo || "-"}] ${w.warrantTypeName || "영장"}이 귀하에게 배당되었습니다. (피의자: ${w.suspectName || "-"})`,
            linkTab: "warrants",
            linkId: id,
          });
        }
      }
    } catch (e) {
      console.warn("[SSE WARRANT_UPDATED (new) send error]", e.message);
    }

    res.json({
      success: true,
      warrant: { ...w, id, prosecutorName: assignedName },
    });
  } catch (err) {
    console.error("[POST /warrants]", err);
    res
      .status(500)
      .json({ success: false, message: "영장 저장에 실패했습니다." });
  }
});

// PATCH /api/warrants/:id — 영장 수정
router.patch(
  "/:id",
  requireAuth,
  requireRecordScope("warrants"),
  async (req, res) => {
    if (req.body.status === undefined)
      return res
        .status(400)
        .json({ success: false, message: "변경할 값이 없습니다." });
    try {
      await db.execute({
        sql: "UPDATE warrants SET status=? WHERE id=? AND deleted_at=''",
        args: [req.body.status, req.params.id],
      });

      try {
        const warrantRow = await db.execute({
          sql: "SELECT prosecutor_name, case_no, suspect_name, warrant_type_name FROM warrants WHERE id=? AND deleted_at=''",
          args: [req.params.id],
        });
        if (warrantRow.rows.length > 0) {
          const wRow = toCamel(warrantRow.rows[0]);
          const prosecutorRow = await db.execute({
            sql: "SELECT id FROM prosecutors WHERE name=? AND status != 'RETIRED'",
            args: [wRow.prosecutorName || ""],
          });
          const prosecutorId = prosecutorRow.rows[0]?.id;
          if (prosecutorId && prosecutorId !== req.user.id) {
            await sendNotificationToUser({
              userId: prosecutorId,
              type: "WARRANT_UPDATED",
              title: "영장 상태 변경",
              message: `[${wRow.caseNo || "-"}] ${wRow.warrantTypeName || "영장"} (피의자: ${wRow.suspectName || "-"}) 상태가 "${req.body.status}"로 변경되었습니다.`,
              linkTab: "warrants",
              linkId: req.params.id,
            });
          }
        }
      } catch (e) {
        console.warn("[SSE WARRANT_UPDATED send error]", e.message);
      }

      res.json({ success: true });
    } catch (err) {
      console.error("[PATCH /warrants]", err);
      res
        .status(500)
        .json({ success: false, message: "영장 수정에 실패했습니다." });
    }
  },
);

// DELETE /api/warrants/:id — 영장 삭제
router.delete(
  "/:id",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    try {
      const existing = await db.execute({
        sql: "SELECT warrant_no, suspect_name FROM warrants WHERE id = ? AND deleted_at = ''",
        args: [req.params.id],
      });
      await db.execute({
        sql: "UPDATE warrants SET deleted_at=? WHERE id=? AND deleted_at=''",
        args: [new Date().toISOString(), req.params.id],
      });
      const label = existing.rows[0]?.warrant_no || req.params.id;
      await writeAuditLog({
        action: "DELETE",
        entityType: "warrant",
        entityId: req.params.id,
        entityLabel: label,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `영장 삭제: ${label} (피의자: ${existing.rows[0]?.suspect_name || "-"})`,
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[DELETE /warrants]", err);
      res
        .status(500)
        .json({ success: false, message: "영장 삭제에 실패했습니다." });
    }
  },
);

export default router;
