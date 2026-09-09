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

/**
 * disposition 문자열을 피의자별 항목으로 분리한다.
 *
 * 케이스:
 *   - suspectsDispositions 객체가 있으면 → { name, disposition }[] 반환
 *   - 없으면 disposition 문자열을 " / " 로 split:
 *       "홍길동: 구속기소 (결재완료) / 김철수: 혐의없음 - 증거불충분 (불기소)"
 *       → [{ name: "홍길동", disposition: "구속기소 (결재완료)" }, ...]
 *     "이름: " 패턴이 없으면 전체를 단일 항목으로 반환
 *
 * @param {object} caseItem  - suspects, suspectsDispositions, disposition 포함
 * @returns {{ name: string|null, disposition: string }[]}
 */
export function parseDispositionEntries(caseItem) {
  if (!caseItem) return [];

  // suspects_dispositions 객체 우선 사용
  const dispsMap = caseItem.suspectsDispositions;
  const suspects = Array.isArray(caseItem.suspects) ? caseItem.suspects : [];

  if (dispsMap && typeof dispsMap === "object" && Object.keys(dispsMap).length > 0) {
    if (suspects.length > 0) {
      return suspects.map((s) => {
        const found =
          (s.id && dispsMap[s.id]) ||
          (s.uuid && dispsMap[s.uuid]) ||
          (s.name && dispsMap[s.name]) ||
          dispsMap[s.id || s.uuid || s.name];
        return {
          name: s.name || null,
          disposition: found || caseItem.disposition || "수사중",
        };
      });
    }
    // suspects 배열 없이 맵만 있는 경우
    return Object.entries(dispsMap).map(([key, disp]) => ({
      name: key,
      disposition: disp,
    }));
  }

  // disposition 문자열 파싱 (fallback)
  const raw = (caseItem.disposition || "").trim();
  if (!raw) return [{ name: null, disposition: "수사중" }];

  const parts = raw.split(" / ").map((s) => s.trim()).filter(Boolean);
  if (parts.length <= 1) {
    // 단일 항목 — "이름: 처분" 패턴 분리 시도
    const m = parts[0]?.match(/^(.+?):\s*(.+)$/);
    if (m) return [{ name: m[1].trim(), disposition: m[2].trim() }];
    return [{ name: null, disposition: parts[0] || raw }];
  }

  return parts.map((part) => {
    const m = part.match(/^(.+?):\s*(.+)$/);
    if (m) return { name: m[1].trim(), disposition: m[2].trim() };
    return { name: null, disposition: part };
  });
}

/**
 * 처분 문자열에 따른 색상을 반환한다.
 * STATUS_COLOR와 동일한 규칙, 컴포넌트 외부에서도 공유 가능.
 *
 * @param {string} disp
 * @returns {string} hex color
 */
export function dispositionColor(disp) {
  if (!disp) return "#94a3b8";
  if (disp.includes("구속")) return "#f87171";
  if (
    disp.includes("불기소") ||
    disp.includes("무혐의") ||
    disp.includes("유예") ||
    disp.includes("공소권없음") ||
    disp.includes("기소중지")
  )
    return "#34d399";
  if (disp.includes("기소")) return "#fb923c";
  return "#93c5fd";
}
