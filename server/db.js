/**
 * server/db.js
 * Turso (libSQL) 클라이언트 초기화 및 테이블 생성
 *
 * 환경변수:
 *   TURSO_DATABASE_URL  — Turso DB URL (libsql://…)
 *   TURSO_AUTH_TOKEN    — Turso 인증 토큰
 *
 * 로컬 개발 시 TURSO_DATABASE_URL을 설정하지 않으면
 * database/dose-pros.db 파일형 SQLite로 자동 폴백합니다.
 */
import { createClient } from "@libsql/client";
import "dotenv/config";

const url = process.env.TURSO_DATABASE_URL || "file:./database/dose-pros.db";
const authToken = process.env.TURSO_AUTH_TOKEN;

if (
  process.env.NODE_ENV === "production" &&
  (!process.env.TURSO_DATABASE_URL || !authToken)
) {
  throw new Error(
    "운영 환경에서는 TURSO_DATABASE_URL과 TURSO_AUTH_TOKEN이 필요합니다.",
  );
}

export const db = createClient({ url, authToken });

/** PRAGMA 설정 적용 (로컬/원격 호환) */
async function applyPragmas() {
  const pragmas = [
    "PRAGMA journal_mode = WAL;",
    "PRAGMA foreign_keys = ON;",
    "PRAGMA busy_timeout = 5000;",
    "PRAGMA synchronous = NORMAL;",
  ];

  for (const pragma of pragmas) {
    try {
      await db.execute(pragma);
    } catch {
      // 일부 원격 Turso 환경에서는 PRAGMA가 제한될 수 있으므로 조용히 무시
    }
  }
}

/**
 * 원자적 시퀀스 채번 헬퍼
 * @param {string} name 시퀀스 명칭 (예: 'APPROVAL_DOC', 'NAESA', 'HYEONGJE' 등)
 * @param {number} year 연도
 * @param {number} startVal 시작값 (기본 1)
 * @returns {Promise<number>} 다음 일련번호
 */
export async function getNextSequence(name, year = new Date().getFullYear(), startVal = 1) {
  // 1. 없으면 초기 레코드 삽입
  await db.execute({
    sql: `INSERT OR IGNORE INTO sequences (name, year, current_val, updated_at)
          VALUES (?, ?, ?, datetime('now'))`,
    args: [name, year, Math.max(0, startVal - 1)],
  });

  // 2. 원자적 증가 및 반환
  const res = await db.execute({
    sql: `UPDATE sequences
          SET current_val = CASE WHEN current_val < ? THEN ? ELSE current_val + 1 END,
              updated_at = datetime('now')
          WHERE name = ? AND year = ?
          RETURNING current_val`,
    args: [startVal, startVal, name, year],
  });

  if (res.rows.length > 0) {
    return Number(res.rows[0].current_val);
  }

  // 폴백
  const queryRes = await db.execute({
    sql: `SELECT current_val FROM sequences WHERE name = ? AND year = ?`,
    args: [name, year],
  });
  return Number(queryRes.rows[0]?.current_val || startVal);
}

/** 테이블 생성 및 초기 시드 (최초 1회) */
export async function initDb() {
  await applyPragmas();

  // ── schema_migrations (마이그레이션 이력 관리) ───────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      applied_at  TEXT DEFAULT (datetime('now'))
    )
  `);

  // ── sequences (원자적 일련번호 채번) ─────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sequences (
      name         TEXT NOT NULL,
      year         INTEGER NOT NULL,
      current_val  INTEGER NOT NULL DEFAULT 0,
      updated_at   TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (name, year)
    )
  `);

  // ── departments (부서 정규화 테이블) ─────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS departments (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      code         TEXT DEFAULT '',
      sort_order   INTEGER DEFAULT 0,
      created_at   TEXT DEFAULT (datetime('now')),
      deleted_at   TEXT DEFAULT ''
    )
  `);

  // ── prosecutors ────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS prosecutors (
      id           TEXT PRIMARY KEY,
      name         TEXT NOT NULL,
      rank         TEXT,
      position     TEXT,
      title        TEXT,
      role_level   TEXT NOT NULL DEFAULT 'PROSECUTOR',
      dept         TEXT,
      password     TEXT NOT NULL,        -- bcrypt 해시
      active_cases INTEGER DEFAULT 0,
      status       TEXT DEFAULT 'ACTIVE',
      delegate_to  TEXT DEFAULT '',
      delegate_reason TEXT DEFAULT '',
      dual_position TEXT DEFAULT '',
      dual_dept TEXT DEFAULT '',
      dual_role_level TEXT DEFAULT '',
      acting_title TEXT DEFAULT '',
      dual_secretariat_work INTEGER DEFAULT 0,
      is_super_admin  INTEGER DEFAULT 0,
      is_auto_assign_excluded INTEGER DEFAULT 0,
      can_arbitrary_approve INTEGER DEFAULT 0,
      note         TEXT DEFAULT '',
      discord_id   TEXT DEFAULT '',
      acting_start TEXT DEFAULT '',
      acting_end   TEXT DEFAULT '',
      acting_user_id TEXT DEFAULT ''
    )
  `);
  for (const column of [
    "dual_position TEXT DEFAULT ''",
    "dual_dept TEXT DEFAULT ''",
    "dual_role_level TEXT DEFAULT ''",
    "acting_title TEXT DEFAULT ''",
    "dual_secretariat_work INTEGER DEFAULT 0",
    "can_arbitrary_approve INTEGER DEFAULT 0",
    "note TEXT DEFAULT ''",
    "discord_id TEXT DEFAULT ''",
    "acting_start TEXT DEFAULT ''",
    "acting_end TEXT DEFAULT ''",
    "acting_user_id TEXT DEFAULT ''",
  ]) {
    try {
      await db.execute(`ALTER TABLE prosecutors ADD COLUMN ${column}`);
    } catch (error) {
      if (!String(error.message || error).includes("duplicate column"))
        throw error;
    }
  }

  // ── cases ──────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS cases (
      id                  TEXT PRIMARY KEY,
      suje_no             TEXT DEFAULT '',
      hyeongje_no         TEXT,
      latest_hyeongje_no  TEXT,
      prosecutor_name     TEXT,
      prosecutor_id       TEXT,
      suspect_name        TEXT,
      suspect_uuid        TEXT,
      booking_status      TEXT,
      booking_date        TEXT,
      incident_date       TEXT DEFAULT '',
      booking_basis       TEXT,
      disposition         TEXT,
      re_appeal           TEXT,
      court1_no           TEXT,
      court1_result       TEXT,
      court1_doc          TEXT,
      court1_appealed     TEXT,
      court1_appellant    TEXT,
      court2_no           TEXT,
      court2_dismissed    TEXT,
      court2_result       TEXT,
      court2_doc          TEXT,
      court3_appealed     TEXT,
      court3_appellant    TEXT,
      court3_no           TEXT,
      court3_remanded     TEXT,
      court3_result       TEXT,
      court3_doc          TEXT,
      notes               TEXT,
      content             TEXT,
      confiscation        TEXT,
      charge_name         TEXT,
      supervisor_designated INTEGER DEFAULT 0,
      supervisor_id       TEXT DEFAULT '',
      supervisor_name     TEXT DEFAULT '',
      visibility          TEXT DEFAULT 'PUBLIC',
      created_by          TEXT DEFAULT '',
      private_viewer_ids  TEXT DEFAULT '[]',
      is_archived         INTEGER DEFAULT 0,
      archived_at         TEXT DEFAULT '',
      archived_by         TEXT DEFAULT '',
      suspects_json       TEXT DEFAULT '[]',
      suspects_dispositions TEXT DEFAULT '{}',
      created_at          TEXT DEFAULT (datetime('now')),
      deleted_at          TEXT DEFAULT ''
    )
  `);
  for (const column of [
    "suje_no TEXT DEFAULT ''",
    "supervisor_designated INTEGER DEFAULT 0",
    "supervisor_id TEXT DEFAULT ''",
    "supervisor_name TEXT DEFAULT ''",
    "visibility TEXT DEFAULT 'PUBLIC'",
    "created_by TEXT DEFAULT ''",
    "private_viewer_ids TEXT DEFAULT '[]'",
    "is_archived INTEGER DEFAULT 0",
    "archived_at TEXT DEFAULT ''",
    "archived_by TEXT DEFAULT ''",
    "incident_date TEXT DEFAULT ''",
    "suspects_json TEXT DEFAULT '[]'",
    "suspects_dispositions TEXT DEFAULT '{}'",
    "deleted_at TEXT DEFAULT ''",
  ]) {
    try {
      await db.execute(`ALTER TABLE cases ADD COLUMN ${column}`);
    } catch (error) {
      if (!String(error.message || error).includes("duplicate column"))
        throw error;
    }
  }

  // ── system_settings ───────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key        TEXT PRIMARY KEY,
      value      TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      updated_by TEXT DEFAULT ''
    )
  `);
  await db.execute({
    sql: `INSERT OR IGNORE INTO system_settings (key, value) VALUES
            ('case_number_hyeongje_start', '280'),
            ('case_number_teuggong_start', '1'),
            ('case_number_teughyeong_start', '1'),
            ('case_number_teugapje_start', '1'),
            ('case_number_apje_start', '1'),
            ('case_number_naesa_start', '1')`,
    args: [],
  });
  await db.execute({
    sql: "INSERT OR IGNORE INTO system_settings (key, value) VALUES ('departments_json', '[]')",
    args: [],
  });
  await db.execute({
    sql: `INSERT OR IGNORE INTO system_settings (key, value) VALUES
            ('auto_archive_enabled', '1'),
            ('auto_archive_days', '7')`,
    args: [],
  });

  // ── charges ────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS charges (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT NOT NULL UNIQUE,
      statute_days  INTEGER NOT NULL DEFAULT 20,
      is_unlimited  INTEGER NOT NULL DEFAULT 0,
      law_article   TEXT DEFAULT '소송법 제21조의2',
      category      TEXT DEFAULT 'GENERAL',
      description   TEXT DEFAULT '',
      created_at    TEXT DEFAULT (datetime('now')),
      created_by    TEXT DEFAULT '',
      updated_at    TEXT DEFAULT (datetime('now')),
      updated_by    TEXT DEFAULT '',
      deleted_at    TEXT DEFAULT '',
      deleted_by    TEXT DEFAULT ''
    )
  `);

  for (const column of [
    "statute_days INTEGER NOT NULL DEFAULT 20",
    "is_unlimited INTEGER NOT NULL DEFAULT 0",
    "law_article TEXT DEFAULT '소송법 제21조의2'",
    "category TEXT DEFAULT 'GENERAL'",
    "description TEXT DEFAULT ''",
    "updated_at TEXT DEFAULT ''",
    "updated_by TEXT DEFAULT ''",
    "deleted_by TEXT DEFAULT ''",
  ]) {
    try {
      await db.execute(`ALTER TABLE charges ADD COLUMN ${column}`);
    } catch (error) {
      if (!String(error.message || error).includes("duplicate column"))
        throw error;
    }
  }

  // ── reports ────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS reports (
      id              TEXT PRIMARY KEY,
      report_no       TEXT,
      hyeongje_no     TEXT,
      suje_no         TEXT DEFAULT '',
      title           TEXT,
      prosecutor_name TEXT,
      suspect_name    TEXT,
      suspect_uuid    TEXT,
      status          TEXT,
      created_at      TEXT,
      basis_url       TEXT,
      period          TEXT,
      confiscation    TEXT,
      deleted_at      TEXT DEFAULT ''
    )
  `);
  for (const column of [
    "suje_no TEXT DEFAULT ''",
    "deleted_at TEXT DEFAULT ''",
  ]) {
    try {
      await db.execute(`ALTER TABLE reports ADD COLUMN ${column}`);
    } catch (error) {
      if (!String(error.message || error).includes("duplicate column"))
        throw error;
    }
  }

  // ── appeals ────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS appeals (
      id                  TEXT PRIMARY KEY,
      appeal_no           TEXT,
      jibulhang_no        TEXT DEFAULT '',
      gobulhang_no        TEXT DEFAULT '',
      jaebulhang_no       TEXT DEFAULT '',
      daejaebulhang_no    TEXT DEFAULT '',
      suje_no             TEXT DEFAULT '',
      hyeongje_no         TEXT DEFAULT '',
      beobwon_no          TEXT DEFAULT '',
      charge_name         TEXT DEFAULT '',
      prosecutor_name     TEXT DEFAULT '',
      chief_prosecutor    TEXT DEFAULT '',
      prosecutor_general  TEXT DEFAULT '',
      suspect_name        TEXT DEFAULT '',
      suspect_uuid        TEXT DEFAULT '',
      status              TEXT DEFAULT '항고접수',
      appeal_status       TEXT DEFAULT '항고접수',
      disposition         TEXT DEFAULT '',
      appeal_disposition  TEXT DEFAULT '',
      disposition_date    TEXT DEFAULT '',
      appeal_date         TEXT DEFAULT '',
      basis_url           TEXT DEFAULT '',
      appeal_basis_url    TEXT DEFAULT '',
      appeal_decision     TEXT DEFAULT '',
      appeal_notice_url   TEXT DEFAULT '',
      original_status     TEXT DEFAULT '종국:불기소',
      intake_date         TEXT DEFAULT '',
      intake_basis_url    TEXT DEFAULT '',
      indictment_status   TEXT DEFAULT '',
      indictment_doc_url  TEXT DEFAULT '',
      created_at          TEXT DEFAULT (datetime('now')),
      deleted_at          TEXT DEFAULT ''
    )
  `);
  for (const column of [
    "jibulhang_no TEXT DEFAULT ''",
    "gobulhang_no TEXT DEFAULT ''",
    "jaebulhang_no TEXT DEFAULT ''",
    "daejaebulhang_no TEXT DEFAULT ''",
    "suje_no TEXT DEFAULT ''",
    "beobwon_no TEXT DEFAULT ''",
    "chief_prosecutor TEXT DEFAULT ''",
    "prosecutor_general TEXT DEFAULT ''",
    "appeal_status TEXT DEFAULT '항고접수'",
    "appeal_disposition TEXT DEFAULT ''",
    "appeal_date TEXT DEFAULT ''",
    "appeal_basis_url TEXT DEFAULT ''",
    "appeal_decision TEXT DEFAULT ''",
    "appeal_notice_url TEXT DEFAULT ''",
    "original_status TEXT DEFAULT '종국:불기소'",
    "intake_date TEXT DEFAULT ''",
    "intake_basis_url TEXT DEFAULT ''",
    "indictment_status TEXT DEFAULT ''",
    "indictment_doc_url TEXT DEFAULT ''",
    "created_at TEXT DEFAULT ''",
    "charge_name TEXT DEFAULT ''",
    "deleted_at TEXT DEFAULT ''",
  ]) {
    try {
      await db.execute(`ALTER TABLE appeals ADD COLUMN ${column}`);
    } catch (error) {
      if (!String(error.message || error).includes("duplicate column"))
        throw error;
    }
  }

  // ── bookings ───────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS bookings (
      id                  TEXT PRIMARY KEY,
      hyeongje_no         TEXT,
      prosecutor_name     TEXT,
      suspect_name        TEXT,
      suspect_uuid        TEXT,
      disposition_status  TEXT,
      booking_date        TEXT,
      basis_url           TEXT,
      days_elapsed        INTEGER DEFAULT 0,
      indictment_decision TEXT,
      deleted_at          TEXT DEFAULT ''
    )
  `);

  // ── approvals ──────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS approvals (
      id               TEXT PRIMARY KEY,
      doc_no           TEXT,
      doc_type         TEXT,
      doc_type_name    TEXT,
      title            TEXT,
      hyeongje_no      TEXT,
      prosecutor_id    TEXT,
      prosecutor_name  TEXT,
      suspect_name     TEXT,
      disposition_type TEXT,
      charge_name      TEXT,
      summary          TEXT,
      status           TEXT,
      created_at       TEXT,
      approvals_json   TEXT,
      hwp_html         TEXT DEFAULT '',
      attachments_json TEXT DEFAULT '[]',
      deleted_at       TEXT DEFAULT ''
    )
  `);
  for (const column of [
    "hwp_html TEXT DEFAULT ''",
    "attachments_json TEXT DEFAULT '[]'",
    "deleted_at TEXT DEFAULT ''",
  ]) {
    try {
      await db.execute(`ALTER TABLE approvals ADD COLUMN ${column}`);
    } catch (error) {
      if (!String(error.message || error).includes("duplicate column"))
        throw error;
    }
  }

  // ── registrations ──────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS registrations (
      id           TEXT PRIMARY KEY,
      req_id       TEXT NOT NULL UNIQUE,
      name         TEXT NOT NULL,
      rank         TEXT DEFAULT '',
      position     TEXT DEFAULT '',
      title        TEXT DEFAULT '',
      role_level   TEXT NOT NULL DEFAULT 'PROSECUTOR',
      dept         TEXT DEFAULT '',
      password     TEXT NOT NULL,
      note         TEXT DEFAULT '',
      status       TEXT NOT NULL DEFAULT 'PENDING',
      reject_reason TEXT DEFAULT '',
      created_at   TEXT DEFAULT (datetime('now')),
      reviewed_at  TEXT DEFAULT '',
      reviewed_by  TEXT DEFAULT ''
    )
  `);

  // ── audit_logs ─────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id          TEXT PRIMARY KEY,
      action      TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id   TEXT,
      entity_label TEXT,
      actor_id    TEXT NOT NULL,
      actor_name  TEXT NOT NULL,
      detail      TEXT DEFAULT '',
      created_at  TEXT DEFAULT (datetime('now'))
    )
  `);

  // ── case_history ────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS case_history (
      id           TEXT PRIMARY KEY,
      case_id      TEXT NOT NULL,
      hyeongje_no  TEXT NOT NULL,
      actor_id     TEXT NOT NULL,
      actor_name   TEXT NOT NULL,
      field_name   TEXT NOT NULL,
      old_value    TEXT DEFAULT '',
      new_value    TEXT DEFAULT '',
      created_at   TEXT DEFAULT (datetime('now')),
      deleted_at   TEXT DEFAULT ''
    )
  `);
  try {
    await db.execute(
      "ALTER TABLE case_history ADD COLUMN deleted_at TEXT DEFAULT ''",
    );
  } catch (error) {
    if (!String(error.message || error).includes("duplicate column"))
      throw error;
  }

  // ── evidence ───────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS evidence (
      id          TEXT PRIMARY KEY,
      case_no     TEXT NOT NULL,
      title       TEXT NOT NULL,
      url         TEXT NOT NULL,
      evidence_type TEXT NOT NULL DEFAULT 'DOCUMENT',
      record      TEXT NOT NULL DEFAULT '',
      created_by  TEXT NOT NULL,
      created_at  TEXT DEFAULT (datetime('now')),
      deleted_at  TEXT DEFAULT ''
    )
  `);

  // ── warrants ───────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS warrants (
      id TEXT PRIMARY KEY, warrant_no TEXT, warrant_type TEXT, warrant_type_name TEXT,
      case_no TEXT, suspect_name TEXT, suspect_uuid TEXT, charge_name TEXT,
      prosecutor_name TEXT, target_place TEXT, status TEXT, requested_at TEXT,
      valid_until TEXT, judge_name TEXT, notes TEXT, deleted_at TEXT DEFAULT ''
    )
  `);

  // ── office_documents ───────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS office_documents (
      id TEXT PRIMARY KEY,
      document_type TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT DEFAULT ''
    )
  `);

  // ── case_memos ─────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS case_memos (
      id           TEXT PRIMARY KEY,
      case_id      TEXT NOT NULL,
      hyeongje_no  TEXT NOT NULL,
      author_id    TEXT NOT NULL,
      author_name  TEXT NOT NULL,
      content      TEXT NOT NULL,
      is_private   INTEGER DEFAULT 0,
      created_at   TEXT DEFAULT (datetime('now')),
      deleted_at   TEXT DEFAULT ''
    )
  `);

  // ── approval_templates ─────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS approval_templates (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT DEFAULT '',
      steps_json  TEXT NOT NULL,
      created_by  TEXT NOT NULL,
      is_shared   INTEGER DEFAULT 0,
      dept        TEXT DEFAULT '',
      created_at  TEXT DEFAULT (datetime('now')),
      deleted_at  TEXT DEFAULT ''
    )
  `);

  // ── notifications ──────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      id          TEXT PRIMARY KEY,
      user_id     TEXT NOT NULL,
      type        TEXT NOT NULL,
      title       TEXT NOT NULL,
      message     TEXT NOT NULL,
      link_tab    TEXT DEFAULT '',
      link_id     TEXT DEFAULT '',
      is_read     INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now')),
      deleted_at  TEXT DEFAULT ''
    )
  `);

  // ── investigation_schedules ────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS investigation_schedules (
      id                TEXT PRIMARY KEY,
      case_id           TEXT NOT NULL,
      hyeongje_no       TEXT NOT NULL,
      target_type       TEXT NOT NULL DEFAULT 'SUSPECT',
      target_name       TEXT NOT NULL,
      target_contact    TEXT DEFAULT '',
      scheduled_at      TEXT NOT NULL,
      location          TEXT DEFAULT '검사실',
      investigator_id   TEXT NOT NULL,
      investigator_name TEXT NOT NULL,
      purpose           TEXT DEFAULT '',
      status            TEXT DEFAULT 'SCHEDULED',
      summons_doc_no    TEXT DEFAULT '',
      summons_issued_at TEXT DEFAULT '',
      notes             TEXT DEFAULT '',
      created_by        TEXT NOT NULL,
      created_at        TEXT DEFAULT (datetime('now')),
      deleted_at        TEXT DEFAULT ''
    )
  `);

  for (const table of [
    "cases",
    "reports",
    "appeals",
    "bookings",
    "approvals",
  ]) {
    try {
      await db.execute(
        `ALTER TABLE ${table} ADD COLUMN deleted_at TEXT DEFAULT ''`,
      );
    } catch (error) {
      if (!String(error.message || error).includes("duplicate column"))
        throw error;
    }
  }

  // ── 🚀 필수 복합 인덱스(INDEX) 일괄 생성 ─────────────────────────
  const indexes = [
    // cases
    "CREATE INDEX IF NOT EXISTS idx_cases_hyeongje_no ON cases(hyeongje_no)",
    "CREATE INDEX IF NOT EXISTS idx_cases_suje_no ON cases(suje_no)",
    "CREATE INDEX IF NOT EXISTS idx_cases_prosecutor_archived ON cases(prosecutor_id, is_archived, deleted_at)",
    "CREATE INDEX IF NOT EXISTS idx_cases_booking_date ON cases(booking_date DESC)",
    "CREATE INDEX IF NOT EXISTS idx_cases_incident_date ON cases(incident_date DESC)",
    "CREATE INDEX IF NOT EXISTS idx_cases_suspect_uuid ON cases(suspect_uuid)",
    // approvals
    "CREATE INDEX IF NOT EXISTS idx_approvals_doc_no ON approvals(doc_no)",
    "CREATE INDEX IF NOT EXISTS idx_approvals_prosecutor_status ON approvals(prosecutor_id, status, deleted_at)",
    "CREATE INDEX IF NOT EXISTS idx_approvals_created_at ON approvals(created_at DESC)",
    // reports, appeals, bookings
    "CREATE INDEX IF NOT EXISTS idx_reports_hyeongje_no ON reports(hyeongje_no, deleted_at)",
    "CREATE INDEX IF NOT EXISTS idx_appeals_hyeongje_no ON appeals(hyeongje_no, deleted_at)",
    "CREATE INDEX IF NOT EXISTS idx_bookings_hyeongje_no ON bookings(hyeongje_no, deleted_at)",
    // evidence, case_memos, history, schedules
    "CREATE INDEX IF NOT EXISTS idx_evidence_case_no ON evidence(case_no, deleted_at)",
    "CREATE INDEX IF NOT EXISTS idx_case_memos_case_id ON case_memos(case_id, deleted_at)",
    "CREATE INDEX IF NOT EXISTS idx_case_history_case_id ON case_history(case_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_schedules_case_date ON investigation_schedules(case_id, scheduled_at, deleted_at)",
    "CREATE INDEX IF NOT EXISTS idx_schedules_investigator ON investigation_schedules(investigator_id, scheduled_at)",
    // notifications, audit_logs
    "CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, deleted_at)",
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id, created_at DESC)",
    "CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_id, created_at DESC)",
  ];

  for (const idxSql of indexes) {
    try {
      await db.execute(idxSql);
    } catch (e) {
      console.warn("[DB] 인덱스 생성 경고:", e.message);
    }
  }

  // 기존 사건: 사건 발생일 미입력 시 접수일로 보정 (공소시효 기산일)
  try {
    await db.execute(`
      UPDATE cases
      SET incident_date = booking_date
      WHERE (incident_date IS NULL OR incident_date = '')
        AND booking_date IS NOT NULL AND booking_date != ''
    `);
  } catch {}

  console.log("[DB] 데이터베이스 및 인덱스 최적화 초기화 완료");
}
