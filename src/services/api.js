/**
 * src/services/api.js
 * 백엔드 REST API 클라이언트
 *
 * - JWT 토큰을 sessionStorage 에서 읽어 Authorization 헤더로 전송
 * - 401 응답 시 세션 삭제 후 페이지 새로고침 (강제 로그아웃)
 * - 모든 에러는 콘솔에 기록하고 null 반환 (앱이 폴백 데이터로 동작)
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

// ── 토큰 헬퍼 ────────────────────────────────────────────────────────
const TOKEN_KEY = 'dose_pros_token';

export function saveToken(token) {
  try { sessionStorage.setItem(TOKEN_KEY, token); } catch {}
}

export function getToken() {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function clearToken() {
  try { sessionStorage.removeItem(TOKEN_KEY); } catch {}
}

// ── 공통 fetch 래퍼 ──────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

    // 401 → 토큰 만료 또는 미인증: 세션 초기화 후 강제 로그아웃
    if (res.status === 401) {
      // 토큰이 있었던 경우만 (만료된 세션) reload — 미로그인 상태에서는 무시
      const hadToken = !!getToken();
      clearToken();
      try { sessionStorage.removeItem('dose_pros_session'); } catch {}
      if (hadToken) window.location.reload();
      return null;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn(`[API] ${options.method || 'GET'} ${path} → ${res.status}`, text);
      return null;
    }

    return await res.json();
  } catch (e) {
    console.error(`[API] 네트워크 오류 (${path}):`, e.message);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════════
// Auth
// ════════════════════════════════════════════════════════════════════
export async function loginApi(id, password) {
  const data = await apiFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ id, password }),
  });
  // 로그인 성공 시 토큰 저장
  if (data?.success && data.token) {
    saveToken(data.token);
  }
  return data;
}

export function logoutApi() {
  clearToken();
}

// ════════════════════════════════════════════════════════════════════
// Cases
// ════════════════════════════════════════════════════════════════════
export function fetchCases() {
  return apiFetch('/cases');
}

export function createCaseApi(caseData) {
  return apiFetch('/cases', {
    method: 'POST',
    body: JSON.stringify(caseData),
  });
}

export function updateCaseApi(id, caseData) {
  return apiFetch(`/cases/${id}`, {
    method: 'PUT',
    body: JSON.stringify(caseData),
  });
}

// ════════════════════════════════════════════════════════════════════
// Reports
// ════════════════════════════════════════════════════════════════════
export function fetchReports() {
  return apiFetch('/reports');
}

export function createReportApi(reportData) {
  return apiFetch('/reports', {
    method: 'POST',
    body: JSON.stringify(reportData),
  });
}

// ════════════════════════════════════════════════════════════════════
// Appeals
// ════════════════════════════════════════════════════════════════════
export function fetchAppeals() {
  return apiFetch('/appeals');
}

export function createAppealApi(appealData) {
  return apiFetch('/appeals', {
    method: 'POST',
    body: JSON.stringify(appealData),
  });
}

// ════════════════════════════════════════════════════════════════════
// Bookings
// ════════════════════════════════════════════════════════════════════
export function fetchBookings() {
  return apiFetch('/bookings');
}

export function createBookingApi(bookingData) {
  return apiFetch('/bookings', {
    method: 'POST',
    body: JSON.stringify(bookingData),
  });
}

// ════════════════════════════════════════════════════════════════════
// Approvals
// ════════════════════════════════════════════════════════════════════
export function fetchApprovals() {
  return apiFetch('/approvals');
}

export function createApprovalApi(approvalData) {
  return apiFetch('/approvals', {
    method: 'POST',
    body: JSON.stringify(approvalData),
  });
}

export function approveDocApi(docId) {
  return apiFetch(`/approvals/${docId}/approve`, { method: 'PUT' });
}

// ════════════════════════════════════════════════════════════════════
// Prosecutors
// ════════════════════════════════════════════════════════════════════
export function fetchProsecutors() {
  return apiFetch('/prosecutors');
}

// ════════════════════════════════════════════════════════════════════
// Registrations — 회원가입 신청 & 검찰사무국 허가
// ════════════════════════════════════════════════════════════════════

/**
 * 회원가입 신청 (비인증 공개 엔드포인트)
 * @param {{ id, name, rank, position, title, roleLevel, dept, password, note }} data
 */
export async function registerApi(data) {
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (e) {
    console.error('[API] 회원가입 신청 오류:', e.message);
    return { success: false, message: '네트워크 오류가 발생했습니다.' };
  }
}

/** 가입 신청 목록 조회 (검찰사무국 전용) */
export function fetchRegistrations() {
  return apiFetch('/registrations');
}

/** 가입 신청 허가 */
export function approveRegistrationApi(regId) {
  return apiFetch(`/registrations/${regId}/approve`, { method: 'PUT' });
}

/** 가입 신청 거부 */
export function rejectRegistrationApi(regId, reason) {
  return apiFetch(`/registrations/${regId}/reject`, {
    method: 'PUT',
    body: JSON.stringify({ reason }),
  });
}
