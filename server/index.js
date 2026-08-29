/**
 * server/index.js
 * Dose-PROS REST API 서버 (Express + Turso + bcrypt + JWT)
 */
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { timingSafeEqual, randomUUID } from "crypto";
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

// 타이밍 공격 방지용 더미 bcrypt 해시 — 계정 미존재 시에도 동일 응답 시간 보장
const DUMMY_BCRYPT_HASH = "$2b$12$aaaaaaaaaaaaaaaaaaaaaa.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const authAttempts = new Map();
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 5; // 10 → 5: 브루트포스 방어 강화

// 만료된 rate-limit 항목 주기적 정리 (메모리 누수 방지)
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of authAttempts.entries()) {
    if (now - val.startedAt >= AUTH_WINDOW_MS) authAttempts.delete(key);
  }
}, AUTH_WINDOW_MS);
const GLOBAL_DATA_ROLES = new Set([
  "SUPER_ADMIN",
  "PROSECUTOR_GENERAL",
  "CHIEF_PROSECUTOR",
  "DEPUTY_CHIEF",
  "CHIEF_ADMINISTRATOR",
]);
const APPROVAL_ROLES = new Set([...GLOBAL_DATA_ROLES, "SENIOR_PROSECUTOR"]);
const MANAGEMENT_ROLE_LEVELS = new Set([
  "CHIEF_ADMINISTRATOR",
  "ADMINISTRATOR",
  "ADMIN_PROBATIONARY",
]);
const SECRETARIAT_ROLES = new Set([
  "SUPER_ADMIN",
  "PROSECUTOR_GENERAL",
  "CHIEF_PROSECUTOR",
  "DEPUTY_CHIEF",
  "CHIEF_ADMINISTRATOR",
]);
const SELF_ROLE_CHANGE_ROLES = new Set([
  "PROSECUTOR_GENERAL",
  "CHIEF_PROSECUTOR",
  "CHIEF_ADMINISTRATOR",
]);
const TOP_ROLE_MANAGERS = new Set(["PROSECUTOR_GENERAL", "CHIEF_PROSECUTOR"]);
const ROLE_AUTHORITY = {
  PROBATIONARY: 10,          // 검사시보
  ADMIN_PROBATIONARY: 15,    // 검찰사무관시보 (검사시보 대우)
  ADMINISTRATOR: 30,         // 검찰사무관 (평검사 대우 — 행정/수사보조)
  PROSECUTOR: 40,            // 평검사 (소추·수사 주체, 검찰청법 제3조)
  SENIOR_PROSECUTOR: 50,     // 부장검사
  DEPUTY_CHIEF: 60,          // 차장검사
  CHIEF_ADMINISTRATOR: 65,   // 검찰관리관 (차장검사 대우 — 행정직)
  CHIEF_PROSECUTOR: 70,      // 검사장
  PROSECUTOR_GENERAL: 80,    // 검찰총장
  SUPER_ADMIN: 100,          // 최고 시스템 관리자
};
const ACCOUNT_ROLE_LEVELS = Object.keys(ROLE_AUTHORITY).filter(
  (roleLevel) => roleLevel !== "SUPER_ADMIN",
);

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
    // OPTIONS 프리플라이트 자동 처리 (200 응답)
    preflightContinue: false,
    optionsSuccessStatus: 200,
  }),
);
app.use(express.json({ limit: "10mb" }));
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  // HSTS: 1년, includeSubDomains
  if (process.env.NODE_ENV === "production") {
    res.setHeader(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
  // CSP: 동일 출처 스크립트만 허용, 인라인 스크립트 차단 기본값
  // Vite 번들은 모두 같은 도메인에서 제공되므로 self 허용으로 충분
  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",   // CSS-in-JS 대응
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; "),
  );
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
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
      sql: "SELECT id, name, role_level, dept, status, is_super_admin, dual_dept, dual_role_level, dual_secretariat_work, can_arbitrary_approve, acting_start, acting_end FROM prosecutors WHERE id = ?",
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
      canArbitraryApprove: Boolean(account.canArbitraryApprove),
    };

    // 직무대리 기간 만료 자동 회수: acting_end가 지났으면 dualRoleLevel 초기화
    if (account.dualRoleLevel && account.actingEnd) {
      const now = new Date();
      const end = new Date(account.actingEnd);
      if (!isNaN(end) && now > end) {
        // 비동기 정리 — 응답 블로킹 없이 처리
        db.execute({
          sql: `UPDATE prosecutors SET
                  dual_role_level='', acting_title='', acting_start='', acting_end='',
                  delegate_to='', delegate_reason=''
                WHERE id=?`,
          args: [account.id],
        }).catch((e) => console.warn("[acting expiry cleanup]", e.message));
        // 현재 요청에서는 이미 만료된 것으로 처리
        req.user.dualRoleLevel = "";
        req.user.actingStart = "";
        req.user.actingEnd = "";
      }
    }

    next();
  } catch {
    return res
      .status(401)
      .json({ success: false, message: "유효하지 않거나 만료된 토큰입니다." });
  }
}

// ── 직무대리(dualRoleLevel) 통합 유효 권한 헬퍼 ────────────────────
// 직무대리 발령 시 대리자의 dualRoleLevel이 피대리인 roleLevel로 설정됨.
// 권한 체크는 모두 이 함수를 통해 "더 높은 쪽"을 사용하도록 통일.
// acting_start ~ acting_end 기간 외에는 dualRoleLevel을 무시한다.
function effectiveRoleLevel(user) {
  if (!user) return "PROBATIONARY";
  const base = user.roleLevel || "PROBATIONARY";
  const dual = user.dualRoleLevel || "";
  if (!dual) return base;

  // 기간 체크: acting_start ~ acting_end 범위 내에만 대리 권한 유효
  const now = new Date();
  const start = user.actingStart ? new Date(user.actingStart) : null;
  const end   = user.actingEnd   ? new Date(user.actingEnd)   : null;
  // start가 설정됐는데 아직 시작 전이면 무효
  if (start && now < start) return base;
  // end가 설정됐는데 이미 만료됐으면 무효
  if (end && now > end) return base;

  const baseAuth = ROLE_AUTHORITY[base] || 0;
  const dualAuth = ROLE_AUTHORITY[dual] || 0;
  return dualAuth > baseAuth ? dual : base;
}

function hasGlobalDataAccess(user) {
  return Boolean(user.isSuperAdmin || GLOBAL_DATA_ROLES.has(effectiveRoleLevel(user)));
}

function hasSecretariatWorkAccess(user) {
  return Boolean(
    user.dept?.includes("사무국") ||
    (user.dualSecretariatWork && user.dualDept?.includes("사무국")),
  );
}

function isManagementAccount(account) {
  return Boolean(
    account?.isSuperAdmin ||
    String(account?.dept || "").includes("사무국") ||
    ["CHIEF_ADMINISTRATOR", "ADMINISTRATOR", "ADMIN_PROBATIONARY"].includes(
      account?.roleLevel,
    ),
  );
}

function isProsecutorGeneral(user) {
  return Boolean(
    user?.isSuperAdmin || effectiveRoleLevel(user) === "PROSECUTOR_GENERAL",
  );
}

function normalizePrivateViewerIds(value) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(value.filter((id) => typeof id === "string" && id.trim())),
  ].slice(0, 50);
}

function isPreBookingInvestigation(status) {
  return String(status || "").trim() === "입건 전 조사";
}

function isAssignableProsecutor(account) {
  return Boolean(
    account &&
    !String(account.dept || "").includes("사무국") &&
    !MANAGEMENT_ROLE_LEVELS.has(account.roleLevel) &&
    account.status === "ACTIVE",
  );
}

async function validateCaseAssignee(prosecutorId) {
  if (!prosecutorId) return true;
  const result = await db.execute({
    sql: "SELECT role_level, dept, status FROM prosecutors WHERE id = ?",
    args: [prosecutorId],
  });
  return isAssignableProsecutor(result.rows[0] && toCamel(result.rows[0]));
}

async function validateForcedCaseAssignee(prosecutorId) {
  if (!prosecutorId) return false;
  const result = await db.execute({
    sql: "SELECT role_level, dept, status FROM prosecutors WHERE id = ?",
    args: [prosecutorId],
  });
  const account = result.rows[0] && toCamel(result.rows[0]);
  return (
    !MANAGEMENT_ROLE_LEVELS.has(account?.roleLevel) &&
    !String(account?.dept || "").includes("사무국") &&
    ["ACTIVE", "ON_LEAVE"].includes(account?.status)
  );
}

function requireApprovalAuthority(req, res, next) {
  if (!APPROVAL_ROLES.has(effectiveRoleLevel(req.user))) {
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
  // 검찰총장은 모든 사건 접근 가능
  if (isProsecutorGeneral(req.user)) {
    return next();
  }
  // 사무국 계정: PUBLIC 사건만 무조건 통과. PRIVATE 사건은 아래 허용 목록으로 판단.
  const result = await db.execute({
    sql: `SELECT c.visibility, c.created_by, c.prosecutor_id,
                 COALESCE(c.private_viewer_ids, '[]') AS private_viewer_ids
          FROM cases c WHERE c.id = ? AND c.deleted_at = ''`,
    args: [req.params.id],
  });
  if (result.rows.length === 0) {
    return res
      .status(403)
      .json({ success: false, message: "해당 사건에 접근할 권한이 없습니다." });
  }
  const row = result.rows[0];
  const visibility = row.visibility;
  const createdBy = row.created_by;
  const prosecutorId = row.prosecutor_id;
  const privateViewerIds = String(row.private_viewer_ids || "[]");
  const uid = req.user.id;

  // PRIVATE 사건: 담당검사, 작성자, privateViewerIds에 명시된 자, 검찰총장만 수사 내용 열람 가능.
  // 사무국은 행정 접근(사건번호·처분 확인)은 허용하되 수사 내용은 GET /api/cases 마스킹으로 처리.
  if (visibility === "PRIVATE") {
    const isAllowed =
      uid === prosecutorId ||
      uid === createdBy ||
      parseJsonArray(privateViewerIds).includes(uid) ||
      hasSecretariatWorkAccess(req.user); // 사무국은 PRIVATE 상세도 접근 허용 (마스킹 적용)
    if (!isAllowed) {
      return res
        .status(403)
        .json({ success: false, message: "비공개 사건에 접근할 권한이 없습니다." });
    }
    return next();
  }

  // PUBLIC 사건: 사무국이면 통과, 아니면 부서 일치 또는 본인 사건 확인
  if (hasSecretariatWorkAccess(req.user)) {
    return next();
  }
  const scopeResult = await db.execute({
    sql: `SELECT 1 FROM cases c JOIN prosecutors p ON c.prosecutor_id = p.id
          WHERE c.id = ? AND
            (p.dept = (SELECT dept FROM prosecutors WHERE id = ?)
              OR c.created_by = ? OR c.prosecutor_id = ?
              OR instr(COALESCE(c.private_viewer_ids, '[]'), '"' || ? || '"') > 0
              OR (c.visibility = 'PUBLIC' AND (
                c.disposition LIKE '%불기소%' OR c.disposition LIKE '%종국%' OR
                c.disposition LIKE '%기소유예%' OR c.disposition LIKE '%혐의없음%' OR
                c.disposition LIKE '%무혐의%' OR c.disposition LIKE '%죄가안됨%' OR
                c.disposition LIKE '%공소권없음%' OR c.disposition LIKE '%각하%' OR
                c.disposition LIKE '%기소중지%' OR c.disposition LIKE '%타관송치%' OR
                c.disposition LIKE '%처분완료%' OR c.disposition LIKE '%구속기소%' OR
                c.disposition LIKE '%불구속기소%' OR c.disposition LIKE '%약식기소%' OR
                c.disposition LIKE '%구공판%'
              )))`,
    args: [req.params.id, uid, uid, uid, uid],
  });
  if (scopeResult.rows.length === 0) {
    return res
      .status(403)
      .json({ success: false, message: "해당 사건에 접근할 권한이 없습니다." });
  }
  next();
}

async function findCaseForEvidence(caseNo, user) {
  const result = await db.execute({
    sql: hasGlobalDataAccess(user)
      ? "SELECT id, suje_no, hyeongje_no, prosecutor_id FROM cases WHERE deleted_at = '' AND (hyeongje_no = ? OR suje_no = ?) LIMIT 1"
      : `SELECT c.id, c.suje_no, c.hyeongje_no, c.prosecutor_id
         FROM cases c JOIN prosecutors p ON c.prosecutor_id = p.id
         WHERE c.deleted_at = '' AND (c.hyeongje_no = ? OR c.suje_no = ?)
           AND p.dept = (SELECT dept FROM prosecutors WHERE id = ?) LIMIT 1`,
    args: hasGlobalDataAccess(user)
      ? [caseNo, caseNo]
      : [caseNo, caseNo, user.id],
  });
  return result.rows[0] || null;
}

// 허용된 테이블/정렬 컬럼 화이트리스트 — SQL 인젝션 방지
const ALLOWED_QUERY_TABLES = new Set([
  "cases", "reports", "appeals", "bookings", "approvals", "warrants",
]);
const ALLOWED_ORDER_BY = new Set([
  "rowid DESC", "rowid ASC",
  "created_at DESC", "created_at ASC",
  "booking_date DESC", "booking_date ASC",
]);

function scopedQuery(table, user, orderBy = "rowid DESC") {
  if (!ALLOWED_QUERY_TABLES.has(table))
    throw new Error(`[scopedQuery] 허용되지 않는 테이블: ${table}`);
  if (!ALLOWED_ORDER_BY.has(orderBy))
    throw new Error(`[scopedQuery] 허용되지 않는 정렬: ${orderBy}`);

  // 검찰총장은 모든 테이블 전체 접근
  if (isProsecutorGeneral(user)) {
    return {
      sql: `SELECT * FROM ${table} WHERE deleted_at = '' ORDER BY ${orderBy}`,
      args: [],
    };
  }
  // 검사장 이상(CHIEF_PROSECUTOR)도 전체 사건 원부 접근 가능
  if (GLOBAL_DATA_ROLES.has(effectiveRoleLevel(user))) {
    return {
      sql: `SELECT * FROM ${table} WHERE deleted_at = '' ORDER BY ${orderBy}`,
      args: [],
    };
  }
  if (table === "cases") {
    if (hasSecretariatWorkAccess(user)) {
      // 사무국 계정: 모든 사건 목록 조회 가능 (행정 업무 — 접수·배당·통계).
      // 단, PRIVATE 사건의 수사 민감 필드(content 등)는 GET /api/cases 응답 단계에서 마스킹됨.
      return {
        sql: `SELECT c.* FROM cases c
              WHERE c.deleted_at = ''
              ORDER BY c.${orderBy}`,
        args: [],
      };
    }
    // 일반 계정: PUBLIC 사건 중 동일 부서 + 본인 담당/작성 + 명시 허용
    // 일반 계정: PUBLIC 사건 중 동일 부서 + 본인 담당/작성 + 명시 허용
    // + 종국·기소 완료 사건은 부서 무관하게 전 부서 열람 가능 (투명성 원칙)
    const CLOSED_KEYWORDS = [
      "불기소", "종국", "기소유예", "혐의없음", "무혐의", "죄가안됨",
      "공소권없음", "각하", "기소중지", "참고인중지", "타관송치", "처분완료",
      "구속기소", "불구속기소", "약식기소", "구공판",
    ];
    const closedCondition = CLOSED_KEYWORDS
      .map(() => `(c.disposition LIKE ? OR c.booking_status LIKE ?)`)
      .join(" OR ");
    const closedArgs = CLOSED_KEYWORDS.flatMap((k) => [`%${k}%`, `%${k}%`]);

    return {
      sql: `SELECT c.* FROM cases c
            LEFT JOIN prosecutors p ON c.prosecutor_id = p.id
            WHERE c.deleted_at = '' AND
              (c.is_archived = 1
                OR (c.visibility = 'PUBLIC' AND p.dept = (SELECT dept FROM prosecutors WHERE id = ?))
                OR c.created_by = ? OR c.prosecutor_id = ?
                OR instr(COALESCE(c.private_viewer_ids, '[]'), '"' || ? || '"') > 0
                OR (c.visibility = 'PUBLIC' AND (${closedCondition})))
            ORDER BY c.${orderBy}`,
      args: [user.id, user.id, user.id, user.id, ...closedArgs],
    };
  }
  // cases 외 테이블: 사무국이면 전체, 아니면 부서 한정
  if (hasSecretariatWorkAccess(user)) {
    return {
      sql: `SELECT * FROM ${table} WHERE deleted_at = '' ORDER BY ${orderBy}`,
      args: [],
    };
  }
  const usesId = table === "approvals";
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
  if (!ALLOWED_QUERY_TABLES.has(table))
    throw new Error(`[requireRecordScope] 허용되지 않는 테이블: ${table}`);
  return async (req, res, next) => {
    if (hasGlobalDataAccess(req.user)) return next();
    const field = table === "approvals" ? "prosecutor_id" : "prosecutor_name";
    const value = table === "approvals" ? req.user.id : req.user.name;
    const result = await db.execute({
      sql: `SELECT 1 FROM ${table} WHERE id=? AND ${field}=? AND deleted_at=''`,
      args: [req.params.id, value],
    });
    if (!result.rows.length)
      return res.status(403).json({
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

function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Express 4 async 에러 전파 래퍼 — try/catch 없는 async 라우트에서
// 발생한 rejection을 전역 에러 핸들러로 자동 전달.
// 사용: app.get("/path", asyncWrap(async (req, res) => { ... }))
function asyncWrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

// 입력 필드 길이 검증 헬퍼 — DoS / DB 오염 방지
const FIELD_MAX_LENGTHS = {
  short:  100,   // 번호·이름·상태 등 짧은 식별자
  medium: 500,   // 제목·죄명·처분내용 등
  long:   2000,  // 메모·비고 등
  url:    2000,  // URL / basisUrl
};
function validateFieldLengths(obj, schema) {
  for (const [field, maxType] of Object.entries(schema)) {
    const val = obj[field];
    if (val === undefined || val === null) continue;
    const max = FIELD_MAX_LENGTHS[maxType] ?? FIELD_MAX_LENGTHS.medium;
    if (String(val).length > max) {
      return `'${field}' 필드가 너무 깁니다. (최대 ${max}자)`;
    }
  }
  return null;
}

// 증거자료 URL/base64 검증 헬퍼
// - http/https URL은 그대로 허용
// - base64는 허용된 MIME 타입(이미지, PDF)만 허용
const ALLOWED_EVIDENCE_MIME = /^data:(image\/(png|jpeg|gif|webp)|application\/pdf);base64,/i;
const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024; // 5MB
const EVIDENCE_MAX_PER_CASE = 50;           // 사건당 증거자료 최대 건수

function validateEvidenceUrl(urlTrimmed) {
  if (!urlTrimmed) return "URL 또는 파일 데이터를 입력해주세요.";
  const isUrl = /^https?:\/\//i.test(urlTrimmed);
  const isBase64 = urlTrimmed.startsWith("data:");
  if (!isUrl && !isBase64) return "http/https URL 또는 파일 데이터를 입력해주세요.";
  if (isBase64) {
    if (!ALLOWED_EVIDENCE_MIME.test(urlTrimmed))
      return "허용되지 않는 파일 형식입니다. PNG/JPEG/GIF/WEBP 이미지 또는 PDF만 업로드할 수 있습니다.";
    if (urlTrimmed.length > EVIDENCE_MAX_BYTES)
      return "파일 크기는 5MB 이하만 허용됩니다.";
  }
  return null; // 통과
}

// ════════════════════════════════════════════════════════════════════
// 1. Auth
// ════════════════════════════════════════════════════════════════════
app.post("/api/auth/login", authRateLimit, asyncWrap(async (req, res) => {
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
    // 타이밍 공격 방지: 계정이 없어도 bcrypt 비교 시간만큼 지연
    await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
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
}));

// ════════════════════════════════════════════════════════════════════
// 2. Cases  (GET 공개, 나머지 인증 필요)
// ════════════════════════════════════════════════════════════════════
app.get("/api/cases", requireAuth, asyncWrap(async (req, res) => {
  const result = await db.execute(scopedQuery("cases", req.user));
  const isSecretariat = hasSecretariatWorkAccess(req.user);
  const canViewPrivate = isProsecutorGeneral(req.user);

  // 사무국 계정(비검찰총장): PRIVATE 사건의 수사 민감 필드를 마스킹.
  // 사건번호·처분내역·담당검사 등 행정 항목은 그대로 노출.
  // 수사 내용(content)·메모(notes)·증거링크(bookingBasis)·피의자 신원은 비노출.
  const PRIVATE_MASKED_FIELDS = [
    "content",
    "notes",
    "bookingBasis",
    "suspectName",   // 피의자 신원은 수사 기밀 — 행정 처리에 불필요
    "suspectUuid",
  ];
  const rows = result.rows.map((row) => {
    const c = toCamel(row);
    if (
      c.visibility === "PRIVATE" &&
      isSecretariat &&
      !canViewPrivate &&
      c.prosecutorId !== req.user.id &&
      c.createdBy !== req.user.id &&
      !parseJsonArray(c.privateViewerIds).includes(req.user.id)
    ) {
      for (const field of PRIVATE_MASKED_FIELDS) {
        c[field] = "";
      }
      c._privateMasked = true; // 프론트에서 [보안사건] 표시용 플래그
    }
    return c;
  });
  res.json(rows);
});

// ── 사건번호 자동계산 시작값 (검찰사무국 전용 수정) ────────────────
app.get("/api/settings/case-number", requireAuth, requireSecretariat, asyncWrap(async (req, res) => {
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
    naesaStart: getStart("case_number_naesa_start"),
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
      naesa: Number(req.body.naesaStart),
    };
    if (
      Object.values(starts).some(
        (value) => !Number.isInteger(value) || value < 1,
      )
    ) {
      return res.status(400).json({
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
      naesaStart: starts.naesa,
    });
  },
);

// POST /api/cases/assign-official-no — 공식 사건번호 원자적 채번 및 배정
// 서버 DB 기준 최대 번호를 읽어 +1 배정 → 레이스 컨디션 방지
app.post(
  "/api/cases/assign-official-no",
  requireAuth,
  requireSecretariat,
  asyncWrap(async (req, res) => {
    const { caseId, prefix, manualNo, autoSeal } = req.body || {};
    if (!caseId || !prefix) {
      return res.status(400).json({ success: false, message: "caseId와 prefix는 필수입니다." });
    }
    const ALLOWED_PREFIXES = new Set(["형제", "특공", "특형", "특압제", "압제"]);
    if (!ALLOWED_PREFIXES.has(prefix)) {
      return res.status(400).json({ success: false, message: "허용되지 않는 사건번호 유형입니다." });
    }

    const currentYear = new Date().getFullYear();

    // 기존 케이스 조회
    const caseRes = await db.execute({
      sql: "SELECT * FROM cases WHERE id = ? AND deleted_at = ''",
      args: [caseId],
    });
    if (caseRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "사건을 찾을 수 없습니다." });
    }
    const existingCase = toCamel(caseRes.rows[0]);

    let numPart;
    if (manualNo && String(manualNo).trim()) {
      // 수동 입력 번호 사용
      numPart = String(manualNo).trim();
    } else {
      // 서버 DB 기준 최대 번호 조회 — 클라이언트 캐시 기준 아님
      const settingKeyMap = {
        형제: "case_number_hyeongje_start",
        특공: "case_number_teuggong_start",
        특형: "case_number_teughyeong_start",
        특압제: "case_number_teugapje_start",
        압제: "case_number_apje_start",
      };
      const settingKey = settingKeyMap[prefix];
      const regex = `^${currentYear}${prefix}([0-9]+)$`;

      const [settingRow, maxRow] = await Promise.all([
        db.execute({
          sql: "SELECT value FROM system_settings WHERE key = ?",
          args: [settingKey],
        }),
        db.execute({
          // DB에서 직접 최대 일련번호 계산 — SELECT MAX 원자적 조회
          sql: `SELECT MAX(CAST(SUBSTR(hyeongje_no, LENGTH(?)+1) AS INTEGER)) AS maxNo
                FROM cases
                WHERE hyeongje_no GLOB ? AND deleted_at = ''`,
          args: [`${currentYear}${prefix}`, `${currentYear}${prefix}[0-9]*`],
        }),
      ]);

      const configuredStart = Number(settingRow.rows[0]?.value) || 1;
      const dbMax = maxRow.rows[0]?.maxNo || 0;
      numPart = Math.max(configuredStart, dbMax + 1);
    }

    const assignedNo = `${currentYear}${prefix}${numPart}`;
    const currentSuje =
      existingCase.sujeNo ||
      (existingCase.hyeongjeNo || "").replace("형제", "수제");

    const newDisposition = autoSeal
      ? `피의자(기소 - 사무국승인 [${assignedNo}])`
      : existingCase.disposition;

    await db.execute({
      sql: `UPDATE cases SET hyeongje_no=?, latest_hyeongje_no=?, suje_no=?, disposition=? WHERE id=? AND deleted_at=''`,
      args: [assignedNo, assignedNo, currentSuje, newDisposition, caseId],
    });

    await writeAuditLog({
      action: "UPDATE",
      entityType: "case",
      entityId: caseId,
      entityLabel: assignedNo,
      actorId: req.user.id,
      actorName: req.user.name,
      detail: `검찰사무국 공식 사건번호 배정: ${currentSuje} → ${assignedNo}`,
    });

    res.json({
      success: true,
      assignedNo,
      sujeNo: currentSuje,
      disposition: newDisposition,
    });
  }),
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
      return res.status(400).json({
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

app.get("/api/charges", requireAuth, async (_req, res) => {
  const result = await db.execute(
    "SELECT id, name, created_at, created_by FROM charges WHERE deleted_at = '' ORDER BY name COLLATE NOCASE",
  );
  res.json(result.rows.map(toCamel));
});

app.post("/api/charges", requireAuth, requireSecretariat, async (req, res) => {
  const name = String(req.body?.name || "").trim();
  if (!name || name.length > 120) {
    return res
      .status(400)
      .json({ success: false, message: "죄명은 1~120자로 입력해주세요." });
  }
  try {
    const result = await db.execute({
      sql: "INSERT INTO charges (name, created_by) VALUES (?, ?)",
      args: [name, req.user.id],
    });
    res.json({
      success: true,
      charge: { id: Number(result.lastInsertRowid), name },
    });
  } catch (error) {
    if (
      String(error.message || error)
        .toLowerCase()
        .includes("unique")
    ) {
      return res
        .status(409)
        .json({ success: false, message: "이미 등록된 죄명입니다." });
    }
    throw error;
  }
});

app.delete(
  "/api/charges/:id",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    try {
      const existing = await db.execute({
        sql: "SELECT name FROM charges WHERE id = ? AND deleted_at = ''",
        args: [req.params.id],
      });
      if (existing.rows.length === 0) {
        return res.status(404).json({ success: false, message: "해당 죄명을 찾을 수 없습니다." });
      }
      await db.execute({
        sql: "UPDATE charges SET deleted_at = ? WHERE id = ? AND deleted_at = ''",
        args: [new Date().toISOString(), req.params.id],
      });
      await writeAuditLog({
        action: "DELETE",
        entityType: "charge",
        entityId: String(req.params.id),
        entityLabel: existing.rows[0].name,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `죄명 삭제: ${existing.rows[0].name}`,
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[DELETE /charges]", err);
      res.status(500).json({ success: false, message: "죄명 삭제에 실패했습니다." });
    }
  },
);

app.post("/api/cases", requireAuth, asyncWrap(async (req, res) => {
  const c = req.body;
  const lenErr = validateFieldLengths(c, {
    sujeNo: "short", hyeongjeNo: "short", latestHyeongjeNo: "short",
    prosecutorName: "short", suspectName: "short", suspectUuid: "short",
    bookingStatus: "short", bookingDate: "short", incidentDate: "short",
    bookingBasis: "url", disposition: "medium", chargeName: "medium",
    notes: "long", content: "long", confiscation: "medium",
  });
  if (lenErr) return res.status(400).json({ success: false, message: lenErr });
  const visibility = c.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC";
  const privateViewerIds = normalizePrivateViewerIds(c.privateViewerIds);
  const assignedId = hasGlobalDataAccess(req.user)
    ? c.prosecutorId || ""
    : req.user.id;
  const assignedName = hasGlobalDataAccess(req.user)
    ? c.prosecutorName || ""
    : req.user.name;
  // 클라이언트 제공 ID 무시 — 서버에서 항상 UUID 생성
  const id = `CASE-${Date.now()}-${randomUUID().slice(0, 8)}`;
  await db.execute({
    sql: `INSERT INTO cases (
            id, suje_no, hyeongje_no, latest_hyeongje_no,
            prosecutor_name, prosecutor_id, suspect_name, suspect_uuid,
            booking_status, booking_date, incident_date, booking_basis, disposition,
            re_appeal, court1_no, court1_result, court1_doc,
            court1_appealed, court1_appellant, court2_no, court2_dismissed,
            court2_result, court2_doc, court3_appealed, court3_appellant,
            court3_no, court3_remanded, court3_result, court3_doc,
            notes, content, confiscation, charge_name, visibility, created_by, private_viewer_ids
          ) VALUES (
            ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?
          )`,
    args: [
      id,
      c.sujeNo || (c.hyeongjeNo && c.hyeongjeNo.includes("수제") ? c.hyeongjeNo : ""),
      c.hyeongjeNo && !c.hyeongjeNo.includes("수제") ? c.hyeongjeNo : "-",
      c.latestHyeongjeNo || "",
      assignedName,
      assignedId,
      c.suspectName || "",
      c.suspectUuid || "",
      c.bookingStatus || "",
      c.bookingDate || "",
      c.incidentDate || c.bookingDate || "",
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
      visibility,
      req.user.id,
      JSON.stringify(privateViewerIds),
    ],
  });
  await writeAuditLog({
    action: "CREATE",
    entityType: "case",
    entityId: id,
    entityLabel: c.hyeongjeNo || id,
    actorId: req.user.id,
    actorName: req.user.name,
    detail: `피의자: ${c.suspectName || ""}, 죄명: ${c.chargeName || ""}`,
  });
  res.json({ success: true, case: { ...c, id } });
});

app.post("/api/cases/intake-bundle", requireAuth, asyncWrap(async (req, res) => {
  const c = req.body || {};
  const visibility = c.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC";
  const privateViewerIds = normalizePrivateViewerIds(c.privateViewerIds);
  const assignedId = hasGlobalDataAccess(req.user)
    ? String(c.prosecutorId || "")
    : req.user.id;
  const assignedName = hasGlobalDataAccess(req.user)
    ? String(c.prosecutorName || "")
    : req.user.name;
  if (
    visibility === "PRIVATE" &&
    !isProsecutorGeneral(req.user) &&
    req.user.id !== assignedId
  ) {
    return res.status(403).json({
      success: false,
      message:
        "비공개 사건 공개대상은 검찰총장 또는 담당검사만 지정할 수 있습니다.",
    });
  }
  // 클라이언트 제공 ID 무시 — 서버에서 항상 UUID 생성
  const id = `CASE-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const reportId = `RPT-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const bookingId = `BKG-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const isPreInvestigation = isPreBookingInvestigation(c.bookingStatus);
  let intakeCaseNo = c.sujeNo || c.hyeongjeNo || "";
  if (isPreInvestigation) {
    const year = new Date().getFullYear();
    const [settingResult, existingCases] = await Promise.all([
      db.execute({
        sql: "SELECT value FROM system_settings WHERE key='case_number_naesa_start'",
        args: [],
      }),
      db.execute({
        sql: "SELECT hyeongje_no FROM cases WHERE hyeongje_no LIKE ?",
        args: [`${year}내사%`],
      }),
    ]);
    const configuredStart = Math.max(
      1,
      Number(settingResult.rows[0]?.value) || 1,
    );
    const maxExisting = existingCases.rows.reduce((max, row) => {
      const match = String(row.hyeongje_no || "").match(
        new RegExp(`^${year}내사(\\d+)$`),
      );
      return match ? Math.max(max, Number(match[1])) : max;
    }, configuredStart - 1);
    intakeCaseNo = `${year}내사${Math.max(configuredStart, maxExisting + 1)}`;
  }
  const evidenceAttachments = Array.isArray(c.evidenceAttachments)
    ? c.evidenceAttachments
        .filter(
          (item) =>
            item &&
            typeof item.url === "string" &&
            item.url.startsWith("data:") &&
            ALLOWED_EVIDENCE_MIME.test(item.url) &&
            item.url.length <= EVIDENCE_MAX_BYTES,
        )
        .slice(0, 10)
    : [];
  const createdAt = new Date().toISOString().replace("T", " ").substring(0, 16);
  if (assignedId && !(await validateCaseAssignee(assignedId))) {
    return res.status(400).json({
      success: false,
      message: "사무국 소속 또는 비활성 계정은 담당검사로 배정할 수 없습니다.",
    });
  }
  const caseArgs = [
    id,
    intakeCaseNo, // suje_no (e.g. 2026수제280)
    c.hyeongjeNo && !c.hyeongjeNo.includes("수제") ? c.hyeongjeNo : "-", // hyeongje_no
    c.latestHyeongjeNo || "",
    assignedName,
    assignedId,
    c.suspectName || "",
    c.suspectUuid || "",
    c.bookingStatus || "",
    c.bookingDate || "",
    c.incidentDate || c.bookingDate || "",
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
    visibility,
    req.user.id,
    JSON.stringify(privateViewerIds),
  ];
  try {
    await db.batch(
      [
        {
          sql: `INSERT INTO cases (id,suje_no,hyeongje_no,latest_hyeongje_no,prosecutor_name,prosecutor_id,suspect_name,suspect_uuid,booking_status,booking_date,incident_date,booking_basis,disposition,re_appeal,court1_no,court1_result,court1_doc,court1_appealed,court1_appellant,court2_no,court2_dismissed,court2_result,court2_doc,court3_appealed,court3_appellant,court3_no,court3_remanded,court3_result,court3_doc,notes,content,confiscation,charge_name,visibility,created_by,private_viewer_ids) VALUES (${Array(36).fill("?").join(",")})`,
          args: caseArgs,
        },
        {
          sql: `INSERT INTO reports (id,report_no,hyeongje_no,title,prosecutor_name,suspect_name,suspect_uuid,status,created_at,basis_url,period,confiscation) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          args: [
            reportId,
            `접수-${Date.now()}`,
            intakeCaseNo,
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
            intakeCaseNo,
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
        ...evidenceAttachments.map((item, index) => ({
          sql: `INSERT INTO evidence (id, case_no, title, url, evidence_type, record, created_by, created_at, deleted_at)
                VALUES (?,?,?,?,?,?,?,?,'')`,
          args: [
            `EVD-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`,
            intakeCaseNo,
            String(item.title || "첨부 증거자료").slice(0, 200),
            item.url,
            item.type === "IMAGE" ? "IMAGE" : "DOCUMENT",
            String(item.record || ""),
            req.user.id,
            new Date().toISOString(),
          ],
        })),
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
        sujeNo: intakeCaseNo,
        hyeongjeNo: isPreInvestigation ? "-" : c.hyeongjeNo,
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

// POST /api/cases/bulk-import — 엑셀 일괄 등록 DB 저장 (검찰사무국 전용)
app.post("/api/cases/bulk-import", requireAuth, requireSecretariat, async (req, res) => {
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (rows.length === 0) {
    return res.status(400).json({ success: false, message: "일괄 등록할 사건 데이터가 없습니다." });
  }
  if (rows.length > 500) {
    return res.status(400).json({ success: false, message: "한 번에 최대 500건까지 등록할 수 있습니다." });
  }

  try {
    const insertedCases = [];
    const insertedReports = [];
    const insertedBookings = [];
    const txStatements = [];

    const now = new Date();

    // 엑셀에 기재된 검사명으로 prosecutors 테이블에서 id를 조회
    // 없으면 name을 임시 id로 사용하되 경고 플래그
    const prosecutorNameSet = new Set(
      rows.map((r) => String(r["검사명"] || "").trim()).filter(Boolean),
    );
    const prosecutorMap = new Map(); // name → id
    if (prosecutorNameSet.size > 0) {
      const placeholders = [...prosecutorNameSet].map(() => "?").join(",");
      const prosResult = await db.execute({
        sql: `SELECT id, name FROM prosecutors WHERE name IN (${placeholders})`,
        args: [...prosecutorNameSet],
      });
      for (const row of prosResult.rows) {
        prosecutorMap.set(row.name, row.id);
      }
    }

    rows.forEach((r, i) => {
      // 충돌 없는 고유 ID 생성 (타임스탬프 + 인덱스 + 랜덤)
      const caseId = `BULK-${now.getTime()}-${i}-${randomUUID().slice(0, 8)}`;
      const rawSujeNo = String(r["수제번호"] || "").trim();
      const rawHyeongjeNo = String(r["형제번호"] || "").trim();
      const prosecutorName = String(r["검사명"] || "").trim();
      // 검사 계정이 존재하면 실제 id 사용, 없으면 이름을 임시 id로
      const prosecutorId = prosecutorMap.get(prosecutorName) || prosecutorName;
      const suspectName = String(r["피고인명"] || r["피의자명"] || "").trim();
      const suspectUuid = String(r["UUID"] || "").trim();
      const bookingStatus = String(r["현재 상황"] || "접수").trim();
      const bookingDate = String(r["접수일시"] || "").trim();
      const incidentDate =
        String(r["사건 발생일"] || r["발생일시"] || "").trim() || bookingDate;
      const bookingBasis = String(r["접수근거"] || "").trim();
      const disposition = String(r["처분내용"] || "").trim();
      const chargeName = String(r["죄명"] || "").trim();

      const caseObj = {
        id: caseId,
        sujeNo: rawSujeNo || (rawHyeongjeNo.includes("수제") ? rawHyeongjeNo : ""),
        hyeongjeNo: rawHyeongjeNo && !rawHyeongjeNo.includes("수제") ? rawHyeongjeNo : "-",
        latestHyeongjeNo: rawHyeongjeNo && !rawHyeongjeNo.includes("수제") ? rawHyeongjeNo : rawSujeNo || "-",
        prosecutorName,
        prosecutorId,
        suspectName,
        suspectUuid,
        bookingStatus,
        bookingDate,
        incidentDate,
        bookingBasis,
        disposition,
        reAppeal: "-",
        court1No: String(r["1심 사건번호"] || "").trim(),
        court1Result: String(r["1심 결과"] || "").trim(),
        court1Doc: String(r["판결문"] || "").trim(),
        court1Appealed: String(r["항소 여부"] || "").trim(),
        court1Appellant: String(r["항소장"] || "").trim(),
        court2No: String(r["2심 사건번호"] || "").trim(),
        court2Dismissed: String(r["항소기각"] || "").trim(),
        court2Result: String(r["2심 결과"] || "").trim(),
        court2Doc: String(r["판결문(항소)"] || "").trim(),
        court3Appealed: String(r["상고 여부"] || "").trim(),
        court3Appellant: String(r["상고장"] || "").trim(),
        court3No: String(r["3심 사건번호"] || "").trim(),
        court3Remanded: String(r["파기환송"] || "").trim(),
        court3Result: String(r["3심 결과"] || "").trim(),
        court3Doc: String(r["판결문(상고)"] || "").trim(),
        notes: "",
        content: "",
        confiscation: "",
        chargeName,
        visibility: "PUBLIC",
        createdBy: req.user.id,
        privateViewerIds: "[]",
      };
      insertedCases.push(caseObj);

      txStatements.push({
        sql: `INSERT INTO cases (
                id, suje_no, hyeongje_no, latest_hyeongje_no,
                prosecutor_name, prosecutor_id, suspect_name, suspect_uuid,
                booking_status, booking_date, incident_date, booking_basis, disposition,
                re_appeal, court1_no, court1_result, court1_doc,
                court1_appealed, court1_appellant, court2_no, court2_dismissed,
                court2_result, court2_doc, court3_appealed, court3_appellant,
                court3_no, court3_remanded, court3_result, court3_doc,
                notes, content, confiscation, charge_name, visibility, created_by, private_viewer_ids
              ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [
          caseObj.id,
          caseObj.sujeNo,
          caseObj.hyeongjeNo,
          caseObj.latestHyeongjeNo,
          caseObj.prosecutorName,
          caseObj.prosecutorId,
          caseObj.suspectName,
          caseObj.suspectUuid,
          caseObj.bookingStatus,
          caseObj.bookingDate,
          caseObj.incidentDate,
          caseObj.bookingBasis,
          caseObj.disposition,
          caseObj.reAppeal,
          caseObj.court1No,
          caseObj.court1Result,
          caseObj.court1Doc,
          caseObj.court1Appealed,
          caseObj.court1Appellant,
          caseObj.court2No,
          caseObj.court2Dismissed,
          caseObj.court2Result,
          caseObj.court2Doc,
          caseObj.court3Appealed,
          caseObj.court3Appellant,
          caseObj.court3No,
          caseObj.court3Remanded,
          caseObj.court3Result,
          caseObj.court3Doc,
          caseObj.notes,
          caseObj.content,
          caseObj.confiscation,
          caseObj.chargeName,
          caseObj.visibility,
          caseObj.createdBy,
          caseObj.privateViewerIds,
        ],
      });

      // Report
      const reportId = `BULK-REP-${now.getTime()}-${i}-${randomUUID().slice(0, 8)}`;
      const reportObj = {
        id: reportId,
        reportNo: `접수-${now.getTime()}-${i}`,
        hyeongjeNo: caseObj.hyeongjeNo,
        title: `${chargeName || '사건'} 접수 건`,
        prosecutorName,
        suspectName,
        suspectUuid,
        status: "입건 완료",
        createdAt: bookingDate || "",
        basisUrl: bookingBasis,
        period: `${bookingDate} ~ 수사중`,
        confiscation: "-",
      };
      insertedReports.push(reportObj);

      txStatements.push({
        sql: `INSERT INTO reports (id, report_no, hyeongje_no, title, prosecutor_name, suspect_name, suspect_uuid, status, created_at, basis_url, period, confiscation)
              VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [
          reportObj.id,
          reportObj.reportNo,
          reportObj.hyeongjeNo,
          reportObj.title,
          reportObj.prosecutorName,
          reportObj.suspectName,
          reportObj.suspectUuid,
          reportObj.status,
          reportObj.createdAt,
          reportObj.basisUrl,
          reportObj.period,
          reportObj.confiscation,
        ],
      });

      // Booking
      const bookingId = `BULK-BKG-${now.getTime()}-${i}-${randomUUID().slice(0, 8)}`;
      const bookingObj = {
        id: bookingId,
        hyeongjeNo: caseObj.hyeongjeNo,
        prosecutorName,
        suspectName,
        suspectUuid,
        dispositionStatus: bookingStatus,
        bookingDate,
        basisUrl: bookingBasis,
        daysElapsed: 0,
        indictmentDecision: disposition || "수사 진행 중",
      };
      insertedBookings.push(bookingObj);

      txStatements.push({
        sql: `INSERT INTO bookings (id, hyeongje_no, prosecutor_name, suspect_name, suspect_uuid, disposition_status, booking_date, basis_url, days_elapsed, indictment_decision)
              VALUES (?,?,?,?,?,?,?,?,?,?)`,
        args: [
          bookingObj.id,
          bookingObj.hyeongjeNo,
          bookingObj.prosecutorName,
          bookingObj.suspectName,
          bookingObj.suspectUuid,
          bookingObj.dispositionStatus,
          bookingObj.bookingDate,
          bookingObj.basisUrl,
          bookingObj.daysElapsed,
          bookingObj.indictmentDecision,
        ],
      });
    });

    await db.batch(txStatements, "write");

    await writeAuditLog({
      action: "CREATE",
      entityType: "cases_bulk",
      entityId: `BULK-${Date.now()}`,
      entityLabel: `${insertedCases.length}건 엑셀 일괄 등록`,
      actorId: req.user.id,
      actorName: req.user.name,
      detail: `엑셀 일괄 등록 ${insertedCases.length}건 DB 반영 완료`,
    });

    res.json({
      success: true,
      count: insertedCases.length,
      cases: insertedCases,
      reports: insertedReports,
      bookings: insertedBookings,
    });
  } catch (err) {
    console.error("[POST /api/cases/bulk-import]", err);
    res.status(500).json({ success: false, message: "엑셀 일괄 등록 중 DB 저장에 실패했습니다." });
  }
});

app.put("/api/cases/:id", requireAuth, requireCaseScope, asyncWrap(async (req, res) => {
  const c = req.body;
  if (c.forceReassign) {
    if (
      !hasSecretariatWorkAccess(req.user) &&
      !GLOBAL_DATA_ROLES.has(effectiveRoleLevel(req.user))
    ) {
      return res.status(403).json({
        success: false,
        message: "사무국 탭에서만 강제 재배당할 수 있습니다.",
      });
    }
    if (!(await validateForcedCaseAssignee(c.prosecutorId))) {
      return res.status(400).json({
        success: false,
        message: "활성 상태의 담당검사를 선택해주세요.",
      });
    }
  }
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
        ["suspectUuid", "피의자 UUID"],
        ["bookingStatus", "입건상태"],
        ["bookingDate", "접수일"],
        ["incidentDate", "사건 발생일"],
        ["disposition", "처분내역"],
        ["chargeName", "죄명"],
        ["notes", "비고"],
        ["content", "사건 내용"],
        ["confiscation", "몰수추징"],
        ["court1No", "1심 사건번호"],
        ["court1Result", "1심 판결"],
        ["court2No", "2심 사건번호"],
        ["court2Result", "2심 판결"],
        ["court3No", "3심 사건번호"],
        ["court3Result", "3심 판결"],
      ];
      const now = new Date().toISOString().replace("T", " ").substring(0, 19);
      const changedFields = [];
      const changedDetails = []; // 이전값→이후값 상세 (audit log detail용)
      for (const [field, label] of trackFields) {
        const oldVal = String(old[field] || "");
        const newVal = String(c[field] || "");
        if (oldVal !== newVal) {
          changedFields.push(label);
          // 내용/비고는 너무 길 수 있으므로 길이 제한
          const oldDisp = oldVal.length > 30 ? oldVal.slice(0, 30) + "…" : oldVal;
          const newDisp = newVal.length > 30 ? newVal.slice(0, 30) + "…" : newVal;
          changedDetails.push(`${label}: "${oldDisp || "(없음)"}" → "${newDisp || "(없음)")"`);
          const histId = `CH-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
          await db.execute({
            sql: `INSERT INTO case_history (id, case_id, hyeongje_no, actor_id, actor_name, field_name, old_value, new_value, created_at)
                  VALUES (?,?,?,?,?,?,?,?,?)`,
            args: [
              histId,
              req.params.id,
              // 수제번호를 우선 사용하고, 없으면 형제번호 fallback
              c.sujeNo || old.sujeNo || c.hyeongjeNo || old.hyeongjeNo,
              req.user.id,
              req.user.name,
              label,
              oldVal,
              newVal,
              now,
            ],
          });
        }
      }
      // 변경된 필드 목록과 상세를 req에 저장해 아래 writeAuditLog에서 사용
      req._changedFields = changedFields;
      req._changedDetails = changedDetails;
    }
  } catch (e) {
    console.warn("[case history write error]", e.message);
  }

  const sujeNo =
    c.sujeNo ||
    (c.hyeongjeNo && c.hyeongjeNo.includes("수제") ? c.hyeongjeNo : "");
  const hyeongjeNo =
    c.hyeongjeNo && !c.hyeongjeNo.includes("수제") ? c.hyeongjeNo : "-";

  // visibility / privateViewerIds 변경 권한 체크
  // — 검찰총장 또는 사건 담당/작성자만 공개범위를 변경할 수 있다.
  const newVisibility = c.visibility === "PRIVATE" ? "PRIVATE" : "PUBLIC";
  const newPrivateViewerIds = normalizePrivateViewerIds(c.privateViewerIds);
  if (c.visibility !== undefined && !isProsecutorGeneral(req.user)) {
    const visCheck = await db.execute({
      sql: "SELECT created_by, prosecutor_id FROM cases WHERE id = ? AND deleted_at = ''",
      args: [req.params.id],
    });
    const vrow = visCheck.rows[0];
    if (vrow && vrow.created_by !== req.user.id && vrow.prosecutor_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "사건의 공개범위는 담당검사 또는 작성자만 변경할 수 있습니다.",
      });
    }
  }

  await db.execute({
    sql: `UPDATE cases SET
            suje_no=?, hyeongje_no=?, latest_hyeongje_no=?,
            prosecutor_name=?, prosecutor_id=?,
            suspect_name=?, suspect_uuid=?,
            booking_status=?, booking_date=?, incident_date=?, booking_basis=?, disposition=?,
            re_appeal=?,
            court1_no=?, court1_result=?, court1_doc=?, court1_appealed=?, court1_appellant=?,
            court2_no=?, court2_dismissed=?, court2_result=?, court2_doc=?,
            court3_appealed=?, court3_appellant=?, court3_no=?, court3_remanded=?, court3_result=?, court3_doc=?,
            charge_name=?, notes=?, content=?, confiscation=?,
            supervisor_designated=?, supervisor_id=?, supervisor_name=?,
            visibility=?, private_viewer_ids=?
          WHERE id=?`,
    args: [
      sujeNo,
      hyeongjeNo,
      c.latestHyeongjeNo || hyeongjeNo,
      assignedName,
      assignedId,
      c.suspectName || "",
      c.suspectUuid || "",
      c.bookingStatus || "",
      c.bookingDate || "",
      c.incidentDate || "",
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
      c.chargeName || "",
      c.notes || "",
      c.content || "",
      c.confiscation || "",
      c.supervisorDesignated ? 1 : 0,
      c.supervisorId || "",
      c.supervisorName || "",
      newVisibility,
      JSON.stringify(newPrivateViewerIds),
      req.params.id,
    ],
  });
  const changedFields = req._changedFields || [];
  const changedDetails = req._changedDetails || [];
  const changedSummary = changedDetails.length > 0
    ? `\n변경 내역:\n${changedDetails.join("\n")}`
    : "";
  await writeAuditLog({
    action: "UPDATE",
    entityType: "case",
    entityId: req.params.id,
    // 수제번호를 우선 사용하고, 없으면 형제번호, 없으면 ID
    entityLabel: c.sujeNo || c.hyeongjeNo || req.params.id,
    actorId: req.user.id,
    actorName: req.user.name,
    detail: c.forceReassign
      ? `강제 재배당: ${assignedName} (${assignedId})${changedSummary}`
      : `처분: ${c.disposition || ""}, 상태: ${c.bookingStatus || ""}${changedSummary}`,
  });
  res.json({ success: true, id: req.params.id });
});

// PATCH /api/cases/:id/archive — 사건 보존 / 보존 해제 처리
app.patch("/api/cases/:id/archive", requireAuth, requireSecretariat, requireCaseScope, async (req, res) => {
  const isArchived = Boolean(req.body.isArchived);
  const nowStr = isArchived
    ? new Date().toISOString().replace("T", " ").substring(0, 19)
    : "";
  const actorName = isArchived ? req.user.name : "";

  try {
    await db.execute({
      sql: `UPDATE cases SET is_archived=?, archived_at=?, archived_by=? WHERE id=?`,
      args: [isArchived ? 1 : 0, nowStr, actorName, req.params.id],
    });

    await writeAuditLog({
      action: "UPDATE",
      entityType: "case",
      entityId: req.params.id,
      entityLabel: req.params.id,
      actorId: req.user.id,
      actorName: req.user.name,
      detail: isArchived ? "사건 보존 처리 (서고 이동)" : "사건 보존 해제 (원부 복원)",
    });

    res.json({ success: true, isArchived, archivedAt: nowStr, archivedBy: actorName });
  } catch (err) {
    console.error("[PATCH /api/cases/:id/archive]", err);
    res.status(500).json({ success: false, message: "사건 보존 처리 중 오류 발생" });
  }
});

// ════════════════════════════════════════════════════════════════════
// 3. Reports
// ════════════════════════════════════════════════════════════════════
app.get("/api/reports", requireAuth, asyncWrap(async (req, res) => {
  const result = await db.execute(scopedQuery("reports", req.user));
  res.json(result.rows.map(toCamel));
});

app.post("/api/reports", requireAuth, asyncWrap(async (req, res) => {
  const r = req.body;
  const lenErr = validateFieldLengths(r, {
    reportNo: "short", hyeongjeNo: "short", title: "medium",
    suspectName: "short", suspectUuid: "short", status: "short",
    basisUrl: "url", period: "short", confiscation: "medium",
  });
  if (lenErr) return res.status(400).json({ success: false, message: lenErr });
  const assignedName = hasGlobalDataAccess(req.user)
    ? r.prosecutorName || req.user.name
    : req.user.name;
  // 클라이언트 제공 ID 무시 — 서버에서 항상 UUID 생성
  const id = `RPT-${Date.now()}-${randomUUID().slice(0, 8)}`;
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
app.get("/api/appeals", requireAuth, asyncWrap(async (req, res) => {
  const result = await db.execute(scopedQuery("appeals", req.user));
  res.json(result.rows.map(toCamel));
});

app.post("/api/appeals", requireAuth, asyncWrap(async (req, res) => {
  const a = req.body;
  const lenErr = validateFieldLengths(a, {
    appealNo: "short", hyeongjeNo: "short", sujeNo: "short",
    status: "short", suspectName: "short", suspectUuid: "short",
    disposition: "medium", dispositionDate: "short",
    basisUrl: "url", chargeName: "medium",
  });
  if (lenErr) return res.status(400).json({ success: false, message: lenErr });
  const assignedName = hasGlobalDataAccess(req.user)
    ? a.prosecutorName || req.user.name
    : req.user.name;
  // 클라이언트 제공 ID 무시 — 서버에서 항상 UUID 생성
  const id = `APL-${Date.now()}-${randomUUID().slice(0, 8)}`;
  await db.execute({
    sql: `INSERT INTO appeals (id, appeal_no, hyeongje_no, suje_no, status,
            prosecutor_name, suspect_name, suspect_uuid, disposition, disposition_date,
            basis_url, charge_name)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      id,
      a.appealNo || "",
      a.hyeongjeNo || "",
      a.sujeNo || "",
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
  requireSecretariat,
  requireRecordScope("appeals"),
  async (req, res) => {
    const fields = {
      appealNo: "appeal_no",
      hyeongjeNo: "hyeongje_no",
      sujeNo: "suje_no",
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
app.get("/api/bookings", requireAuth, asyncWrap(async (req, res) => {
  const result = await db.execute(scopedQuery("bookings", req.user));
  res.json(result.rows.map(toCamel));
});

app.post("/api/bookings", requireAuth, asyncWrap(async (req, res) => {
  const b = req.body;
  const lenErr = validateFieldLengths(b, {
    hyeongjeNo: "short", suspectName: "short", suspectUuid: "short",
    dispositionStatus: "short", bookingDate: "short",
    basisUrl: "url", indictmentDecision: "medium",
  });
  if (lenErr) return res.status(400).json({ success: false, message: lenErr });
  const assignedName = hasGlobalDataAccess(req.user)
    ? b.prosecutorName || req.user.name
    : req.user.name;
  // 클라이언트 제공 ID 무시 — 서버에서 항상 UUID 생성
  const id = `BKG-${Date.now()}-${randomUUID().slice(0, 8)}`;
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

app.get("/api/warrants", requireAuth, asyncWrap(async (req, res) => {
  const result = await db.execute(scopedQuery("warrants", req.user));
  res.json(result.rows.map(toCamel));
});

app.post("/api/warrants", requireAuth, async (req, res) => {
  const w = req.body || {};
  const assignedName = hasGlobalDataAccess(req.user)
    ? w.prosecutorName || req.user.name
    : req.user.name;
  // 클라이언트 제공 ID 무시 — 서버에서 항상 UUID 생성
  const id = `WAR-${Date.now()}-${randomUUID().slice(0, 8)}`;
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
      const existing = await db.execute({
        sql: "SELECT warrant_no, suspect_name FROM warrants WHERE id = ? AND deleted_at = ''",
        args: [req.params.id],
      });
      await db.execute({
        sql: "UPDATE warrants SET deleted_at=? WHERE id=? AND deleted_at=''",
        args: [new Date().toISOString(), req.params.id],
      });
      const label = existing.rows[0]?.warrant_no || req.params.id;
      await writeAuditLog({
        action: "DELETE",
        entityType: "warrant",
        entityId: req.params.id,
        entityLabel: label,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `영장 삭제: ${label} (피의자: ${existing.rows[0]?.suspect_name || "-"})`,
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[DELETE /warrants]", err);
      res.status(500).json({ success: false, message: "영장 삭제에 실패했습니다." });
    }
  },
);

// ════════════════════════════════════════════════════════════════════
// 6. Approvals
// ════════════════════════════════════════════════════════════════════
app.get("/api/approvals", requireAuth, asyncWrap(async (req, res) => {
  const result = await db.execute(scopedQuery("approvals", req.user));
  res.json(
    result.rows.map((row) => ({
      ...toCamel(row),
      approvals: parseJsonArray(row.approvals_json),
      attachments: parseJsonArray(row.attachments_json),
    })),
  );
});

app.post("/api/approvals", requireAuth, asyncWrap(async (req, res) => {
  const doc = req.body;

  // ── 사건 소유권 검증 ─────────────────────────────────────────────
  // 전역 권한(검찰총장·사무국)이 없는 일반 검사는 본인이 담당한 사건에만 결재를 상신할 수 있다.
  if (!hasGlobalDataAccess(req.user) && doc.hyeongjeNo) {
    const caseCheck = await db.execute({
      sql: `SELECT prosecutor_id FROM cases
            WHERE (hyeongje_no = ? OR suje_no = ?) AND deleted_at = '' LIMIT 1`,
      args: [doc.hyeongjeNo, doc.hyeongjeNo],
    });
    const caseRow = caseCheck.rows[0];
    if (caseRow && caseRow.prosecutor_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "담당 사건의 결재만 상신할 수 있습니다.",
      });
    }
  }

  const assignedId = hasGlobalDataAccess(req.user)
    ? doc.prosecutorId || req.user.id
    : req.user.id;
  const assignedName = hasGlobalDataAccess(req.user)
    ? doc.prosecutorName || req.user.name
    : req.user.name;
  // 클라이언트 제공 ID 무시 — 서버에서 항상 UUID 생성
  const approvalId = `APV-${Date.now()}-${randomUUID().slice(0, 8)}`;
  await db.execute({
    sql: `INSERT INTO approvals (id, doc_no, doc_type, doc_type_name, title,
            hyeongje_no, prosecutor_id, prosecutor_name, suspect_name,
            disposition_type, charge_name, summary, status, created_at, approvals_json, attachments_json)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      approvalId,
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
  await writeAuditLog({
    action: "CREATE",
    entityType: "approval",
    entityId: approvalId,
    entityLabel: doc.docNo || approvalId,
    actorId: req.user.id,
    actorName: req.user.name,
    detail: `결재 문서 상신: ${doc.docTypeName || doc.docType || "서식"}`,
  });
  res.json({ success: true, doc: { ...doc, id: approvalId } });
});

app.put(
  "/api/approvals/:id",
  requireAuth,
  requireRecordScope("approvals"),
  asyncWrap(async (req, res) => {
    const doc = req.body || {};

    // 최종승인된 문서는 소급 수정 불가
    const existing = await db.execute({
      sql: "SELECT status FROM approvals WHERE id = ? AND deleted_at = ''",
      args: [req.params.id],
    });
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, message: "문서를 찾을 수 없습니다." });
    }
    const currentStatus = existing.rows[0].status;
    if (currentStatus === "최종승인" || currentStatus === "최종승인 (전결)") {
      return res.status(409).json({
        success: false,
        message: "최종승인된 결재 문서는 수정할 수 없습니다.",
      });
    }

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
  }),
);

app.put(
  "/api/approvals/:id/approve",
  requireAuth,
  requireApprovalAuthority,
  requireApprovalScope,
  async (req, res) => {
    if (req.body?.mode === "ARBITRARY" && !req.user.canArbitraryApprove) {
      return res.status(403).json({
        success: false,
        message: "전결 권한이 설정되지 않은 계정입니다.",
      });
    }
    const docId = req.params.id;
    const docRes = await db.execute({
      sql: "SELECT * FROM approvals WHERE id = ?",
      args: [docId],
    });

    if (docRes.rows.length === 0) {
      return res.status(404).json({ error: "문서를 찾을 수 없습니다." });
    }

    const doc = toCamel(docRes.rows[0]);

    // 이미 최종승인된 문서는 중복 결재 차단 (TOCTOU 방지)
    if (doc.status === "최종승인") {
      return res.status(409).json({
        success: false,
        message: "이미 최종승인된 문서입니다.",
      });
    }

    if (req.body?.mode === "ARBITRARY") {
      const caseRes = await db.execute({
        sql: `SELECT supervisor_designated FROM cases
              WHERE (hyeongje_no = ? OR suje_no = ?) AND deleted_at = ''
              LIMIT 1`,
        args: [doc.hyeongjeNo || "", doc.hyeongjeNo || ""],
      });
      if (Number(caseRes.rows[0]?.supervisor_designated) === 1) {
        return res.status(403).json({
          success: false,
          message: "결재 필수 지정 사건은 전결 승인할 수 없습니다.",
        });
      }
    }
    const now = new Date().toISOString().replace("T", " ").substring(0, 16);
    const updatedApprovals = JSON.parse(doc.approvalsJson || "[]").map((a) => ({
      ...a,
      status: "최종결재(인장날인)",
      date: now,
    }));

    // approvals + cases 업데이트를 하나의 batch로 원자화
    // approvals 업데이트 시 status != '최종승인' 조건을 추가해 중복 결재 방지
    const batchResult = await db.batch([
      {
        sql: `UPDATE approvals SET status='최종승인', approvals_json=? WHERE id=? AND status != '최종승인'`,
        args: [JSON.stringify(updatedApprovals), docId],
      },
      {
        sql: `UPDATE cases SET disposition=? WHERE hyeongje_no=? AND deleted_at=''`,
        args: [`${doc.dispositionType} (결재완료)`, doc.hyeongjeNo],
      },
    ], "write");

    // 첫 번째 쿼리의 rowsAffected가 0이면 다른 요청이 먼저 결재한 것
    if (Number(batchResult[0]?.rowsAffected ?? 1) === 0) {
      return res.status(409).json({
        success: false,
        message: "이미 다른 결재권자가 최종승인한 문서입니다.",
      });
    }

    await writeAuditLog({
      action: "APPROVE",
      entityType: "approval",
      entityId: req.params.id,
      entityLabel: doc.docNo,
      actorId: req.user.id,
      actorName: req.user.name,
      detail: `문서유형: ${doc.docTypeName || doc.docType}, 처분: ${doc.dispositionType}`,
    });

    res.json({ success: true });
  },
);

// ════════════════════════════════════════════════════════════════════
// 7. Prosecutors (사무국 관리용)
// ════════════════════════════════════════════════════════════════════

// 일반 사용자(평검사 등)에게 노출할 최소 필드 화이트리스트
const PROSECUTOR_PUBLIC_FIELDS = new Set([
  "id", "name", "rank", "position", "title", "dept", "roleLevel", "status",
]);

app.get("/api/prosecutors", requireAuth, asyncWrap(async (req, res) => {
  const result = await db.execute("SELECT * FROM prosecutors");
  const canViewManagementAccounts =
    req.user.isSuperAdmin || SECRETARIAT_ROLES.has(effectiveRoleLevel(req.user));
  const visibleRows = canViewManagementAccounts
    ? result.rows
    : result.rows.filter((row) => !isManagementAccount(toCamel(row)));

  // 민감 필드 노출 수준 결정
  // - SUPER_ADMIN / 사무국: 모든 필드 (비밀번호 제외)
  // - hasSecretariatWorkAccess(사무관): 직무대리·부서 포함, 개인정보(discordId·note·delegateReason) 제외
  // - 그 외(평검사 등): 공개 화이트리스트 필드만 노출
  const isSuperAdmin = req.user.isSuperAdmin;
  const isSecretariatRole = SECRETARIAT_ROLES.has(effectiveRoleLevel(req.user));
  const isSecretariatWork = hasSecretariatWorkAccess(req.user);

  res.json(
    visibleRows.map((row) => {
      const { password: _pw, ...safe } = toCamel(row);

      if (isSuperAdmin || isSecretariatRole) {
        // 최고 권한: 모든 필드 반환 (비밀번호만 제거)
        return safe;
      }
      if (isSecretariatWork) {
        // 사무관: 직무대리·부서 정보 포함, 개인 민감정보 제거
        delete safe.discordId;
        delete safe.note;
        delete safe.delegateTo;
        delete safe.delegateReason;
        return safe;
      }
      // 일반 사용자: 공개 화이트리스트 필드만 반환
      return Object.fromEntries(
        Object.entries(safe).filter(([k]) => PROSECUTOR_PUBLIC_FIELDS.has(k)),
      );
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
      discordId = "",
    } = req.body;
    const canIssueAllRoles =
      req.user.isSuperAdmin || effectiveRoleLevel(req.user) === "CHIEF_ADMINISTRATOR";
    const allowedRoles = canIssueAllRoles
      ? ACCOUNT_ROLE_LEVELS
      : [
          "PROSECUTOR",
          "PROBATIONARY",
          "SENIOR_PROSECUTOR",
          "ADMINISTRATOR",
          "ADMIN_PROBATIONARY",
        ];
    if (!id || !name || !password || !allowedRoles.includes(roleLevel)) {
      return res.status(400).json({
        success: false,
        message: "계정 ID, 이름, 비밀번호 또는 역할이 올바르지 않습니다.",
      });
    }
    if (password.length < 10) {
      return res.status(400).json({
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
        (id, name, rank, position, title, role_level, dept, password, active_cases, status, note, discord_id)
        VALUES (?,?,?,?,?,?,?, ?,0,'ACTIVE',?,?)`,
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
          discordId,
        ],
      });
      await writeAuditLog({
        action: "CREATE",
        entityType: "prosecutor",
        entityId: id,
        entityLabel: id,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `계정 발급: ${name} (${roleLevel}, ${dept || "부서 미지정"})`,
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
        discordId,
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
      effectiveRoleLevel(req.user),
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
  async (req, res, next) => {
    const isSelf = req.user.id === req.params.id;
    const isSuperAdmin = req.user.isSuperAdmin;
    const isSecretariat =
      SECRETARIAT_ROLES.has(effectiveRoleLevel(req.user)) ||
      hasSecretariatWorkAccess(req.user);

    // 본인이 자기 프로필(제한 필드 제외)을 수정하는 경우는 허용
    // 타인 계정 수정은 사무국/SUPER_ADMIN만 허용
    if (!isSelf && !isSuperAdmin && !isSecretariat) {
      return res.status(403).json({
        success: false,
        message: "본인 계정 또는 관리자만 계정 정보를 수정할 수 있습니다.",
      });
    }

    // 본인이 수정할 때는 관리 전용 필드(status, roleLevel, rank, 직무대리 등) 차단
    if (isSelf && !isSuperAdmin && !isSecretariat) {
      const adminOnlyFields = [
        "status", "roleLevel", "rank", "dept",
        "dualRoleLevel", "dualDept", "actingTitle", "actingStart", "actingEnd",
        "delegateTo", "delegateReason", "dualSecretariatWork",
        "isAutoAssignExcluded", "canArbitraryApprove",
      ];
      const forbidden = adminOnlyFields.filter((f) => req.body[f] !== undefined);
      if (forbidden.length > 0) {
        return res.status(403).json({
          success: false,
          message: `다음 필드는 관리자만 변경할 수 있습니다: ${forbidden.join(", ")}`,
        });
      }
    }

    // 사무국/관리자 경로는 기존 requireProsecutorAccountManager 로직 적용
    if (!isSelf || isSuperAdmin || isSecretariat) {
      return requireProsecutorAccountManager(req, res, next);
    }
    next();
  },
  async (req, res) => {
    const allowedFields = {
      status: "status",
      dept: "dept",
      roleLevel: "role_level",
      rank: "rank",
      delegateTo: "delegate_to",
      delegateReason: "delegate_reason",
      dualPosition: "dual_position",
      dualDept: "dual_dept",
      dualRoleLevel: "dual_role_level",
      actingTitle: "acting_title",
      actingStart: "acting_start",
      actingEnd: "acting_end",
      dualSecretariatWork: "dual_secretariat_work",
      isAutoAssignExcluded: "is_auto_assign_excluded",
      canArbitraryApprove: "can_arbitrary_approve",
      position: "position",
      title: "title",
      discordId: "discord_id",
      note: "note",
    };
    const updates = Object.entries(allowedFields)
      .filter(([field]) => req.body[field] !== undefined)
      .map(([field, column]) => ({ column, value: req.body[field] }));
    const allowedRoleLevels = new Set([
      "PROSECUTOR_GENERAL",
      "CHIEF_PROSECUTOR",
      "DEPUTY_CHIEF",
      "CHIEF_ADMINISTRATOR",
      "SENIOR_PROSECUTOR",
      "PROSECUTOR",
      "PROBATIONARY",
      "ADMINISTRATOR",
      "ADMIN_PROBATIONARY",
    ]);
    if (
      req.body.roleLevel !== undefined &&
      !allowedRoleLevels.has(req.body.roleLevel)
    ) {
      return res
        .status(400)
        .json({ success: false, message: "허용되지 않는 직급입니다." });
    }
    const canManageAnyRole =
      req.user.isSuperAdmin ||
      hasSecretariatWorkAccess(req.user) ||
      TOP_ROLE_MANAGERS.has(effectiveRoleLevel(req.user));
    if (
      (req.body.roleLevel !== undefined || req.body.rank !== undefined) &&
      !canManageAnyRole &&
      !(
        req.params.id === req.user.id &&
        SELF_ROLE_CHANGE_ROLES.has(effectiveRoleLevel(req.user))
      )
    ) {
      return res
        .status(403)
        .json({ success: false, message: "승진·직급 변경 권한이 필요합니다." });
    }
    const canChangeOwnRole =
      // 직무대리 권한(effectiveRoleLevel)이 아닌 실제 roleLevel만 기준으로 판단
      // — 직무대리로 임시 승격된 상태에서 본계정을 영구 승격하는 것을 방지
      req.user.isSuperAdmin || SELF_ROLE_CHANGE_ROLES.has(req.user.roleLevel);
    if (
      (req.body.roleLevel !== undefined || req.body.rank !== undefined) &&
      req.params.id === req.user.id &&
      !canChangeOwnRole
    ) {
      return res.status(403).json({
        success: false,
        message: "본인 계정의 직급은 변경할 수 없습니다.",
      });
    }
    if (req.body.roleLevel !== undefined) {
      const actorAuthority = req.user.isSuperAdmin
        ? ROLE_AUTHORITY.SUPER_ADMIN
        : ROLE_AUTHORITY[effectiveRoleLevel(req.user)] || 0;
      const targetAuthority = ROLE_AUTHORITY[req.body.roleLevel] || 0;
      if (
        !targetAuthority ||
        (!canManageAnyRole &&
          !(req.params.id === req.user.id && canChangeOwnRole) &&
          targetAuthority > actorAuthority)
      ) {
        return res.status(403).json({
          success: false,
          message: "본인보다 높은 권한으로 계정을 승격할 수 없습니다.",
        });
      }
    }
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
      await writeAuditLog({
        action: "UPDATE",
        entityType: "prosecutor",
        entityId: req.params.id,
        entityLabel: req.params.id,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `계정 상태 및 권한 변경: ${updates.map(({ column }) => column).join(", ")}`,
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
app.post("/api/auth/register", authRateLimit, asyncWrap(async (req, res) => {
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
    const isBootstrap = (() => {
      if (Number(accountCount.rows[0]?.count || 0) !== 0) return false;
      if (!process.env.BOOTSTRAP_SECRET || !bootstrapSecret) return false;
      try {
        // 타이밍 공격 방지: 상수 시간 비교
        const a = Buffer.from(String(bootstrapSecret));
        const b = Buffer.from(String(process.env.BOOTSTRAP_SECRET));
        // 길이가 다르면 timingSafeEqual이 throw하므로 미리 false 반환
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
app.get("/api/registrations", requireAuth, asyncWrap(async (req, res) => {
  // 직무대리 권한 포함 검찰사무국 접근 가능 직급 체크
  const isSecretariat =
    SECRETARIAT_ROLES.has(effectiveRoleLevel(req.user)) ||
    hasSecretariatWorkAccess(req.user);

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
    // requireSecretariat 미들웨어가 이미 effectiveRoleLevel 기반으로 검증하므로
    // 이중 체크도 동일 방식으로 통일
    const isSecretariat =
      SECRETARIAT_ROLES.has(effectiveRoleLevel(req.user)) ||
      hasSecretariatWorkAccess(req.user);

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

      await writeAuditLog({
        action: "CREATE",
        entityType: "prosecutor",
        entityId: reg.reqId,
        entityLabel: `${reg.name} (${reg.reqId})`,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: "가입 신청 허가 및 검사 계정 등록",
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
app.put("/api/registrations/:id/reject", requireAuth, asyncWrap(async (req, res) => {
  const isSecretariat =
    SECRETARIAT_ROLES.has(effectiveRoleLevel(req.user)) ||
    hasSecretariatWorkAccess(req.user);

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
  const ok =
    SECRETARIAT_ROLES.has(effectiveRoleLevel(req.user)) ||
    hasSecretariatWorkAccess(req.user);
  if (!ok) {
    return res
      .status(403)
      .json({ success: false, message: "검찰사무국 권한이 필요합니다." });
  }
  next();
}

function requireLoginRecordAccess(req, res, next) {
  const role = effectiveRoleLevel(req.user);
  const allowed =
    req.user.isSuperAdmin ||
    MANAGEMENT_ROLE_LEVELS.has(role) ||
    hasSecretariatWorkAccess(req.user) ||
    role === "CHIEF_PROSECUTOR" ||
    role === "PROSECUTOR_GENERAL";
  if (!allowed) {
    return res.status(403).json({
      success: false,
      message: "관리용 계정 또는 검사장 이상만 감사 로그를 조회할 수 있습니다.",
    });
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
            // case_memos 연쇄 삭제 (사건 ID 기준)
            {
              sql: "UPDATE case_memos SET deleted_at = ? WHERE case_id = ? AND deleted_at = ''",
              args: [deletedAt, id],
            },
            // case_history 연쇄 삭제 (사건 ID 기준)
            {
              sql: "UPDATE case_history SET deleted_at = ? WHERE case_id = ? AND deleted_at = ''",
              args: [deletedAt, id],
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
        actorName: req.user.name,
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
      const existing = await db.execute({
        sql: "SELECT appeal_no, suspect_name FROM appeals WHERE id = ? AND deleted_at = ''",
        args: [req.params.id],
      });
      await db.execute({
        sql: "UPDATE appeals SET deleted_at = ? WHERE id = ? AND deleted_at = ''",
        args: [new Date().toISOString(), req.params.id],
      });
      const label = existing.rows[0]?.appeal_no || req.params.id;
      await writeAuditLog({
        action: "DELETE",
        entityType: "appeal",
        entityId: req.params.id,
        entityLabel: label,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `항고 삭제: ${label} (피의자: ${existing.rows[0]?.suspect_name || "-"})`,
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[DELETE /appeals]", err);
      res.status(500).json({ success: false, message: "서버 오류가 발생했습니다." });
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
      const existing = await db.execute({
        sql: "SELECT doc_no, doc_type_name FROM approvals WHERE id = ? AND deleted_at = ''",
        args: [req.params.id],
      });
      await db.execute({
        sql: "UPDATE approvals SET deleted_at = ? WHERE id = ? AND deleted_at = ''",
        args: [new Date().toISOString(), req.params.id],
      });
      const label = existing.rows[0]?.doc_no || req.params.id;
      await writeAuditLog({
        action: "DELETE",
        entityType: "approval",
        entityId: req.params.id,
        entityLabel: label,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `결재 문서 삭제: ${label} (${existing.rows[0]?.doc_type_name || "-"})`,
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[DELETE /approvals]", err);
      res.status(500).json({ success: false, message: "서버 오류가 발생했습니다." });
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
      const existing = await db.execute({
        sql: "SELECT report_no, suspect_name FROM reports WHERE id = ? AND deleted_at = ''",
        args: [req.params.id],
      });
      await db.execute({
        sql: "UPDATE reports SET deleted_at = ? WHERE id = ? AND deleted_at = ''",
        args: [new Date().toISOString(), req.params.id],
      });
      const label = existing.rows[0]?.report_no || req.params.id;
      await writeAuditLog({
        action: "DELETE",
        entityType: "report",
        entityId: req.params.id,
        entityLabel: label,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `입건 보고서 삭제: ${label} (피의자: ${existing.rows[0]?.suspect_name || "-"})`,
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[DELETE /reports]", err);
      res.status(500).json({ success: false, message: "서버 오류가 발생했습니다." });
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
      const existing = await db.execute({
        sql: "SELECT hyeongje_no, suspect_name FROM bookings WHERE id = ? AND deleted_at = ''",
        args: [req.params.id],
      });
      await db.execute({
        sql: "UPDATE bookings SET deleted_at = ? WHERE id = ? AND deleted_at = ''",
        args: [new Date().toISOString(), req.params.id],
      });
      const label = existing.rows[0]?.hyeongje_no || req.params.id;
      await writeAuditLog({
        action: "DELETE",
        entityType: "booking",
        entityId: req.params.id,
        entityLabel: label,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `입건 기록 삭제: ${label} (피의자: ${existing.rows[0]?.suspect_name || "-"})`,
      });
      res.json({ success: true });
    } catch (err) {
      console.error("[DELETE /bookings]", err);
      res.status(500).json({ success: false, message: "서버 오류가 발생했습니다." });
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
      const existing = await db.execute({
        sql: "SELECT name, role_level FROM prosecutors WHERE id = ?",
        args: [id],
      });
      await db.execute({
        sql: "DELETE FROM prosecutors WHERE id = ?",
        args: [id],
      });
      const label = existing.rows[0]?.name || id;
      await writeAuditLog({
        action: "DELETE",
        entityType: "prosecutor",
        entityId: id,
        entityLabel: label,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `검사 계정 삭제: ${label} (${existing.rows[0]?.role_level || "-"})`,
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
app.patch("/api/prosecutors/:id/password", requireAuth, asyncWrap(async (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body || {};
  const isSelf = req.user.id === id;
  const isSuperAdmin = req.user.isSuperAdmin;

  // 본인도 아니고 SUPER_ADMIN도 아니면 즉시 거부
  // (hasGlobalDataAccess는 DEPUTY_CHIEF까지 포함하므로 사용하지 않음)
  if (!isSelf && !isSuperAdmin) {
    return res.status(403).json({
      success: false,
      message: "본인 계정의 비밀번호만 변경할 수 있습니다.",
    });
  }

  if (!newPassword || newPassword.length < 10) {
    return res
      .status(400)
      .json({ success: false, message: "비밀번호는 10자 이상이어야 합니다." });
  }

  try {
    const account = await db.execute({
      sql: "SELECT password FROM prosecutors WHERE id = ?",
      args: [id],
    });
    if (account.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "계정을 찾을 수 없습니다." });
    }

    // 본인 변경: 현재 비밀번호 반드시 검증
    if (isSelf) {
      if (!currentPassword) {
        return res
          .status(400)
          .json({ success: false, message: "현재 비밀번호가 필요합니다." });
      }
      const storedPassword = account.rows[0].password;
      if (!(await bcrypt.compare(currentPassword, storedPassword))) {
        return res.status(401).json({
          success: false,
          message: "현재 비밀번호가 일치하지 않습니다.",
        });
      }
    }
    // SUPER_ADMIN에 의한 강제 재설정: currentPassword 불필요, 감사 로그 기록

    const hashed = await bcrypt.hash(newPassword, 12);
    await db.execute({
      sql: "UPDATE prosecutors SET password = ? WHERE id = ?",
      args: [hashed, id],
    });

    if (!isSelf) {
      await writeAuditLog({
        action: "UPDATE",
        entityType: "prosecutor",
        entityId: id,
        entityLabel: id,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: "SUPER_ADMIN에 의한 비밀번호 강제 재설정",
      });
    }

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

// GET /api/audit-logs — 최근 500건 (사무국·검사장 이상)
app.get(
  "/api/audit-logs",
  requireAuth,
  requireLoginRecordAccess,
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

// GET /api/case-history — 전체 원부 수정 이력 최근 500건 (사무국·검사장 이상)
app.get(
  "/api/case-history",
  requireAuth,
  requireLoginRecordAccess,
  async (req, res) => {
    try {
      const result = await db.execute(
        `SELECT * FROM case_history WHERE deleted_at = '' ORDER BY created_at DESC LIMIT 500`,
      );
      res.json(result.rows.map(toCamel));
    } catch (err) {
      console.error("[GET /case-history]", err);
      res.status(500).json({ success: false, message: "서버 오류" });
    }
  },
);

app.post(
  "/api/audit-logs",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    const {
      action,
      entityType = "system",
      entityId = "",
      entityLabel = "",
      detail = "",
    } = req.body || {};
    const allowedActions = new Set([
      "CREATE",
      "UPDATE",
      "DELETE",
      "APPROVE",
      "REJECT",
      "LOGIN",
      "LOGOUT",
    ]);
    const allowedEntityTypes = new Set([
      "case", "report", "appeal", "booking", "approval",
      "prosecutor", "system", "warrant", "evidence",
    ]);
    if (!allowedActions.has(action)) {
      return res.status(400).json({
        success: false,
        message: "감사 로그 행위가 올바르지 않습니다.",
      });
    }
    if (!allowedEntityTypes.has(entityType)) {
      return res.status(400).json({
        success: false,
        message: "허용되지 않는 엔티티 타입입니다.",
      });
    }
    // 길이 제한으로 DB 오염 방지
    const safeEntityId    = String(entityId).slice(0, 200);
    const safeEntityLabel = String(entityLabel).slice(0, 200);
    const safeDetail      = String(detail).slice(0, 1000);
    try {
      const id = `AL-${Date.now()}-${randomUUID().slice(0, 6)}`;
      const now = new Date().toISOString().replace("T", " ").substring(0, 19);
      await db.execute({
        sql: `INSERT INTO audit_logs (id, action, entity_type, entity_id, entity_label, actor_id, actor_name, detail, created_at)
              VALUES (?,?,?,?,?,?,?,?,?)`,
        args: [
          id,
          action,
          entityType,
          safeEntityId,
          safeEntityLabel,
          req.user.id,
          req.user.name,
          safeDetail,
          now,
        ],
      });
      res.json({
        success: true,
        log: {
          id,
          action,
          entityType,
          entityId: safeEntityId,
          entityLabel: safeEntityLabel,
          actorId: req.user.id,
          actorName: req.user.name,
          detail: safeDetail,
          createdAt: now,
        },
      });
    } catch (err) {
      console.error("[POST /audit-logs]", err);
      res
        .status(500)
        .json({ success: false, message: "감사 로그 저장에 실패했습니다." });
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

app.get("/api/cases/:caseNo/evidence", requireAuth, asyncWrap(async (req, res) => {
  try {
    const caseItem = await findCaseForEvidence(req.params.caseNo, req.user);
    if (!caseItem)
      return res.status(403).json({
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

app.post("/api/cases/:caseNo/evidence", requireAuth, asyncWrap(async (req, res) => {
  const { title = "", url = "", type = "DOCUMENT", record = "" } = req.body;
  const urlTrimmed = String(url).trim();
  const urlError = validateEvidenceUrl(urlTrimmed);
  if (urlError) {
    return res.status(400).json({ success: false, message: urlError });
  }
  try {
    const caseItem = await findCaseForEvidence(req.params.caseNo, req.user);
    if (!caseItem)
      return res.status(403).json({
        success: false,
        message: "해당 사건에 접근할 권한이 없습니다.",
      });
    // 사건당 증거자료 건수 제한
    const countRes = await db.execute({
      sql: "SELECT COUNT(*) AS cnt FROM evidence WHERE case_no = ? AND deleted_at = ''",
      args: [req.params.caseNo],
    });
    if (Number(countRes.rows[0]?.cnt || 0) >= EVIDENCE_MAX_PER_CASE) {
      return res.status(400).json({
        success: false,
        message: `사건당 증거자료는 최대 ${EVIDENCE_MAX_PER_CASE}건까지 등록할 수 있습니다.`,
      });
    }
    const id = `EVD-${Date.now()}-${randomUUID().slice(0, 7)}`;
    const now = new Date().toISOString();
    await db.execute({
      sql: `INSERT INTO evidence (id, case_no, title, url, evidence_type, record, created_by, created_at, deleted_at)
            VALUES (?,?,?,?,?,?,?,?,'')`,
      args: [
        id,
        req.params.caseNo,
        title.trim() || "증거 자료",
        urlTrimmed,
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
        url: urlTrimmed,
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
        : `SELECT e.case_no FROM evidence e JOIN cases c ON c.hyeongje_no = e.case_no OR c.suje_no = e.case_no
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

app.patch("/api/evidence/:id", requireAuth, asyncWrap(async (req, res) => {
  const { url } = req.body || {};
  if (url !== undefined) {
    const urlTrimmed = String(url).trim();
    const urlError = validateEvidenceUrl(urlTrimmed);
    if (urlError) {
      return res.status(400).json({ success: false, message: urlError });
    }
  }
  try {
    const result = await db.execute({
      sql: hasGlobalDataAccess(req.user)
        ? "SELECT case_no FROM evidence WHERE id = ? AND deleted_at = ''"
        : `SELECT e.case_no FROM evidence e JOIN cases c ON c.hyeongje_no = e.case_no OR c.suje_no = e.case_no
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
        actorName: req.user.name,
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
    // timestamp 제거 — 서버 시간 노출로 타이밍 공격에 활용될 수 있음
    res.json({ status: "ok" });
  } catch (err) {
    console.error("[GET /health]", err.message);
    res.status(503).json({ status: "error" });
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

// ════════════════════════════════════════════════════════════════════
// 15. 사건 메모 (Case Memos)
// ════════════════════════════════════════════════════════════════════

// GET /api/cases/:id/memos — 해당 사건 메모 목록
app.get("/api/cases/:id/memos", requireAuth, requireCaseScope, async (req, res) => {
  try {
    const result = await db.execute({
      sql: "SELECT * FROM case_memos WHERE case_id = ? AND deleted_at = '' ORDER BY created_at ASC",
      args: [req.params.id],
    });
    const rows = result.rows.map(toCamel);
    // 비공개 메모: 작성자 본인 또는 전역 관리자만 포함
    const filtered = rows.filter(
      (m) =>
        !m.isPrivate ||
        m.authorId === req.user.id ||
        hasGlobalDataAccess(req.user),
    );
    res.json(filtered);
  } catch (err) {
    console.error("[GET /cases/memos]", err);
    res.status(500).json({ success: false, message: "서버 오류" });
  }
});

// POST /api/cases/:id/memos — 메모 작성
app.post("/api/cases/:id/memos", requireAuth, requireCaseScope, async (req, res) => {
  const content = String(req.body?.content || "").trim();
  const isPrivate = req.body?.isPrivate ? 1 : 0;
  if (!content || content.length > 2000) {
    return res
      .status(400)
      .json({ success: false, message: "메모 내용은 1~2000자여야 합니다." });
  }
  try {
    // requireCaseScope가 이미 사건 존재·접근 권한을 검증했으므로 형제번호만 조회
    const caseRes = await db.execute({
      sql: "SELECT hyeongje_no FROM cases WHERE id = ? AND deleted_at = ''",
      args: [req.params.id],
    });
    const hyeongjeNo = toCamel(caseRes.rows[0] || {}).hyeongjeNo || "";
    const id = `MEMO-${Date.now()}-${randomUUID().slice(0, 6)}`;
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);
    await db.execute({
      sql: `INSERT INTO case_memos (id, case_id, hyeongje_no, author_id, author_name, content, is_private, created_at, deleted_at)
            VALUES (?,?,?,?,?,?,?,?,'')`,
      args: [
        id,
        req.params.id,
        hyeongjeNo,
        req.user.id,
        req.user.name,
        content,
        isPrivate,
        now,
      ],
    });
    res.json({
      success: true,
      memo: {
        id,
        caseId: req.params.id,
        hyeongjeNo,
        authorId: req.user.id,
        authorName: req.user.name,
        content,
        isPrivate,
        createdAt: now,
      },
    });
  } catch (err) {
    console.error("[POST /cases/memos]", err);
    res.status(500).json({ success: false, message: "서버 오류" });
  }
});

// DELETE /api/cases/:id/memos/:memoId — 메모 삭제
app.delete("/api/cases/:id/memos/:memoId", requireAuth, async (req, res) => {
  try {
    const result = await db.execute({
      sql: "SELECT author_id FROM case_memos WHERE id = ? AND case_id = ? AND deleted_at = ''",
      args: [req.params.memoId, req.params.id],
    });
    if (!result.rows.length) {
      return res
        .status(404)
        .json({ success: false, message: "메모를 찾을 수 없습니다." });
    }
    const memo = toCamel(result.rows[0]);
    // 본인 또는 사무국만 삭제 가능
    if (
      memo.authorId !== req.user.id &&
      !hasGlobalDataAccess(req.user) &&
      !hasSecretariatWorkAccess(req.user)
    ) {
      return res
        .status(403)
        .json({ success: false, message: "본인 메모만 삭제할 수 있습니다." });
    }
    await db.execute({
      sql: "UPDATE case_memos SET deleted_at = ? WHERE id = ?",
      args: [new Date().toISOString(), req.params.memoId],
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /cases/memos]", err);
    res.status(500).json({ success: false, message: "서버 오류" });
  }
});

// ════════════════════════════════════════════════════════════════════
// 16. 피의자 통합 프로필 (Suspect Profile)
// ════════════════════════════════════════════════════════════════════

// GET /api/suspects/:uuid/profile
app.get("/api/suspects/:uuid/profile", requireAuth, async (req, res) => {
  const { uuid } = req.params;
  if (!uuid || uuid.length < 4) {
    return res
      .status(400)
      .json({ success: false, message: "유효한 UUID를 입력해주세요." });
  }
  try {
    const [casesRes, bookingsRes, appealsRes, warrantsRes] = await Promise.all([
      db.execute({
        sql: hasGlobalDataAccess(req.user)
          ? "SELECT * FROM cases WHERE suspect_uuid = ? AND deleted_at = '' ORDER BY rowid DESC"
          : `SELECT c.* FROM cases c JOIN prosecutors p ON c.prosecutor_id = p.id
             WHERE c.suspect_uuid = ? AND c.deleted_at = ''
               AND (c.visibility = 'PUBLIC' OR c.prosecutor_id = ? OR c.created_by = ?
                 OR (c.visibility = 'PUBLIC' AND (
                   c.disposition LIKE '%불기소%' OR c.disposition LIKE '%종국%' OR
                   c.disposition LIKE '%기소유예%' OR c.disposition LIKE '%혐의없음%' OR
                   c.disposition LIKE '%무혐의%' OR c.disposition LIKE '%죄가안됨%' OR
                   c.disposition LIKE '%공소권없음%' OR c.disposition LIKE '%각하%' OR
                   c.disposition LIKE '%기소중지%' OR c.disposition LIKE '%타관송치%' OR
                   c.disposition LIKE '%처분완료%' OR c.disposition LIKE '%구속기소%' OR
                   c.disposition LIKE '%불구속기소%' OR c.disposition LIKE '%약식기소%' OR
                   c.disposition LIKE '%구공판%'
                 )))
             ORDER BY c.rowid DESC`,
        args: hasGlobalDataAccess(req.user)
          ? [uuid]
          : [uuid, req.user.id, req.user.id],
      }),
      db.execute({
        // 전역 접근 계정: 전체 조회
        // 일반 계정: 본인 부서 담당 입건 기록 OR 종결된 처분(공개 처분 키워드)은 부서 무관 열람
        sql: hasGlobalDataAccess(req.user)
          ? "SELECT * FROM bookings WHERE suspect_uuid = ? ORDER BY rowid DESC"
          : `SELECT b.* FROM bookings b
             LEFT JOIN cases c ON c.hyeongje_no = b.hyeongje_no AND c.deleted_at = ''
             LEFT JOIN prosecutors p ON c.prosecutor_id = p.id
             WHERE b.suspect_uuid = ?
               AND (
                 p.dept = (SELECT dept FROM prosecutors WHERE id = ?)
                 OR b.disposition_status LIKE '%불기소%'
                 OR b.disposition_status LIKE '%혐의없음%'
                 OR b.disposition_status LIKE '%무혐의%'
                 OR b.disposition_status LIKE '%기소유예%'
                 OR b.disposition_status LIKE '%공소권없음%'
                 OR b.disposition_status LIKE '%죄가안됨%'
                 OR b.disposition_status LIKE '%각하%'
                 OR b.disposition_status LIKE '%기소중지%'
                 OR b.disposition_status LIKE '%타관송치%'
                 OR b.disposition_status LIKE '%처분완료%'
                 OR b.disposition_status LIKE '%구속기소%'
                 OR b.disposition_status LIKE '%불구속기소%'
                 OR b.disposition_status LIKE '%약식기소%'
                 OR b.disposition_status LIKE '%구공판%'
                 OR b.indictment_decision LIKE '%종국%'
               )
             ORDER BY b.rowid DESC`,
        args: hasGlobalDataAccess(req.user)
          ? [uuid]
          : [uuid, req.user.id],
      }),
      db.execute({
        sql: hasGlobalDataAccess(req.user)
          ? "SELECT * FROM appeals WHERE suspect_uuid = ? AND deleted_at = '' ORDER BY rowid DESC"
          : `SELECT ap.* FROM appeals ap JOIN prosecutors p ON ap.prosecutor_name = p.name
             WHERE ap.suspect_uuid = ? AND ap.deleted_at = ''
               AND p.dept = (SELECT dept FROM prosecutors WHERE id = ?)
             ORDER BY ap.rowid DESC`,
        args: hasGlobalDataAccess(req.user)
          ? [uuid]
          : [uuid, req.user.id],
      }),
      db.execute({
        sql: hasGlobalDataAccess(req.user)
          ? "SELECT * FROM warrants WHERE suspect_uuid = ? AND deleted_at = '' ORDER BY rowid DESC"
          : `SELECT w.* FROM warrants w JOIN prosecutors p ON w.prosecutor_name = p.name
             WHERE w.suspect_uuid = ? AND w.deleted_at = ''
               AND p.dept = (SELECT dept FROM prosecutors WHERE id = ?)
             ORDER BY w.rowid DESC`,
        args: hasGlobalDataAccess(req.user)
          ? [uuid]
          : [uuid, req.user.id],
      }),
    ]);

    const cases = casesRes.rows.map(toCamel);
    const bookings = bookingsRes.rows.map(toCamel);
    const appeals = appealsRes.rows.map(toCamel);
    const warrants = warrantsRes.rows.map(toCamel);

    // 처분 통계 집계
    const dispositionStats = {};
    cases.forEach((c) => {
      const d = (c.disposition || "수사중").split(" ")[0];
      dispositionStats[d] = (dispositionStats[d] || 0) + 1;
    });

    // 대표 피의자명 (가장 최근 사건에서)
    const suspectName =
      cases[0]?.suspectName ||
      bookings[0]?.suspectName ||
      appeals[0]?.suspectName ||
      "알 수 없음";

    res.json({
      uuid,
      suspectName,
      stats: {
        totalCases: cases.length,
        totalBookings: bookings.length,
        totalAppeals: appeals.length,
        totalWarrants: warrants.length,
        indicted: cases.filter(
          (c) =>
            (c.disposition || "").includes("기소") ||
            (c.disposition || "").includes("구공판"),
        ).length,
        nonIndicted: cases.filter((c) =>
          [
            "불기소",
            "혐의없음",
            "죄가안됨",
            "기소유예",
            "각하",
            "공소권없음",
          ].some((k) => (c.disposition || "").includes(k)),
        ).length,
        pending: cases.filter(
          (c) =>
            !(c.disposition || "") ||
            (c.disposition || "").includes("수사") ||
            (c.disposition || "").includes("진행"),
        ).length,
        dispositionStats,
      },
      cases,
      bookings,
      appeals,
      warrants,
    });
  } catch (err) {
    console.error("[GET /suspects/profile]", err);
    res.status(500).json({ success: false, message: "서버 오류" });
  }
});

// ════════════════════════════════════════════════════════════════════
// 17. 사건 일괄 재배당 (Bulk Reassign)
// ════════════════════════════════════════════════════════════════════

app.post(
  "/api/cases/bulk-reassign",
  requireAuth,
  requireSecretariat,
  async (req, res) => {
    const {
      caseIds,
      toProsecutorId,
      toProsecutorName,
      reason = "사무국 일괄 재배당",
    } = req.body || {};

    if (!Array.isArray(caseIds) || caseIds.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "재배당할 사건 목록이 없습니다." });
    }
    if (caseIds.length > 100) {
      return res
        .status(400)
        .json({ success: false, message: "한 번에 최대 100건까지 재배당할 수 있습니다." });
    }
    if (!toProsecutorId || !toProsecutorName) {
      return res
        .status(400)
        .json({ success: false, message: "새 담당검사를 선택해주세요." });
    }

    // 새 담당검사 유효성 검증
    if (!(await validateForcedCaseAssignee(toProsecutorId))) {
      return res.status(400).json({
        success: false,
        message: "활성 상태의 담당검사(사무국 외)를 선택해주세요.",
      });
    }

    try {
      const now = new Date().toISOString().replace("T", " ").substring(0, 19);
      const safeCaseIds = caseIds
        .map((id) => String(id).trim())
        .filter(Boolean)
        .slice(0, 100);

      // 기존 담당검사 정보 조회 (이력 기록용)
      const existingRes = await db.execute({
        sql: `SELECT id, hyeongje_no, prosecutor_id, prosecutor_name FROM cases
              WHERE id IN (${safeCaseIds.map(() => "?").join(",")}) AND deleted_at = ''`,
        args: safeCaseIds,
      });
      const existingCases = existingRes.rows.map(toCamel);

      // 일괄 UPDATE
      await db.batch(
        safeCaseIds.map((id) => ({
          sql: "UPDATE cases SET prosecutor_id = ?, prosecutor_name = ? WHERE id = ? AND deleted_at = ''",
          args: [toProsecutorId, toProsecutorName, id],
        })),
        "write",
      );

      // case_history 일괄 기록
      const historyInserts = existingCases
        .filter(
          (c) =>
            c.prosecutorId !== toProsecutorId ||
            c.prosecutorName !== toProsecutorName,
        )
        .map((c) => ({
          sql: `INSERT INTO case_history (id, case_id, hyeongje_no, actor_id, actor_name, field_name, old_value, new_value, created_at)
                VALUES (?,?,?,?,?,?,?,?,?)`,
          args: [
            `CH-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            c.id,
            c.hyeongjeNo || "",
            req.user.id,
            req.user.name,
            "담당검사",
            c.prosecutorName || "",
            toProsecutorName,
            now,
          ],
        }));

      if (historyInserts.length > 0) {
        await db.batch(historyInserts, "write");
      }

      // 감사 로그 1건
      await writeAuditLog({
        action: "UPDATE",
        entityType: "case",
        entityId: safeCaseIds.join(","),
        entityLabel: `일괄 재배당 ${safeCaseIds.length}건`,
        actorId: req.user.id,
        actorName: req.user.name,
        detail: `→ ${toProsecutorName} (${toProsecutorId}), 사유: ${reason}`,
      });

      res.json({
        success: true,
        updatedCount: existingCases.length,
        toProsecutorId,
        toProsecutorName,
      });
    } catch (err) {
      console.error("[POST /cases/bulk-reassign]", err);
      res
        .status(500)
        .json({ success: false, message: "일괄 재배당 중 오류가 발생했습니다." });
    }
  },
);

// ════════════════════════════════════════════════════════════════════
// 18. 결재선 템플릿 (Approval Templates)
// ════════════════════════════════════════════════════════════════════

// GET /api/approval-templates — 본인 + 공유 템플릿 목록
app.get("/api/approval-templates", requireAuth, async (req, res) => {
  try {
    const result = await db.execute({
      sql: `SELECT * FROM approval_templates
            WHERE deleted_at = '' AND (created_by = ? OR is_shared = 1)
            ORDER BY created_at DESC`,
      args: [req.user.id],
    });
    res.json(
      result.rows.map((row) => ({
        ...toCamel(row),
        steps: parseJsonArray(row.steps_json),
      })),
    );
  } catch (err) {
    console.error("[GET /approval-templates]", err);
    res.status(500).json({ success: false, message: "서버 오류" });
  }
});

// POST /api/approval-templates — 템플릿 생성
app.post("/api/approval-templates", requireAuth, async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const description = String(req.body?.description || "").trim();
  const steps = req.body?.steps;
  const isShared = req.body?.isShared ? 1 : 0;

  if (!name || name.length > 80) {
    return res
      .status(400)
      .json({ success: false, message: "템플릿 이름은 1~80자여야 합니다." });
  }
  if (!Array.isArray(steps) || steps.length === 0 || steps.length > 10) {
    return res
      .status(400)
      .json({ success: false, message: "결재 단계는 1~10개여야 합니다." });
  }

  try {
    const id = `TPL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const now = new Date().toISOString().replace("T", " ").substring(0, 19);
    await db.execute({
      sql: `INSERT INTO approval_templates (id, name, description, steps_json, created_by, is_shared, dept, created_at, deleted_at)
            VALUES (?,?,?,?,?,?,?,?,'')`,
      args: [
        id,
        name,
        description,
        JSON.stringify(steps),
        req.user.id,
        isShared,
        req.user.dept || "",
        now,
      ],
    });
    res.json({
      success: true,
      template: {
        id,
        name,
        description,
        steps,
        createdBy: req.user.id,
        isShared,
        dept: req.user.dept || "",
        createdAt: now,
      },
    });
  } catch (err) {
    console.error("[POST /approval-templates]", err);
    res.status(500).json({ success: false, message: "서버 오류" });
  }
});

// DELETE /api/approval-templates/:id — 본인 생성 템플릿 삭제
app.delete("/api/approval-templates/:id", requireAuth, async (req, res) => {
  try {
    const result = await db.execute({
      sql: "SELECT created_by FROM approval_templates WHERE id = ? AND deleted_at = ''",
      args: [req.params.id],
    });
    if (!result.rows.length) {
      return res
        .status(404)
        .json({ success: false, message: "템플릿을 찾을 수 없습니다." });
    }
    const row = toCamel(result.rows[0]);
    if (row.createdBy !== req.user.id && !hasGlobalDataAccess(req.user)) {
      return res
        .status(403)
        .json({ success: false, message: "본인이 만든 템플릿만 삭제할 수 있습니다." });
    }
    await db.execute({
      sql: "UPDATE approval_templates SET deleted_at = ? WHERE id = ?",
      args: [new Date().toISOString(), req.params.id],
    });
    res.json({ success: true });
  } catch (err) {
    console.error("[DELETE /approval-templates]", err);
    res.status(500).json({ success: false, message: "서버 오류" });
  }
});

// ── 정적 파일 서빙 (프로덕션) ────────────────────────────────────────
const distPath = join(__dirname, "..", "dist");
app.use(express.static(distPath));

// API 라우트가 아닌 모든 요청은 index.html로 (SPA 라우팅)
app.get("/{*splat}", (req, res) => {
  res.sendFile(join(distPath, "index.html"));
});

// ════════════════════════════════════════════════════════════════════
// 자동보존 설정 API (GET / PATCH /api/settings/auto-archive)
// ════════════════════════════════════════════════════════════════════
app.get("/api/settings/auto-archive", requireAuth, requireSecretariat, async (req, res) => {
  const result = await db.execute({
    sql: "SELECT key, value FROM system_settings WHERE key IN ('auto_archive_enabled', 'auto_archive_days')",
    args: [],
  });
  const settings = {};
  for (const row of result.rows) {
    settings[row.key] = row.value;
  }
  res.json({
    enabled: settings["auto_archive_enabled"] !== "0",
    days: Number(settings["auto_archive_days"] || 7),
  });
});

app.patch("/api/settings/auto-archive", requireAuth, requireSecretariat, async (req, res) => {
  const { enabled, days } = req.body;
  if (enabled !== undefined) {
    await db.execute({
      sql: "UPDATE system_settings SET value=?, updated_at=datetime('now'), updated_by=? WHERE key='auto_archive_enabled'",
      args: [enabled ? "1" : "0", req.user.name],
    });
  }
  if (days !== undefined) {
    const d = Math.max(1, Math.floor(Number(days)));
    await db.execute({
      sql: "UPDATE system_settings SET value=?, updated_at=datetime('now'), updated_by=? WHERE key='auto_archive_days'",
      args: [String(d), req.user.name],
    });
  }
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════════
// 불기소 자동보존 스케줄러
// 불기소처분 후 설정된 기간(auto_archive_days) 동안 항고가 없으면 자동 보존.
// 서버 시작 후 1분 뒤 최초 실행, 이후 1시간마다 반복.
// ════════════════════════════════════════════════════════════════════
const NON_INDICT_KEYWORDS = ["불기소", "혐의없음", "무혐의", "기소유예", "공소권없음", "기소중지", "죄가안됨"];

function isNonIndictDisposition(disposition) {
  if (!disposition) return false;
  return NON_INDICT_KEYWORDS.some((kw) => disposition.includes(kw));
}

async function runAutoArchiveScheduler() {
  try {
    // 설정 조회
    const settingRows = await db.execute({
      sql: "SELECT key, value FROM system_settings WHERE key IN ('auto_archive_enabled', 'auto_archive_days')",
      args: [],
    });
    const settings = {};
    for (const row of settingRows.rows) settings[row.key] = row.value;

    if (settings["auto_archive_enabled"] === "0") return; // 비활성화

    const days = Math.max(1, Number(settings["auto_archive_days"] || 7));
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().replace("T", " ").substring(0, 19);

    // 불기소 처분이며 아직 보존되지 않은 사건 조회
    const casesResult = await db.execute({
      sql: `SELECT id, hyeongje_no, suje_no, disposition, created_at
            FROM cases
            WHERE is_archived = 0
              AND deleted_at = ''
              AND created_at <= ?`,
      args: [cutoffStr],
    });

    let archivedCount = 0;
    for (const row of casesResult.rows) {
      const c = toCamel(row);
      if (!isNonIndictDisposition(c.disposition)) continue;

      // 항고 접수 여부 확인 (hyeongje_no 또는 suje_no 기준)
      const appealCheck = await db.execute({
        sql: `SELECT id FROM appeals
              WHERE deleted_at = ''
                AND (hyeongje_no = ? OR suje_no = ? OR hyeongje_no = ? OR suje_no = ?)
              LIMIT 1`,
        args: [c.hyeongjeNo || "", c.hyeongjeNo || "", c.sujeNo || "", c.sujeNo || ""],
      });
      if (appealCheck.rows.length > 0) continue; // 항고 있음 → 보존 스킵

      // 자동 보존 처리
      const nowStr = new Date().toISOString().replace("T", " ").substring(0, 19);
      await db.execute({
        sql: "UPDATE cases SET is_archived=1, archived_at=?, archived_by=? WHERE id=?",
        args: [nowStr, "[자동보존]", c.id],
      });
      await writeAuditLog({
        action: "UPDATE",
        entityType: "case",
        entityId: c.id,
        entityLabel: c.hyeongjeNo || c.sujeNo || c.id,
        actorId: "SYSTEM",
        actorName: "자동보존 스케줄러",
        detail: `불기소 처분(${c.disposition}) 후 ${days}일 경과, 항고 없음 — 자동 보존 처리`,
      });
      archivedCount++;
    }

    if (archivedCount > 0) {
      console.log(`[자동보존] ${archivedCount}건 자동 보존 완료 (기준: ${days}일)`);
    }
  } catch (e) {
    console.error("[자동보존 스케줄러 오류]", e.message);
  }
}

// ── 전역 에러 핸들러 ─────────────────────────────────────────────
// async 라우트에서 catch 되지 않은 에러가 Express로 전파될 때 처리.
// 스택 트레이스를 클라이언트에 노출하지 않고 일반 메시지만 반환.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error("[Unhandled Error]", req.method, req.path, err);
  if (res.headersSent) return;
  res.status(500).json({ success: false, message: "서버 오류가 발생했습니다." });
});

// ── 서버 시작 ─────────────────────────────────────────────────────
async function start() {
  await initDb();
  app.listen(PORT, () => {
    console.log(`[Dose-PROS API] http://localhost:${PORT}`);
  });
  // 자동보존 스케줄러: 1분 후 최초 실행, 이후 1시간마다
  setTimeout(() => {
    runAutoArchiveScheduler();
    setInterval(runAutoArchiveScheduler, 60 * 60 * 1000);
  }, 60 * 1000);
}

start().catch((err) => {
  console.error("[FATAL] 서버 시작 실패:", err);
  process.exit(1);
});
