/**
 * server/routes/events.routes.js
 * 실시간 SSE 스트림 연결 및 웹 알림 엔드포인트
 */
import { Router } from "express";
import jwt from "jsonwebtoken";
import { db } from "../db.js";
import { requireAuth } from "../middlewares/auth.js";
import { toCamel, asyncWrap } from "../utils/helpers.js";
import { addSseClient, removeSseClient } from "../services/notificationService.js";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET;

// GET /api/events — 실시간 SSE 스트림 연결
router.get("/events", async (req, res) => {
  const authHeader = req.headers.authorization;
  const queryToken = req.query.token;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : typeof queryToken === "string"
      ? queryToken
      : null;

  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: "인증 토큰이 필요합니다." });
  }

  let userId = null;
  try {
    const claims = jwt.verify(token, JWT_SECRET);
    userId = claims.id;
  } catch {
    return res
      .status(401)
      .json({ success: false, message: "유효하지 않은 토큰입니다." });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  res.write(
    `data: ${JSON.stringify({ type: "CONNECTED", message: "실시간 알림 스트림 연결됨" })}\n\n`,
  );

  addSseClient(userId, res);

  const heartbeat = setInterval(() => {
    try {
      res.write(": keep-alive\n\n");
    } catch {
      clearInterval(heartbeat);
      removeSseClient(userId, res);
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeSseClient(userId, res);
  });
});

// GET /api/notifications — 사용자 알림 목록 조회
router.get(
  "/notifications",
  requireAuth,
  asyncWrap(async (req, res) => {
    const result = await db.execute({
      sql: `SELECT id, user_id, type, title, message, link_tab, link_id, is_read, created_at
            FROM notifications
            WHERE user_id = ? AND deleted_at = ''
            ORDER BY created_at DESC LIMIT 60`,
      args: [req.user.id],
    });
    res.json({
      success: true,
      notifications: result.rows.map(toCamel),
    });
  }),
);

// PATCH /api/notifications/:id/read — 개별 알림 읽음 처리
router.patch(
  "/notifications/:id/read",
  requireAuth,
  asyncWrap(async (req, res) => {
    await db.execute({
      sql: `UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?`,
      args: [req.params.id, req.user.id],
    });
    res.json({ success: true });
  }),
);

// POST /api/notifications/read-all — 전체 알림 읽음 처리
router.post(
  "/notifications/read-all",
  requireAuth,
  asyncWrap(async (req, res) => {
    await db.execute({
      sql: `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND deleted_at = ''`,
      args: [req.user.id],
    });
    res.json({ success: true });
  }),
);

// DELETE /api/notifications/:id — 알림 삭제
router.delete(
  "/notifications/:id",
  requireAuth,
  asyncWrap(async (req, res) => {
    await db.execute({
      sql: `UPDATE notifications SET deleted_at = datetime('now') WHERE id = ? AND user_id = ?`,
      args: [req.params.id, req.user.id],
    });
    res.json({ success: true });
  }),
);

export default router;
