/**
 * server/config/roles.js
 * 시스템 역할, 권한 계층 및 권한 검사 헬퍼
 */

export const GLOBAL_DATA_ROLES = new Set([
  "SUPER_ADMIN",
  "PROSECUTOR_GENERAL",
  "CHIEF_PROSECUTOR",
  "DEPUTY_CHIEF",
  "CHIEF_ADMINISTRATOR",
]);

export const APPROVAL_ROLES = new Set([
  ...GLOBAL_DATA_ROLES,
  "SENIOR_PROSECUTOR",
]);

export const MANAGEMENT_ROLE_LEVELS = new Set([
  "CHIEF_ADMINISTRATOR",
  "ADMINISTRATOR",
  "ADMIN_PROBATIONARY",
]);

export const SECRETARIAT_ROLES = new Set([
  "SUPER_ADMIN",
  "PROSECUTOR_GENERAL",
  "CHIEF_PROSECUTOR",
  "DEPUTY_CHIEF",
  "CHIEF_ADMINISTRATOR",
  "ADMINISTRATOR",
  "ADMIN_PROBATIONARY",
]);

export const SELF_ROLE_CHANGE_ROLES = new Set([
  "PROSECUTOR_GENERAL",
  "CHIEF_PROSECUTOR",
  "CHIEF_ADMINISTRATOR",
]);

export const TOP_ROLE_MANAGERS = new Set([
  "PROSECUTOR_GENERAL",
  "CHIEF_PROSECUTOR",
]);

export const ROLE_AUTHORITY = {
  PROBATIONARY: 10, // 검사시보
  ADMIN_PROBATIONARY: 15, // 검찰사무관시보 (검사시보 대우)
  ADMINISTRATOR: 30, // 검찰사무관 (평검사 대우 — 행정/수사보조)
  PROSECUTOR: 40, // 평검사 (소추·수사 주체, 검찰청법 제3조)
  SENIOR_PROSECUTOR: 50, // 부장검사
  DEPUTY_CHIEF: 60, // 차장검사
  CHIEF_ADMINISTRATOR: 65, // 검찰관리관 (차장검사 대우 — 행정직)
  CHIEF_PROSECUTOR: 70, // 검사장
  PROSECUTOR_GENERAL: 80, // 검찰총장
  SUPER_ADMIN: 100, // 최고 시스템 관리자
};

export const ACCOUNT_ROLE_LEVELS = Object.keys(ROLE_AUTHORITY).filter(
  (roleLevel) => roleLevel !== "SUPER_ADMIN",
);

/**
 * 직무대리(dualRoleLevel) 통합 유효 권한 헬퍼
 */
export function effectiveRoleLevel(user) {
  if (!user) return "PROBATIONARY";
  const base = user.roleLevel || "PROBATIONARY";
  const dual = user.dualRoleLevel || "";
  if (!dual) return base;

  const now = new Date();
  const start = user.actingStart ? new Date(user.actingStart) : null;
  const end = user.actingEnd ? new Date(user.actingEnd) : null;
  if (start && now < start) return base;
  if (end && now > end) return base;

  const baseAuth = ROLE_AUTHORITY[base] || 0;
  const dualAuth = ROLE_AUTHORITY[dual] || 0;
  return dualAuth > baseAuth ? dual : base;
}

export function hasGlobalDataAccess(user) {
  return Boolean(
    user?.isSuperAdmin || GLOBAL_DATA_ROLES.has(effectiveRoleLevel(user)),
  );
}

export function hasSecretariatWorkAccess(user) {
  if (!user) return false;
  return Boolean(
    user.isSuperAdmin ||
      user.dept?.includes("사무국") ||
      (user.dualSecretariatWork && user.dualDept?.includes("사무국")) ||
      MANAGEMENT_ROLE_LEVELS.has(effectiveRoleLevel(user)),
  );
}

export function isManagementAccount(account) {
  if (!account) return false;
  return Boolean(
    account.isSuperAdmin ||
      String(account.dept || "").includes("사무국") ||
      MANAGEMENT_ROLE_LEVELS.has(account.roleLevel),
  );
}

export function isProsecutorGeneral(user) {
  return Boolean(
    user?.isSuperAdmin || effectiveRoleLevel(user) === "PROSECUTOR_GENERAL",
  );
}

export function isAssignableProsecutor(account) {
  return Boolean(
    account &&
      !String(account.dept || "").includes("사무국") &&
      !MANAGEMENT_ROLE_LEVELS.has(account.roleLevel) &&
      account.status === "ACTIVE",
  );
}
