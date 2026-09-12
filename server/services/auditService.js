/**
 * server/services/auditService.js
 * 감사 로그(Audit Log) 서비스
 */
import { db } from "../db.js";

/**
 * 감사 로그 1건 삽입
 */
export async function writeAuditLog({
  action,
  entityType,
  entityId = "",
  entityLabel = "",
  actorId,
  actorName,
  detail = "",
}) {
  const id = `AL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const now = new Date().toISOString().replace("T", " ").substring(0, 19);
  await db
    .execute({
      sql: `INSERT INTO audit_logs (id, action, entity_type, entity_id, entity_label, actor_id, actor_name, detail, created_at)
          VALUES (?,?,?,?,?,?,?,?,?)`,
      args: [
        id,
        action,
        entityType,
        entityId,
        entityLabel,
        actorId,
        actorName,
        detail,
        now,
      ],
    })
    .catch((e) => console.warn("[audit_log write error]", e.message));
}
