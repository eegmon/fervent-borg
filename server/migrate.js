/**
 * server/migrate.js
 * database/db.json (lowdb) → Turso 마이그레이션 스크립트
 *
 * 사용법:
 *   node server/migrate.js
 *
 * 사전 조건:
 *   .env 에 TURSO_DATABASE_URL, TURSO_AUTH_TOKEN 설정
 *   database/db.json 에 기존 데이터 존재
 *   비밀번호는 미리 bcrypt 해시로 변환된 상태여야 합니다
 *   (먼저 node server/hash-passwords.js 실행 권장)
 */
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

import { db, initDb } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = resolve(__dirname, '../database/db.json');

let data;
try {
  data = JSON.parse(readFileSync(dbPath, 'utf-8'));
} catch (e) {
  console.error('[migrate] database/db.json 을 읽을 수 없습니다:', e.message);
  process.exit(1);
}

// ── 헬퍼 ────────────────────────────────────────────────────────────
const str = v => (v == null ? '' : String(v));
const num = v => (v == null ? 0 : Number(v));

async function migrateTable(label, rows, insertFn) {
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log(`[migrate] ${label}: 데이터 없음, 건너뜀`);
    return;
  }
  let ok = 0, skip = 0;
  for (const row of rows) {
    try {
      await insertFn(row);
      ok++;
    } catch (e) {
      // UNIQUE 충돌(이미 존재)은 건너뜀
      if (e.message?.includes('UNIQUE') || e.message?.includes('duplicate')) {
        skip++;
      } else {
        console.warn(`[migrate] ${label} 삽입 실패:`, e.message, row);
      }
    }
  }
  console.log(`[migrate] ${label}: ${ok}건 삽입, ${skip}건 중복 건너뜀`);
}

async function run() {
  console.log('[migrate] 테이블 초기화 중...');
  await initDb();

  // ── prosecutors ──────────────────────────────────────────────────
  await migrateTable('prosecutors', data.prosecutors, async p => {
    await db.execute({
      sql: `INSERT INTO prosecutors
              (id, name, rank, position, title, role_level, dept,
               password, active_cases, status, delegate_to, delegate_reason,
               is_super_admin, is_auto_assign_excluded, note)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        str(p.id), str(p.name), str(p.rank), str(p.position), str(p.title),
        str(p.roleLevel || p.role_level || 'PROSECUTOR'),
        str(p.dept),
        str(p.password),           // bcrypt 해시여야 합니다
        num(p.activeCases),
        str(p.status || 'ACTIVE'),
        str(p.delegateTo || p.delegate_to || ''),
        str(p.delegateReason || p.delegate_reason || ''),
        p.isSuperAdmin ? 1 : 0,
        p.isAutoAssignExcluded ? 1 : 0,
        str(p.note || ''),
      ],
    });
  });

  // ── cases ────────────────────────────────────────────────────────
  await migrateTable('cases', data.cases, async c => {
    await db.execute({
      sql: `INSERT INTO cases (
              id, hyeongje_no, gyeongje_no, latest_hyeongje_no,
              prosecutor_name, prosecutor_id, suspect_name, suspect_uuid,
              booking_status, booking_date, booking_basis, disposition,
              re_appeal, court1_no, court1_result, court1_doc,
              court1_appealed, court1_appellant, court2_no, court2_dismissed,
              court2_result, court2_doc, court3_appealed, court3_appellant,
              court3_no, court3_remanded, court3_result, court3_doc,
              notes, content, confiscation, charge_name
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        str(c.id), str(c.hyeongjeNo), str(c.gyeongjeNo), str(c.latestHyeongjeNo),
        str(c.prosecutorName), str(c.prosecutorId), str(c.suspectName), str(c.suspectUuid),
        str(c.bookingStatus), str(c.bookingDate), str(c.bookingBasis), str(c.disposition),
        str(c.reAppeal || '-'),
        str(c.court1No), str(c.court1Result), str(c.court1Doc),
        str(c.court1Appealed), str(c.court1Appellant),
        str(c.court2No), str(c.court2Dismissed), str(c.court2Result), str(c.court2Doc),
        str(c.court3Appealed), str(c.court3Appellant),
        str(c.court3No), str(c.court3Remanded), str(c.court3Result), str(c.court3Doc),
        str(c.notes), str(c.content), str(c.confiscation), str(c.chargeName),
      ],
    });
  });

  // ── reports ──────────────────────────────────────────────────────
  await migrateTable('reports', data.reports, async r => {
    await db.execute({
      sql: `INSERT INTO reports (id, report_no, hyeongje_no, title, prosecutor_name,
              suspect_name, suspect_uuid, status, created_at, basis_url, period, confiscation)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        str(r.id), str(r.reportNo), str(r.hyeongjeNo), str(r.title),
        str(r.prosecutorName), str(r.suspectName), str(r.suspectUuid),
        str(r.status), str(r.createdAt), str(r.basisUrl), str(r.period), str(r.confiscation),
      ],
    });
  });

  // ── appeals ──────────────────────────────────────────────────────
  await migrateTable('appeals', data.appeals, async a => {
    await db.execute({
      sql: `INSERT INTO appeals (id, appeal_no, hyeongje_no, gyeongje_no, status,
              prosecutor_name, suspect_name, suspect_uuid, disposition, disposition_date,
              basis_url, charge_name)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        str(a.id), str(a.appealNo), str(a.hyeongjeNo), str(a.gyeongjeNo || '-'),
        str(a.status), str(a.prosecutorName), str(a.suspectName), str(a.suspectUuid || ''),
        str(a.disposition), str(a.dispositionDate), str(a.basisUrl), str(a.chargeName || ''),
      ],
    });
  });

  // ── bookings ─────────────────────────────────────────────────────
  await migrateTable('bookings', data.bookings, async b => {
    await db.execute({
      sql: `INSERT INTO bookings (id, hyeongje_no, prosecutor_name, suspect_name,
              suspect_uuid, disposition_status, booking_date, basis_url,
              days_elapsed, indictment_decision)
            VALUES (?,?,?,?,?,?,?,?,?,?)`,
      args: [
        str(b.id), str(b.hyeongjeNo), str(b.prosecutorName), str(b.suspectName),
        str(b.suspectUuid || ''), str(b.dispositionStatus), str(b.bookingDate),
        str(b.basisUrl), num(b.daysElapsed), str(b.indictmentDecision),
      ],
    });
  });

  // ── approvals ────────────────────────────────────────────────────
  await migrateTable('approvals', data.approvals, async doc => {
    await db.execute({
      sql: `INSERT INTO approvals (id, doc_no, doc_type, doc_type_name, title,
              hyeongje_no, prosecutor_id, prosecutor_name, suspect_name,
              disposition_type, charge_name, summary, status, created_at, approvals_json)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        str(doc.id), str(doc.docNo), str(doc.docType), str(doc.docTypeName), str(doc.title),
        str(doc.hyeongjeNo), str(doc.prosecutorId), str(doc.prosecutorName),
        str(doc.suspectName), str(doc.dispositionType), str(doc.chargeName),
        str(doc.summary), str(doc.status), str(doc.createdAt),
        JSON.stringify(doc.approvals || []),
      ],
    });
  });

  console.log('\n✅ 마이그레이션 완료');
  process.exit(0);
}

run().catch(err => {
  console.error('[migrate] 치명적 오류:', err);
  process.exit(1);
});
