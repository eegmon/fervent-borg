/**
 * server/routes/auth.routes.js
 * 인증 관련 라우트 (로그인, 복귀, 회원가입)
 */
import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { timingSafeEqual } from "crypto";
import { db } from "../db.js";
import {
  requireAuth,
  authRateLimit,
  clearAuthAttempts,
} from "../middlewares/auth.js";
import { toCamel, asyncWrap } from "../utils/helpers.js";
import { writeAuditLog } from "../services/auditService.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;
const DUMMY_BCRYPT_HASH =
  "$2b$12$aaaaaaaaaaaaaaaaaaaaaa.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

// POST /api/auth/login
router.post(
  "/login",
  authRateLimit,
  asyncWrap(async (req, res) => {
    const invalidLoginMessage = "아이디 또는 비밀번호가 올바르지 않습니다.";
    const { id, password } = req.body;
    if (!id || !password) {
      return res
        .status(400)
        .json({ success: false, message: "아이디와 비밀번호를 입력해주세요." });
    }

    const result = await db.execute({
      sql: "SELECT * FROM prosecutors WHERE id = ?",
      args: [id],
    });

    if (result.rows.length === 0) {
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
      return res
        .status(401)
        .json({ success: false, message: invalidLoginMessage });
    }

    const user = toCamel(result.rows[0]);
    if (user.status === "RETIRED") {
      return res.status(403).json({
        success: false,
        message: "퇴직 처리된 계정입니다. 로그인이 불가능합니다.",
      });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res
        .status(401)
        .json({ success: false, message: invalidLoginMessage });
    }

    const { password: _pw, ...safeUser } = user;
    clearAuthAttempts(req);
    const token = jwt.sign(
      { id: safeUser.id, roleLevel: safeUser.roleLevel },
      JWT_SECRET,
      { expiresIn: "8h" },
    );

    await writeAuditLog({
      action: "LOGIN",
      entityType: "system",
      entityId: safeUser.id,
      entityLabel: safeUser.name,
      actorId: safeUser.id,
      actorName: safeUser.name,
      detail: "로그인 성공",
    });

    res.json({ success: true, token, user: safeUser });
  }),
);

// POST /api/auth/return — 휴가·직무대리 위임 종료 후 본인 복귀
router.post(
  "/return",
  requireAuth,
  asyncWrap(async (req, res) => {
    const { status, id: userId, name: userName, actingUserId } = req.user;

    if (!["ON_LEAVE", "DELEGATED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "복귀 처리가 필요한 상태가 아닙니다.",
      });
    }

    await db.execute({
      sql: `UPDATE prosecutors
            SET status='ACTIVE', delegate_to='', delegate_reason='', acting_user_id=''
          WHERE id=?`,
      args: [userId],
    });

    if (actingUserId) {
      await db.execute({
        sql: `UPDATE prosecutors SET
              dual_role_level='', acting_title='',
              acting_start='', acting_end='',
              delegate_to='', delegate_reason=''
            WHERE id=?`,
        args: [actingUserId],
      });

      await db.execute({
        sql: `UPDATE office_documents
              SET payload_json = json_patch(payload_json, '{"status":"해제완료(본인복귀)"}')
            WHERE document_type='order'
              AND json_extract(payload_json,'$.originalUserId')=?
              AND json_extract(payload_json,'$.status')='발령중'
              AND deleted_at=''`,
        args: [userId],
      });
    }

    const detail =
      status === "ON_LEAVE"
        ? actingUserId
          ? "휴가 복귀 처리 (직무대리 연쇄 해제)"
          : "휴가 복귀 처리"
        : "직무대리 위임 종료 후 복귀 처리";

    await writeAuditLog({
      action: "RETURN",
      entityType: "prosecutor",
      entityId: userId,
      entityLabel: userName,
      actorId: userId,
      actorName: userName,
      detail,
    });

    res.json({ success: true });
  }),
);

// POST /api/auth/register — 회원가입 신청
router.post(
  "/register",
  authRateLimit,
  asyncWrap(async (req, res) => {
    const {
      id,
      name,
      rank,
      position,
      title,
      dept,
      password,
      note,
      bootstrapSecret,
    } = req.body;

    if (!id || !name || !password) {
      return res.status(400).json({
        success: false,
        message: "아이디, 이름, 비밀번호는 필수입니다.",
      });
    }

    if (!/^[a-zA-Z0-9_-]{2,30}$/.test(id)) {
      return res.status(400).json({
        success: false,
        message: "아이디는 영문/숫자/언더스코어/하이픈 2~30자여야 합니다.",
      });
    }

    if (password.length < 10) {
      return res.status(400).json({
        success: false,
        message: "비밀번호는 10자 이상이어야 합니다.",
      });
    }

    try {
      const existPros = await db.execute({
        sql: "SELECT id FROM prosecutors WHERE id = ?",
        args: [id],
      });
      if (existPros.rows.length > 0) {
        return res
          .status(409)
          .json({ success: false, message: "이미 사용 중인 아이디입니다." });
      }

      const existReg = await db.execute({
        sql: "SELECT id FROM registrations WHERE req_id = ? AND status = 'PENDING'",
        args: [id],
      });
      if (existReg.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message:
            "이미 가입 신청 중인 아이디입니다. 검찰사무국 허가를 기다려주세요.",
        });
      }

      const hashedPw = await bcrypt.hash(password, 10);
      const regId = `REG-${Date.now()}`;
      const now = new Date().toISOString().replace("T", " ").substring(0, 19);

      const accountCount = await db.execute(
        "SELECT COUNT(*) AS count FROM prosecutors",
      );
      const isBootstrap = (() => {
        if (Number(accountCount.rows[0]?.count || 0) !== 0) return false;
        if (!process.env.BOOTSTRAP_SECRET || !bootstrapSecret) return false;
        try {
          const a = Buffer.from(String(bootstrapSecret));
          const b = Buffer.from(String(process.env.BOOTSTRAP_SECRET));
          if (a.length !== b.length) return false;
          return timingSafeEqual(a, b);
        } catch {
          return false;
        }
      })();

      if (isBootstrap) {
        await db.execute({
          sql: `INSERT INTO prosecutors
                (id, name, rank, position, title, role_level, dept, password,
                 active_cases, status, delegate_to, delegate_reason,
                 is_super_admin, is_auto_assign_excluded, note)
              VALUES (?,?,?,?,?,?,?,?,0,'ACTIVE','','',1,1,?)`,
          args: [
            id,
            name,
            "최고 관리자",
            position || "시스템 관리자",
            "최고 시스템 관리자",
            "SUPER_ADMIN",
            "",
            hashedPw,
            note || "",
          ],
        });
        return res.json({
          success: true,
          message: "최초 관리자 계정이 활성화되었습니다. 로그인해주세요.",
        });
      }

      await db.execute({
        sql: `INSERT INTO registrations
              (id, req_id, name, rank, position, title, role_level, dept, password, note, status, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [
          regId,
          id,
          name,
          rank || "",
          position || "",
          title || "",
          "PROSECUTOR",
          dept || "",
          hashedPw,
          note || "",
          "PENDING",
          now,
        ],
      });

      res.json({
        success: true,
        message:
          "가입 신청이 접수되었습니다. 검찰사무국의 허가를 기다려주세요.",
      });
    } catch (err) {
      console.error("[register]", err);
      res
        .status(500)
        .json({ success: false, message: "서버 오류가 발생했습니다." });
    }
  }),
);

export default router;
