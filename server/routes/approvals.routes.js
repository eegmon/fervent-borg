/**
 * server/routes/approvals.routes.js
 * 전자결재 상신, 결재(승인/반려/전결), 문서번호 채번, 결재선 템플릿 라우트
 */
import { Router } from "express";
import { randomUUID } from "crypto";
import { db, getNextSequence } from "../db.js";
import {
  requireAuth,
  requireApprovalAuthority,
  requireApprovalScope,
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
  parseJsonArray,
  asyncWrap,
} from "../utils/helpers.js";
import { writeAuditLog } from "../services/auditService.js";
import { sendNotificationToUser } from "../services/notificationService.js";

const router = Router();

// ── 1. 결재 목록 조회 (GET /api/approvals) ─────────────────────────────
router.get(
  "/approvals",
  requireAuth,
  asyncWrap(async (req, res) => {
    const result = await db.execute(scopedQuery("approvals", req.user));
    res.json(
      result.rows.map((row) => ({
        ...toCamel(row),
        approvals: parseJsonArray(row.approvals_json),
        attachments: parseJsonArray(row.attachments_json),
      })),
    );
  }),
);

// ── 2. 결재 문서번호 채번 (GET /api/approvals/next-doc-no) ────────────
router.get("/approvals/next-doc-no", requireAuth, async (req, res) => {
  try {
    const year = new Date().getFullYear();
    const result = await db.execute({
      sql: `SELECT doc_no FROM approvals WHERE doc_no LIKE ? ORDER BY doc_no DESC LIMIT 20`,
      args: [`${year}-결재-%`],
    });
    let maxExisting = 0;
    for (const row of result.rows) {
      const match = String(row.doc_no || "").match(/-(\d+)$/);
      if (match) {
        maxExisting = Math.max(maxExisting, parseInt(match[1], 10));
      }
    }
    const nextSeq = await getNextSequence(
      `APPROVAL_DOC_${year}`,
      year,
      maxExisting + 1,
    );
    res.json({
      docNo: `${year}-결재-${String(nextSeq).padStart(3, "0")}`,
      seq: nextSeq,
    });
  } catch (err) {
    console.error("[GET /approvals/next-doc-no]", err);
    res.status(500).json({ success: false, message: "서버 오류" });
  }
});

// ── 3. 결재 상신 (POST /api/approvals) ────────────────────────────────
router.post(
  "/approvals",
  requireAuth,
  asyncWrap(async (req, res) => {
    const doc = req.body;

    const canAssignOthers =
      hasGlobalDataAccess(req.user) ||
      hasSecretariatWorkAccess(req.user) ||
      isManagementAccount(req.user);

    if (!canAssignOthers && doc.hyeongjeNo) {
      const caseCheck = await db.execute({
        sql: `SELECT prosecutor_id, prosecutor_name FROM cases
            WHERE (hyeongje_no = ? OR suje_no = ?) AND deleted_at = '' LIMIT 1`,
        args: [doc.hyeongjeNo, doc.hyeongjeNo],
      });
      const caseRow = caseCheck.rows[0];
      if (caseRow && caseRow.prosecutor_name !== req.user.name) {
        return res.status(403).json({
          success: false,
          message: "담당 사건의 결재만 상신할 수 있습니다.",
        });
      }
    }

    const assignedId = canAssignOthers
      ? doc.prosecutorId || req.user.id
      : req.user.id;
    const assignedName = canAssignOthers
      ? doc.prosecutorName || req.user.name
      : req.user.name;

    const approvalId = `APV-${Date.now()}-${randomUUID().slice(0, 8)}`;
    await db.execute({
      sql: `INSERT INTO approvals (id, doc_no, doc_type, doc_type_name, title,
            hyeongje_no, prosecutor_id, prosecutor_name, suspect_name,
            disposition_type, charge_name, summary, status, created_at, approvals_json, attachments_json)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        approvalId,
        doc.docNo || "",
        doc.docType || "",
        doc.docTypeName || "",
        doc.title || "",
        doc.hyeongjeNo || "",
        assignedId,
        assignedName,
        doc.suspectName || "",
        doc.dispositionType || "",
        doc.chargeName || "",
        doc.summary || "",
        doc.status || "",
        doc.createdAt || "",
        JSON.stringify(doc.approvals || []),
        JSON.stringify(doc.attachments || []),
      ],
    });
    await writeAuditLog({
      action: "CREATE",
      entityType: "approval",
      entityId: approvalId,
      entityLabel: doc.docNo || approvalId,
      actorId: req.user.id,
      actorName: req.user.name,
      detail: `결재 문서 상신: ${doc.docTypeName || doc.docType || "서식"}`,
    });

    try {
      const firstPendingStep = (doc.approvals || []).find(
        (s) =>
          s &&
          (s.status === "PENDING" ||
            s.status === "대기" ||
            (typeof s.status === "string" && s.status.includes("대기"))),
      );
      if (
        firstPendingStep?.approverId &&
        firstPendingStep.approverId !== req.user.id
      ) {
        sendNotificationToUser({
          userId: firstPendingStep.approverId,
          type: "APPROVAL_REQ",
          title: "📄 신규 결재 상신",
          message: `${req.user.name}님이 [${doc.title || doc.docTypeName || "결재문서"}] 결재를 요청했습니다.`,
          linkTab: "approvals",
          linkId: approvalId,
        }).catch(() => {});
      }
    } catch {}

    res.json({ success: true, doc: { ...doc, id: approvalId } });
  }),
);

// ── 4. 결재 문서 수정 (PUT /api/approvals/:id) ─────────────────────────
router.put(
  "/approvals/:id",
  requireAuth,
  requireRecordScope("approvals"),
  asyncWrap(async (req, res) => {
    const doc = req.body || {};

    const existing = await db.execute({
      sql: "SELECT status FROM approvals WHERE id = ? AND deleted_at = ''",
      args: [req.params.id],
    });
    if (existing.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "문서를 찾을 수 없습니다." });
    }
    const currentStatus = existing.rows[0].status;
    if (currentStatus === "최종승인" || currentStatus === "최종승인 (전결)") {
      return res.status(409).json({
        success: false,
        message: "최종승인된 결재 문서는 수정할 수 없습니다.",
      });
    }

    await db.execute({
      sql: `UPDATE approvals SET doc_no=?, disposition_type=?, summary=?, hwp_html=?, attachments_json=? WHERE id=?`,
      args: [
        doc.docNo || "",
        doc.dispositionType || "",
        doc.summary || "",
        doc.hwpHtml || "",
        JSON.stringify(doc.attachments || []),
        req.params.id,
      ],
    });
    res.json({ success: true, approval: { ...doc, id: req.params.id } });
  }),
);

// ── 5. 결재 승인 (PUT /api/approvals/:id/approve) ──────────────────────
router.put(
  "/approvals/:id/approve",
  requireAuth,
  requireApprovalAuthority,
  requireApprovalScope,
  async (req, res) => {
    if (req.body?.mode === "ARBITRARY" && !req.user.canArbitraryApprove) {
      return res.status(403).json({
        success: false,
        message: "전결 권한이 설정되지 않은 계정입니다.",
      });
    }
    const docId = req.params.id;
    const docRes = await db.execute({
      sql: "SELECT * FROM approvals WHERE id = ?",
      args: [docId],
    });

    if (docRes.rows.length === 0) {
      return res.status(404).json({ error: "문서를 찾을 수 없습니다." });
    }

    const doc = toCamel(docRes.rows[0]);

    if (doc.status === "최종승인") {
      return res.status(409).json({
        success: false,
        message: "이미 최종승인된 문서입니다.",
      });
    }

    if (req.body?.mode === "ARBITRARY") {
      const caseRes = await db.execute({
        sql: `SELECT supervisor_designated FROM cases
              WHERE (hyeongje_no = ? OR suje_no = ?) AND deleted_at = ''
              LIMIT 1`,
        args: [doc.hyeongjeNo || "", doc.hyeongjeNo || ""],
      });
      if (Number(caseRes.rows[0]?.supervisor_designated) === 1) {
        return res.status(403).json({
          success: false,
          message: "결재 필수 지정 사건은 전결 승인할 수 없습니다.",
        });
      }
    }
    const now = new Date().toISOString().replace("T", " ").substring(0, 16);
    const updatedApprovals = JSON.parse(doc.approvalsJson || "[]").map(
      (a, idx, arr) => {
        const isLast = idx === arr.length - 1;
        const status = String(a.status || "");
        const isPending =
          /대기/.test(status) &&
          !/(승인완료|상신완료|검토승인|최종결재|최종승인|전결승인|대결승인)/.test(
            status,
          );

        return {
          ...a,
          status: isLast
            ? "최종결재(인장날인)"
            : isPending || status === "상신완료" || /검토/.test(status)
              ? "승인완료"
              : status,
          date: a.date === "-" ? now : a.date,
        };
      },
    );

    const batchResult = await db.batch(
      [
        {
          sql: `UPDATE approvals SET status='최종승인', approvals_json=? WHERE id=? AND status != '최종승인'`,
          args: [JSON.stringify(updatedApprovals), docId],
        },
        {
          sql: `UPDATE cases SET disposition=? WHERE (hyeongje_no=? OR suje_no=?) AND deleted_at=''`,
          args: [
            `${doc.dispositionType} (결재완료)`,
            doc.hyeongjeNo,
            doc.hyeongjeNo,
          ],
        },
      ],
      "write",
    );

    if (Number(batchResult[0]?.rowsAffected ?? 1) === 0) {
      return res.status(409).json({
        success: false,
        message: "이미 다른 결재권자가 최종승인한 문서입니다.",
      });
    }

    await writeAuditLog({
      action: "APPROVE",
      entityType: "approval",
      entityId: req.params.id,
      entityLabel: doc.docNo,
      actorId: req.user.id,
      actorName: req.user.name,
      detail: `문서유형: ${doc.docTypeName || doc.docType}, 처분: ${doc.dispositionType}`,
    });

    if (doc.prosecutorId && doc.prosecutorId !== req.user.id) {
      sendNotificationToUser({
        userId: doc.prosecutorId,
        type: "APPROVAL_RESULT",
        title: "✅ 전자결재 승인 완료",
        message: `${req.user.name}님이 [${doc.title || doc.docTypeName || "결재문서"}] 문서를 최종 승인했습니다.`,
        linkTab: "approvals",
        linkId: req.params.id,
      }).catch(() => {});
    }

    res.json({ success: true });
  },
);

// ── 6. 결재 반려 (PUT /api/approvals/:id/reject) ───────────────────────
router.put(
  "/approvals/:id/reject",
  requireAuth,
  requireApprovalAuthority,
  requireApprovalScope,
  async (req, res) => {
    const { reason = "보완수사요구" } = req.body;
    try {
      const docRes = await db.execute({
        sql: "SELECT * FROM approvals WHERE id = ?",
        args: [req.params.id],
      });
      if (docRes.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "문서를 찾을 수 없습니다." });
      }
      const doc = toCamel(docRes.rows[0]);
      const now = new Date().toISOString().replace("T", " ").substring(0, 16);
      const updatedApprovals = JSON.parse(doc.approvalsJson || "[]").map(
        (a) => ({
          ...a,
          status: a.status.includes("대기") ? `반려 (${reason})` : a.status,
          date: a.date === "-" ? now : a.date,
        }),
      );
      const rejectStatus = `반려 — ${reason}`;
      await db.execute({
        sql: `UPDATE approvals SET status=?, approvals_json=? WHERE id=?`,
        args: [rejectStatus, JSON.stringify(updatedApprovals), req.params.id],
      });

      await writeAuditLog({
        action: "REJECT",
        entityType: "approval",
        entityId: req.params.id,
        entityLabel: doc.docNo,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: reason,
      });

      if (doc.prosecutorId && doc.prosecutorId !== req.user.id) {
        sendNotificationToUser({
          userId: doc.prosecutorId,
          type: "APPROVAL_RESULT",
          title: "❌ 전자결재 반려",
          message: `${req.user.name}님이 [${doc.title || doc.docTypeName || "결재문서"}] 문서를 반려했습니다. 사유: ${reason}`,
          linkTab: "approvals",
          linkId: req.params.id,
        }).catch(() => {});
      }

      res.json({ success: true, status: rejectStatus });
    } catch (err) {
      console.error("[PUT /approvals/reject]", err);
      res.status(500).json({ success: false, message: "서버 오류" });
    }
  },
);

// ── 7. 결재선 템플릿 목록 (GET /api/approval-templates) ──────────────
router.get("/approval-templates", requireAuth, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT * FROM approval_templates
            WHERE deleted_at = '' AND (created_by = ? OR is_shared = 1)
            ORDER BY created_at DESC`,
      args: [req.user.id],
    });
    res.json(
      result.rows.map((row) => ({
        ...toCamel(row),
        steps: parseJsonArray(row.steps_json),
      })),
    );
  } catch (err) {
    console.error("[GET /approval-templates]", err);
    res.status(500).json({ success: false, message: "서버 오류" });
  }
});

// ── 8. 결재선 템플릿 생성 (POST /api/approval-templates) ─────────────
router.post("/approval-templates", requireAuth, async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const description = String(req.body?.description || "").trim();
  const steps = req.body?.steps;
  const isShared = req.body?.isShared ? 1 : 0;

  if (!name || name.length > 80) {
    return res
      .status(400)
      .json({ success: false, message: "템플릿 이름은 1~80자여야 합니다." });
  }
  if (!Array.isArray(steps) || steps.length === 0 || steps.length > 10) {
    return res
      .status(400)
      .json({ success: false, message: "결재 단계는 1~10개여야 합니다." });
  }

  try {
    const id = `TPL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);
    await db.execute({
      sql: `INSERT INTO approval_templates (id, name, description, steps_json, created_by, is_shared, dept, created_at, deleted_at)
            VALUES (?,?,?,?,?,?,?,?,'')`,
      args: [
        id,
        name,
        description,
        JSON.stringify(steps),
        req.user.id,
        isShared,
        req.user.dept || "",
        now,
      ],
    });
    res.json({
      success: true,
      template: {
        id,
        name,
        description,
        steps,
        createdBy: req.user.id,
        isShared,
        dept: req.user.dept || "",
        createdAt: now,
      },
    });
  } catch (err) {
    console.error("[POST /approval-templates]", err);
    res.status(500).json({ success: false, message: "서버 오류" });
  }
});

// ── 9. 결재선 템플릿 삭제 (DELETE /api/approval-templates/:id) ────────
router.delete("/approval-templates/:id", requireAuth, async (req, res) => {
  try {
    const result = await db.execute({
      sql: "SELECT created_by FROM approval_templates WHERE id = ? AND deleted_at = ''",
      args: [req.params.id],
    });
    if (!result.rows.length) {
      return res
        .status(404)
        .json({ success: false, message: "템플릿을 찾을 수 없습니다." });
    }
    const row = toCamel(result.rows[0]);
    if (row.createdBy !== req.user.id && !hasGlobalDataAccess(req.user)) {
      return res.status(403).json({
        success: false,
        message: "본인이 만든 템플릿만 삭제할 수 있습니다.",
      });
    }
    await db.execute({
      sql: "UPDATE approval_templates SET deleted_at = ? WHERE id = ?",
      args: [new Date().toISOString(), req.params.id],
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /approval-templates]", err);
    res.status(500).json({ success: false, message: "서버 오류" });
  }
});

export default router;
