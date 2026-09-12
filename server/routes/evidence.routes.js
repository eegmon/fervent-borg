/**
 * server/routes/evidence.routes.js
 * 증거자료, 수사 메모, 사건 변경 히스토리 관리 라우트
 */
import { Router } from "express";
import { randomUUID } from "crypto";
import { db } from "../db.js";
import {
  requireAuth,
  requireCaseScope,
  findCaseForEvidence,
} from "../middlewares/auth.js";
import {
  hasGlobalDataAccess,
  hasSecretariatWorkAccess,
} from "../config/roles.js";
import {
  toCamel,
  asyncWrap,
  validateEvidenceUrl,
  EVIDENCE_MAX_PER_CASE,
} from "../utils/helpers.js";

const router = Router();

// GET /api/cases/:id/history — 사건 수정 이력
router.get(
  "/cases/:id/history",
  requireAuth,
  requireCaseScope,
  async (req, res) => {
    try {
      const result = await db.execute({
        sql: "SELECT * FROM case_history WHERE case_id = ? ORDER BY created_at DESC",
        args: [req.params.id],
      });
      res.json(result.rows.map(toCamel));
    } catch (err) {
      console.error("[GET /cases/history]", err);
      res.status(500).json({ success: false, message: "서버 오류" });
    }
  },
);

// GET /api/cases/:caseNo/evidence — 사건 증거 목록
router.get(
  "/cases/:caseNo/evidence",
  requireAuth,
  asyncWrap(async (req, res) => {
    try {
      const caseItem = await findCaseForEvidence(req.params.caseNo, req.user);
      if (!caseItem)
        return res.status(403).json({
          success: false,
          message: "해당 사건에 접근할 권한이 없습니다.",
        });
      const result = await db.execute({
        sql: "SELECT * FROM evidence WHERE case_no = ? AND deleted_at = '' ORDER BY created_at DESC",
        args: [req.params.caseNo],
      });
      res.json(result.rows.map(toCamel));
    } catch (err) {
      console.error("[GET /evidence]", err);
      res.status(500).json({ success: false, message: "서버 오류" });
    }
  }),
);

// POST /api/cases/:caseNo/evidence — 사건 증거 등록
router.post(
  "/cases/:caseNo/evidence",
  requireAuth,
  asyncWrap(async (req, res) => {
    const { title = "", url = "", type = "DOCUMENT", record = "" } = req.body;
    const urlTrimmed = String(url).trim();
    const urlError = validateEvidenceUrl(urlTrimmed);
    if (urlError) {
      return res.status(400).json({ success: false, message: urlError });
    }
    try {
      const caseItem = await findCaseForEvidence(req.params.caseNo, req.user);
      if (!caseItem)
        return res.status(403).json({
          success: false,
          message: "해당 사건에 접근할 권한이 없습니다.",
        });

      const countRes = await db.execute({
        sql: "SELECT COUNT(*) AS cnt FROM evidence WHERE case_no = ? AND deleted_at = ''",
        args: [req.params.caseNo],
      });
      if (Number(countRes.rows[0]?.cnt || 0) >= EVIDENCE_MAX_PER_CASE) {
        return res.status(400).json({
          success: false,
          message: `사건당 증거자료는 최대 ${EVIDENCE_MAX_PER_CASE}건까지 등록할 수 있습니다.`,
        });
      }
      const id = `EVD-${Date.now()}-${randomUUID().slice(0, 7)}`;
      const now = new Date().toISOString();
      await db.execute({
        sql: `INSERT INTO evidence (id, case_no, title, url, evidence_type, record, created_by, created_at, deleted_at)
            VALUES (?,?,?,?,?,?,?,?,'')`,
        args: [
          id,
          req.params.caseNo,
          title.trim() || "증거 자료",
          urlTrimmed,
          type,
          record.trim(),
          req.user.id,
          now,
        ],
      });
      res.json({
        success: true,
        evidence: {
          id,
          caseNo: req.params.caseNo,
          title: title.trim() || "증거 자료",
          url: urlTrimmed,
          type,
          record: record.trim(),
          createdBy: req.user.id,
          createdAt: now,
        },
      });
    } catch (err) {
      console.error("[POST /evidence]", err);
      res.status(500).json({ success: false, message: "서버 오류" });
    }
  }),
);

// DELETE /api/evidence/:id — 증거 삭제
router.delete("/evidence/:id", requireAuth, async (req, res) => {
  try {
    const result = await db.execute({
      sql: hasGlobalDataAccess(req.user)
        ? "SELECT case_no FROM evidence WHERE id = ? AND deleted_at = ''"
        : `SELECT e.case_no FROM evidence e JOIN cases c ON c.hyeongje_no = e.case_no OR c.suje_no = e.case_no
           JOIN prosecutors p ON c.prosecutor_id = p.id
           WHERE e.id = ? AND e.deleted_at = '' AND p.dept = (SELECT dept FROM prosecutors WHERE id = ?)`,
      args: hasGlobalDataAccess(req.user)
        ? [req.params.id]
        : [req.params.id, req.user.id],
    });
    if (!result.rows.length)
      return res
        .status(404)
        .json({ success: false, message: "증거자료를 찾을 수 없습니다." });
    await db.execute({
      sql: "UPDATE evidence SET deleted_at = ? WHERE id = ?",
      args: [new Date().toISOString(), req.params.id],
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /evidence]", err);
    res.status(500).json({ success: false, message: "서버 오류" });
  }
});

// PATCH /api/evidence/:id — 증거 수정
router.patch(
  "/evidence/:id",
  requireAuth,
  asyncWrap(async (req, res) => {
    const { url } = req.body || {};
    if (url !== undefined) {
      const urlTrimmed = String(url).trim();
      const urlError = validateEvidenceUrl(urlTrimmed);
      if (urlError) {
        return res.status(400).json({ success: false, message: urlError });
      }
    }
    try {
      const result = await db.execute({
        sql: hasGlobalDataAccess(req.user)
          ? "SELECT case_no FROM evidence WHERE id = ? AND deleted_at = ''"
          : `SELECT e.case_no FROM evidence e JOIN cases c ON c.hyeongje_no = e.case_no OR c.suje_no = e.case_no
           JOIN prosecutors p ON c.prosecutor_id = p.id WHERE e.id = ? AND e.deleted_at = ''
           AND p.dept = (SELECT dept FROM prosecutors WHERE id = ?)`,
        args: hasGlobalDataAccess(req.user)
          ? [req.params.id]
          : [req.params.id, req.user.id],
      });
      if (!result.rows.length)
        return res
          .status(404)
          .json({ success: false, message: "증거자료를 찾을 수 없습니다." });
      const fields = {
        title: "title",
        type: "evidence_type",
        record: "record",
        url: "url",
      };
      const updates = Object.entries(fields).filter(
        ([field]) => req.body[field] !== undefined,
      );
      if (!updates.length)
        return res
          .status(400)
          .json({ success: false, message: "변경할 값이 없습니다." });
      await db.execute({
        sql: `UPDATE evidence SET ${updates.map(([, column]) => `${column}=?`).join(", ")} WHERE id=?`,
        args: [
          ...updates.map(([field]) => String(req.body[field]).trim()),
          req.params.id,
        ],
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[PATCH /evidence]", err);
      res.status(500).json({ success: false, message: "서버 오류" });
    }
  }),
);

// GET /api/cases/:id/memos — 사건 메모 목록
router.get(
  "/cases/:id/memos",
  requireAuth,
  requireCaseScope,
  async (req, res) => {
    try {
      const result = await db.execute({
        sql: "SELECT * FROM case_memos WHERE case_id = ? AND deleted_at = '' ORDER BY created_at ASC",
        args: [req.params.id],
      });
      const rows = result.rows.map(toCamel);
      const filtered = rows.filter(
        (m) =>
          !m.isPrivate ||
          m.authorId === req.user.id ||
          hasGlobalDataAccess(req.user),
      );
      res.json(filtered);
    } catch (err) {
      console.error("[GET /cases/memos]", err);
      res.status(500).json({ success: false, message: "서버 오류" });
    }
  },
);

// POST /api/cases/:id/memos — 메모 작성
router.post(
  "/cases/:id/memos",
  requireAuth,
  requireCaseScope,
  async (req, res) => {
    const content = String(req.body?.content || "").trim();
    const isPrivate = req.body?.isPrivate ? 1 : 0;
    if (!content || content.length > 2000) {
      return res
        .status(400)
        .json({ success: false, message: "메모 내용은 1~2000자여야 합니다." });
    }
    try {
      const caseRes = await db.execute({
        sql: "SELECT hyeongje_no FROM cases WHERE id = ? AND deleted_at = ''",
        args: [req.params.id],
      });
      const hyeongjeNo = toCamel(caseRes.rows[0] || {}).hyeongjeNo || "";
      const id = `MEMO-${Date.now()}-${randomUUID().slice(0, 6)}`;
      const now = new Date().toISOString().replace("T", " ").substring(0, 19);
      await db.execute({
        sql: `INSERT INTO case_memos (id, case_id, hyeongje_no, author_id, author_name, content, is_private, created_at, deleted_at)
            VALUES (?,?,?,?,?,?,?,?,'')`,
        args: [
          id,
          req.params.id,
          hyeongjeNo,
          req.user.id,
          req.user.name,
          content,
          isPrivate,
          now,
        ],
      });
      res.json({
        success: true,
        memo: {
          id,
          caseId: req.params.id,
          hyeongjeNo,
          authorId: req.user.id,
          authorName: req.user.name,
          content,
          isPrivate,
          createdAt: now,
        },
      });
    } catch (err) {
      console.error("[POST /cases/memos]", err);
      res.status(500).json({ success: false, message: "서버 오류" });
    }
  },
);

// DELETE /api/cases/:id/memos/:memoId — 메모 삭제
router.delete("/cases/:id/memos/:memoId", requireAuth, async (req, res) => {
  try {
    const result = await db.execute({
      sql: "SELECT author_id FROM case_memos WHERE id = ? AND case_id = ? AND deleted_at = ''",
      args: [req.params.memoId, req.params.id],
    });
    if (!result.rows.length) {
      return res
        .status(404)
        .json({ success: false, message: "메모를 찾을 수 없습니다." });
    }
    const memo = toCamel(result.rows[0]);
    if (
      memo.authorId !== req.user.id &&
      !hasGlobalDataAccess(req.user) &&
      !hasSecretariatWorkAccess(req.user)
    ) {
      return res
        .status(403)
        .json({ success: false, message: "본인 메모만 삭제할 수 있습니다." });
    }
    await db.execute({
      sql: "UPDATE case_memos SET deleted_at = ? WHERE id = ?",
      args: [new Date().toISOString(), req.params.memoId],
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /cases/memos]", err);
    res.status(500).json({ success: false, message: "서버 오류" });
  }
});

export default router;
