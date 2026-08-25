/**
 * server/index.js
 * Dose-PROS REST API 서버 (Express + Turso + bcrypt + JWT)
 */
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import "dotenv/config";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import { db, initDb } from "./db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  console.error(
    "[FATAL] JWT_SECRET 환경변수가 설정되지 않았습니다. 서버를 종료합니다.",
  );
  process.exit(1);
}

// ── CORS 설정 ────────────────────────────────────────────────────────
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
      .map((o) => o.trim())
      .filter(Boolean)
  : process.env.NODE_ENV === "production" && process.env.RENDER_EXTERNAL_URL
    ? [process.env.RENDER_EXTERNAL_URL.replace(/\/$/, "")]
    : [];

if (process.env.NODE_ENV === "production" && allowedOrigins.length === 0) {
  console.error(
    "[FATAL] 운영 환경에서는 ALLOWED_ORIGINS 환경변수가 필요합니다.",
  );
  process.exit(1);
}

const authAttempts = new Map();
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 10;
const GLOBAL_DATA_ROLES = new Set([
  "SUPER_ADMIN",
  "PROSECUTOR_GENERAL",
  "CHIEF_PROSECUTOR",
  "DEPUTY_CHIEF",
  "CHIEF_ADMINISTRATOR",
]);
const APPROVAL_ROLES = new Set([...GLOBAL_DATA_ROLES, "SENIOR_PROSECUTOR"]);

function authRateLimit(req, res, next) {
  const identity = String(req.body?.id || "anonymous").toLowerCase();
  const key = `${req.ip}:${req.path}:${identity}`;
  const now = Date.now();
  const previous = authAttempts.get(key);
  if (!previous || now - previous.startedAt >= AUTH_WINDOW_MS) {
    authAttempts.set(key, { startedAt: now, count: 1 });
    return next();
  }
  if (previous.count >= AUTH_MAX_ATTEMPTS) {
    return res.status(429).json({
      success: false,
      message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
    });
  }
  previous.count += 1;
  next();
}

function clearAuthAttempts(req) {
  const identity = String(req.body?.id || "anonymous").toLowerCase();
  authAttempts.delete(`${req.ip}:${req.path}:${identity}`);
}

app.use(
  cors({
    origin: (origin, cb) => {
      // 같은 도메인(origin 없음) 또는 허용 목록이면 통과
      if (!origin) return cb(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin))
        return cb(null, true);
      cb(new Error(`CORS: ${origin} 은 허용되지 않는 출처입니다.`));
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: "256kb" }));
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
});

// ── JWT 인증 미들웨어 ─────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ success: false, message: "인증 토큰이 없습니다." });
  }
  try {
    const claims = jwt.verify(header.slice(7), JWT_SECRET);
    const result = await db.execute({
      sql: "SELECT id, name, role_level, dept, status, is_super_admin, dual_dept, dual_role_level, dual_secretariat_work FROM prosecutors WHERE id = ?",
      args: [claims.id],
    });
    if (result.rows.length === 0 || result.rows[0].status !== "ACTIVE") {
      return res
        .status(401)
        .json({ success: false, message: "비활성화된 계정입니다." });
    }
    const account = toCamel(result.rows[0]);
    req.user = {
      ...claims,
      ...account,
      isSuperAdmin: Boolean(account.isSuperAdmin),
    };
    next();
  } catch {
    return res
      .status(401)
      .json({ success: false, message: "유효하지 않거나 만료된 토큰입니다." });
  }
}

function hasGlobalDataAccess(user) {
  return Boolean(user.isSuperAdmin || GLOBAL_DATA_ROLES.has(user.roleLevel));
}

function hasSecretariatWorkAccess(user) {
  return Boolean(
    user.dept?.includes("사무국") ||
    (user.dualSecretariatWork && user.dualDept?.includes("사무국")),
  );
}

function requireApprovalAuthority(req, res, next) {
  if (!APPROVAL_ROLES.has(req.user.roleLevel)) {
    return res
      .status(403)
      .json({ success: false, message: "결재 권한이 필요합니다." });
  }
  next();
}

function requireApprovalScope(req, res, next) {
  if (hasGlobalDataAccess(req.user)) return next();
  return requireRecordScope("approvals")(req, res, next);
}

async function requireCaseScope(req, res, next) {
  if (hasGlobalDataAccess(req.user)) return next();
  const result = await db.execute({
    sql: `SELECT 1 FROM cases c JOIN prosecutors p ON c.prosecutor_id = p.id
          WHERE c.id = ? AND p.dept = (SELECT dept FROM prosecutors WHERE id = ?)`,
    args: [req.params.id, req.user.id],
  });
  if (result.rows.length === 0) {
    return res
      .status(403)
      .json({ success: false, message: "해당 사건에 접근할 권한이 없습니다." });
  }
  next();
}

async function findCaseForEvidence(caseNo, user) {
  const result = await db.execute({
    sql: hasGlobalDataAccess(user)
      ? "SELECT id, hyeongje_no, gyeongje_no, prosecutor_id FROM cases WHERE deleted_at = '' AND (hyeongje_no = ? OR gyeongje_no = ?) LIMIT 1"
      : `SELECT c.id, c.hyeongje_no, c.gyeongje_no, c.prosecutor_id
         FROM cases c JOIN prosecutors p ON c.prosecutor_id = p.id
         WHERE c.deleted_at = '' AND (c.hyeongje_no = ? OR c.gyeongje_no = ?)
           AND p.dept = (SELECT dept FROM prosecutors WHERE id = ?) LIMIT 1`,
    args: hasGlobalDataAccess(user)
      ? [caseNo, caseNo]
      : [caseNo, caseNo, user.id],
  });
  return result.rows[0] || null;
}

function scopedQuery(table, user, orderBy = "rowid DESC") {
  if (hasGlobalDataAccess(user)) {
    return {
      sql: `SELECT * FROM ${table} WHERE deleted_at = '' ORDER BY ${orderBy}`,
      args: [],
    };
  }
  const usesId = table === "cases" || table === "approvals";
  const field = usesId ? "prosecutor_id" : "prosecutor_name";
  const value = usesId ? "p.id" : "p.name";
  return {
    sql: `SELECT ${table}.* FROM ${table} JOIN prosecutors p ON ${table}.${field} = ${value}
          WHERE ${table}.deleted_at = '' AND p.dept = (SELECT dept FROM prosecutors WHERE id = ?)
          ORDER BY ${table}.${orderBy}`,
    args: [user.id],
  };
}

function requireRecordScope(table) {
  return async (req, res, next) => {
    if (hasGlobalDataAccess(req.user)) return next();
    const field = table === "approvals" ? "prosecutor_id" : "prosecutor_name";
    const value = table === "approvals" ? req.user.id : req.user.name;
    const result = await db.execute({
      sql: `SELECT 1 FROM ${table} WHERE id=? AND ${field}=? AND deleted_at=''`,
      args: [req.params.id, value],
    });
    if (!result.rows.length)
      return res
        .status(403)
        .json({
          success: false,
          message: "해당 자료에 접근할 권한이 없습니다.",
        });
    next();
  };
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
app.post("/api/auth/login", authRateLimit, async (req, res) => {
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
    return res
      .status(401)
      .json({ success: false, message: invalidLoginMessage });
  }

  const user = toCamel(result.rows[0]);
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

  res.json({ success: true, token, user: safeUser });
});

// ════════════════════════════════════════════════════════════════════
// 2. Cases  (GET 공개, 나머지 인증 필요)
// ════════════════════════════════════════════════════════════════════
app.get("/api/cases", requireAuth, async (req, res) => {
  const result = await db.execute(scopedQuery("cases", req.user));
  res.json(result.rows.map(toCamel));
});

// ── 사건번호 자동계산 시작값 (검찰사무국 전용 수정) ────────────────
app.get("/api/settings/case-number", requireAuth, async (req, res) => {
  const result = await db.execute(
    `SELECT key, value FROM system_settings WHERE key LIKE 'case_number_%_start'`,
  );
  const settings = Object.fromEntries(
    result.rows.map((row) => [row.key, Number(row.value)]),
  );
  const getStart = (key, fallback = 1) =>
    Number.isFinite(settings[key]) ? settings[key] : fallback;
  res.json({
    hyeongjeStart: getStart("case_number_hyeongje_start", 280),
    teuggongStart: getStart("case_number_teuggong_start"),
    teughyeongStart: getStart("case_number_teughyeong_start"),
    teugapjeStart: getStart("case_number_teugapje_start"),
    apjeStart: getStart("case_number_apje_start"),
  });
});

app.patch(
  "/api/settings/case-number",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    const hyeongjeStart = Number(req.body.hyeongjeStart);
    const starts = {
      hyeongje: hyeongjeStart,
      teuggong: Number(req.body.teuggongStart),
      teughyeong: Number(req.body.teughyeongStart),
      teugapje: Number(req.body.teugapjeStart),
      apje: Number(req.body.apjeStart),
    };
    if (
      Object.values(starts).some(
        (value) => !Number.isInteger(value) || value < 1,
      )
    ) {
      return res
        .status(400)
        .json({
          success: false,
          message: "시작번호는 1 이상의 정수여야 합니다.",
        });
    }
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);
    await db.batch(
      Object.entries(starts).map(([type, value]) => ({
        sql: `UPDATE system_settings SET value=?, updated_at=?, updated_by=? WHERE key='case_number_${type}_start'`,
        args: [String(value), now, req.user.id],
      })),
      "write",
    );
    res.json({
      success: true,
      hyeongjeStart,
      teuggongStart: starts.teuggong,
      teughyeongStart: starts.teughyeong,
      teugapjeStart: starts.teugapje,
      apjeStart: starts.apje,
    });
  },
);

app.get("/api/departments", requireAuth, async (_req, res) => {
  const result = await db.execute({
    sql: "SELECT value FROM system_settings WHERE key='departments_json'",
    args: [],
  });
  try {
    res.json(JSON.parse(result.rows[0]?.value || "[]"));
  } catch {
    res
      .status(500)
      .json({ success: false, message: "부서 설정을 읽을 수 없습니다." });
  }
});

app.put(
  "/api/departments",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    if (!Array.isArray(req.body?.departments))
      return res
        .status(400)
        .json({
          success: false,
          message: "부서 목록 형식이 올바르지 않습니다.",
        });
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);
    await db.execute({
      sql: "UPDATE system_settings SET value=?, updated_at=?, updated_by=? WHERE key='departments_json'",
      args: [JSON.stringify(req.body.departments), now, req.user.id],
    });
    res.json({ success: true, departments: req.body.departments });
  },
);

app.post("/api/cases", requireAuth, async (req, res) => {
  const c = req.body;
  const assignedId = hasGlobalDataAccess(req.user)
    ? c.prosecutorId || ""
    : req.user.id;
  const assignedName = hasGlobalDataAccess(req.user)
    ? c.prosecutorName || ""
    : req.user.name;
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
      id,
      c.hyeongjeNo || "",
      c.gyeongjeNo || "",
      c.latestHyeongjeNo || "",
      assignedName,
      assignedId,
      c.suspectName || "",
      c.suspectUuid || "",
      c.bookingStatus || "",
      c.bookingDate || "",
      c.bookingBasis || "",
      c.disposition || "",
      c.reAppeal || "-",
      c.court1No || "",
      c.court1Result || "",
      c.court1Doc || "",
      c.court1Appealed || "",
      c.court1Appellant || "",
      c.court2No || "",
      c.court2Dismissed || "",
      c.court2Result || "",
      c.court2Doc || "",
      c.court3Appealed || "",
      c.court3Appellant || "",
      c.court3No || "",
      c.court3Remanded || "",
      c.court3Result || "",
      c.court3Doc || "",
      c.notes || "",
      c.content || "",
      c.confiscation || "",
      c.chargeName || "",
    ],
  });
  await writeAuditLog({
    action: "CREATE",
    entityType: "case",
    entityId: id,
    entityLabel: c.hyeongjeNo || id,
    actorId: req.user.id,
    actorName: req.user.id,
    detail: `피의자: ${c.suspectName || ""}, 죄명: ${c.chargeName || ""}`,
  });
  res.json({ success: true, case: { ...c, id } });
});

app.post("/api/cases/intake-bundle", requireAuth, async (req, res) => {
  const c = req.body || {};
  const assignedId = hasGlobalDataAccess(req.user)
    ? String(c.prosecutorId || "")
    : req.user.id;
  const assignedName = hasGlobalDataAccess(req.user)
    ? String(c.prosecutorName || "")
    : req.user.name;
  const id = String(
    c.id || `CASE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  );
  const reportId = `REP-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const bookingId = `BKG-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const createdAt = new Date().toISOString().replace("T", " ").substring(0, 16);
  const caseArgs = [
    id,
    c.hyeongjeNo || "",
    c.gyeongjeNo || "",
    c.latestHyeongjeNo || "",
    assignedName,
    assignedId,
    c.suspectName || "",
    c.suspectUuid || "",
    c.bookingStatus || "",
    c.bookingDate || "",
    c.bookingBasis || "",
    c.disposition || "",
    c.reAppeal || "-",
    c.court1No || "",
    c.court1Result || "",
    c.court1Doc || "",
    c.court1Appealed || "",
    c.court1Appellant || "",
    c.court2No || "",
    c.court2Dismissed || "",
    c.court2Result || "",
    c.court2Doc || "",
    c.court3Appealed || "",
    c.court3Appellant || "",
    c.court3No || "",
    c.court3Remanded || "",
    c.court3Result || "",
    c.court3Doc || "",
    c.notes || "",
    c.content || "",
    c.confiscation || "",
    c.chargeName || "",
  ];
  try {
    await db.batch(
      [
        {
          sql: `INSERT INTO cases (id,hyeongje_no,gyeongje_no,latest_hyeongje_no,prosecutor_name,prosecutor_id,suspect_name,suspect_uuid,booking_status,booking_date,booking_basis,disposition,re_appeal,court1_no,court1_result,court1_doc,court1_appealed,court1_appellant,court2_no,court2_dismissed,court2_result,court2_doc,court3_appealed,court3_appellant,court3_no,court3_remanded,court3_result,court3_doc,notes,content,confiscation,charge_name) VALUES (${Array(32).fill("?").join(",")})`,
          args: caseArgs,
        },
        {
          sql: `INSERT INTO reports (id,report_no,hyeongje_no,title,prosecutor_name,suspect_name,suspect_uuid,status,created_at,basis_url,period,confiscation) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          args: [
            reportId,
            `접수-${Date.now()}`,
            c.hyeongjeNo || "",
            `${c.chargeName || ""} 사건 접수 건`,
            assignedName,
            c.suspectName || "",
            c.suspectUuid || "",
            "입건 완료",
            createdAt,
            c.bookingBasis || "",
            `${c.bookingDate || ""} ~ 수사중`,
            c.confiscation || "-",
          ],
        },
        {
          sql: `INSERT INTO bookings (id,hyeongje_no,prosecutor_name,suspect_name,suspect_uuid,disposition_status,booking_date,basis_url,days_elapsed,indictment_decision) VALUES (?,?,?,?,?,?,?,?,?,?)`,
          args: [
            bookingId,
            c.hyeongjeNo || "",
            assignedName,
            c.suspectName || "",
            c.suspectUuid || "",
            c.bookingStatus || "",
            c.bookingDate || "",
            c.bookingBasis || "",
            1,
            "수사 진행 중",
          ],
        },
      ],
      "write",
    );
    await writeAuditLog({
      action: "CREATE",
      entityType: "case",
      entityId: id,
      entityLabel: c.hyeongjeNo || id,
      actorId: req.user.id,
      actorName: req.user.name,
      detail: "사건·신고·입건 원자적 접수",
    });
    res.json({
      success: true,
      case: {
        ...c,
        id,
        prosecutorId: assignedId,
        prosecutorName: assignedName,
      },
      reportId,
      bookingId,
    });
  } catch (err) {
    console.error("[POST /cases/intake-bundle]", err);
    res
      .status(500)
      .json({ success: false, message: "사건 접수 중 저장에 실패했습니다." });
  }
});

app.put("/api/cases/:id", requireAuth, requireCaseScope, async (req, res) => {
  const c = req.body;
  const assignedId = hasGlobalDataAccess(req.user)
    ? String(c.prosecutorId || "")
    : req.user.id;
  const assignedName = hasGlobalDataAccess(req.user)
    ? String(c.prosecutorName || "")
    : req.user.name;

  // 변경 이력 저장: 기존 값과 비교
  try {
    const oldRes = await db.execute({
      sql: "SELECT * FROM cases WHERE id = ?",
      args: [req.params.id],
    });
    if (oldRes.rows.length > 0) {
      const old = toCamel(oldRes.rows[0]);
      const trackFields = [
        ["hyeongjeNo", "형제번호"],
        ["prosecutorName", "담당검사"],
        ["suspectName", "피의자명"],
        ["bookingStatus", "입건상태"],
        ["disposition", "처분내역"],
        ["chargeName", "죄명"],
        ["notes", "비고"],
        ["content", "사건 내용"],
        ["confiscation", "몰수추징"],
      ];
      const now = new Date().toISOString().replace("T", " ").substring(0, 19);
      for (const [field, label] of trackFields) {
        const oldVal = String(old[field] || "");
        const newVal = String(c[field] || "");
        if (oldVal !== newVal) {
          const histId = `CH-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
          await db.execute({
            sql: `INSERT INTO case_history (id, case_id, hyeongje_no, actor_id, actor_name, field_name, old_value, new_value, created_at)
                  VALUES (?,?,?,?,?,?,?,?,?)`,
            args: [
              histId,
              req.params.id,
              c.hyeongjeNo || old.hyeongjeNo,
              req.user.id,
              req.user.id,
              label,
              oldVal,
              newVal,
              now,
            ],
          });
        }
      }
    }
  } catch (e) {
    console.warn("[case history write error]", e.message);
  }

  await db.execute({
    sql: `UPDATE cases SET
            hyeongje_no=?, prosecutor_name=?, prosecutor_id=?,
            suspect_name=?, booking_status=?, disposition=?,
            charge_name=?, notes=?, content=?, confiscation=?,
            supervisor_designated=?, supervisor_id=?, supervisor_name=?
          WHERE id=?`,
    args: [
      c.hyeongjeNo || "",
      assignedName,
      assignedId,
      c.suspectName || "",
      c.bookingStatus || "",
      c.disposition || "",
      c.chargeName || "",
      c.notes || "",
      c.content || "",
      c.confiscation || "",
      c.supervisorDesignated ? 1 : 0,
      c.supervisorId || "",
      c.supervisorName || "",
      req.params.id,
    ],
  });
  await writeAuditLog({
    action: "UPDATE",
    entityType: "case",
    entityId: req.params.id,
    entityLabel: c.hyeongjeNo || req.params.id,
    actorId: req.user.id,
    actorName: req.user.id,
    detail: `처분: ${c.disposition || ""}, 상태: ${c.bookingStatus || ""}`,
  });
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════════
// 3. Reports
// ════════════════════════════════════════════════════════════════════
app.get("/api/reports", requireAuth, async (req, res) => {
  const result = await db.execute(scopedQuery("reports", req.user));
  res.json(result.rows.map(toCamel));
});

app.post("/api/reports", requireAuth, async (req, res) => {
  const r = req.body;
  const assignedName = hasGlobalDataAccess(req.user)
    ? r.prosecutorName || req.user.name
    : req.user.name;
  const id = String(r.id || Date.now());
  await db.execute({
    sql: `INSERT INTO reports (id, report_no, hyeongje_no, title, prosecutor_name,
            suspect_name, suspect_uuid, status, created_at, basis_url, period, confiscation)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      id,
      r.reportNo || "",
      r.hyeongjeNo || "",
      r.title || "",
      assignedName,
      r.suspectName || "",
      r.suspectUuid || "",
      r.status || "",
      r.createdAt || "",
      r.basisUrl || "",
      r.period || "",
      r.confiscation || "",
    ],
  });
  res.json({ success: true, report: { ...r, id } });
});

app.patch(
  "/api/reports/:id",
  requireAuth,
  requireSecretariat,
  requireRecordScope("reports"),
  async (req, res) => {
    const fields = {
      reportNo: "report_no",
      hyeongjeNo: "hyeongje_no",
      title: "title",
      prosecutorName: "prosecutor_name",
      suspectName: "suspect_name",
      suspectUuid: "suspect_uuid",
      status: "status",
      basisUrl: "basis_url",
      period: "period",
      confiscation: "confiscation",
    };
    const updates = Object.entries(fields).filter(
      ([field]) => req.body[field] !== undefined,
    );
    if (!updates.length)
      return res
        .status(400)
        .json({ success: false, message: "변경할 값이 없습니다." });
    try {
      await db.execute({
        sql: `UPDATE reports SET ${updates.map(([, column]) => `${column}=?`).join(", ")} WHERE id=?`,
        args: [...updates.map(([field]) => req.body[field]), req.params.id],
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[PATCH /reports]", err);
      res.status(500).json({ success: false, message: "서버 오류" });
    }
  },
);

// ════════════════════════════════════════════════════════════════════
// 4. Appeals
// ════════════════════════════════════════════════════════════════════
app.get("/api/appeals", requireAuth, async (req, res) => {
  const result = await db.execute(scopedQuery("appeals", req.user));
  res.json(result.rows.map(toCamel));
});

app.post("/api/appeals", requireAuth, async (req, res) => {
  const a = req.body;
  const assignedName = hasGlobalDataAccess(req.user)
    ? a.prosecutorName || req.user.name
    : req.user.name;
  const id = String(a.id || Date.now());
  await db.execute({
    sql: `INSERT INTO appeals (id, appeal_no, hyeongje_no, gyeongje_no, status,
            prosecutor_name, suspect_name, suspect_uuid, disposition, disposition_date,
            basis_url, charge_name)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      id,
      a.appealNo || "",
      a.hyeongjeNo || "",
      a.gyeongjeNo || "",
      a.status || "",
      assignedName,
      a.suspectName || "",
      a.suspectUuid || "",
      a.disposition || "",
      a.dispositionDate || "",
      a.basisUrl || "",
      a.chargeName || "",
    ],
  });
  res.json({ success: true, appeal: { ...a, id } });
});

app.patch(
  "/api/appeals/:id",
  requireAuth,
  requireRecordScope("appeals"),
  async (req, res) => {
    const fields = {
      appealNo: "appeal_no",
      hyeongjeNo: "hyeongje_no",
      gyeongjeNo: "gyeongje_no",
      status: "status",
      prosecutorName: "prosecutor_name",
      suspectName: "suspect_name",
      suspectUuid: "suspect_uuid",
      disposition: "disposition",
      dispositionDate: "disposition_date",
      basisUrl: "basis_url",
      chargeName: "charge_name",
    };
    const updates = Object.entries(fields).filter(
      ([field]) => req.body[field] !== undefined,
    );
    if (!updates.length)
      return res
        .status(400)
        .json({ success: false, message: "변경할 값이 없습니다." });
    try {
      await db.execute({
        sql: `UPDATE appeals SET ${updates.map(([, column]) => `${column}=?`).join(", ")} WHERE id=?`,
        args: [...updates.map(([field]) => req.body[field]), req.params.id],
      });
      res.json({ success: true, appeal: { ...req.body, id: req.params.id } });
    } catch (err) {
      console.error("[PATCH /appeals]", err);
      res.status(500).json({ success: false, message: "서버 오류" });
    }
  },
);

// ════════════════════════════════════════════════════════════════════
// 5. Bookings
// ════════════════════════════════════════════════════════════════════
app.get("/api/bookings", requireAuth, async (req, res) => {
  const result = await db.execute(scopedQuery("bookings", req.user));
  res.json(result.rows.map(toCamel));
});

app.post("/api/bookings", requireAuth, async (req, res) => {
  const b = req.body;
  const assignedName = hasGlobalDataAccess(req.user)
    ? b.prosecutorName || req.user.name
    : req.user.name;
  const id = String(b.id || Date.now());
  await db.execute({
    sql: `INSERT INTO bookings (id, hyeongje_no, prosecutor_name, suspect_name,
            suspect_uuid, disposition_status, booking_date, basis_url,
            days_elapsed, indictment_decision)
          VALUES (?,?,?,?,?,?,?,?,?,?)`,
    args: [
      id,
      b.hyeongjeNo || "",
      assignedName,
      b.suspectName || "",
      b.suspectUuid || "",
      b.dispositionStatus || "",
      b.bookingDate || "",
      b.basisUrl || "",
      b.daysElapsed || 0,
      b.indictmentDecision || "",
    ],
  });
  res.json({ success: true, booking: { ...b, id } });
});

app.patch(
  "/api/bookings/:id",
  requireAuth,
  requireSecretariat,
  requireRecordScope("bookings"),
  async (req, res) => {
    const fields = {
      hyeongjeNo: "hyeongje_no",
      prosecutorName: "prosecutor_name",
      suspectName: "suspect_name",
      suspectUuid: "suspect_uuid",
      dispositionStatus: "disposition_status",
      bookingDate: "booking_date",
      basisUrl: "basis_url",
      daysElapsed: "days_elapsed",
      indictmentDecision: "indictment_decision",
    };
    const updates = Object.entries(fields).filter(
      ([field]) => req.body[field] !== undefined,
    );
    if (!updates.length)
      return res
        .status(400)
        .json({ success: false, message: "변경할 값이 없습니다." });
    try {
      await db.execute({
        sql: `UPDATE bookings SET ${updates.map(([, column]) => `${column}=?`).join(", ")} WHERE id=?`,
        args: [...updates.map(([field]) => req.body[field]), req.params.id],
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[PATCH /bookings]", err);
      res.status(500).json({ success: false, message: "서버 오류" });
    }
  },
);

app.get("/api/warrants", requireAuth, async (req, res) => {
  const result = await db.execute(scopedQuery("warrants", req.user));
  res.json(result.rows.map(toCamel));
});

app.post("/api/warrants", requireAuth, async (req, res) => {
  const w = req.body || {};
  const assignedName = hasGlobalDataAccess(req.user)
    ? w.prosecutorName || req.user.name
    : req.user.name;
  const id = String(
    w.id || `WAR-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  );
  try {
    await db.execute({
      sql: `INSERT INTO warrants (id,warrant_no,warrant_type,warrant_type_name,case_no,suspect_name,suspect_uuid,charge_name,prosecutor_name,target_place,status,requested_at,valid_until,judge_name,notes,deleted_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, '')`,
      args: [
        id,
        w.warrantNo || "",
        w.warrantType || "",
        w.warrantTypeName || "",
        w.caseNo || "",
        w.suspectName || "",
        w.suspectUuid || "",
        w.chargeName || "",
        assignedName,
        w.targetPlace || "",
        w.status || "청구중",
        w.requestedAt || new Date().toISOString().slice(0, 10),
        w.validUntil || "",
        w.judgeName || "",
        w.notes || "",
      ],
    });
    res.json({
      success: true,
      warrant: { ...w, id, prosecutorName: assignedName },
    });
  } catch (err) {
    console.error("[POST /warrants]", err);
    res
      .status(500)
      .json({ success: false, message: "영장 저장에 실패했습니다." });
  }
});

app.patch(
  "/api/warrants/:id",
  requireAuth,
  requireRecordScope("warrants"),
  async (req, res) => {
    if (req.body.status === undefined)
      return res
        .status(400)
        .json({ success: false, message: "변경할 값이 없습니다." });
    try {
      await db.execute({
        sql: "UPDATE warrants SET status=? WHERE id=? AND deleted_at=''",
        args: [req.body.status, req.params.id],
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[PATCH /warrants]", err);
      res
        .status(500)
        .json({ success: false, message: "영장 수정에 실패했습니다." });
    }
  },
);

app.delete(
  "/api/warrants/:id",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    try {
      await db.execute({
        sql: "UPDATE warrants SET deleted_at=? WHERE id=? AND deleted_at=''",
        args: [new Date().toISOString(), req.params.id],
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[DELETE /warrants]", err);
      res
        .status(500)
        .json({ success: false, message: "영장 삭제에 실패했습니다." });
    }
  },
);

// ════════════════════════════════════════════════════════════════════
// 6. Approvals
// ════════════════════════════════════════════════════════════════════
app.get("/api/approvals", requireAuth, async (req, res) => {
  const result = await db.execute(scopedQuery("approvals", req.user));
  res.json(
    result.rows.map((row) => ({
      ...toCamel(row),
      approvals: JSON.parse(row.approvals_json || "[]"),
      attachments: JSON.parse(row.attachments_json || "[]"),
    })),
  );
});

app.post("/api/approvals", requireAuth, async (req, res) => {
  const doc = req.body;
  const assignedId = hasGlobalDataAccess(req.user)
    ? doc.prosecutorId || req.user.id
    : req.user.id;
  const assignedName = hasGlobalDataAccess(req.user)
    ? doc.prosecutorName || req.user.name
    : req.user.name;
  await db.execute({
    sql: `INSERT INTO approvals (id, doc_no, doc_type, doc_type_name, title,
            hyeongje_no, prosecutor_id, prosecutor_name, suspect_name,
            disposition_type, charge_name, summary, status, created_at, approvals_json, attachments_json)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      doc.id,
      doc.docNo || "",
      doc.docType || "",
      doc.docTypeName || "",
      doc.title || "",
      doc.hyeongjeNo || "",
      assignedId,
      assignedName,
      doc.suspectName || "",
      doc.dispositionType || "",
      doc.chargeName || "",
      doc.summary || "",
      doc.status || "",
      doc.createdAt || "",
      JSON.stringify(doc.approvals || []),
      JSON.stringify(doc.attachments || []),
    ],
  });
  res.json({ success: true, doc });
});

app.put(
  "/api/approvals/:id",
  requireAuth,
  requireRecordScope("approvals"),
  async (req, res) => {
    const doc = req.body || {};
    await db.execute({
      sql: `UPDATE approvals SET doc_no=?, disposition_type=?, summary=?, hwp_html=?, attachments_json=? WHERE id=?`,
      args: [
        doc.docNo || "",
        doc.dispositionType || "",
        doc.summary || "",
        doc.hwpHtml || "",
        JSON.stringify(doc.attachments || []),
        req.params.id,
      ],
    });
    res.json({ success: true, approval: { ...doc, id: req.params.id } });
  },
);

app.put(
  "/api/approvals/:id/approve",
  requireAuth,
  requireApprovalAuthority,
  requireApprovalScope,
  async (req, res) => {
    const docId = req.params.id;
    const docRes = await db.execute({
      sql: "SELECT * FROM approvals WHERE id = ?",
      args: [docId],
    });

    if (docRes.rows.length === 0) {
      return res.status(404).json({ error: "문서를 찾을 수 없습니다." });
    }

    const doc = toCamel(docRes.rows[0]);
    const now = new Date().toISOString().replace("T", " ").substring(0, 16);
    const updatedApprovals = JSON.parse(doc.approvalsJson || "[]").map((a) => ({
      ...a,
      status: "최종결재(인장날인)",
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

    await writeAuditLog({
      action: "APPROVE",
      entityType: "approval",
      entityId: req.params.id,
      entityLabel: doc.docNo,
      actorId: req.user.id,
      actorName: req.user.id,
      detail: `문서유형: ${doc.docTypeName || doc.docType}, 처분: ${doc.dispositionType}`,
    });

    res.json({ success: true });
  },
);

// ════════════════════════════════════════════════════════════════════
// 7. Prosecutors (사무국 관리용)
// ════════════════════════════════════════════════════════════════════
app.get("/api/prosecutors", requireAuth, async (req, res) => {
  const result = await db.execute("SELECT * FROM prosecutors");
  // 비밀번호 필드 제외 후 반환
  res.json(
    result.rows.map((row) => {
      const { password: _pw, ...safe } = toCamel(row);
      return safe;
    }),
  );
});

app.post(
  "/api/prosecutors",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    const {
      id,
      name,
      rank = "",
      position = "",
      title = "",
      roleLevel = "PROSECUTOR",
      dept = "",
      password,
      note = "",
    } = req.body;
    const allowedRoles = [
      "PROSECUTOR",
      "PROBATIONARY",
      "SENIOR_PROSECUTOR",
      "ADMINISTRATOR",
      "ADMIN_PROBATIONARY",
    ];
    if (!id || !name || !password || !allowedRoles.includes(roleLevel)) {
      return res
        .status(400)
        .json({
          success: false,
          message: "계정 ID, 이름, 비밀번호 또는 역할이 올바르지 않습니다.",
        });
    }
    if (password.length < 10) {
      return res
        .status(400)
        .json({
          success: false,
          message: "비밀번호는 10자 이상이어야 합니다.",
        });
    }
    try {
      const existing = await db.execute({
        sql: "SELECT id FROM prosecutors WHERE id = ?",
        args: [id],
      });
      if (existing.rows.length > 0) {
        return res
          .status(409)
          .json({ success: false, message: "이미 사용 중인 아이디입니다." });
      }
      const hashedPassword = await bcrypt.hash(password, 12);
      await db.execute({
        sql: `INSERT INTO prosecutors
        (id, name, rank, position, title, role_level, dept, password, active_cases, status, note)
        VALUES (?,?,?,?,?,?,?, ?,0,'ACTIVE',?)`,
        args: [
          id,
          name,
          rank,
          position,
          title,
          roleLevel,
          dept,
          hashedPassword,
          note,
        ],
      });
      const prosecutor = {
        id,
        name,
        rank,
        position,
        title,
        roleLevel,
        dept,
        activeCases: 0,
        status: "ACTIVE",
        note,
      };
      res.json({ success: true, prosecutor });
    } catch (err) {
      console.error("[POST /prosecutors]", err);
      res.status(500).json({ success: false, message: "서버 오류" });
    }
  },
);

async function requireProsecutorAccountManager(req, res, next) {
  if (req.user.dept?.includes("사무국"))
    return requireSecretariat(req, res, next);
  if (
    !["PROSECUTOR_GENERAL", "CHIEF_PROSECUTOR", "SUPER_ADMIN"].includes(
      req.user.roleLevel,
    )
  ) {
    const result = await db.execute({
      sql: "SELECT dept FROM prosecutors WHERE id = ?",
      args: [req.params.id],
    });
    if (result.rows[0]?.dept?.includes("사무국")) {
      return res.status(403).json({
        success: false,
        message: "검사장급 이상 검사만 검찰사무국 인원을 관리할 수 있습니다.",
      });
    }
  }
  requireSecretariat(req, res, next);
}

app.patch(
  "/api/prosecutors/:id",
  requireAuth,
  requireProsecutorAccountManager,
  async (req, res) => {
    const allowedFields = {
      status: "status",
      dept: "dept",
      delegateTo: "delegate_to",
      delegateReason: "delegate_reason",
      dualPosition: "dual_position",
      dualDept: "dual_dept",
      dualRoleLevel: "dual_role_level",
      dualSecretariatWork: "dual_secretariat_work",
      isAutoAssignExcluded: "is_auto_assign_excluded",
      position: "position",
      title: "title",
    };
    const updates = Object.entries(allowedFields)
      .filter(([field]) => req.body[field] !== undefined)
      .map(([field, column]) => ({ column, value: req.body[field] }));
    if (updates.length === 0)
      return res
        .status(400)
        .json({ success: false, message: "변경할 값이 없습니다." });
    try {
      const setClause = updates.map(({ column }) => `${column}=?`).join(", ");
      await db.execute({
        sql: `UPDATE prosecutors SET ${setClause} WHERE id=?`,
        args: [...updates.map(({ value }) => value), req.params.id],
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[PATCH /prosecutors]", err);
      res.status(500).json({ success: false, message: "서버 오류" });
    }
  },
);

// ════════════════════════════════════════════════════════════════════
// 8. Registrations — 회원가입 신청 / 검찰사무국 허가
// ════════════════════════════════════════════════════════════════════

// ── 8-1. 회원가입 신청 (공개 엔드포인트) ────────────────────────────
app.post("/api/auth/register", authRateLimit, async (req, res) => {
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

  // 아이디 형식 검증 (영숫자, 언더스코어, 하이픈, 2~30자)
  if (!/^[a-zA-Z0-9_-]{2,30}$/.test(id)) {
    return res.status(400).json({
      success: false,
      message: "아이디는 영문/숫자/언더스코어/하이픈 2~30자여야 합니다.",
    });
  }

  // 비밀번호 최소 길이
  if (password.length < 10) {
    return res
      .status(400)
      .json({ success: false, message: "비밀번호는 10자 이상이어야 합니다." });
  }

  try {
    // 기존 검사 계정 중복 확인
    const existPros = await db.execute({
      sql: "SELECT id FROM prosecutors WHERE id = ?",
      args: [id],
    });
    if (existPros.rows.length > 0) {
      return res
        .status(409)
        .json({ success: false, message: "이미 사용 중인 아이디입니다." });
    }

    // 대기 중인 신청 중 동일 아이디 중복 확인
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
    const isBootstrap =
      Number(accountCount.rows[0]?.count || 0) === 0 &&
      process.env.BOOTSTRAP_SECRET &&
      bootstrapSecret === process.env.BOOTSTRAP_SECRET;

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
      message: "가입 신청이 접수되었습니다. 검찰사무국의 허가를 기다려주세요.",
    });
  } catch (err) {
    console.error("[register]", err);
    res
      .status(500)
      .json({ success: false, message: "서버 오류가 발생했습니다." });
  }
});

// ── 8-2. 가입 신청 목록 조회 (검찰사무국 전용) ──────────────────────
app.get("/api/registrations", requireAuth, async (req, res) => {
  // 검찰사무국 접근 가능 직급 체크
  const allowed = [
    "SUPER_ADMIN",
    "PROSECUTOR_GENERAL",
    "CHIEF_PROSECUTOR",
    "DEPUTY_CHIEF",
    "CHIEF_ADMINISTRATOR",
  ];
  const isSecretariat = allowed.includes(req.user.roleLevel);

  if (!isSecretariat) {
    return res
      .status(403)
      .json({ success: false, message: "검찰사무국 권한이 필요합니다." });
  }

  try {
    const result = await db.execute(
      "SELECT * FROM registrations ORDER BY created_at DESC",
    );
    // 비밀번호 제외 후 반환
    res.json(
      result.rows.map((row) => {
        const { password: _pw, ...safe } = toCamel(row);
        return safe;
      }),
    );
  } catch (err) {
    console.error("[registrations GET]", err);
    res
      .status(500)
      .json({ success: false, message: "서버 오류가 발생했습니다." });
  }
});

// ── 8-3. 가입 신청 허가 ─────────────────────────────────────────────
app.put(
  "/api/registrations/:id/approve",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    const allowed = [
      "SUPER_ADMIN",
      "PROSECUTOR_GENERAL",
      "CHIEF_PROSECUTOR",
      "DEPUTY_CHIEF",
      "CHIEF_ADMINISTRATOR",
    ];
    const isSecretariat = allowed.includes(req.user.roleLevel);

    if (!isSecretariat) {
      return res
        .status(403)
        .json({ success: false, message: "검찰사무국 권한이 필요합니다." });
    }

    try {
      const regRes = await db.execute({
        sql: "SELECT * FROM registrations WHERE id = ?",
        args: [req.params.id],
      });
      if (regRes.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "신청 건을 찾을 수 없습니다." });
      }

      const reg = toCamel(regRes.rows[0]);
      if (reg.status !== "PENDING") {
        return res
          .status(409)
          .json({ success: false, message: "이미 처리된 신청입니다." });
      }

      // 아이디 최종 중복 확인
      const existPros = await db.execute({
        sql: "SELECT id FROM prosecutors WHERE id = ?",
        args: [reg.reqId],
      });
      if (existPros.rows.length > 0) {
        return res
          .status(409)
          .json({ success: false, message: "이미 사용 중인 아이디입니다." });
      }

      const now = new Date().toISOString().replace("T", " ").substring(0, 19);

      // prosecutors 테이블에 계정 생성
      await db.execute({
        sql: `INSERT INTO prosecutors
              (id, name, rank, position, title, role_level, dept, password,
               active_cases, status, delegate_to, delegate_reason,
               is_super_admin, is_auto_assign_excluded, note)
            VALUES (?,?,?,?,?,?,?,?,0,'ACTIVE','','',0,0,?)`,
        args: [
          reg.reqId,
          reg.name,
          reg.rank || "",
          reg.position || "",
          reg.title || "",
          "PROSECUTOR",
          "",
          reg.password,
          reg.note || "",
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
          id: reg.reqId,
          name: reg.name,
          rank: reg.rank,
          position: reg.position,
          title: reg.title,
          roleLevel: reg.roleLevel,
          dept: reg.dept,
        },
      });
    } catch (err) {
      console.error("[registrations approve]", err);
      res
        .status(500)
        .json({ success: false, message: "서버 오류가 발생했습니다." });
    }
  },
);

// ── 8-4. 가입 신청 거부 ─────────────────────────────────────────────
app.put("/api/registrations/:id/reject", requireAuth, async (req, res) => {
  const allowed = [
    "SUPER_ADMIN",
    "PROSECUTOR_GENERAL",
    "CHIEF_PROSECUTOR",
    "DEPUTY_CHIEF",
    "CHIEF_ADMINISTRATOR",
  ];
  const isSecretariat = allowed.includes(req.user.roleLevel);

  if (!isSecretariat) {
    return res
      .status(403)
      .json({ success: false, message: "검찰사무국 권한이 필요합니다." });
  }

  const { reason } = req.body;

  try {
    const regRes = await db.execute({
      sql: "SELECT * FROM registrations WHERE id = ?",
      args: [req.params.id],
    });
    if (regRes.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "신청 건을 찾을 수 없습니다." });
    }

    const reg = toCamel(regRes.rows[0]);
    if (reg.status !== "PENDING") {
      return res
        .status(409)
        .json({ success: false, message: "이미 처리된 신청입니다." });
    }

    const now = new Date().toISOString().replace("T", " ").substring(0, 19);

    await db.execute({
      sql: `UPDATE registrations
              SET status='REJECTED', reject_reason=?, reviewed_at=?, reviewed_by=?
            WHERE id=?`,
      args: [reason || "검찰사무국 심사 불허", now, req.user.id, req.params.id],
    });

    res.json({
      success: true,
      message: `'${reg.name}' 가입 신청이 거부되었습니다.`,
    });
  } catch (err) {
    console.error("[registrations reject]", err);
    res
      .status(500)
      .json({ success: false, message: "서버 오류가 발생했습니다." });
  }
});

// ════════════════════════════════════════════════════════════════════
// 9. DELETE 엔드포인트 (검찰사무국 전용)
// ════════════════════════════════════════════════════════════════════

// 공통: 사무국 권한 체크 헬퍼
function requireSecretariat(req, res, next) {
  const allowed = [
    "SUPER_ADMIN",
    "PROSECUTOR_GENERAL",
    "CHIEF_PROSECUTOR",
    "DEPUTY_CHIEF",
    "CHIEF_ADMINISTRATOR",
  ];
  const ok =
    allowed.includes(req.user.roleLevel) || hasSecretariatWorkAccess(req.user);
  if (!ok) {
    return res
      .status(403)
      .json({ success: false, message: "검찰사무국 권한이 필요합니다." });
  }
  next();
}

// ── 9-1. 사건 삭제 ───────────────────────────────────────────────────
app.delete(
  "/api/cases/:id",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    const { id } = req.params;
    try {
      const caseRes = await db.execute({
        sql: "SELECT hyeongje_no, suspect_name FROM cases WHERE id = ?",
        args: [id],
      });
      const label = caseRes.rows.length > 0 ? caseRes.rows[0].hyeongje_no : id;
      if (caseRes.rows.length > 0) {
        const hyeongjeNo = caseRes.rows[0].hyeongje_no;
        const deletedAt = new Date().toISOString();
        await db.batch(
          [
            {
              sql: "UPDATE reports SET deleted_at = ? WHERE hyeongje_no = ? AND deleted_at = ''",
              args: [deletedAt, hyeongjeNo],
            },
            {
              sql: "UPDATE bookings SET deleted_at = ? WHERE hyeongje_no = ? AND deleted_at = ''",
              args: [deletedAt, hyeongjeNo],
            },
            {
              sql: "UPDATE evidence SET deleted_at = ? WHERE case_no = ? AND deleted_at = ''",
              args: [deletedAt, hyeongjeNo],
            },
            {
              sql: "UPDATE appeals SET deleted_at = ? WHERE hyeongje_no = ? AND deleted_at = ''",
              args: [deletedAt, hyeongjeNo],
            },
            {
              sql: "UPDATE approvals SET deleted_at = ? WHERE hyeongje_no = ? AND deleted_at = ''",
              args: [deletedAt, hyeongjeNo],
            },
            {
              sql: "UPDATE cases SET deleted_at = ? WHERE id = ? AND deleted_at = ''",
              args: [deletedAt, id],
            },
          ],
          "write",
        );
      } else {
        await db.execute({
          sql: "UPDATE cases SET deleted_at = ? WHERE id = ? AND deleted_at = ''",
          args: [new Date().toISOString(), id],
        });
      }
      await writeAuditLog({
        action: "DELETE",
        entityType: "case",
        entityId: id,
        entityLabel: label,
        actorId: req.user.id,
        actorName: req.user.id,
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[DELETE /cases]", err);
      res
        .status(500)
        .json({ success: false, message: "서버 오류가 발생했습니다." });
    }
  },
);

// ── 9-2. 항고 삭제 ───────────────────────────────────────────────────
app.delete(
  "/api/appeals/:id",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    try {
      await db.execute({
        sql: "UPDATE appeals SET deleted_at = ? WHERE id = ? AND deleted_at = ''",
        args: [new Date().toISOString(), req.params.id],
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[DELETE /appeals]", err);
      res
        .status(500)
        .json({ success: false, message: "서버 오류가 발생했습니다." });
    }
  },
);

// ── 9-3. 결재 문서 삭제 ─────────────────────────────────────────────
app.delete(
  "/api/approvals/:id",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    try {
      await db.execute({
        sql: "UPDATE approvals SET deleted_at = ? WHERE id = ? AND deleted_at = ''",
        args: [new Date().toISOString(), req.params.id],
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[DELETE /approvals]", err);
      res
        .status(500)
        .json({ success: false, message: "서버 오류가 발생했습니다." });
    }
  },
);

// ── 9-4. 신고(입건 보고서) 삭제 ────────────────────────────────────
app.delete(
  "/api/reports/:id",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    try {
      await db.execute({
        sql: "UPDATE reports SET deleted_at = ? WHERE id = ? AND deleted_at = ''",
        args: [new Date().toISOString(), req.params.id],
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[DELETE /reports]", err);
      res
        .status(500)
        .json({ success: false, message: "서버 오류가 발생했습니다." });
    }
  },
);

// ── 9-5. 입건 기록 삭제 ─────────────────────────────────────────────
app.delete(
  "/api/bookings/:id",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    try {
      await db.execute({
        sql: "UPDATE bookings SET deleted_at = ? WHERE id = ? AND deleted_at = ''",
        args: [new Date().toISOString(), req.params.id],
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[DELETE /bookings]", err);
      res
        .status(500)
        .json({ success: false, message: "서버 오류가 발생했습니다." });
    }
  },
);

// ── 9-6. 검사 계정 삭제 ─────────────────────────────────────────────
app.delete(
  "/api/prosecutors/:id",
  requireAuth,
  requireProsecutorAccountManager,
  async (req, res) => {
    const { id } = req.params;
    // 자기 자신 삭제 금지
    if (req.user.id === id) {
      return res
        .status(400)
        .json({ success: false, message: "본인 계정은 삭제할 수 없습니다." });
    }
    try {
      await db.execute({
        sql: "DELETE FROM prosecutors WHERE id = ?",
        args: [id],
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[DELETE /prosecutors]", err);
      res
        .status(500)
        .json({ success: false, message: "서버 오류가 발생했습니다." });
    }
  },
);

// ════════════════════════════════════════════════════════════════════
// 10. 비밀번호 변경 (PATCH)
// ════════════════════════════════════════════════════════════════════
app.patch("/api/prosecutors/:id/password", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body || {};
  if (id !== req.user.id && !hasGlobalDataAccess(req.user)) {
    return res
      .status(403)
      .json({
        success: false,
        message: "본인 계정의 비밀번호만 변경할 수 있습니다.",
      });
  }

  // 본인 또는 사무국 관리자만 변경 가능
  const allowed = [
    "SUPER_ADMIN",
    "PROSECUTOR_GENERAL",
    "CHIEF_PROSECUTOR",
    "DEPUTY_CHIEF",
    "CHIEF_ADMINISTRATOR",
  ];
  const isAdmin = allowed.includes(req.user.roleLevel);
  const isSelf = req.user.id === id;

  if (!isSelf && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: "본인 또는 관리자만 비밀번호를 변경할 수 있습니다.",
    });
  }

  if (isSelf && !currentPassword) {
    return res
      .status(400)
      .json({ success: false, message: "현재 비밀번호가 필요합니다." });
  }

  if (!newPassword || newPassword.length < 10) {
    return res
      .status(400)
      .json({ success: false, message: "비밀번호는 10자 이상이어야 합니다." });
  }

  try {
    if (isSelf) {
      const account = await db.execute({
        sql: "SELECT password FROM prosecutors WHERE id = ? AND status = 'ACTIVE'",
        args: [id],
      });
      const storedPassword = account.rows[0]?.password;
      if (
        !storedPassword ||
        !(await bcrypt.compare(currentPassword, storedPassword))
      ) {
        return res
          .status(401)
          .json({
            success: false,
            message: "현재 비밀번호가 일치하지 않습니다.",
          });
      }
    }
    const hashed = await bcrypt.hash(newPassword, 10);
    await db.execute({
      sql: "UPDATE prosecutors SET password = ? WHERE id = ?",
      args: [hashed, id],
    });
    res.json({ success: true, message: "비밀번호가 변경되었습니다." });
  } catch (err) {
    console.error("[PATCH /prosecutors/password]", err);
    res
      .status(500)
      .json({ success: false, message: "서버 오류가 발생했습니다." });
  }
});

// ════════════════════════════════════════════════════════════════════
// 11. 감사 로그 (Audit Log)
// ════════════════════════════════════════════════════════════════════

/** 내부 헬퍼 — 감사 로그 1건 삽입 */
async function writeAuditLog({
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

// GET /api/audit-logs — 최근 500건 (사무국 전용)
app.get(
  "/api/audit-logs",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    try {
      const result = await db.execute(
        "SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500",
      );
      res.json(result.rows.map(toCamel));
    } catch (err) {
      console.error("[GET /audit-logs]", err);
      res.status(500).json({ success: false, message: "서버 오류" });
    }
  },
);

// ════════════════════════════════════════════════════════════════════
// 12. 사건 수정 이력 (Case History)
// ════════════════════════════════════════════════════════════════════

// GET /api/cases/:id/history
app.get(
  "/api/cases/:id/history",
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

app.get("/api/cases/:caseNo/evidence", requireAuth, async (req, res) => {
  try {
    const caseItem = await findCaseForEvidence(req.params.caseNo, req.user);
    if (!caseItem)
      return res
        .status(403)
        .json({
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
});

app.post("/api/cases/:caseNo/evidence", requireAuth, async (req, res) => {
  const { title = "", url = "", type = "DOCUMENT", record = "" } = req.body;
  if (!url.trim() || !/^https?:\/\//i.test(url.trim())) {
    return res
      .status(400)
      .json({ success: false, message: "http 또는 https URL을 입력해주세요." });
  }
  try {
    const caseItem = await findCaseForEvidence(req.params.caseNo, req.user);
    if (!caseItem)
      return res
        .status(403)
        .json({
          success: false,
          message: "해당 사건에 접근할 권한이 없습니다.",
        });
    const id = `EVD-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const now = new Date().toISOString();
    await db.execute({
      sql: `INSERT INTO evidence (id, case_no, title, url, evidence_type, record, created_by, created_at, deleted_at)
            VALUES (?,?,?,?,?,?,?,?,'')`,
      args: [
        id,
        req.params.caseNo,
        title.trim() || "증거 자료",
        url.trim(),
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
        url: url.trim(),
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
});

app.delete("/api/evidence/:id", requireAuth, async (req, res) => {
  try {
    const result = await db.execute({
      sql: hasGlobalDataAccess(req.user)
        ? "SELECT case_no FROM evidence WHERE id = ? AND deleted_at = ''"
        : `SELECT e.case_no FROM evidence e JOIN cases c ON c.hyeongje_no = e.case_no OR c.gyeongje_no = e.case_no
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

app.patch("/api/evidence/:id", requireAuth, async (req, res) => {
  const { url } = req.body || {};
  if (
    url !== undefined &&
    (!String(url).trim() || !/^https?:\/\//i.test(String(url).trim()))
  ) {
    return res
      .status(400)
      .json({ success: false, message: "http 또는 https URL을 입력해주세요." });
  }
  try {
    const result = await db.execute({
      sql: hasGlobalDataAccess(req.user)
        ? "SELECT case_no FROM evidence WHERE id = ? AND deleted_at = ''"
        : `SELECT e.case_no FROM evidence e JOIN cases c ON c.hyeongje_no = e.case_no OR c.gyeongje_no = e.case_no
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
});

// ════════════════════════════════════════════════════════════════════
// 13. 문서번호 채번
// ════════════════════════════════════════════════════════════════════

// GET /api/approvals/next-doc-no — 다음 문서번호 조회
app.get("/api/approvals/next-doc-no", requireAuth, async (req, res) => {
  try {
    const result = await db.execute(
      `SELECT doc_no FROM approvals ORDER BY rowid DESC LIMIT 1`,
    );
    let nextSeq = 1;
    if (result.rows.length > 0) {
      const last = result.rows[0].doc_no || "";
      const match = last.match(/(\d+)$/);
      if (match) nextSeq = parseInt(match[1], 10) + 1;
    }
    const year = new Date().getFullYear();
    res.json({
      docNo: `${year}-결재-${String(nextSeq).padStart(3, "0")}`,
      seq: nextSeq,
    });
  } catch (err) {
    console.error("[GET /approvals/next-doc-no]", err);
    res.status(500).json({ success: false, message: "서버 오류" });
  }
});

// ════════════════════════════════════════════════════════════════════
// 14. 결재 반려 (Reject)
// ════════════════════════════════════════════════════════════════════

app.put(
  "/api/approvals/:id/reject",
  requireAuth,
  requireApprovalAuthority,
  requireApprovalScope,
  async (req, res) => {
    const { reason = "보완수사요구" } = req.body;
    try {
      const docRes = await db.execute({
        sql: "SELECT * FROM approvals WHERE id = ?",
        args: [req.params.id],
      });
      if (docRes.rows.length === 0) {
        return res
          .status(404)
          .json({ success: false, message: "문서를 찾을 수 없습니다." });
      }
      const doc = toCamel(docRes.rows[0]);
      const now = new Date().toISOString().replace("T", " ").substring(0, 16);
      const updatedApprovals = JSON.parse(doc.approvalsJson || "[]").map(
        (a) => ({
          ...a,
          status: a.status.includes("대기") ? `반려 (${reason})` : a.status,
          date: a.date === "-" ? now : a.date,
        }),
      );
      const rejectStatus = `반려 — ${reason}`;
      await db.execute({
        sql: `UPDATE approvals SET status=?, approvals_json=? WHERE id=?`,
        args: [rejectStatus, JSON.stringify(updatedApprovals), req.params.id],
      });
      // 감사 로그
      await writeAuditLog({
        action: "REJECT",
        entityType: "approval",
        entityId: req.params.id,
        entityLabel: doc.docNo,
        actorId: req.user.id,
        actorName: req.user.id,
        detail: reason,
      });
      res.json({ success: true, status: rejectStatus });
    } catch (err) {
      console.error("[PUT /approvals/reject]", err);
      res.status(500).json({ success: false, message: "서버 오류" });
    }
  },
);

// ── 운영 상태 확인 ──────────────────────────────────────────────────
app.get("/api/health", async (_req, res) => {
  try {
    await db.execute("SELECT 1");
    res.json({
      status: "ok",
      database: "ok",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[GET /health]", err.message);
    res.status(503).json({ status: "error", database: "unavailable" });
  }
});

app.get(
  "/api/office-documents",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    const allowedTypes = ["receive", "send", "archive", "order"];
    const type = String(req.query.type || "");
    if (!allowedTypes.includes(type))
      return res
        .status(400)
        .json({ success: false, message: "문서 유형이 올바르지 않습니다." });
    try {
      const result = await db.execute({
        sql: "SELECT id, payload_json, created_at FROM office_documents WHERE document_type=? AND deleted_at='' ORDER BY created_at DESC",
        args: [type],
      });
      res.json(
        result.rows.map((row) => ({
          ...JSON.parse(row.payload_json),
          id: row.id,
          createdAt: row.created_at,
        })),
      );
    } catch (err) {
      console.error("[GET /office-documents]", err);
      res
        .status(500)
        .json({ success: false, message: "문서를 불러오지 못했습니다." });
    }
  },
);

app.post(
  "/api/office-documents",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    const { type, document } = req.body || {};
    if (
      !["receive", "send", "archive", "order"].includes(type) ||
      !document ||
      typeof document !== "object"
    )
      return res
        .status(400)
        .json({ success: false, message: "문서 데이터가 올바르지 않습니다." });
    const id = String(
      document.id ||
        `DOC-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    );
    try {
      await db.execute({
        sql: "INSERT INTO office_documents (id,document_type,payload_json,created_by,created_at,deleted_at) VALUES (?,?,?,?,?,'')",
        args: [
          id,
          type,
          JSON.stringify({ ...document, id }),
          req.user.id,
          new Date().toISOString(),
        ],
      });
      res.json({ success: true, document: { ...document, id } });
    } catch (err) {
      console.error("[POST /office-documents]", err);
      res
        .status(500)
        .json({ success: false, message: "문서 저장에 실패했습니다." });
    }
  },
);

app.delete(
  "/api/office-documents/:id",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    try {
      await db.execute({
        sql: "UPDATE office_documents SET deleted_at=? WHERE id=? AND deleted_at=''",
        args: [new Date().toISOString(), req.params.id],
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[DELETE /office-documents]", err);
      res
        .status(500)
        .json({ success: false, message: "문서 삭제에 실패했습니다." });
    }
  },
);

app.patch(
  "/api/office-documents/:id",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    if (!req.body?.document || typeof req.body.document !== "object")
      return res
        .status(400)
        .json({ success: false, message: "문서 데이터가 올바르지 않습니다." });
    try {
      const existing = await db.execute({
        sql: "SELECT payload_json FROM office_documents WHERE id=? AND deleted_at=''",
        args: [req.params.id],
      });
      if (!existing.rows.length)
        return res
          .status(404)
          .json({ success: false, message: "문서를 찾을 수 없습니다." });
      const document = {
        ...JSON.parse(existing.rows[0].payload_json),
        ...req.body.document,
        id: req.params.id,
      };
      await db.execute({
        sql: "UPDATE office_documents SET payload_json=? WHERE id=? AND deleted_at=''",
        args: [JSON.stringify(document), req.params.id],
      });
      res.json({ success: true, document });
    } catch (err) {
      console.error("[PATCH /office-documents]", err);
      res
        .status(500)
        .json({ success: false, message: "문서 수정에 실패했습니다." });
    }
  },
);

// ── 정적 파일 서빙 (프로덕션) ────────────────────────────────────────
const distPath = join(__dirname, "..", "dist");
app.use(express.static(distPath));

// API 라우트가 아닌 모든 요청은 index.html로 (SPA 라우팅)
app.get("/{*splat}", (req, res) => {
  res.sendFile(join(distPath, "index.html"));
});

// ── 서버 시작 ─────────────────────────────────────────────────────
async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`[Dose-PROS API] http://localhost:${PORT}`);
  });
}

start().catch((err) => {
  console.error("[FATAL] 서버 시작 실패:", err);
  process.exit(1);
});
