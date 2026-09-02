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

/** 테이블 생성 및 초기 시드 (최초 1회) */
export async function initDb() {
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
      note         TEXT DEFAULT ''
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
      suje_no             TEXT,
      hyeongje_no         TEXT,
      latest_hyeongje_no  TEXT,
      prosecutor_name     TEXT,
      prosecutor_id       TEXT,
      suspect_name        TEXT,
      suspect_uuid        TEXT,
      booking_status      TEXT,
      booking_date        TEXT,
      incident_date       TEXT,
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
      visibility          TEXT DEFAULT 'PUBLIC',
      created_by          TEXT DEFAULT '',
      private_viewer_ids  TEXT DEFAULT '[]',
      created_at          TEXT DEFAULT (datetime('now'))
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
  ]) {
    try {
      await db.execute(`ALTER TABLE cases ADD COLUMN ${column}`);
    } catch (error) {
      if (!String(error.message || error).includes("duplicate column"))
        throw error;
    }
  }
  // 기존 사건: 사건 발생일 미입력 시 접수일로 보정 (공소시효 기산일)
  await db.execute(`
    UPDATE cases
    SET incident_date = booking_date
    WHERE (incident_date IS NULL OR incident_date = '')
      AND booking_date IS NOT NULL AND booking_date != ''
  `);

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
  // 불기소 자동보존 설정 초기값
  await db.execute({
    sql: `INSERT OR IGNORE INTO system_settings (key, value) VALUES
            ('auto_archive_enabled', '1'),
            ('auto_archive_days', '7')`,
    args: [],
  });

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
      id               TEXT PRIMARY KEY,
      appeal_no        TEXT,
      suje_no          TEXT,
      hyeongje_no      TEXT,
      status           TEXT,
      prosecutor_name  TEXT,
      suspect_name     TEXT,
      suspect_uuid     TEXT,
      disposition      TEXT,
      disposition_date TEXT,
      basis_url        TEXT,
      charge_name      TEXT
    )
  `);

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
      indictment_decision TEXT
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
      approvals_json   TEXT   -- JSON 배열 (결재선)
    )
  `);
  try {
    await db.execute(
      "ALTER TABLE approvals ADD COLUMN hwp_html TEXT DEFAULT ''",
    );
  } catch (error) {
    if (!String(error.message || error).includes("duplicate column"))
      throw error;
  }
  try {
    await db.execute(
      "ALTER TABLE approvals ADD COLUMN attachments_json TEXT DEFAULT '[]'",
    );
  } catch (error) {
    if (!String(error.message || error).includes("duplicate column"))
      throw error;
  }

  // ── registrations (회원가입 신청) ──────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS registrations (
      id           TEXT PRIMARY KEY,
      req_id       TEXT NOT NULL UNIQUE,   -- 신청 아이디
      name         TEXT NOT NULL,
      rank         TEXT DEFAULT '',
      position     TEXT DEFAULT '',
      title        TEXT DEFAULT '',
      role_level   TEXT NOT NULL DEFAULT 'PROSECUTOR',
      dept         TEXT DEFAULT '',
      password     TEXT NOT NULL,          -- bcrypt 해시
      note         TEXT DEFAULT '',
      status       TEXT NOT NULL DEFAULT 'PENDING',  -- PENDING | APPROVED | REJECTED
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
      action      TEXT NOT NULL,    -- CREATE | UPDATE | DELETE | APPROVE | REJECT | LOGIN | LOGOUT
      entity_type TEXT NOT NULL,    -- case | report | appeal | booking | approval | prosecutor
      entity_id   TEXT,
      entity_label TEXT,            -- 사람이 읽을 수 있는 식별자 (형제번호, 문서번호 등)
      actor_id    TEXT NOT NULL,
      actor_name  TEXT NOT NULL,
      detail      TEXT DEFAULT '',  -- 변경 상세 (JSON 문자열 또는 메모)
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
  // 기존 case_history 테이블에 deleted_at 컬럼 추가 (없는 경우)
  try {
    await db.execute(
      "ALTER TABLE case_history ADD COLUMN deleted_at TEXT DEFAULT ''",
    );
  } catch (error) {
    if (!String(error.message || error).includes("duplicate column"))
      throw error;
  }

  // ── evidence (사건 증거자료 및 사건기록) ─────────────────────────
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
  await db.execute(`
    CREATE TABLE IF NOT EXISTS warrants (
      id TEXT PRIMARY KEY, warrant_no TEXT, warrant_type TEXT, warrant_type_name TEXT,
      case_no TEXT, suspect_name TEXT, suspect_uuid TEXT, charge_name TEXT,
      prosecutor_name TEXT, target_place TEXT, status TEXT, requested_at TEXT,
      valid_until TEXT, judge_name TEXT, notes TEXT, deleted_at TEXT DEFAULT ''
    )
  `);
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

  // ── case_memos (사건 수사 메모) ────────────────────────────────────
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

  // ── approval_templates (결재선 템플릿) ────────────────────────────
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

  // ── notifications (실시간 웹 알림 영속화) ────────────────────────────
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

  // ── investigation_schedules (조사/신문 일정 및 소환 관리) ─────────
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

  console.log("[DB] 테이블 초기화 완료");
}
