/**
 * server/middlewares/auth.js
 * 인증, 인가, Rate Limit, 접근 범위 검사 미들웨어
 */
import jwt from "jsonwebtoken";
import { db } from "../db.js";
import {
  ROLE_AUTHORITY,
  GLOBAL_DATA_ROLES,
  APPROVAL_ROLES,
  MANAGEMENT_ROLE_LEVELS,
  SECRETARIAT_ROLES,
  effectiveRoleLevel,
  hasGlobalDataAccess,
  hasSecretariatWorkAccess,
  isManagementAccount,
  isProsecutorGeneral,
  isAssignableProsecutor,
} from "../config/roles.js";
import {
  toCamel,
  parseJsonArray,
  asyncWrap,
} from "../utils/helpers.js";

const JWT_SECRET = process.env.JWT_SECRET;
const authAttempts = new Map();
const AUTH_WINDOW_MS = 15 * 60 * 1000;
const AUTH_MAX_ATTEMPTS = 5;

// 만료된 rate-limit 항목 주기적 정리
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of authAttempts.entries()) {
    if (now - val.startedAt >= AUTH_WINDOW_MS) authAttempts.delete(key);
  }
}, AUTH_WINDOW_MS);

export function authRateLimit(req, res, next) {
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

export function clearAuthAttempts(req) {
  const identity = String(req.body?.id || "anonymous").toLowerCase();
  authAttempts.delete(`${req.ip}:${req.path}:${identity}`);
}

/** JWT 인증 미들웨어 */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ success: false, message: "인증 토큰이 없습니다." });
  }
  try {
    const claims = jwt.verify(header.slice(7), JWT_SECRET);
    const result = await db.execute({
      sql: "SELECT id, name, role_level, dept, status, is_super_admin, dual_dept, dual_role_level, dual_secretariat_work, can_arbitrary_approve, acting_start, acting_end, acting_user_id FROM prosecutors WHERE id = ?",
      args: [claims.id],
    });

    const READONLY_STATUSES = new Set(["ON_LEAVE", "DELEGATED"]);

    if (result.rows.length === 0) {
      return res
        .status(401)
        .json({ success: false, message: "계정을 찾을 수 없습니다." });
    }
    const statusVal = result.rows[0].status;
    if (statusVal === "RETIRED") {
      return res
        .status(403)
        .json({ success: false, message: "퇴직 처리된 계정입니다." });
    }
    if (statusVal !== "ACTIVE" && !READONLY_STATUSES.has(statusVal)) {
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
      isReadOnly: READONLY_STATUSES.has(statusVal),
    };

    // 직무대리 기간 만료 자동 회수
    if (account.dualRoleLevel && account.actingEnd) {
      const now = new Date();
      const end = new Date(account.actingEnd);
      if (!isNaN(end) && now > end) {
        db.execute({
          sql: `UPDATE prosecutors SET
                  dual_role_level='', acting_title='', acting_start='', acting_end='',
                  delegate_to='', delegate_reason=''
                WHERE id=?`,
          args: [account.id],
        }).catch((e) => console.warn("[acting expiry cleanup]", e.message));
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

/** 읽기전용 계정 쓰기 요청 차단 미들웨어 */
export function requireReadWrite(req, res, next) {
  if (req.user?.isReadOnly) {
    return res.status(403).json({
      success: false,
      message:
        "읽기 전용 상태입니다. 휴가 또는 직무대리 위임 중에는 데이터 변경이 불가합니다.",
    });
  }
  next();
}

/** 사무국 권한 미들웨어 */
export function requireSecretariat(req, res, next) {
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

/** 결재 권한 미들웨어 */
export function requireApprovalAuthority(req, res, next) {
  if (!APPROVAL_ROLES.has(effectiveRoleLevel(req.user))) {
    return res
      .status(403)
      .json({ success: false, message: "결재 권한이 필요합니다." });
  }
  next();
}

/** 결재 문서 스코프 확인 */
export function requireApprovalScope(req, res, next) {
  if (hasGlobalDataAccess(req.user)) return next();
  return requireRecordScope("approvals")(req, res, next);
}

/** 배당 가능 검사 검증 */
export async function validateCaseAssignee(prosecutorId) {
  if (!prosecutorId) return true;
  const result = await db.execute({
    sql: "SELECT role_level, dept, status FROM prosecutors WHERE id = ?",
    args: [prosecutorId],
  });
  return isAssignableProsecutor(result.rows[0] && toCamel(result.rows[0]));
}

/** 강제 재배당 가능 검사 검증 */
export async function validateForcedCaseAssignee(prosecutorId) {
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

const ALLOWED_QUERY_TABLES = new Set([
  "cases",
  "reports",
  "appeals",
  "bookings",
  "approvals",
  "warrants",
]);
const ALLOWED_ORDER_BY = new Set([
  "rowid DESC",
  "rowid ASC",
  "created_at DESC",
  "created_at ASC",
  "booking_date DESC",
  "booking_date ASC",
]);

/** 권한 기반 스코프 쿼리 빌더 */
export function scopedQuery(table, user, orderBy = "rowid DESC") {
  if (!ALLOWED_QUERY_TABLES.has(table))
    throw new Error(`[scopedQuery] 허용되지 않는 테이블: ${table}`);
  if (!ALLOWED_ORDER_BY.has(orderBy))
    throw new Error(`[scopedQuery] 허용되지 않는 정렬: ${orderBy}`);

  if (isProsecutorGeneral(user) || GLOBAL_DATA_ROLES.has(effectiveRoleLevel(user))) {
    return {
      sql: `SELECT * FROM ${table} WHERE deleted_at = '' ORDER BY ${orderBy}`,
      args: [],
    };
  }

  if (table === "cases") {
    if (hasSecretariatWorkAccess(user)) {
      return {
        sql: `SELECT c.* FROM cases c WHERE c.deleted_at = '' ORDER BY c.${orderBy}`,
        args: [],
      };
    }

    const CLOSED_KEYWORDS = [
      "불기소", "종국", "기소유예", "혐의없음", "무혐의", "죄가안됨",
      "공소권없음", "각하", "기소중지", "참고인중지", "타관송치",
      "처분완료", "구속기소", "불구속기소", "약식기소", "구공판",
    ];
    const closedCondition = CLOSED_KEYWORDS.map(
      () => `(c.disposition LIKE ? OR c.booking_status LIKE ?)`,
    ).join(" OR ");
    const closedArgs = CLOSED_KEYWORDS.flatMap((k) => [`%${k}%`, `%${k}%`]);

    return {
      sql: `SELECT c.* FROM cases c
            LEFT JOIN prosecutors p ON c.prosecutor_id = p.id
            WHERE c.deleted_at = '' AND
              (c.is_archived = 1
                OR (c.visibility = 'PUBLIC' AND p.dept = (SELECT dept FROM prosecutors WHERE id = ?))
                OR c.created_by = ? OR c.prosecutor_name = ?
                OR instr(COALESCE(c.private_viewer_ids, '[]'), '"' || ? || '"') > 0
                OR (c.visibility = 'PUBLIC' AND (${closedCondition})))
            ORDER BY c.${orderBy}`,
      args: [user.id, user.id, user.name, user.id, ...closedArgs],
    };
  }

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
    sql: `SELECT ${table}.* FROM ${table} LEFT JOIN prosecutors p ON ${table}.${field} = ${value}
          WHERE ${table}.deleted_at = '' AND (p.dept = (SELECT dept FROM prosecutors WHERE id = ?) OR ${table}.${field} = ? OR ${table}.${field} = '' OR ${table}.${field} IS NULL)
          ORDER BY ${table}.${orderBy}`,
    args: [user.id, usesId ? user.id : user.name],
  };
}

/** 개별 레코드 권한 검사 미들웨어 */
export function requireRecordScope(table) {
  if (!ALLOWED_QUERY_TABLES.has(table))
    throw new Error(`[requireRecordScope] 허용되지 않는 테이블: ${table}`);
  return async (req, res, next) => {
    if (hasGlobalDataAccess(req.user) || hasSecretariatWorkAccess(req.user)) return next();
    const field = table === "approvals" ? "prosecutor_id" : "prosecutor_name";
    const value = table === "approvals" ? req.user.id : req.user.name;
    const result = await db.execute({
      sql: `SELECT 1 FROM ${table} WHERE id=? AND (${field}=? OR ${field}='' OR ${field} IS NULL) AND deleted_at=''`,
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

/** 개별 사건 상세 접근 권한 미들웨어 */
async function requireCaseScopeImpl(req, res, next) {
  if (isProsecutorGeneral(req.user) || hasGlobalDataAccess(req.user)) {
    return next();
  }

  const result = await db.execute({
    sql: `SELECT c.visibility, c.created_by, c.prosecutor_id, c.prosecutor_name,
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
  const prosecutorName = row.prosecutor_name;
  const privateViewerIds = String(row.private_viewer_ids || "[]");
  const uid = req.user.id;

  async function isDirectSuperior(requesterId, targetProsecutorId) {
    if (!targetProsecutorId) return false;
    const r = await db.execute({
      sql: "SELECT role_level, dept FROM prosecutors WHERE id = ?",
      args: [targetProsecutorId],
    });
    if (r.rows.length === 0) return false;
    const target = toCamel(r.rows[0]);
    const requesterDept = req.user.dept || "";
    const targetDept = target.dept || "";
    if (!requesterDept || requesterDept !== targetDept) return false;
    const requesterAuth = ROLE_AUTHORITY[effectiveRoleLevel(req.user)] || 0;
    const targetAuth = ROLE_AUTHORITY[target.roleLevel] || 0;
    return requesterAuth > targetAuth;
  }

  if (visibility === "PRIVATE") {
    const isAllowed =
      prosecutorName === req.user.name ||
      uid === createdBy ||
      parseJsonArray(privateViewerIds).includes(uid) ||
      hasSecretariatWorkAccess(req.user);
    if (!isAllowed) {
      return res.status(403).json({
        success: false,
        message: "비공개 사건에 접근할 권한이 없습니다.",
      });
    }
    return next();
  }

  if (hasSecretariatWorkAccess(req.user)) {
    return next();
  }
  if (await isDirectSuperior(uid, prosecutorId)) {
    return next();
  }
  const scopeResult = await db.execute({
    sql: `SELECT 1 FROM cases c JOIN prosecutors p ON c.prosecutor_id = p.id
          WHERE c.id = ? AND
            (p.dept = (SELECT dept FROM prosecutors WHERE id = ?)
              OR c.created_by = ? OR c.prosecutor_name = ?
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

export const requireCaseScope = asyncWrap(requireCaseScopeImpl);

/** 증거자료 등록용 사건 조회 */
export async function findCaseForEvidence(caseNo, user) {
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
