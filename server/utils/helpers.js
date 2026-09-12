/**
 * server/utils/helpers.js
 * 데이터 변환, JSON 파싱, 유효성 검증 및 공통 헬퍼 유틸리티
 */

/** DB 컬럼명(snake_case)을 camelCase로 변환 */
export function toCamel(row) {
  if (!row || typeof row !== "object") return row;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    const camel = k.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = v;
  }
  return out;
}

/** camelCase 문자열을 snake_case로 변환 */
export function toSnake(str) {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/** 안전한 JSON 배열 파싱 */
export function parseJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** 안전한 JSON 객체 파싱 */
export function parseJsonObject(value) {
  if (!value) return {};
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

/** 피의자 목록 및 처분 요약 문자열 빌더 */
export function buildCaseDispositionSummary(suspects, dispositions, fallback = "") {
  const suspectList =
    Array.isArray(suspects) && suspects.length > 0
      ? suspects
      : [{ name: fallback || "피의자" }];

  const entries = suspectList.map((suspect, index) => {
    const key =
      suspect?.id || suspect?.uuid || suspect?.name || `suspect-${index}`;
    const selected = dispositions?.[key] || fallback || "입건 : 수사 진행 중";
    return `${suspect?.name || "피의자"}: ${selected}`;
  });

  return entries.join(" / ");
}

/** Express async 에러 전파 래퍼 */
export function asyncWrap(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

/** 비공개 사건 뷰어 ID 배열 정규화 */
export function normalizePrivateViewerIds(value) {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(value.filter((id) => typeof id === "string" && id.trim())),
  ].slice(0, 50);
}

/** 내사/입건 전 조사 여부 */
export function isPreBookingInvestigation(status) {
  return String(status || "").trim() === "입건 전 조사";
}

/** 필드 길이 제한 상수 */
export const FIELD_MAX_LENGTHS = {
  short: 100, // 번호·이름·상태 등
  medium: 500, // 제목·죄명·처분내용 등
  long: 2000, // 메모·비고 등
  url: 2000, // URL / basisUrl
};

/** 필드 길이 유효성 검사 */
export function validateFieldLengths(obj, schema) {
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

/** 증거자료 관련 상수 및 검증 */
export const ALLOWED_EVIDENCE_MIME =
  /^data:(image\/(png|jpeg|gif|webp)|application\/pdf);base64,/i;
export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024; // 5MB
export const EVIDENCE_MAX_PER_CASE = 50; // 사건당 증거자료 최대 건수

export function validateEvidenceUrl(urlTrimmed) {
  if (!urlTrimmed) return "URL 또는 파일 데이터를 입력해주세요.";
  const isUrl = /^https?:\/\//i.test(urlTrimmed);
  const isBase64 = urlTrimmed.startsWith("data:");
  if (!isUrl && !isBase64)
    return "http/https URL 또는 파일 데이터를 입력해주세요.";
  if (isBase64) {
    if (!ALLOWED_EVIDENCE_MIME.test(urlTrimmed))
      return "허용되지 않는 파일 형식입니다. PNG/JPEG/GIF/WEBP 이미지 또는 PDF만 업로드할 수 있습니다.";
    if (urlTrimmed.length > EVIDENCE_MAX_BYTES)
      return "파일 크기는 5MB 이하만 허용됩니다.";
  }
  return null;
}

/** 기준일자로부터 경과 일수 계산 */
export function calculateDaysElapsedFromDate(dateValue) {
  if (!dateValue || typeof dateValue !== "string") return 0;
  const d = new Date(`${dateValue}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = today.getTime() - d.getTime();
  return Math.max(0, Math.floor(diffMs / 86400000));
}
