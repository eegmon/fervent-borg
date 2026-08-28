import React, { useState, useEffect, useMemo } from "react";
import {
  Scale,
  Lock,
  CheckCircle,
  User,
  KeyRound,
  AlertCircle,
  HelpCircle,
  UserPlus,
} from "lucide-react";

import Header from "./components/Header";
import MainLedger from "./components/MainLedger";
import MyCasesLedger from "./components/MyCasesLedger";
import WarrantLedger from "./components/WarrantLedger";
import ApprovalSystem from "./components/ApprovalSystem";
import ReportLedger from "./components/ReportLedger";
import AppealLedger from "./components/AppealLedger";
import BookingLedger from "./components/BookingLedger";
import SearchSystem from "./components/SearchSystem";
import PreservedCasesLedger from "./components/PreservedCasesLedger";
import AnalyticsDashboard from "./components/AnalyticsDashboard";
import SecretariatAdmin from "./components/SecretariatAdmin";
import IntakeModal from "./components/IntakeModal";
import EvidenceModal from "./components/EvidenceModal";
import SuspectHistoryModal from "./components/SuspectHistoryModal";
import LoginModal from "./components/LoginModal";
import PasswordChangeModal from "./components/PasswordChangeModal";
import DeadlineAlertModal from "./components/DeadlineAlertModal";
import OfficialTemplateModal from "./components/OfficialTemplateModal";
import RegisterModal from "./components/RegisterModal";
import CaseTimelineModal from "./components/CaseTimelineModal";
import CaseMemoModal from "./components/CaseMemoModal";

import AuditLogViewer from "./components/AuditLogViewer";
import Toast from "./components/Toast";

function formatIntakeNotice(data) {
  const chargeName = (data.chargeName || "-")
    .replace(/(?:주위적|예비적):\s*/g, "")
    .replace(/\s*\/\s*/g, ", ");
  const date = data.bookingDate
    ? new Date(`${data.bookingDate}T00:00:00`).toLocaleDateString("ko-KR", {
        year: "2-digit",
        month: "2-digit",
        day: "2-digit",
      })
    : "-";
  const prosecutorContact = data.prosecutorDiscordId
    ? ` (@${data.prosecutorDiscordId})`
    : "";

  return `**[신건 접수 통지]**
> 사건번호 | ${data.caseNo} 호
아래와 같이 배당합니다.
사건내용 ${data.caseNo} ${chargeName}
피의자명 ${data.suspectName || "-"} ( UUID: ${data.suspectUuid || "-"} )
접수일시 ${date}
접수근거 [관련 게시물](${data.bookingBasis || ""})
담당검사 ${data.prosecutorName || "-"}<@${prosecutorContact}>
--- 이 하 여 백 ---`;
}

function formatLegacyIntakeNotice(data, registrantName, registrantTitle) {
  return `[도스온라인 검찰사무국]
[사건접수배당 알림]

${data.caseNo}
담당검사 ${data.prosecutorName || "-"}

검찰청에서는 사건접수배당 외에도 사건처분 결과, 구공판 되는 경우 공판개시 및 재판결과를 귀하에게 통지해드릴 예정입니다.

도스온라인 검찰청 검찰사무국 ${registrantTitle || ""} ${registrantName || ""}`;
}

import {
  INITIAL_MAIN_LEDGER,
  INITIAL_REPORTS,
  INITIAL_APPEALS,
  INITIAL_BOOKINGS,
  INITIAL_APPROVALS,
  INITIAL_DEPARTMENTS,
  calculateStatuteOfLimitations,
  isCaseClosedOrIndicted,
  isManagementAccount,
} from "./data/prosecutionData";

import {
  fetchCases,
  createCaseApi,
  createIntakeBundleApi,
  updateCaseApi,
  archiveCaseApi,
  bulkImportCasesApi,
  deleteCaseApi,
  fetchReports,
  createReportApi,
  fetchAppeals,
  createAppealApi,
  updateAppealApi,
  fetchBookings,
  createBookingApi,
  deleteAppealApi,
  deleteApprovalApi,
  deleteReportApi,
  deleteBookingApi,
  deleteProsecutorApi,
  fetchApprovals,
  createApprovalApi,
  updateApprovalApi,
  approveDocApi,
  rejectDocApi,
  changePasswordApi,
  fetchAuditLogs,
  fetchCaseHistory,
  fetchNextDocNo,
  fetchCaseNumberSettings,
  loginApi,
  logoutApi,
  fetchProsecutors,
  createProsecutorApi,
  updateProsecutorApi,
  fetchDepartments,
  saveDepartmentsApi,
  fetchCharges,
  bulkReassignApi,
} from "./services/api";

export default function App() {
  const [activeTab, setActiveTab] = useState("ledger");

  // Auth Session State (Commercial Security Gate - Defaults to null with sessionStorage persistence)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem("dose_pros_session");
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Core Data States
  const [ledgerData, setLedgerData] = useState(INITIAL_MAIN_LEDGER);
  const [reportsData, setReportsData] = useState(INITIAL_REPORTS);
  const [appealsData, setAppealsData] = useState(INITIAL_APPEALS);
  const [bookingsData, setBookingsData] = useState(INITIAL_BOOKINGS);
  const [approvalsData, setApprovalsData] = useState(INITIAL_APPROVALS);
  const [departmentsData, setDepartmentsData] = useState(INITIAL_DEPARTMENTS);
  const [chargesData, setChargesData] = useState([]);
  const [prosecutorsList, setProsecutorsList] = useState([]);

  // 문서번호 자동 순번 카운터 (INITIAL_APPROVALS 길이 기준 시작, 서버 동기화)
  const [docNoCounter, setDocNoCounter] = useState(
    INITIAL_APPROVALS.length + 1,
  );
  const [caseNumberSettings, setCaseNumberSettings] = useState({
    hyeongjeStart: 280,
    teuggongStart: 1,
    teughyeongStart: 1,
    teugapjeStart: 1,
    apjeStart: 1,
    naesaStart: 1,
  });

  // 감사 로그
  const [auditLogs, setAuditLogs] = useState([]);

  // Toast
  const [toasts, setToasts] = useState([]);
  const showToast = (message, type = "success", duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  };
  const dismissToast = (id) =>
    setToasts((prev) => prev.filter((t) => t.id !== id));

  // Modal States
  const [isIntakeModalOpen, setIsIntakeModalOpen] = useState(false);
  const [evidenceModalInfo, setEvidenceModalInfo] = useState(null);
  const [suspectHistoryName, setSuspectHistoryName] = useState(null);
  // suspectHistoryName: { name: string, uuid: string | null } 또는 문자열(하위호환)
  const [timelineCaseItem, setTimelineCaseItem] = useState(null);
  const [memoCaseItem, setMemoCaseItem] = useState(null);
  const [isDeadlineModalOpen, setIsDeadlineModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [intakeNoticeData, setIntakeNoticeData] = useState(null);

  // Compute total alert counts for Header badge
  const totalDeadlineAlertsCount = useMemo(() => {
    let count = 0;
    (ledgerData || []).forEach((c) => {
      if (isCaseClosedOrIndicted(c)) return;
      if ((c.bookingStatus || c.disposition || "").includes("구속")) count++;
    });
    (appealsData || []).forEach((a) => {
      if (
        (a.appealStatus || a.status || "").includes("접수") ||
        (a.appealStatus || a.status || "").includes("심리")
      )
        count++;
    });
    (approvalsData || []).forEach((doc) => {
      if (
        (doc.status || "").includes("대기") ||
        (doc.status || "").includes("진행")
      )
        count++;
    });
    return count;
  }, [ledgerData, appealsData, approvalsData]);

  // Inline Login States (For unauthenticated landing screen)
  const [inlineUsername, setInlineUsername] = useState("");
  const [inlinePassword, setInlinePassword] = useState("");
  const [inlineError, setInlineError] = useState("");
  const [showInlineHint, setShowInlineHint] = useState(false);
  const [showInlineRegister, setShowInlineRegister] = useState(false);

  const handleInlineLogin = (e) => {
    if (e) e.preventDefault();
    if (!inlineUsername.trim() || !inlinePassword) {
      setInlineError("아이디와 비밀번호를 입력해주세요.");
      return;
    }
    loginApi(inlineUsername.trim(), inlinePassword).then((res) => {
      if (!res?.success) {
        setInlineError(res?.message || "로그인에 실패했습니다.");
        return;
      }
      setInlineError("");
      handleLoginSuccess(
        { id: inlineUsername.trim(), password: inlinePassword },
        res,
      );
    });
  };

  // Load Persistence from Backend DB on mount
  useEffect(() => {
    if (!currentUser) return; // 로그인 상태일 때만 로드
    async function loadDbData() {
      const [
        serverCases,
        serverApprovals,
        serverReports,
        serverAppeals,
        serverBookings,
        serverAuditLogs,
        nextDocNoRes,
        serverProsecutors,
        serverCaseNumberSettings,
        serverDepartments,
        serverCharges,
      ] = await Promise.all([
        fetchCases(),
        fetchApprovals(),
        fetchReports(),
        fetchAppeals(),
        fetchBookings(),
        currentUser.isSuperAdmin ||
        currentUser.dept?.includes("사무국") ||
        ["CHIEF_ADMINISTRATOR", "ADMINISTRATOR", "ADMIN_PROBATIONARY"].includes(
          currentUser.roleLevel,
        )
          ? fetchAuditLogs()
          : Promise.resolve([]),
        fetchNextDocNo(),
        fetchProsecutors(),
        fetchCaseNumberSettings(),
        fetchDepartments(),
        fetchCharges(),
      ]);

      if (Array.isArray(serverCases)) setLedgerData(serverCases);
      if (Array.isArray(serverApprovals)) setApprovalsData(serverApprovals);
      if (Array.isArray(serverReports)) setReportsData(serverReports);
      if (Array.isArray(serverAppeals)) setAppealsData(serverAppeals);
      if (Array.isArray(serverBookings)) setBookingsData(serverBookings);
      if (Array.isArray(serverAuditLogs)) setAuditLogs(serverAuditLogs);
      if (serverProsecutors) setProsecutorsList(serverProsecutors);
      if (serverCaseNumberSettings)
        setCaseNumberSettings(serverCaseNumberSettings);
      if (Array.isArray(serverDepartments) && serverDepartments.length > 0)
        setDepartmentsData(serverDepartments);
      if (Array.isArray(serverCharges)) setChargesData(serverCharges);

      // 문서번호 카운터 서버 동기화
      if (nextDocNoRes && nextDocNoRes.seq) {
        setDocNoCounter(nextDocNoRes.seq);
      }
    }
    loadDbData();
  }, [currentUser]);

  const operationalProsecutorsList = prosecutorsList.filter(
    (prosecutor) => !isManagementAccount(prosecutor),
  );

  const pendingApprovalsCount = approvalsData.filter((a) =>
    a.status.includes("대기"),
  ).length;

  // ── 직급(roleLevel) 기반 정보 보안 스코핑 (이름/ID 하드코딩 제거) ─────
  const isGlobalAdmin =
    currentUser &&
    (currentUser.isSuperAdmin ||
      currentUser.roleLevel === "SUPER_ADMIN" ||
      currentUser.roleLevel === "PROSECUTOR_GENERAL" ||
      currentUser.roleLevel === "CHIEF_PROSECUTOR" ||
      currentUser.roleLevel === "DEPUTY_CHIEF" ||
      currentUser.roleLevel === "CHIEF_ADMINISTRATOR" ||
      (currentUser.dept && currentUser.dept.includes("사무국")));

  const canViewLoginRecords = Boolean(
    currentUser &&
    (currentUser.isSuperAdmin ||
      currentUser.dept?.includes("사무국") ||
      ["CHIEF_ADMINISTRATOR", "ADMINISTRATOR", "ADMIN_PROBATIONARY"].includes(
        currentUser.roleLevel,
      )),
  );

  const isProsecutorInUserDept = (prosecutorNameOrId) => {
    if (isGlobalAdmin || !currentUser) return true;
    const pUser = prosecutorsList.find(
      (p) =>
        p.id === prosecutorNameOrId ||
        p.name === prosecutorNameOrId ||
        p.name.includes(prosecutorNameOrId) ||
        (prosecutorNameOrId && prosecutorNameOrId.includes(p.name)),
    );
    return pUser ? pUser.dept === currentUser.dept : true;
  };

  const scopeRecords = (records, includeOwnRecord = false) => {
    if (isGlobalAdmin) return records;
    return records.filter((item) => {
      // 본인 담당 사건 또는 본인 작성 사건
      if (includeOwnRecord && item.prosecutorId === currentUser?.id)
        return true;
      // 동일 부서 사건
      if (isProsecutorInUserDept(item.prosecutorName)) return true;
      // 보존사건은 전 부서 열람 가능
      if (item.isArchived) return true;
      // 종국·기소 완료 사건은 전 부서 열람 가능 (서버 정책과 동기화)
      const disp = (item.disposition || "").toLowerCase();
      const status = (item.bookingStatus || "").toLowerCase();
      const CLOSED = [
        "불기소",
        "종국",
        "기소유예",
        "혐의없음",
        "무혐의",
        "죄가안됨",
        "공소권없음",
        "각하",
        "기소중지",
        "타관송치",
        "처분완료",
        "구속기소",
        "불구속기소",
        "약식기소",
        "구공판",
      ];
      if (CLOSED.some((k) => disp.includes(k) || status.includes(k)))
        return true;
      return false;
    });
  };

  const scopedLedgerData = scopeRecords(ledgerData, true);
  const scopedApprovalsData = scopeRecords(approvalsData, true);
  const scopedReportsData = scopeRecords(reportsData);
  const scopedAppealsData = scopeRecords(appealsData);
  const scopedBookingsData = scopeRecords(bookingsData);

  // Handler: Login Success (Persists Session — password 필드 제외)
  const handleLoginSuccess = async (user, authResult = null) => {
    const res = authResult || (await loginApi(user.id, user.password || ""));
    if (!res?.success) {
      showToast(
        `❌ 로그인 실패: ${res?.message || "서버에 연결할 수 없습니다."}`,
        "error",
      );
      return;
    }
    const loggedUser = res.user;
    // 비밀번호 필드를 세션에 저장하지 않음
    const { password: _pw, ...safeUser } = loggedUser;
    setCurrentUser(safeUser);
    try {
      sessionStorage.setItem("dose_pros_session", JSON.stringify(safeUser));
    } catch {}
    setIsLoginModalOpen(false);
    showToast(
      `✅ ${safeUser.name} (${safeUser.position || safeUser.title || safeUser.roleLevel}) 로그인 승인`,
      "success",
    );

    // ── 공소시효 자동 경보: D-2 이내 사건이 있으면 로그인 직후 팝업 ──
    // 서버에서 사건 데이터 로드 후 체크 (약간의 지연 후 실행)
    setTimeout(async () => {
      try {
        const cases = await fetchCases();
        if (!cases) return;
        const urgent = cases.filter((c) => {
          if (isCaseClosedOrIndicted(c)) return false;
          const sol = calculateStatuteOfLimitations(
            c.chargeName,
            c.incidentDate || c.bookingDate,
          );
          return sol.dDay !== Infinity && sol.dDay <= 2;
        });
        if (urgent.length > 0) {
          setIsDeadlineModalOpen(true);
          showToast(
            `⚠️ 공소시효 D-2 이내 사건 ${urgent.length}건이 있습니다!`,
            "error",
            6000,
          );
        }
      } catch {}
    }, 1500);
  };

  // Handler: Logout (Purges Session & Locks System)
  const handleLogout = () => {
    setCurrentUser(null);
    logoutApi();
    try {
      sessionStorage.removeItem("dose_pros_session");
    } catch {}
    setIsLoginModalOpen(true);
    showToast("🔒 보안 로그아웃 완료. 세션이 삭제되었습니다.", "info");
  };

  // Handler: Change Password (서버 + 로컬 state 동시 반영)
  const handleChangePassword = async (userId, currentPassword, newPassword) => {
    const res = await changePasswordApi(userId, currentPassword, newPassword);
    if (res && !res.success) {
      showToast(
        `❌ 비밀번호 변경 실패: ${res.message || "서버 오류"}`,
        "error",
      );
      return false;
    }
    showToast("🔑 비밀번호가 성공적으로 변경되었습니다.", "success");
    return true;
  };

  // Handler: Update Case Ledger Record (서버 저장 성공 후 state 갱신)
  const handleUpdateCase = async (updatedCase) => {
    if (!updatedCase.id) {
      showToast("❌ 사건 ID가 없어 수정할 수 없습니다.", "error");
      return false;
    }
    const res = await updateCaseApi(updatedCase.id, updatedCase);
    if (!res || !res.success) {
      showToast(
        `❌ 사건 수정 실패: ${res?.message || "서버 오류가 발생했습니다."}`,
        "error",
      );
      return false;
    }
    // 서버 저장 성공 후 화면 상태 갱신
    setLedgerData((prev) =>
      prev.map((item) =>
        item.id === updatedCase.id ? { ...item, ...updatedCase } : item,
      ),
    );
    showToast(
      `✏️ ${updatedCase.hyeongjeNo || updatedCase.sujeNo || updatedCase.id}호 사건 원부가 수정되었습니다.`,
      "success",
    );
    return true;
  };

  // Handler: Archive Case (사건 보존 / 보존 해제 처리)
  const handleArchiveCase = async (caseId, isArchived) => {
    const target = (ledgerData || []).find((c) => c.id === caseId);
    if (!target) return;

    const res = await archiveCaseApi(caseId, isArchived);
    if (res && res.success) {
      const nowStr =
        res.archivedAt ||
        new Date().toISOString().replace("T", " ").substring(0, 19);
      const actorName = res.archivedBy || currentUser?.name || "";
      setLedgerData((prev) =>
        prev.map((c) =>
          c.id === caseId
            ? {
                ...c,
                isArchived: isArchived ? 1 : 0,
                archivedAt: nowStr,
                archivedBy: actorName,
              }
            : c,
        ),
      );
      if (isArchived) {
        showToast(
          `📦 [${target.hyeongjeNo || target.sujeNo || target.id}] 사건이 보존 처리되어 [보존기록 서고]로 이동했습니다.`,
          "success",
        );
      } else {
        showToast(
          `🔄 [${target.hyeongjeNo || target.sujeNo || target.id}] 사건의 보존이 해제되어 원부 기본 목록으로 복원되었습니다.`,
          "info",
        );
      }
    } else {
      showToast("❌ 사건 보존 처리 중 오류가 발생했습니다.", "error");
    }
  };

  // Handler: Bulk Import Cases from Excel (검찰사무국 전용 — DB 영구 저장)
  const handleBulkImport = async (rows) => {
    if (!rows || rows.length === 0) return;

    // 1) API 호출하여 DB에 일괄 저장
    const res = await bulkImportCasesApi(rows);

    if (res && res.success && res.cases) {
      setLedgerData((prev) => [...res.cases, ...prev]);
      if (res.reports) setReportsData((prev) => [...res.reports, ...prev]);
      if (res.bookings) setBookingsData((prev) => [...res.bookings, ...prev]);

      showToast(
        `📥 ${res.count || res.cases.length}건의 사건이 엑셀에서 DB로 일괄 등록 저장되었습니다.`,
        "success",
      );
    } else {
      // 서버 미연결 모드 또는 에러 시 폴백
      const newCases = rows.map((r, i) => ({
        id: Date.now() + i,
        hyeongjeNo: r["형제번호"] || r["수제번호"] || "",
        latestHyeongjeNo: r["형제번호"] || r["수제번호"] || "",
        prosecutorName: r["검사명"] || "",
        prosecutorId: r["검사명"] || "",
        suspectName: r["피고인명"] || "",
        suspectUuid: r["UUID"] || "",
        bookingStatus: r["현재 상황"] || "접수",
        bookingDate: r["접수일시"] || "",
        bookingBasis: r["접수근거"] || "",
        disposition: r["처분내용"] || "",
        chargeName: r["죄명"] || "",
        court1No: r["1심 사건번호"] || "",
        court1Result: r["1심 결과"] || "",
        court1Doc: r["판결문"] || "",
        court1Appealed: r["항소 여부"] || "",
        court1Appellant: r["항소장"] || "",
        court2No: r["2심 사건번호"] || "",
        court2Dismissed: r["항소기각"] || "",
        court2Result: r["2심 결과"] || "",
        court2Doc: r["판결문(항소)"] || "",
        court3Appealed: r["상고 여부"] || "",
        court3Appellant: r["상고장"] || "",
        court3No: r["3심 사건번호"] || "",
        court3Remanded: r["파기환송"] || "",
        court3Result: r["3심 결과"] || "",
        court3Doc: r["판결문(상고)"] || "",
        reAppeal: "-",
        notes: "",
        content: "",
        confiscation: "",
      }));

      setLedgerData((prev) => [...newCases, ...prev]);
      showToast(
        `📥 ${newCases.length}건의 사건이 화면 메모리에 등록되었습니다.`,
        "info",
      );
    }
  };

  // Handler: Add New Appeal Record
  const handleAddAppeal = async (newAppeal) => {
    const savedAppeal = await createAppealApi(newAppeal);
    if (!savedAppeal?.success) {
      showToast(
        `❌ 항고 사건 저장 실패: ${savedAppeal?.message || "서버 오류"}`,
        "error",
      );
      return;
    }
    setAppealsData((prev) => [savedAppeal.appeal || newAppeal, ...prev]);
    showToast(
      `⚖️ ${newAppeal.appealNo}호 항고 사건이 접수되었습니다.`,
      "success",
    );
  };

  // Handler: Update Appeal Record
  const handleUpdateAppeal = async (updatedAppeal) => {
    const res = await updateAppealApi(updatedAppeal.id, updatedAppeal);
    if (!res?.success) {
      showToast(
        `❌ 항고 사건 수정 실패: ${res?.message || "서버 오류"}`,
        "error",
      );
      return;
    }
    setAppealsData((prev) =>
      prev.map((a) =>
        a.id === updatedAppeal.id ? res.appeal || updatedAppeal : a,
      ),
    );
    showToast(
      `⚖️ ${updatedAppeal.appealNo}호 항고 처분이 수정되었습니다.`,
      "success",
    );
  };

  // 공통 단순 삭제 헬퍼 — 낙관적 업데이트 + 서버 반영
  const makeDeleteHandler =
    (getData, setData, getLabel, apiFn) => async (id) => {
      const target = getData().find((item) => item.id === id);
      setData((prev) => prev.filter((item) => item.id !== id));
      if (apiFn) {
        const res = await apiFn(id);
        if (!res?.success) {
          setData((prev) => [target, ...prev]);
          showToast(`❌ 서버 삭제 실패: ${res?.message || "오류"}`, "error");
          return;
        }
      }
      showToast(`🗑️ ${getLabel(target)} 삭제되었습니다.`, "info");
    };

  // Handler: Delete Case (검찰사무국 전용) — 연계 데이터(reports, bookings)도 함께 제거
  const handleDeleteCase = async (caseId) => {
    const target = ledgerData.find((c) => c.id === caseId);
    // 낙관적 업데이트 (UI 즉시 반영)
    setLedgerData((prev) => prev.filter((c) => c.id !== caseId));
    setReportsData((prev) =>
      prev.filter(
        (r) =>
          r.hyeongjeNo !== target?.hyeongjeNo &&
          r.hyeongjeNo !== target?.sujeNo,
      ),
    );
    setBookingsData((prev) =>
      prev.filter(
        (b) =>
          b.hyeongjeNo !== target?.hyeongjeNo &&
          b.hyeongjeNo !== target?.sujeNo,
      ),
    );
    // 서버 DB 반영
    const res = await deleteCaseApi(caseId);
    if (!res?.success) {
      setLedgerData((prev) => [target, ...prev]);
      if (target) {
        setReportsData((prev) => [
          ...prev,
          ...reportsData.filter(
            (r) =>
              r.hyeongjeNo === target.hyeongjeNo ||
              r.hyeongjeNo === target.sujeNo,
          ),
        ]);
        setBookingsData((prev) => [
          ...prev,
          ...bookingsData.filter(
            (b) =>
              b.hyeongjeNo === target.hyeongjeNo ||
              b.hyeongjeNo === target.sujeNo,
          ),
        ]);
      }
      showToast(`❌ 서버 삭제 실패: ${res?.message || "오류"}`, "error");
    } else {
      showToast(
        `🗑️ ${target?.sujeNo || target?.hyeongjeNo} 사건이 삭제되었습니다.`,
        "info",
      );
    }
  };

  // Handler: Delete Appeal (검찰사무국 전용)
  const handleDeleteAppeal = makeDeleteHandler(
    () => appealsData,
    setAppealsData,
    (t) => `${t?.appealNo || ""} 항고 사건이`,
    deleteAppealApi,
  );

  // Handler: Delete Approval Doc (검찰사무국 전용)
  const handleDeleteApproval = makeDeleteHandler(
    () => approvalsData,
    setApprovalsData,
    (t) => `${t?.docNo || ""} 결재 문서가`,
    deleteApprovalApi,
  );

  // Handler: Delete Report (검찰사무국 전용)
  const handleDeleteReport = makeDeleteHandler(
    () => reportsData,
    setReportsData,
    (t) => `${t?.reportNo || ""} 입건 보고서가`,
    deleteReportApi,
  );

  // Handler: Delete Booking (검찰사무국 전용)
  const handleDeleteBooking = makeDeleteHandler(
    () => bookingsData,
    setBookingsData,
    (t) => `${t?.hyeongjeNo || ""} 입건 기록이`,
    deleteBookingApi,
  );

  // Handler: Designate Case as requiring supervisor approval before disposition
  // Called by supervisor (SENIOR_PROSECUTOR+) from MyCasesLedger or SecretariatAdmin
  const handleDesignateCase = async (caseId, supervisorUser) => {
    const target = ledgerData.find((c) => c.id === caseId);
    const designation = {
      ...target,
      supervisorDesignated: true,
      supervisorId: supervisorUser.id,
      supervisorName: supervisorUser.name,
    };
    const res = await updateCaseApi(caseId, designation);
    if (!res?.success) {
      showToast(
        `❌ 결재 지정 저장 실패: ${res?.message || "서버 오류"}`,
        "error",
      );
      return;
    }
    setLedgerData((prev) =>
      prev.map((item) => {
        if (item.id === caseId) {
          return {
            ...item,
            supervisorDesignated: true,
            supervisorId: supervisorUser.id,
            supervisorName: supervisorUser.name,
          };
        }
        return item;
      }),
    );
    showToast(
      `🔒 [결재 지정] ${target?.hyeongjeNo || caseId} 사건이 결재 필수 사건으로 지정되었습니다.`,
      "warning",
    );
  };

  // Handler: Undesignate Case (remove supervisor approval requirement)
  const handleUndesignateCase = async (caseId) => {
    const target = ledgerData.find((c) => c.id === caseId);
    const designation = {
      ...target,
      supervisorDesignated: false,
      supervisorId: "",
      supervisorName: "",
    };
    const res = await updateCaseApi(caseId, designation);
    if (!res?.success) {
      showToast(
        `❌ 결재 지정 해제 저장 실패: ${res?.message || "서버 오류"}`,
        "error",
      );
      return;
    }
    setLedgerData((prev) =>
      prev.map((item) => {
        if (item.id === caseId) {
          return {
            ...item,
            supervisorDesignated: false,
            supervisorId: "",
            supervisorName: "",
          };
        }
        return item;
      }),
    );
    showToast(
      `🔓 [결재 지정 해제] ${target?.hyeongjeNo || caseId} 사건의 결재 필수 지정이 해제되었습니다.`,
      "info",
    );
  };

  // Handler: Reassign Prosecutor for a Case (Secretariat Action)
  const handleReassignCase = async (
    hyeongjeNo,
    newProsecutorName,
    newProsecutorId,
  ) => {
    const target = ledgerData.find((item) => item.hyeongjeNo === hyeongjeNo);
    const res = await updateCaseApi(target?.id, {
      ...target,
      prosecutorName: newProsecutorName,
      prosecutorId: newProsecutorId,
      forceReassign: true,
    });
    if (!res?.success) {
      showToast(
        `❌ 사건 재배당 저장 실패: ${res?.message || "서버 오류"}`,
        "error",
      );
      return;
    }
    setLedgerData((prev) =>
      prev.map((item) => {
        if (item.hyeongjeNo === hyeongjeNo) {
          return {
            ...item,
            prosecutorName: newProsecutorName,
            prosecutorId: newProsecutorId,
          };
        }
        return item;
      }),
    );
  };

  // Handler: Bulk Reassign Cases (Secretariat Action)
  const handleBulkReassignCases = async (
    caseIds,
    toProsecutorId,
    toProsecutorName,
    reason,
  ) => {
    const res = await bulkReassignApi({
      caseIds,
      toProsecutorId,
      toProsecutorName,
      reason,
    });
    if (!res?.success) {
      showToast(
        `❌ 사건 일괄 재배당 저장 실패: ${res?.message || "서버 오류"}`,
        "error",
      );
      return false;
    }
    const targetSet = new Set(caseIds.map(String));
    setLedgerData((prev) =>
      prev.map((item) => {
        if (
          targetSet.has(String(item.id)) ||
          targetSet.has(String(item.hyeongjeNo))
        ) {
          return {
            ...item,
            prosecutorName: toProsecutorName,
            prosecutorId: toProsecutorId,
          };
        }
        return item;
      }),
    );
    showToast(
      `🔄 사건 ${caseIds.length}건이 '${toProsecutorName}' 검사에게 일괄 재배당되었습니다.`,
      "success",
    );
    return true;
  };

  // Handler: Add New Prosecutor Account (Secretariat Action)
  const handleAddProsecutor = async (newP) => {
    const res = await createProsecutorApi(newP);
    if (!res?.success) {
      showToast(`❌ 계정 저장 실패: ${res?.message || "서버 오류"}`, "error");
      return false;
    }
    setProsecutorsList((prev) => [...prev, res.prosecutor || newP]);
    showToast(`✅ '${newP.name}' 계정이 등록되었습니다.`, "success");
    return true;
  };

  // Handler: Delete Prosecutor Account (Secretariat Action)
  const handleDeleteProsecutor = async (userId) => {
    setProsecutorsList((prev) => prev.filter((p) => p.id !== userId));
    const res = await deleteProsecutorApi(userId);
    if (res && !res.success) {
      showToast(`❌ 계정 삭제 실패: ${res.message || "서버 오류"}`, "error");
    } else {
      showToast("🗑️ 계정이 성공적으로 삭제되었습니다.", "info");
    }
  };

  // Handler: Update Prosecutor Status (휴직, 대결, 결재권한 위임)
  const handleUpdateProsecutorStatus = async (userId, statusData) => {
    const res = await updateProsecutorApi(userId, statusData);
    if (!res?.success) {
      showToast(
        `❌ 계정 상태 저장 실패: ${res?.message || "서버 오류"}`,
        "error",
      );
      return;
    }
    setProsecutorsList((prev) =>
      prev.map((p) => (p.id === userId ? { ...p, ...statusData } : p)),
    );
    showToast(
      "👤 검사 신분 상태 및 결재 위임 권한이 설정되었습니다.",
      "success",
    );
  };

  // Handler: Add Department
  const handleAddDepartment = async (newDept) => {
    const next = [...departmentsData, newDept];
    const res = await saveDepartmentsApi(next);
    if (!res?.success) {
      showToast(`❌ 부서 저장 실패: ${res?.message || "서버 오류"}`, "error");
      return;
    }
    setDepartmentsData(next);
  };

  // Handler: Toggle Department Intake Permission
  const handleToggleDeptIntake = async (deptId) => {
    const next = departmentsData.map((d) => {
      if (d.id === deptId) {
        const nextState = !d.canIntake;
        showToast(
          `⚙️ '${d.name}' 사건 접수 권한이 ${nextState ? "부여" : "차단"}되었습니다.`,
          "info",
        );
        return { ...d, canIntake: nextState };
      }
      return d;
    });
    const res = await saveDepartmentsApi(next);
    if (!res?.success) {
      showToast(
        `❌ 부서 권한 저장 실패: ${res?.message || "서버 오류"}`,
        "error",
      );
      return;
    }
    setDepartmentsData(next);
  };

  // Check current user department intake permission
  const currentUserDeptObj = departmentsData.find(
    (d) => d.name === currentUser?.dept,
  );
  const userCanIntake =
    !currentUser ||
    currentUser.isSuperAdmin ||
    currentUser.roleLevel === "SUPER_ADMIN" ||
    currentUser.roleLevel === "PROSECUTOR_GENERAL" ||
    (currentUserDeptObj ? currentUserDeptObj.canIntake !== false : true);

  const handleTryOpenIntakeModal = () => {
    if (!userCanIntake) {
      showToast(
        `❌ [사건 접수 제한] 소속 부서('${currentUser?.dept}')는 사건 접수 권한이 없습니다. 검찰사무국에 권한을 요청하세요.`,
        "error",
      );
      return;
    }
    setIsIntakeModalOpen(true);
  };

  // Handler: Update User Department (and sync Position)
  const handleUpdateUserDept = async (userId, newDeptName) => {
    const res = await updateProsecutorApi(userId, { dept: newDeptName });
    if (!res?.success) {
      showToast(
        `❌ 부서 변경 저장 실패: ${res?.message || "서버 오류"}`,
        "error",
      );
      return;
    }
    setProsecutorsList((prev) =>
      prev.map((p) => {
        if (p.id === userId) {
          let newPos = `${newDeptName} 검사`;
          if (
            p.roleLevel === "CHIEF_PROSECUTOR" ||
            p.roleLevel === "PROSECUTOR_GENERAL"
          ) {
            newPos = `${newDeptName}장`;
          } else if (
            p.roleLevel === "SENIOR_PROSECUTOR" ||
            p.roleLevel === "DEPUTY_CHIEF"
          ) {
            newPos = `${newDeptName} 부장검사`;
          } else if (p.roleLevel === "CHIEF_ADMINISTRATOR") {
            newPos = `${newDeptName}장`;
          } else if (
            p.roleLevel === "ADMINISTRATOR" ||
            p.roleLevel === "ADMIN_PROBATIONARY"
          ) {
            newPos = `${newDeptName} 사무관`;
          }
          return {
            ...p,
            dept: newDeptName,
            position: newPos,
            title: `${newPos}`,
          };
        }
        return p;
      }),
    );
  };

  // Handler: Add New Intake Case (Persists to DB)
  const handleAddIntake = async (newCase) => {
    const savedBundle = await createIntakeBundleApi(newCase);
    if (!savedBundle?.success) {
      showToast(
        `❌ 사건 접수 실패: ${savedBundle?.message || "서버 오류"}`,
        "error",
      );
      return;
    }
    const persistedCase = savedBundle.case || newCase;
    const [serverReports, serverBookings] = await Promise.all([
      fetchReports(),
      fetchBookings(),
    ]);
    setLedgerData((prev) => [persistedCase, ...prev]);
    if (Array.isArray(serverReports)) setReportsData(serverReports);
    if (Array.isArray(serverBookings)) setBookingsData(serverBookings);

    const assignedCaseNo = persistedCase.sujeNo || persistedCase.hyeongjeNo;
    setIntakeNoticeData({
      caseNo: assignedCaseNo,
      chargeName: persistedCase.chargeName || newCase.chargeName,
      suspectName: persistedCase.suspectName || newCase.suspectName,
      suspectUuid: persistedCase.suspectUuid || newCase.suspectUuid,
      bookingDate: persistedCase.bookingDate || newCase.bookingDate,
      bookingBasis: persistedCase.bookingBasis || newCase.bookingBasis,
      prosecutorName: persistedCase.prosecutorName || newCase.prosecutorName,
      prosecutorDiscordId:
        persistedCase.prosecutorDiscordId || newCase.prosecutorDiscordId,
      registrantName: currentUser?.name || "",
      registrantTitle:
        currentUser?.title || currentUser?.position || "검찰사무원",
    });

    showToast(
      `📁 ${assignedCaseNo} 사건이 접수되어 ${persistedCase.prosecutorName} 검사에게 배당되었습니다.`,
      "success",
    );
  };

  // Handler: Update Approval Document Content
  const handleUpdateApprovalDoc = (updatedDoc) => {
    setApprovalsData((prev) =>
      prev.map((a) =>
        a.id === updatedDoc.id || a.docNo === updatedDoc.docNo
          ? { ...a, ...updatedDoc }
          : a,
      ),
    );
    updateApprovalApi(updatedDoc.id, updatedDoc).then((result) => {
      if (!result?.success)
        showToast("결재 문서 저장에 실패했습니다.", "error");
    });
  };

  // Handler: Approve E-Approval Document (Persists to DB)
  const handleApproveDoc = async (docId, userId, mode, customDoc) => {
    const result = await approveDocApi(docId, mode);
    if (!result?.success) {
      showToast(
        `❌ 결재 처리 실패: ${result?.message || "서버 오류"}`,
        "error",
      );
      return;
    }

    setApprovalsData((prev) =>
      prev.map((doc) => {
        if (doc.id === docId) {
          if (customDoc) {
            setLedgerData((lPrev) =>
              lPrev.map((item) => {
                if (item.hyeongjeNo === customDoc.hyeongjeNo) {
                  return {
                    ...item,
                    disposition: `${customDoc.dispositionType} (결재완료)`,
                  };
                }
                return item;
              }),
            );
            return customDoc;
          }

          const now = new Date()
            .toISOString()
            .replace("T", " ")
            .substring(0, 16);
          const updatedApprovals = doc.approvals.map((app, idx) => {
            const isLast = idx === doc.approvals.length - 1;
            return {
              ...app,
              name: isLast
                ? app.name
                : app.status.includes("대기")
                  ? `${app.name} [직권승인]`
                  : app.name,
              status: isLast ? "최종결재(인장날인)" : "승인완료",
              date: app.date === "-" ? now : app.date,
            };
          });

          setLedgerData((lPrev) =>
            lPrev.map((item) => {
              if (item.hyeongjeNo === doc.hyeongjeNo) {
                return {
                  ...item,
                  disposition: `${doc.dispositionType} (결재완료)`,
                };
              }
              return item;
            }),
          );

          return {
            ...doc,
            status: "최종승인",
            approvals: updatedApprovals,
          };
        }
        return doc;
      }),
    );
  };

  // Handler: Reject E-Approval Document (서버 연동)
  const handleRejectDoc = async (docId, userId, reason = "보완수사요구") => {
    // 낙관적 업데이트
    setApprovalsData((prev) =>
      prev.map((doc) => {
        if (doc.id === docId) {
          return {
            ...doc,
            status: `반려 — ${reason}`,
            approvals: (doc.approvals || []).map((a) =>
              a.status.includes("대기")
                ? {
                    ...a,
                    status: `반려 (${reason})`,
                    date: new Date()
                      .toISOString()
                      .replace("T", " ")
                      .substring(0, 16),
                  }
                : a,
            ),
          };
        }
        return doc;
      }),
    );
    const res = await rejectDocApi(docId, reason);
    if (res && !res.success) {
      showToast(`❌ 반려 처리 실패: ${res.message || "서버 오류"}`, "error");
    } else {
      showToast(`📋 결재 문서가 반려(${reason}) 처리되었습니다.`, "warning");
    }
  };

  // Handler: Update Document Number (Secretariat Admin)
  const handleUpdateDocNo = async (docId, newDocNo) => {
    const target = approvalsData.find((doc) => doc.id === docId);
    const res = await updateApprovalApi(docId, { ...target, docNo: newDocNo });
    if (!res?.success) {
      showToast(
        `❌ 문서번호 저장 실패: ${res?.message || "서버 오류"}`,
        "error",
      );
      return;
    }
    setApprovalsData((prev) =>
      prev.map((doc) => (doc.id === docId ? { ...doc, docNo: newDocNo } : doc)),
    );
  };

  // Handler: Delete Department
  const handleDeleteDepartment = async (deptId) => {
    const next = departmentsData.filter((d) => d.id !== deptId);
    const res = await saveDepartmentsApi(next);
    if (!res?.success) {
      showToast(
        `❌ 부서 삭제 저장 실패: ${res?.message || "서버 오류"}`,
        "error",
      );
      return;
    }
    setDepartmentsData(next);
  };

  // Helper: generate next sequential doc number
  const nextDocNo = () => {
    const seq = String(docNoCounter).padStart(3, "0");
    setDocNoCounter((c) => c + 1);
    return `2026-결재-${seq}`;
  };

  // Handler: Save New Approval Document to DB
  const handleSaveNewApproval = async (newDoc) => {
    // assign sequential doc number if not already set
    const docWithNo = { ...newDoc, docNo: newDoc.docNo || nextDocNo() };
    setApprovalsData([docWithNo, ...approvalsData]);
    await createApprovalApi(docWithNo);
  };

  // Handler: Add approval doc submitted directly from MyCasesLedger (기소/불기소 결재 상신)
  const handleAddApprovalFromMyCases = async (newDoc) => {
    const seqNo = nextDocNo();
    const uniqueId = `APP-MY-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const docWithNo = {
      ...newDoc,
      id: uniqueId,
      docNo: seqNo,
      docTypeName:
        newDoc.docType === "NON_INDICTMENT"
          ? "불기소 결정서"
          : "검찰 처분 결의서",
      status: "결재진행",
      createdAt: newDoc.createdAt || new Date().toISOString().split("T")[0],
      prosecutorId: currentUser?.id,
      prosecutorName: currentUser?.name,
      approvals: (newDoc.approvalLine || []).map((step, idx) => ({
        role: step.role,
        name: step.name,
        status: idx === 0 ? "상신완료" : "결재대기",
        date:
          idx === 0
            ? new Date().toISOString().replace("T", " ").substring(0, 16)
            : "-",
      })),
    };
    setApprovalsData((prev) => [docWithNo, ...prev]);
    await createApprovalApi(docWithNo);
    showToast(
      `📨 [${newDoc.dispositionType}] 결재 문서가 전자결재함에 상신되었습니다.`,
      "success",
    );
  };

  // Handler: Create Approval for specific Case from Ledger
  const handleCreateApprovalForCase = async (caseItem) => {
    const seqNo = nextDocNo();
    const supervisor = prosecutorsList.find((prosecutor) =>
      ["SENIOR_PROSECUTOR", "DEPUTY_CHIEF"].includes(prosecutor.roleLevel),
    );
    const chief = prosecutorsList.find((prosecutor) =>
      ["CHIEF_PROSECUTOR", "PROSECUTOR_GENERAL"].includes(prosecutor.roleLevel),
    );
    const newDoc = {
      id: `APP-2026-${String(docNoCounter).padStart(3, "0")}`,
      docNo: seqNo,
      docType: "DISPOSITION",
      docTypeName: "검찰 처분 결의서",
      title: `${caseItem.hyeongjeNo}호 피의자 ${caseItem.suspectName} 처분 결의서`,
      hyeongjeNo: caseItem.hyeongjeNo,
      prosecutorId: caseItem.prosecutorId,
      prosecutorName: caseItem.prosecutorName,
      suspectName: caseItem.suspectName,
      dispositionType: caseItem.disposition.includes("구속")
        ? "구속기소"
        : "불구속기소",
      chargeName: caseItem.chargeName || "형법 위반",
      summary: `피의자 ${caseItem.suspectName}의 범죄 사실이 명백하고 관련 증거가 제출되었으므로 검찰 처분안대로 결재 승인을 구함.`,
      status: "지검장결재대기",
      createdAt: new Date().toISOString().split("T")[0],
      approvals: [
        {
          role: "담당검사",
          name: caseItem.prosecutorName,
          status: "상신완료",
          date: new Date().toISOString().replace("T", " ").substring(0, 16),
        },
        {
          role: "부장검사",
          name: supervisor?.name || "",
          status: supervisor ? "검토승인" : "결재대기",
          date: supervisor
            ? new Date().toISOString().replace("T", " ").substring(0, 16)
            : "-",
        },
        {
          role: "지검장",
          name: chief?.name || "",
          status: "결재대기",
          date: "-",
        },
      ],
    };

    setApprovalsData([newDoc, ...approvalsData]);
    await createApprovalApi(newDoc);
    setActiveTab("approvals");
    showToast(
      `📨 ${caseItem.hyeongjeNo}호 처분 결의서가 결재함으로 상신되었습니다.`,
      "info",
    );
  };

  return (
    <div className="min-h-screen bg-[#090e1a] text-slate-100 flex flex-col font-sans">
      {/* Header Bar */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
        onOpenPasswordModal={() => setIsPasswordModalOpen(true)}
        pendingApprovalsCount={pendingApprovalsCount}
        onOpenIntakeModal={handleTryOpenIntakeModal}
        onOpenDeadlineModal={() => setIsDeadlineModalOpen(true)}
        onOpenTemplateModal={() => setIsTemplateModalOpen(true)}
        totalAlertsCount={totalDeadlineAlertsCount}
        isGlobalAdmin={isGlobalAdmin}
        canViewLoginRecords={canViewLoginRecords}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {!currentUser ? (
          <div
            className="glass-panel gold-border"
            style={{
              padding: "36px 28px",
              textAlign: "center",
              maxWidth: 520,
              margin: "30px auto",
              boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
            }}
          >
            {/* Official Logo */}
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 18,
                background: "linear-gradient(135deg, #1e3a8a, #f59e0b)",
                border: "1px solid rgba(245,158,11,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <Scale size={30} color="#fff" />
            </div>

            {/* Main Title */}
            <div
              style={{
                fontSize: "1.35rem",
                fontWeight: 900,
                color: "var(--text-main)",
                marginBottom: 4,
                letterSpacing: "-0.02em",
              }}
            >
              도스온라인 검찰청 사건관리 시스템
            </div>

            {/* Sub Instruction */}
            <div
              style={{
                fontSize: "0.98rem",
                fontWeight: 700,
                color: "var(--primary-amber)",
                marginBottom: 16,
              }}
            >
              사용하려면 로그인 하세요
            </div>

            {/* Legal Warning Notice */}
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: "rgba(239, 68, 68, 0.1)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                color: "#f87171",
                fontSize: "0.78rem",
                fontWeight: 600,
                lineHeight: 1.5,
                marginBottom: 20,
              }}
            >
              ⚠️ * 권한 없는 자의 시스템 사용은 관계 법령에 따라 처벌 될 수
              있습니다
            </div>

            {/* Embedded Login ID + Password Form */}
            <form
              onSubmit={handleInlineLogin}
              style={{
                textAlign: "left",
                background: "var(--bg-elevated)",
                borderRadius: 12,
                padding: 18,
                border: "1px solid var(--border-subtle)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {/* Username Input */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    marginBottom: 4,
                  }}
                >
                  검찰청 계정 아이디 (ID)
                </label>
                <div style={{ position: "relative" }}>
                  <User
                    size={16}
                    style={{
                      position: "absolute",
                      left: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-muted)",
                    }}
                  />
                  <input
                    className="input-field"
                    style={{ paddingLeft: 38 }}
                    type="text"
                    placeholder="아이디 입력"
                    value={inlineUsername}
                    onChange={(e) => {
                      setInlineUsername(e.target.value);
                      setInlineError("");
                    }}
                    autoFocus
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    marginBottom: 4,
                  }}
                >
                  비밀번호 (Password)
                </label>
                <div style={{ position: "relative" }}>
                  <KeyRound
                    size={16}
                    style={{
                      position: "absolute",
                      left: 12,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-muted)",
                    }}
                  />
                  <input
                    className="input-field"
                    style={{ paddingLeft: 38 }}
                    type="password"
                    placeholder="비밀번호 입력"
                    value={inlinePassword}
                    onChange={(e) => {
                      setInlinePassword(e.target.value);
                      setInlineError("");
                    }}
                    required
                  />
                </div>
              </div>

              {inlineError && (
                <div
                  style={{
                    color: "#f87171",
                    fontSize: "0.75rem",
                    padding: "6px 10px",
                    borderRadius: 6,
                    background: "rgba(239,68,68,0.1)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <AlertCircle size={14} /> {inlineError}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-gold"
                style={{
                  width: "100%",
                  padding: "11px",
                  fontSize: "0.92rem",
                  fontWeight: 800,
                  justifyContent: "center",
                  marginTop: 4,
                }}
              >
                <Lock size={16} /> 로그인 인증 및 시스템 접속
              </button>
            </form>

            {/* 가입 신청 버튼 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                margin: "14px 0 4px",
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: "var(--border-subtle)",
                }}
              />
              <span
                style={{
                  fontSize: "0.72rem",
                  color: "var(--text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                계정이 없으신가요?
              </span>
              <div
                style={{
                  flex: 1,
                  height: 1,
                  background: "var(--border-subtle)",
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowInlineRegister(true)}
              className="btn btn-secondary"
              style={{
                width: "100%",
                padding: "11px",
                fontWeight: 700,
                justifyContent: "center",
                fontSize: "0.88rem",
              }}
            >
              <UserPlus size={15} /> 검찰청 가입 신청
            </button>
            <div
              style={{
                fontSize: "0.7rem",
                color: "var(--text-muted)",
                textAlign: "center",
                marginTop: 6,
              }}
            >
              가입 신청 후{" "}
              <strong style={{ color: "var(--primary-amber)" }}>
                검찰사무국
              </strong>
              의 허가가 완료되면 로그인 가능합니다
            </div>

            {/* 인라인 화면 가입 신청 모달 */}
            <RegisterModal
              isOpen={showInlineRegister}
              onClose={() => setShowInlineRegister(false)}
              departmentsData={departmentsData}
            />
          </div>
        ) : (
          <>
            {/* Department Scope Banner */}
            {!isGlobalAdmin ? (
              <div
                className="glass-panel"
                style={{
                  padding: "10px 16px",
                  borderLeft: "4px solid var(--primary-amber)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "0.8rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "0.9rem" }}>📍</span>
                  <span>
                    소속 부서{" "}
                    <strong style={{ color: "var(--primary-amber)" }}>
                      [{currentUser.dept}]
                    </strong>{" "}
                    보안 격리 모드 적용 중 (자기 부서 전용 사건·결재문서만
                    표시됩니다)
                  </span>
                </div>
                <span
                  className="badge badge-gold"
                  style={{ fontSize: "0.68rem" }}
                >
                  부서 보안 권한
                </span>
              </div>
            ) : (
              <div
                className="glass-panel"
                style={{
                  padding: "10px 16px",
                  borderLeft: "4px solid #3b82f6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "0.8rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "0.9rem" }}>🌐</span>
                  <span>
                    권한 레벨:{" "}
                    <strong style={{ color: "#60a5fa" }}>
                      [{currentUser.position || currentUser.title}]
                    </strong>{" "}
                    (전체 부서 사건 및 결재 통합 열람 권한)
                  </span>
                </div>
                <span
                  className="badge badge-info"
                  style={{ fontSize: "0.68rem" }}
                >
                  전 부서 관람 가능
                </span>
              </div>
            )}

            {activeTab === "mycases" && (
              <MyCasesLedger
                ledgerData={scopedLedgerData}
                currentUser={currentUser}
                prosecutorsList={operationalProsecutorsList}
                chargesData={chargesData}
                onSelectEvidence={(url, caseNo, suspectName) =>
                  setEvidenceModalInfo({ url, caseNo, suspectName })
                }
                onSelectSuspect={(suspect) => setSuspectHistoryName(suspect)}
                onOpenTimeline={(caseItem) => setTimelineCaseItem(caseItem)}
                onOpenMemo={(caseItem) => setMemoCaseItem(caseItem)}
                onOpenApprovalForCase={handleCreateApprovalForCase}
                onUpdateCase={handleUpdateCase}
                onArchiveCase={handleArchiveCase}
                onOpenLoginModal={() => setIsLoginModalOpen(true)}
                onAddApproval={handleAddApprovalFromMyCases}
                approvalsData={approvalsData}
                onDesignateCase={(caseId) =>
                  handleDesignateCase(caseId, currentUser)
                }
                onUndesignateCase={handleUndesignateCase}
              />
            )}

            {activeTab === "warrants" && (
              <WarrantLedger
                currentUser={currentUser}
                prosecutorsList={operationalProsecutorsList}
                onSelectEvidence={(url, caseNo, suspectName) =>
                  setEvidenceModalInfo({ url, caseNo, suspectName })
                }
                onSelectSuspect={(suspect) => setSuspectHistoryName(suspect)}
              />
            )}

            {activeTab === "ledger" && (
              <MainLedger
                ledgerData={scopedLedgerData}
                departmentsData={departmentsData}
                prosecutorsList={operationalProsecutorsList}
                chargesData={chargesData}
                onSelectEvidence={(url, caseNo, suspectName) =>
                  setEvidenceModalInfo({ url, caseNo, suspectName })
                }
                onSelectSuspect={(suspect) => setSuspectHistoryName(suspect)}
                onOpenTimeline={(caseItem) => setTimelineCaseItem(caseItem)}
                onOpenMemo={(caseItem) => setMemoCaseItem(caseItem)}
                onCreateApproval={handleCreateApprovalForCase}
                onUpdateCase={handleUpdateCase}
                onArchiveCase={handleArchiveCase}
                currentRole={currentUser?.id || ""}
                currentUser={currentUser}
                approvalsData={approvalsData}
                onDesignateCase={(caseId) =>
                  handleDesignateCase(caseId, currentUser)
                }
                onUndesignateCase={handleUndesignateCase}
              />
            )}

            {activeTab === "approvals" && (
              <ApprovalSystem
                approvals={scopedApprovalsData}
                onApproveDoc={handleApproveDoc}
                onRejectDoc={handleRejectDoc}
                currentUser={currentUser}
                onSaveNewApproval={handleSaveNewApproval}
                onUpdateApprovalDoc={handleUpdateApprovalDoc}
                ledgerData={scopedLedgerData}
                nextDocNo={nextDocNo}
                onToast={showToast}
                prosecutorsList={operationalProsecutorsList}
                onUpdateProsecutorStatus={handleUpdateProsecutorStatus}
              />
            )}

            {activeTab === "secretariat" && (
              <SecretariatAdmin
                ledgerData={ledgerData}
                approvalsData={approvalsData}
                appealsData={appealsData}
                reportsData={reportsData}
                bookingsData={bookingsData}
                departmentsData={departmentsData}
                prosecutorsList={prosecutorsList}
                onReassignCase={handleReassignCase}
                onBulkReassign={handleBulkReassignCases}
                onUpdateCase={handleUpdateCase}
                onDeleteCase={handleDeleteCase}
                onDesignateCase={(caseId) =>
                  handleDesignateCase(caseId, currentUser)
                }
                onUndesignateCase={handleUndesignateCase}
                onArchiveCase={handleArchiveCase}
                onDeleteAppeal={handleDeleteAppeal}
                onDeleteApproval={handleDeleteApproval}
                onDeleteReport={handleDeleteReport}
                onDeleteBooking={handleDeleteBooking}
                onAddProsecutor={handleAddProsecutor}
                onDeleteProsecutor={handleDeleteProsecutor}
                onUpdateProsecutorStatus={handleUpdateProsecutorStatus}
                onUpdateDocNo={handleUpdateDocNo}
                onAddDepartment={handleAddDepartment}
                onDeleteDepartment={handleDeleteDepartment}
                onToggleDeptIntake={handleToggleDeptIntake}
                onUpdateUserDept={handleUpdateUserDept}
                docNoCounter={docNoCounter}
                setDocNoCounter={setDocNoCounter}
                currentUser={currentUser}
                onOpenLoginModal={() => setIsLoginModalOpen(true)}
                onBulkImport={handleBulkImport}
                caseNumberSettings={caseNumberSettings}
                onUpdateCaseNumberSettings={setCaseNumberSettings}
                chargesData={chargesData}
                onUpdateCharges={setChargesData}
                auditLogs={auditLogs}
              />
            )}

            {activeTab === "reports" && (
              <ReportLedger
                reports={scopedReportsData}
                onSelectEvidence={(url, caseNo, suspectName) =>
                  setEvidenceModalInfo({ url, caseNo, suspectName })
                }
                onSelectSuspect={(suspect) => setSuspectHistoryName(suspect)}
              />
            )}

            {activeTab === "appeals" && (
              <AppealLedger
                appeals={scopedAppealsData}
                ledgerData={scopedLedgerData}
                prosecutorsList={operationalProsecutorsList}
                currentUser={currentUser}
                onAddAppeal={handleAddAppeal}
                onUpdateAppeal={handleUpdateAppeal}
                onSelectEvidence={(url, caseNo, suspectName) =>
                  setEvidenceModalInfo({ url, caseNo, suspectName })
                }
                onSelectSuspect={(suspect) => setSuspectHistoryName(suspect)}
              />
            )}

            {activeTab === "bookings" && (
              <BookingLedger
                bookings={scopedBookingsData}
                onSelectEvidence={(url, caseNo, suspectName) =>
                  setEvidenceModalInfo({ url, caseNo, suspectName })
                }
                onSelectSuspect={(suspect) => setSuspectHistoryName(suspect)}
              />
            )}

            {activeTab === "preserved" && (
              <PreservedCasesLedger
                ledgerData={scopedLedgerData}
                currentUser={currentUser}
                onSelectEvidence={(url, caseNo, suspectName) =>
                  setEvidenceModalInfo({ url, caseNo, suspectName })
                }
                onSelectSuspect={(suspect) => setSuspectHistoryName(suspect)}
                onArchiveCase={handleArchiveCase}
              />
            )}

            {activeTab === "search" && (
              <SearchSystem
                ledgerData={scopedLedgerData}
                onSelectEvidence={(url, caseNo, suspectName) =>
                  setEvidenceModalInfo({ url, caseNo, suspectName })
                }
                onSelectSuspect={(suspect) => setSuspectHistoryName(suspect)}
              />
            )}

            {activeTab === "analytics" && (
              <AnalyticsDashboard ledgerData={scopedLedgerData} />
            )}

            {activeTab === "auditlog" && canViewLoginRecords && (
              <AuditLogViewer auditLogs={auditLogs} />
            )}
          </>
        )}
      </main>

      {/* Global Modals */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onLoginSuccess={handleLoginSuccess}
        onClose={() => setIsLoginModalOpen(false)}
        prosecutorsList={operationalProsecutorsList}
        departmentsData={departmentsData}
      />

      <PasswordChangeModal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        currentUser={currentUser}
        onChangePassword={handleChangePassword}
      />

      <IntakeModal
        isOpen={isIntakeModalOpen}
        onClose={() => setIsIntakeModalOpen(false)}
        onSubmitIntake={handleAddIntake}
        currentUser={currentUser}
        prosecutorsList={operationalProsecutorsList}
        ledgerData={ledgerData}
        caseNumberSettings={caseNumberSettings}
        chargesData={chargesData}
      />

      <EvidenceModal
        isOpen={!!evidenceModalInfo}
        url={evidenceModalInfo?.url}
        caseNo={evidenceModalInfo?.caseNo}
        suspectName={evidenceModalInfo?.suspectName}
        onClose={() => setEvidenceModalInfo(null)}
      />

      <SuspectHistoryModal
        isOpen={!!suspectHistoryName}
        suspectName={suspectHistoryName?.name || suspectHistoryName}
        suspectUuid={suspectHistoryName?.uuid || null}
        ledgerData={ledgerData}
        onClose={() => setSuspectHistoryName(null)}
      />

      <CaseTimelineModal
        isOpen={!!timelineCaseItem}
        onClose={() => setTimelineCaseItem(null)}
        caseItem={timelineCaseItem}
        reportsData={reportsData}
        bookingsData={bookingsData}
        approvalsData={approvalsData}
        appealsData={appealsData}
        onSelectEvidence={(url, caseNo, suspectName) =>
          setEvidenceModalInfo({ url, caseNo, suspectName })
        }
      />

      <CaseMemoModal
        isOpen={!!memoCaseItem}
        onClose={() => setMemoCaseItem(null)}
        caseItem={memoCaseItem}
        currentUser={currentUser}
        onToast={showToast}
      />

      <DeadlineAlertModal
        isOpen={isDeadlineModalOpen}
        onClose={() => setIsDeadlineModalOpen(false)}
        ledgerData={ledgerData}
        appealsData={appealsData}
        approvalsData={approvalsData}
      />

      {/* 사건접수 배당 알림 복사 팝업 모달 */}
      {intakeNoticeData && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(3, 7, 18, 0.85)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="glass-panel gold-border"
            style={{
              width: "100%",
              maxWidth: 480,
              padding: 24,
              borderRadius: 14,
              boxShadow: "0 25px 60px rgba(0,0,0,0.7)",
            }}
          >
            <div
              style={{
                fontWeight: 800,
                fontSize: "1rem",
                color: "var(--primary-amber)",
                marginBottom: 14,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>📋 사건접수배당 알림 팝업</span>
              <button
                onClick={() => setIntakeNoticeData(null)}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  fontSize: "1.2rem",
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                background: "#fff",
                color: "#000",
                padding: 20,
                borderRadius: 8,
                fontSize: "0.88rem",
                lineHeight: 1.7,
                fontFamily: "'Noto Sans KR', sans-serif",
                whiteSpace: "pre-wrap",
                marginBottom: 16,
                border: "1px solid #cbd5e1",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                기존 사건접수배당 알림
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>
                {formatLegacyIntakeNotice(
                  intakeNoticeData,
                  intakeNoticeData.registrantName || currentUser?.name,
                  intakeNoticeData.registrantTitle ||
                    currentUser?.title ||
                    currentUser?.position,
                )}
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    formatLegacyIntakeNotice(
                      intakeNoticeData,
                      intakeNoticeData.registrantName || currentUser?.name,
                      intakeNoticeData.registrantTitle ||
                        currentUser?.title ||
                        currentUser?.position,
                    ),
                  );
                  showToast("기존 알림 문구가 복사되었습니다.", "success");
                }}
                className="btn btn-secondary"
                style={{
                  marginTop: 12,
                  padding: "8px 14px",
                  fontSize: "0.8rem",
                }}
              >
                기존 알림 문구 복사
              </button>
            </div>

            <div
              style={{
                background: "#fff",
                color: "#000",
                padding: 20,
                borderRadius: 8,
                fontSize: "0.88rem",
                lineHeight: 1.7,
                fontFamily: "'Noto Sans KR', sans-serif",
                whiteSpace: "pre-wrap",
                marginBottom: 16,
                border: "1px solid #cbd5e1",
              }}
            >
              <div style={{ fontWeight: 800, marginBottom: 8 }}>
                신규 신건 접수 통지
              </div>
              {formatIntakeNotice(intakeNoticeData)}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    formatIntakeNotice(intakeNoticeData),
                  );
                  showToast("신건 접수 통지 문구가 복사되었습니다.", "success");
                }}
                className="btn btn-gold"
                style={{
                  marginTop: 12,
                  padding: "8px 14px",
                  fontSize: "0.8rem",
                }}
              >
                신건 접수 통지 복사
              </button>
            </div>

            <div
              style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}
            >
              <button
                onClick={() => setIntakeNoticeData(null)}
                className="btn btn-secondary"
                style={{ padding: "10px 16px", fontSize: "0.85rem" }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      <OfficialTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        showToast={showToast}
        ledgerData={ledgerData}
        currentUser={currentUser}
        onCreateApprovalFromDoc={({ caseItem }) => {
          setIsTemplateModalOpen(false);
          setActiveTab("approvals");
        }}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        도스온라인 검찰청 (Dose Online Prosecution Office) · 검찰사무국 총괄
        관리 포털 v4.0
      </footer>
      {/* Toast Notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <style>{`@keyframes toastIn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }`}</style>
    </div>
  );
}
