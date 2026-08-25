/**
 * server/db.js
 * Turso (libSQL) 클라이언트 초기화 및 테이블 생성
 *
 * 환경변수:
 *   TURSO_DATABASE_URL  — Turso DB URL (libsql://…)
 *   TURSO_AUTH_TOKEN    — Turso 인증 토큰
 *
 * 로컬 개발 시 TURSO_DATABASE_URL을 설정하지 않으면
 * 인메모리 SQLite(:memory:)로 자동 폴백합니다.
 */
import { createClient } from '@libsql/client';
import 'dotenv/config';

const url   = process.env.TURSO_DATABASE_URL || ':memory:';
const authToken = process.env.TURSO_AUTH_TOKEN;

export const db = createClient(
  url === ':memory:'
    ? { url }
    : { url, authToken }
);

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
      is_super_admin  INTEGER DEFAULT 0,
      is_auto_assign_excluded INTEGER DEFAULT 0,
      note         TEXT DEFAULT ''
    )
  `);

  // ── cases ──────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS cases (
      id                  TEXT PRIMARY KEY,
      hyeongje_no         TEXT,
      gyeongje_no         TEXT,
      latest_hyeongje_no  TEXT,
      prosecutor_name     TEXT,
      prosecutor_id       TEXT,
      suspect_name        TEXT,
      suspect_uuid        TEXT,
      booking_status      TEXT,
      booking_date        TEXT,
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
      created_at          TEXT DEFAULT (datetime('now'))
    )
  `);

  // ── reports ────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS reports (
      id              TEXT PRIMARY KEY,
      report_no       TEXT,
      hyeongje_no     TEXT,
      title           TEXT,
      prosecutor_name TEXT,
      suspect_name    TEXT,
      suspect_uuid    TEXT,
      status          TEXT,
      created_at      TEXT,
      basis_url       TEXT,
      period          TEXT,
      confiscation    TEXT
    )
  `);

  // ── appeals ────────────────────────────────────────────────────
  await db.execute(`
    CREATE TABLE IF NOT EXISTS appeals (
      id               TEXT PRIMARY KEY,
      appeal_no        TEXT,
      hyeongje_no      TEXT,
      gyeongje_no      TEXT,
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

  // ── sys_admin 기본 계정 보장 ───────────────────────────────────────
  // DB에 sys_admin이 없을 경우 자동으로 삽입합니다 (비밀번호: 1234)
  const existing = await db.execute({
    sql: "SELECT id FROM prosecutors WHERE id = 'sys_admin'",
    args: [],
  });
  if (existing.rows.length === 0) {
    // bcrypt hash of '1234' with salt rounds 12
    const SYS_ADMIN_PW_HASH = '$2b$12$mBJRZVAYl/.SfSjxYvO7YOkUFNi66LbVfZu0EtUxiGH8Udm9CmWke';
    await db.execute({
      sql: `INSERT INTO prosecutors
              (id, name, rank, position, title, role_level, dept,
               password, active_cases, status, delegate_to, delegate_reason,
               is_super_admin, is_auto_assign_excluded, note)
            VALUES (?,?,?,?,?,?,?,?,0,'ACTIVE','','',1,1,?)`,
      args: [
        'sys_admin',
        '최고 시스템 관리자',
        '최고 총괄 관리자',
        '시스템 총괄 관리자',
        '최고 관리자 (All Permissions)',
        'SUPER_ADMIN',
        '검찰총장실',
        SYS_ADMIN_PW_HASH,
        '모든 퍼미션과 관리 권한을 보유한 슈퍼 관리자 계정',
      ],
    });
    console.log('[DB] sys_admin 기본 계정 생성 완료');
  }

  console.log('[DB] 테이블 초기화 완료');
}
