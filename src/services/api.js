/**
 * src/services/api.js
 * 백엔드 REST API 클라이언트
 *
 * - JWT 토큰을 sessionStorage 에서 읽어 Authorization 헤더로 전송
 * - 401 응답 시 세션 삭제 후 페이지 새로고침 (강제 로그아웃)
 * - 모든 에러는 콘솔에 기록하고 null 반환 (앱이 폴백 데이터로 동작)
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL || "/api";

// ── 토큰 헬퍼 ────────────────────────────────────────────────────────
const TOKEN_KEY = "dose_pros_token";

export function saveToken(token) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {}
}

export function getToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function clearToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {}
}

// ── 공통 fetch 래퍼 ──────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
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
      try {
        sessionStorage.removeItem("dose_pros_session");
      } catch {}
      if (hadToken) window.location.reload();
      return null;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.warn(
        `[API] ${options.method || "GET"} ${path} → ${res.status}`,
        text,
      );
      // 에러 응답의 JSON을 파싱해서 반환 — success: false + message 포함 가능
      try {
        return JSON.parse(text);
      } catch {
        return { success: false, message: text || "서버 오류" };
      }
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
  const data = await apiFetch("/auth/login", {
    method: "POST",
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
  return apiFetch("/cases");
}

export function fetchCaseNumberSettings() {
  return apiFetch("/settings/case-number");
}

export function updateCaseNumberSettings(settings) {
  return apiFetch("/settings/case-number", {
    method: "PATCH",
    body: JSON.stringify(settings),
  });
}

export function createCaseApi(caseData) {
  return apiFetch("/cases", {
    method: "POST",
    body: JSON.stringify(caseData),
  });
}

export function createIntakeBundleApi(caseData) {
  return apiFetch("/cases/intake-bundle", {
    method: "POST",
    body: JSON.stringify(caseData),
  });
}

export function updateCaseApi(id, caseData) {
  return apiFetch(`/cases/${id}`, {
    method: "PUT",
    body: JSON.stringify(caseData),
  });
}

export function archiveCaseApi(id, isArchived) {
  return apiFetch(`/cases/${id}/archive`, {
    method: "PATCH",
    body: JSON.stringify({ isArchived }),
  });
}

export function bulkImportCasesApi(rows) {
  return apiFetch("/cases/bulk-import", {
    method: "POST",
    body: JSON.stringify({ rows }),
  });
}

export function fetchDepartments() {
  return apiFetch("/departments");
}

export function saveDepartmentsApi(departments) {
  return apiFetch("/departments", {
    method: "PUT",
    body: JSON.stringify({ departments }),
  });
}

export function fetchCharges() {
  return apiFetch("/charges");
}

export function createChargeApi(name) {
  return apiFetch("/charges", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
}

export function deleteChargeApi(id) {
  return apiFetch(`/charges/${id}`, { method: "DELETE" });
}

export function assignOfficialCaseNoApi({ caseId, prefix, manualNo, autoSeal }) {
  return apiFetch("/cases/assign-official-no", {
    method: "POST",
    body: JSON.stringify({ caseId, prefix, manualNo, autoSeal }),
  });
}

// ════════════════════════════════════════════════════════════════════
// Reports
// ════════════════════════════════════════════════════════════════════
export function fetchReports() {
  return apiFetch("/reports");
}

export function createReportApi(reportData) {
  return apiFetch("/reports", {
    method: "POST",
    body: JSON.stringify(reportData),
  });
}

// ════════════════════════════════════════════════════════════════════
// Appeals
// ════════════════════════════════════════════════════════════════════
export function fetchAppeals() {
  return apiFetch("/appeals");
}

export function createAppealApi(appealData) {
  return apiFetch("/appeals", {
    method: "POST",
    body: JSON.stringify(appealData),
  });
}

export function updateAppealApi(id, appealData) {
  return apiFetch(`/appeals/${id}`, {
    method: "PATCH",
    body: JSON.stringify(appealData),
  });
}

// ════════════════════════════════════════════════════════════════════
// Bookings
// ════════════════════════════════════════════════════════════════════
export function fetchBookings() {
  return apiFetch("/bookings");
}

export function createBookingApi(bookingData) {
  return apiFetch("/bookings", {
    method: "POST",
    body: JSON.stringify(bookingData),
  });
}

// ════════════════════════════════════════════════════════════════════
// Approvals
// ════════════════════════════════════════════════════════════════════
export function fetchApprovals() {
  return apiFetch("/approvals");
}

export function createApprovalApi(approvalData) {
  return apiFetch("/approvals", {
    method: "POST",
    body: JSON.stringify(approvalData),
  });
}

export function updateApprovalApi(id, approvalData) {
  return apiFetch(`/approvals/${id}`, {
    method: "PUT",
    body: JSON.stringify(approvalData),
  });
}

export function approveDocApi(docId, mode = "STANDARD") {
  return apiFetch(`/approvals/${docId}/approve`, {
    method: "PUT",
    body: JSON.stringify({ mode }),
  });
}

// ════════════════════════════════════════════════════════════════════
// DELETE 엔드포인트 (검찰사무국 전용)
// ════════════════════════════════════════════════════════════════════
export function deleteCaseApi(id) {
  return apiFetch(`/cases/${id}`, { method: "DELETE" });
}

export function deleteAppealApi(id) {
  return apiFetch(`/appeals/${id}`, { method: "DELETE" });
}

export function deleteApprovalApi(id) {
  return apiFetch(`/approvals/${id}`, { method: "DELETE" });
}

export function deleteReportApi(id) {
  return apiFetch(`/reports/${id}`, { method: "DELETE" });
}

export function deleteBookingApi(id) {
  return apiFetch(`/bookings/${id}`, { method: "DELETE" });
}

export function deleteProsecutorApi(id) {
  return apiFetch(`/prosecutors/${id}`, { method: "DELETE" });
}

// ════════════════════════════════════════════════════════════════════
// Prosecutors
// ════════════════════════════════════════════════════════════════════
export function fetchProsecutors() {
  return apiFetch("/prosecutors");
}

export function createProsecutorApi(prosecutor) {
  return apiFetch("/prosecutors", {
    method: "POST",
    body: JSON.stringify(prosecutor),
  });
}

export function updateProsecutorApi(userId, changes) {
  return apiFetch(`/prosecutors/${userId}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}

/** 비밀번호 변경 (본인 또는 관리자) */
export function changePasswordApi(userId, currentPassword, newPassword) {
  return apiFetch(`/prosecutors/${userId}/password`, {
    method: "PATCH",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
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
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return await res.json();
  } catch (e) {
    console.error("[API] 회원가입 신청 오류:", e.message);
    return { success: false, message: "네트워크 오류가 발생했습니다." };
  }
}

/** 가입 신청 목록 조회 (검찰사무국 전용) */
export function fetchRegistrations() {
  return apiFetch("/registrations");
}

/** 가입 신청 허가 */
export function approveRegistrationApi(regId) {
  return apiFetch(`/registrations/${regId}/approve`, { method: "PUT" });
}

/** 가입 신청 거부 */
export function rejectRegistrationApi(regId, reason) {
  return apiFetch(`/registrations/${regId}/reject`, {
    method: "PUT",
    body: JSON.stringify({ reason }),
  });
}

// ════════════════════════════════════════════════════════════════════
// Audit Logs
// ════════════════════════════════════════════════════════════════════
export function fetchAuditLogs() {
  return apiFetch("/audit-logs");
}

export function createAuditLogApi(log) {
  return apiFetch("/audit-logs", {
    method: "POST",
    body: JSON.stringify(log),
  });
}

// ════════════════════════════════════════════════════════════════════
// Case History
// ════════════════════════════════════════════════════════════════════
export function fetchCaseHistory(caseId) {
  return apiFetch(`/cases/${caseId}/history`);
}

// 전체 원부 수정 이력 (감사 로그 뷰어용)
export function fetchAllCaseHistory() {
  return apiFetch("/case-history");
}

export function fetchEvidence(caseNo) {
  return apiFetch(`/cases/${encodeURIComponent(caseNo)}/evidence`);
}

export function createEvidenceApi(caseNo, evidence) {
  return apiFetch(`/cases/${encodeURIComponent(caseNo)}/evidence`, {
    method: "POST",
    body: JSON.stringify(evidence),
  });
}

export function deleteEvidenceApi(evidenceId) {
  return apiFetch(`/evidence/${encodeURIComponent(evidenceId)}`, {
    method: "DELETE",
  });
}

export function updateEvidenceApi(evidenceId, evidence) {
  return apiFetch(`/evidence/${encodeURIComponent(evidenceId)}`, {
    method: "PATCH",
    body: JSON.stringify(evidence),
  });
}

export const fetchWarrants = () => apiFetch("/warrants");
export const createWarrantApi = (warrant) =>
  apiFetch("/warrants", { method: "POST", body: JSON.stringify(warrant) });
export const updateWarrantApi = (id, changes) =>
  apiFetch(`/warrants/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
export const deleteWarrantApi = (id) =>
  apiFetch(`/warrants/${encodeURIComponent(id)}`, { method: "DELETE" });

export const fetchOfficeDocuments = (type) =>
  apiFetch(`/office-documents?type=${encodeURIComponent(type)}`);
export const createOfficeDocumentApi = (type, document) =>
  apiFetch("/office-documents", {
    method: "POST",
    body: JSON.stringify({ type, document }),
  });
export const deleteOfficeDocumentApi = (id) =>
  apiFetch(`/office-documents/${encodeURIComponent(id)}`, { method: "DELETE" });
export const updateOfficeDocumentApi = (id, document) =>
  apiFetch(`/office-documents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ document }),
  });

// ════════════════════════════════════════════════════════════════════
// 문서번호 서버 채번
// ════════════════════════════════════════════════════════════════════
export function fetchNextDocNo() {
  return apiFetch("/approvals/next-doc-no");
}

// ════════════════════════════════════════════════════════════════════
// 결재 반려
// ════════════════════════════════════════════════════════════════════
export function rejectDocApi(docId, reason) {
  return apiFetch(`/approvals/${docId}/reject`, {
    method: "PUT",
    body: JSON.stringify({ reason }),
  });
}

// ════════════════════════════════════════════════════════════════════
// Case Memos — 사건 수사 메모
// ════════════════════════════════════════════════════════════════════
export function fetchCaseMemos(caseId) {
  return apiFetch(`/cases/${encodeURIComponent(caseId)}/memos`);
}

export function createCaseMemoApi(caseId, content, isPrivate = false) {
  return apiFetch(`/cases/${encodeURIComponent(caseId)}/memos`, {
    method: "POST",
    body: JSON.stringify({ content, isPrivate }),
  });
}

export function deleteCaseMemoApi(caseId, memoId) {
  return apiFetch(
    `/cases/${encodeURIComponent(caseId)}/memos/${encodeURIComponent(memoId)}`,
    { method: "DELETE" },
  );
}

// ════════════════════════════════════════════════════════════════════
// Suspect Profile — 피의자 통합 프로필
// ════════════════════════════════════════════════════════════════════
export function fetchSuspectProfile(uuid) {
  return apiFetch(`/suspects/${encodeURIComponent(uuid)}/profile`);
}

// ════════════════════════════════════════════════════════════════════
// Bulk Reassign — 사건 일괄 재배당
// ════════════════════════════════════════════════════════════════════
export function bulkReassignApi({
  caseIds,
  toProsecutorId,
  toProsecutorName,
  reason,
}) {
  return apiFetch("/cases/bulk-reassign", {
    method: "POST",
    body: JSON.stringify({ caseIds, toProsecutorId, toProsecutorName, reason }),
  });
}

// ════════════════════════════════════════════════════════════════════
// Approval Templates — 결재선 템플릿
// ════════════════════════════════════════════════════════════════════
export function fetchApprovalTemplates() {
  return apiFetch("/approval-templates");
}

export function createApprovalTemplateApi({ name, description, steps, isShared }) {
  return apiFetch("/approval-templates", {
    method: "POST",
    body: JSON.stringify({ name, description, steps, isShared }),
  });
}

export function deleteApprovalTemplateApi(id) {
  return apiFetch(`/approval-templates/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}



// ════════════════════════════════════════════════════════════════════
// System Settings — 자동보존 설정
// ════════════════════════════════════════════════════════════════════

/** 자동보존 설정 조회 */
export function fetchAutoArchiveSettings() {
  return apiFetch("/settings/auto-archive");
}

/** 자동보존 설정 저장 */
export function updateAutoArchiveSettings(settings) {
  return apiFetch("/settings/auto-archive", {
    method: "PATCH",
    body: JSON.stringify(settings),
  });
}
