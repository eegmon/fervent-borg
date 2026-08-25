/**
 * server/index.js
 * Dose-PROS REST API 서버 (Express + Turso + bcrypt + JWT)
 */
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

import { db, initDb } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app  = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error('[FATAL] JWT_SECRET 환경변수가 설정되지 않았습니다. 서버를 종료합니다.');
  process.exit(1);
}

// ── CORS 설정 ────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5173'];

app.use(cors({
  origin: (origin, cb) => {
    // 서버-간 요청(origin 없음)이나 허용 목록에 있으면 통과
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: ${origin} 은 허용되지 않는 출처입니다.`));
  },
  credentials: true,
}));
app.use(express.json());

// ── 입력 크기 제한 ────────────────────────────────────────────────────
app.use(express.json({ limit: '256kb' }));

// ── JWT 인증 미들웨어 ─────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '인증 토큰이 없습니다.' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, message: '유효하지 않거나 만료된 토큰입니다.' });
  }
}

// ── 헬퍼: 행을 camelCase 객체로 변환 ─────────────────────────────────
function toCamel(row) {
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = v;
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════
// 1. Auth
// ════════════════════════════════════════════════════════════════════
app.post('/api/auth/login', async (req, res) => {
  const { id, password } = req.body;
  if (!id || !password) {
    return res.status(400).json({ success: false, message: '아이디와 비밀번호를 입력해주세요.' });
  }

  const result = await db.execute({
    sql: 'SELECT * FROM prosecutors WHERE id = ?',
    args: [id],
  });

  if (result.rows.length === 0) {
    return res.status(401).json({ success: false, message: '존재하지 않는 계정입니다.' });
  }

  const user = toCamel(result.rows[0]);
  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    return res.status(401).json({ success: false, message: '비밀번호가 올바르지 않습니다.' });
  }

  const { password: _pw, ...safeUser } = user;
  const token = jwt.sign(
    { id: safeUser.id, roleLevel: safeUser.roleLevel },
    JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({ success: true, token, user: safeUser });
});

// ════════════════════════════════════════════════════════════════════
// 2. Cases  (GET 공개, 나머지 인증 필요)
// ════════════════════════════════════════════════════════════════════
app.get('/api/cases', requireAuth, async (req, res) => {
  const result = await db.execute('SELECT * FROM cases ORDER BY rowid DESC');
  res.json(result.rows.map(toCamel));
});

app.post('/api/cases', requireAuth, async (req, res) => {
  const c = req.body;
  const id = String(c.id || Date.now());
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
          ) VALUES (
            ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
          )`,
    args: [
      id, c.hyeongjeNo||'', c.gyeongjeNo||'', c.latestHyeongjeNo||'',
      c.prosecutorName||'', c.prosecutorId||'', c.suspectName||'', c.suspectUuid||'',
      c.bookingStatus||'', c.bookingDate||'', c.bookingBasis||'', c.disposition||'',
      c.reAppeal||'-', c.court1No||'', c.court1Result||'', c.court1Doc||'',
      c.court1Appealed||'', c.court1Appellant||'', c.court2No||'', c.court2Dismissed||'',
      c.court2Result||'', c.court2Doc||'', c.court3Appealed||'', c.court3Appellant||'',
      c.court3No||'', c.court3Remanded||'', c.court3Result||'', c.court3Doc||'',
      c.notes||'', c.content||'', c.confiscation||'', c.chargeName||'',
    ],
  });
  res.json({ success: true, case: { ...c, id } });
});

app.put('/api/cases/:id', requireAuth, async (req, res) => {
  const c = req.body;
  await db.execute({
    sql: `UPDATE cases SET
            hyeongje_no=?, prosecutor_name=?, prosecutor_id=?,
            suspect_name=?, booking_status=?, disposition=?,
            charge_name=?, notes=?, content=?, confiscation=?
          WHERE id=?`,
    args: [
      c.hyeongjeNo||'', c.prosecutorName||'', c.prosecutorId||'',
      c.suspectName||'', c.bookingStatus||'', c.disposition||'',
      c.chargeName||'', c.notes||'', c.content||'', c.confiscation||'',
      req.params.id,
    ],
  });
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════════
// 3. Reports
// ════════════════════════════════════════════════════════════════════
app.get('/api/reports', requireAuth, async (req, res) => {
  const result = await db.execute('SELECT * FROM reports ORDER BY rowid DESC');
  res.json(result.rows.map(toCamel));
});

app.post('/api/reports', requireAuth, async (req, res) => {
  const r = req.body;
  const id = String(r.id || Date.now());
  await db.execute({
    sql: `INSERT INTO reports (id, report_no, hyeongje_no, title, prosecutor_name,
            suspect_name, suspect_uuid, status, created_at, basis_url, period, confiscation)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      id, r.reportNo||'', r.hyeongjeNo||'', r.title||'',
      r.prosecutorName||'', r.suspectName||'', r.suspectUuid||'',
      r.status||'', r.createdAt||'', r.basisUrl||'', r.period||'', r.confiscation||'',
    ],
  });
  res.json({ success: true, report: { ...r, id } });
});

// ════════════════════════════════════════════════════════════════════
// 4. Appeals
// ════════════════════════════════════════════════════════════════════
app.get('/api/appeals', requireAuth, async (req, res) => {
  const result = await db.execute('SELECT * FROM appeals ORDER BY rowid DESC');
  res.json(result.rows.map(toCamel));
});

app.post('/api/appeals', requireAuth, async (req, res) => {
  const a = req.body;
  const id = String(a.id || Date.now());
  await db.execute({
    sql: `INSERT INTO appeals (id, appeal_no, hyeongje_no, gyeongje_no, status,
            prosecutor_name, suspect_name, suspect_uuid, disposition, disposition_date,
            basis_url, charge_name)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      id, a.appealNo||'', a.hyeongjeNo||'', a.gyeongjeNo||'',
      a.status||'', a.prosecutorName||'', a.suspectName||'', a.suspectUuid||'',
      a.disposition||'', a.dispositionDate||'', a.basisUrl||'', a.chargeName||'',
    ],
  });
  res.json({ success: true, appeal: { ...a, id } });
});

// ════════════════════════════════════════════════════════════════════
// 5. Bookings
// ════════════════════════════════════════════════════════════════════
app.get('/api/bookings', requireAuth, async (req, res) => {
  const result = await db.execute('SELECT * FROM bookings ORDER BY rowid DESC');
  res.json(result.rows.map(toCamel));
});

app.post('/api/bookings', requireAuth, async (req, res) => {
  const b = req.body;
  const id = String(b.id || Date.now());
  await db.execute({
    sql: `INSERT INTO bookings (id, hyeongje_no, prosecutor_name, suspect_name,
            suspect_uuid, disposition_status, booking_date, basis_url,
            days_elapsed, indictment_decision)
          VALUES (?,?,?,?,?,?,?,?,?,?)`,
    args: [
      id, b.hyeongjeNo||'', b.prosecutorName||'', b.suspectName||'',
      b.suspectUuid||'', b.dispositionStatus||'', b.bookingDate||'',
      b.basisUrl||'', b.daysElapsed||0, b.indictmentDecision||'',
    ],
  });
  res.json({ success: true, booking: { ...b, id } });
});

// ════════════════════════════════════════════════════════════════════
// 6. Approvals
// ════════════════════════════════════════════════════════════════════
app.get('/api/approvals', requireAuth, async (req, res) => {
  const result = await db.execute('SELECT * FROM approvals ORDER BY rowid DESC');
  res.json(result.rows.map(row => ({
    ...toCamel(row),
    approvals: JSON.parse(row.approvals_json || '[]'),
  })));
});

app.post('/api/approvals', requireAuth, async (req, res) => {
  const doc = req.body;
  await db.execute({
    sql: `INSERT INTO approvals (id, doc_no, doc_type, doc_type_name, title,
            hyeongje_no, prosecutor_id, prosecutor_name, suspect_name,
            disposition_type, charge_name, summary, status, created_at, approvals_json)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      doc.id, doc.docNo||'', doc.docType||'', doc.docTypeName||'', doc.title||'',
      doc.hyeongjeNo||'', doc.prosecutorId||'', doc.prosecutorName||'',
      doc.suspectName||'', doc.dispositionType||'', doc.chargeName||'',
      doc.summary||'', doc.status||'', doc.createdAt||'',
      JSON.stringify(doc.approvals || []),
    ],
  });
  res.json({ success: true, doc });
});

app.put('/api/approvals/:id/approve', requireAuth, async (req, res) => {
  const docId = req.params.id;
  const docRes = await db.execute({
    sql: 'SELECT * FROM approvals WHERE id = ?',
    args: [docId],
  });

  if (docRes.rows.length === 0) {
    return res.status(404).json({ error: '문서를 찾을 수 없습니다.' });
  }

  const doc = toCamel(docRes.rows[0]);
  const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
  const updatedApprovals = (JSON.parse(doc.approvalsJson || '[]')).map(a => ({
    ...a,
    status: '최종결재(인장날인)',
    date: now,
  }));

  await db.execute({
    sql: `UPDATE approvals SET status='최종승인', approvals_json=? WHERE id=?`,
    args: [JSON.stringify(updatedApprovals), docId],
  });

  // 관련 사건 처분 상태 업데이트
  await db.execute({
    sql: `UPDATE cases SET disposition=? WHERE hyeongje_no=?`,
    args: [`${doc.dispositionType} (결재완료)`, doc.hyeongjeNo],
  });

  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════════
// 7. Prosecutors (사무국 관리용)
// ════════════════════════════════════════════════════════════════════
app.get('/api/prosecutors', requireAuth, async (req, res) => {
  const result = await db.execute('SELECT * FROM prosecutors');
  // 비밀번호 필드 제외 후 반환
  res.json(result.rows.map(row => {
    const { password: _pw, ...safe } = toCamel(row);
    return safe;
  }));
});

// ════════════════════════════════════════════════════════════════════
// 8. Registrations — 회원가입 신청 / 검찰사무국 허가
// ════════════════════════════════════════════════════════════════════

// ── 8-1. 회원가입 신청 (공개 엔드포인트) ────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  const { id, name, rank, position, title, roleLevel, dept, password, note } = req.body;

  if (!id || !name || !password) {
    return res.status(400).json({ success: false, message: '아이디, 이름, 비밀번호는 필수입니다.' });
  }

  // 아이디 형식 검증 (영숫자, 언더스코어, 하이픈, 2~30자)
  if (!/^[a-zA-Z0-9_\-]{2,30}$/.test(id)) {
    return res.status(400).json({ success: false, message: '아이디는 영문/숫자/언더스코어/하이픈 2~30자여야 합니다.' });
  }

  // 비밀번호 최소 길이
  if (password.length < 4) {
    return res.status(400).json({ success: false, message: '비밀번호는 4자 이상이어야 합니다.' });
  }

  try {
    // 기존 검사 계정 중복 확인
    const existPros = await db.execute({
      sql: 'SELECT id FROM prosecutors WHERE id = ?',
      args: [id],
    });
    if (existPros.rows.length > 0) {
      return res.status(409).json({ success: false, message: '이미 사용 중인 아이디입니다.' });
    }

    // 대기 중인 신청 중 동일 아이디 중복 확인
    const existReg = await db.execute({
      sql: "SELECT id FROM registrations WHERE req_id = ? AND status = 'PENDING'",
      args: [id],
    });
    if (existReg.rows.length > 0) {
      return res.status(409).json({ success: false, message: '이미 가입 신청 중인 아이디입니다. 검찰사무국 허가를 기다려주세요.' });
    }

    const hashedPw = await bcrypt.hash(password, 10);
    const regId = `REG-${Date.now()}`;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    await db.execute({
      sql: `INSERT INTO registrations
              (id, req_id, name, rank, position, title, role_level, dept, password, note, status, created_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [
        regId, id, name,
        rank || '', position || '', title || '',
        roleLevel || 'PROSECUTOR',
        dept || '',
        hashedPw,
        note || '',
        'PENDING',
        now,
      ],
    });

    res.json({ success: true, message: '가입 신청이 접수되었습니다. 검찰사무국의 허가를 기다려주세요.' });
  } catch (err) {
    console.error('[register]', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// ── 8-2. 가입 신청 목록 조회 (검찰사무국 전용) ──────────────────────
app.get('/api/registrations', requireAuth, async (req, res) => {
  // 검찰사무국 접근 가능 직급 체크
  const allowed = ['SUPER_ADMIN', 'PROSECUTOR_GENERAL', 'CHIEF_PROSECUTOR',
                   'DEPUTY_CHIEF', 'CHIEF_ADMINISTRATOR'];
  const isSecretariat = allowed.includes(req.user.roleLevel) ||
    req.user.dept?.includes('사무국');

  if (!isSecretariat) {
    return res.status(403).json({ success: false, message: '검찰사무국 권한이 필요합니다.' });
  }

  try {
    const result = await db.execute(
      'SELECT * FROM registrations ORDER BY created_at DESC'
    );
    // 비밀번호 제외 후 반환
    res.json(result.rows.map(row => {
      const { password: _pw, ...safe } = toCamel(row);
      return safe;
    }));
  } catch (err) {
    console.error('[registrations GET]', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// ── 8-3. 가입 신청 허가 ─────────────────────────────────────────────
app.put('/api/registrations/:id/approve', requireAuth, async (req, res) => {
  const allowed = ['SUPER_ADMIN', 'PROSECUTOR_GENERAL', 'CHIEF_PROSECUTOR',
                   'DEPUTY_CHIEF', 'CHIEF_ADMINISTRATOR'];
  const isSecretariat = allowed.includes(req.user.roleLevel) ||
    req.user.dept?.includes('사무국');

  if (!isSecretariat) {
    return res.status(403).json({ success: false, message: '검찰사무국 권한이 필요합니다.' });
  }

  try {
    const regRes = await db.execute({
      sql: 'SELECT * FROM registrations WHERE id = ?',
      args: [req.params.id],
    });
    if (regRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: '신청 건을 찾을 수 없습니다.' });
    }

    const reg = toCamel(regRes.rows[0]);
    if (reg.status !== 'PENDING') {
      return res.status(409).json({ success: false, message: '이미 처리된 신청입니다.' });
    }

    // 아이디 최종 중복 확인
    const existPros = await db.execute({
      sql: 'SELECT id FROM prosecutors WHERE id = ?',
      args: [reg.reqId],
    });
    if (existPros.rows.length > 0) {
      return res.status(409).json({ success: false, message: '이미 사용 중인 아이디입니다.' });
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    // prosecutors 테이블에 계정 생성
    await db.execute({
      sql: `INSERT INTO prosecutors
              (id, name, rank, position, title, role_level, dept, password,
               active_cases, status, delegate_to, delegate_reason,
               is_super_admin, is_auto_assign_excluded, note)
            VALUES (?,?,?,?,?,?,?,?,0,'ACTIVE','','',0,0,?)`,
      args: [
        reg.reqId, reg.name, reg.rank || '', reg.position || '',
        reg.title || '', reg.roleLevel || 'PROSECUTOR',
        reg.dept || '', reg.password,
        reg.note || '',
      ],
    });

    // 신청 상태 업데이트
    await db.execute({
      sql: `UPDATE registrations SET status='APPROVED', reviewed_at=?, reviewed_by=? WHERE id=?`,
      args: [now, req.user.id, req.params.id],
    });

    res.json({
      success: true,
      message: `'${reg.name}' 계정이 승인되어 검찰 시스템에 등록되었습니다.`,
      user: {
        id: reg.reqId, name: reg.name, rank: reg.rank,
        position: reg.position, title: reg.title,
        roleLevel: reg.roleLevel, dept: reg.dept,
      },
    });
  } catch (err) {
    console.error('[registrations approve]', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// ── 8-4. 가입 신청 거부 ─────────────────────────────────────────────
app.put('/api/registrations/:id/reject', requireAuth, async (req, res) => {
  const allowed = ['SUPER_ADMIN', 'PROSECUTOR_GENERAL', 'CHIEF_PROSECUTOR',
                   'DEPUTY_CHIEF', 'CHIEF_ADMINISTRATOR'];
  const isSecretariat = allowed.includes(req.user.roleLevel) ||
    req.user.dept?.includes('사무국');

  if (!isSecretariat) {
    return res.status(403).json({ success: false, message: '검찰사무국 권한이 필요합니다.' });
  }

  const { reason } = req.body;

  try {
    const regRes = await db.execute({
      sql: 'SELECT * FROM registrations WHERE id = ?',
      args: [req.params.id],
    });
    if (regRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: '신청 건을 찾을 수 없습니다.' });
    }

    const reg = toCamel(regRes.rows[0]);
    if (reg.status !== 'PENDING') {
      return res.status(409).json({ success: false, message: '이미 처리된 신청입니다.' });
    }

    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

    await db.execute({
      sql: `UPDATE registrations
              SET status='REJECTED', reject_reason=?, reviewed_at=?, reviewed_by=?
            WHERE id=?`,
      args: [reason || '검찰사무국 심사 불허', now, req.user.id, req.params.id],
    });

    res.json({ success: true, message: `'${reg.name}' 가입 신청이 거부되었습니다.` });
  } catch (err) {
    console.error('[registrations reject]', err);
    res.status(500).json({ success: false, message: '서버 오류가 발생했습니다.' });
  }
});

// ── 정적 파일 서빙 (프로덕션) ────────────────────────────────────────
const distPath = join(__dirname, '..', 'dist');
app.use(express.static(distPath));

// API 라우트가 아닌 모든 요청은 index.html로 (SPA 라우팅)
app.get('*', (req, res) => {
  res.sendFile(join(distPath, 'index.html'));
});

// ── 서버 시작 ─────────────────────────────────────────────────────
async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`[Dose-PROS API] http://localhost:${PORT}`);
  });
}

start().catch(err => {
  console.error('[FATAL] 서버 시작 실패:', err);
  process.exit(1);
});
