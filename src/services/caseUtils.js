/**
 * src/services/caseUtils.js
 * 사건번호·사건상태 공통 유틸리티
 *
 * 사건번호 표시 규칙:
 *   형제 + 수제 있음 → 형제번호(수제번호)
 *   형제만 있음      → 형제번호
 *   수제만 있음      → 수제번호
 *
 * 내부 검색·연결·집계 기준은 수제번호(sujeNo) 우선.
 */

/** 빈 값 판정 헬퍼 */
function isBlank(v) {
  return !v || v === "-" || v === "00" || v.trim() === "";
}

/**
 * 내부 기준번호(수제번호)를 반환한다.
 * 수제번호가 없으면 형제번호로 대체.
 * 사건 집계·검색·연결에 이 값을 사용한다.
 *
 * @param {object} caseItem
 * @returns {string}
 */
export function getMasterCaseNumber(caseItem) {
  if (!caseItem) return "";
  const suje = String(caseItem.sujeNo || "").trim();
  const hyeongje = String(caseItem.hyeongjeNo || "").trim();
  if (!isBlank(suje)) return suje;
  if (!isBlank(hyeongje)) return hyeongje;
  return "";
}

/**
 * 사용자에게 표시할 대표 사건번호를 반환한다.
 *
 * 표시 규칙:
 *   형제 + 수제 있음 → "형제번호(수제번호)"
 *   형제만 있음      → "형제번호"
 *   수제만 있음      → "수제번호"
 *
 * @param {object} caseItem
 * @returns {string}
 */
export function getDisplayCaseNumber(caseItem) {
  if (!caseItem) return "";
  const suje = String(caseItem.sujeNo || "").trim();
  const hyeongje = String(caseItem.hyeongjeNo || "").trim();

  const hasSuje = !isBlank(suje);
  const hasHyeongje = !isBlank(hyeongje);

  if (hasHyeongje && hasSuje) return `${hyeongje}(${suje})`;
  if (hasHyeongje) return hyeongje;
  if (hasSuje) return suje;
  return "";
}

/**
 * 검색어가 사건번호(수제·형제 모두)에 포함되는지 확인한다.
 * 수제번호 우선 검색, 형제번호도 함께 검색.
 *
 * @param {object} caseItem
 * @param {string} query  소문자 트림된 검색어
 * @returns {boolean}
 */
export function matchesCaseNumber(caseItem, query) {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  return (
    (caseItem.sujeNo || "").toLowerCase().includes(q) ||
    (caseItem.hyeongjeNo || "").toLowerCase().includes(q)
  );
}

/**
 * 보존 사건 여부 반환.
 * isArchived가 truthy(1 또는 true)이면 보존 사건.
 *
 * @param {object} caseItem
 * @returns {boolean}
 */
export function isArchivedCase(caseItem) {
  return Boolean(caseItem?.isArchived);
}

/**
 * 현재 처리중 사건 여부 반환.
 * 보존되지 않은 사건만 현재 처리중으로 간주한다.
 *
 * @param {object} caseItem
 * @returns {boolean}
 */
export function isActiveCase(caseItem) {
  return !isArchivedCase(caseItem);
}
