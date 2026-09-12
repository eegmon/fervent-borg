/**
 * server/services/notificationService.js
 * 실시간 SSE 알림 및 알림 DB 영속화 서비스
 */
import { db } from "../db.js";

export const sseClients = new Map(); // userId -> Set<Response>

export function addSseClient(userId, res) {
  if (!sseClients.has(userId)) {
    sseClients.set(userId, new Set());
  }
  sseClients.get(userId).add(res);
}

export function removeSseClient(userId, res) {
  if (sseClients.has(userId)) {
    const set = sseClients.get(userId);
    set.delete(res);
    if (set.size === 0) sseClients.delete(userId);
  }
}

/** 특정 사용자에게 알림 전송 및 DB 영속화 */
export async function sendNotificationToUser({
  userId,
  type,
  title,
  message,
  linkTab = "",
  linkId = "",
}) {
  if (!userId) return null;
  const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();

  try {
    await db.execute({
      sql: `INSERT INTO notifications (id, user_id, type, title, message, link_tab, link_id, is_read, created_at, deleted_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, '')`,
      args: [id, userId, type, title, message, linkTab, linkId, now],
    });
  } catch (err) {
    console.error("[Notification DB Insert Error]", err);
  }

  const payload = {
    id,
    userId,
    type,
    title,
    message,
    linkTab,
    linkId,
    isRead: 0,
    createdAt: now,
  };

  const clients = sseClients.get(userId);
  if (clients && clients.size > 0) {
    const data = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of clients) {
      try {
        res.write(data);
      } catch {
        // 무효 커넥션 무시
      }
    }
  }
  return payload;
}

/** 다수 사용자 또는 전체 사용자에게 브로드캐스트 */
export async function broadcastNotification({
  type,
  title,
  message,
  linkTab = "",
  linkId = "",
  targetUserIds = null,
}) {
  try {
    let ids = targetUserIds;
    if (!ids || !Array.isArray(ids)) {
      const allUsers = await db.execute(
        "SELECT id FROM prosecutors WHERE status != 'RETIRED'",
      );
      ids = allUsers.rows.map((r) => r.id);
    }
    for (const uId of ids) {
      await sendNotificationToUser({
        userId: uId,
        type,
        title,
        message,
        linkTab,
        linkId,
      });
    }
  } catch (err) {
    console.error("[Broadcast Notification Error]", err);
  }
}
