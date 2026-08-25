import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Scale, Lock, CheckCircle, User, KeyRound, AlertCircle, HelpCircle, UserPlus } from 'lucide-react';

import Header from './components/Header';
import MainLedger from './components/MainLedger';
import MyCasesLedger from './components/MyCasesLedger';
import WarrantLedger from './components/WarrantLedger';
import ApprovalSystem from './components/ApprovalSystem';
import ReportLedger from './components/ReportLedger';
import AppealLedger from './components/AppealLedger';
import BookingLedger from './components/BookingLedger';
import SearchSystem from './components/SearchSystem';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import SecretariatAdmin from './components/SecretariatAdmin';
import IntakeModal from './components/IntakeModal';
import EvidenceModal from './components/EvidenceModal';
import SuspectHistoryModal from './components/SuspectHistoryModal';
import LoginModal from './components/LoginModal';
import PasswordChangeModal from './components/PasswordChangeModal';
import DeadlineAlertModal from './components/DeadlineAlertModal';
import OfficialTemplateModal from './components/OfficialTemplateModal';
import RegisterModal from './components/RegisterModal';

import Toast from './components/Toast';

import { 
  INITIAL_MAIN_LEDGER, 
  INITIAL_REPORTS, 
  INITIAL_APPEALS, 
  INITIAL_BOOKINGS, 
  INITIAL_APPROVALS,
  INITIAL_DEPARTMENTS,
  PROSECUTORS,
} from './data/prosecutionData';

import { 
  fetchCases, 
  createCaseApi, 
  fetchApprovals, 
  createApprovalApi, 
  approveDocApi,
  loginApi,
  logoutApi,
} from './services/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('ledger');
  
  // Auth Session State (Commercial Security Gate - Defaults to null with sessionStorage persistence)
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = sessionStorage.getItem('dose_pros_session');
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
  const [prosecutorsList, setProsecutorsList] = useState(PROSECUTORS.filter(p => p.id !== 'sys_admin'));

  // 문서번호 자동 순번 카운터 (INITIAL_APPROVALS 길이 기준 시작)
  const [docNoCounter, setDocNoCounter] = useState(INITIAL_APPROVALS.length + 1);

  // Toast
  const [toasts, setToasts] = useState([]);
  const showToast = (message, type = 'success', duration = 4000) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, duration }]);
  };
  const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  // Modal States
  const [isIntakeModalOpen, setIsIntakeModalOpen] = useState(false);
  const [evidenceModalInfo, setEvidenceModalInfo] = useState(null);
  const [suspectHistoryName, setSuspectHistoryName] = useState(null);
  const [isDeadlineModalOpen, setIsDeadlineModalOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [intakeNoticeData, setIntakeNoticeData] = useState(null);


  // Compute total alert counts for Header badge
  const totalDeadlineAlertsCount = useMemo(() => {
    let count = 0;
    (ledgerData || []).forEach(c => {
      if ((c.bookingStatus || c.disposition || '').includes('구속')) count++;
    });
    (appealsData || []).forEach(a => {
      if ((a.appealStatus || a.status || '').includes('접수') || (a.appealStatus || a.status || '').includes('심리')) count++;
    });
    (approvalsData || []).forEach(doc => {
      if ((doc.status || '').includes('대기') || (doc.status || '').includes('진행')) count++;
    });
    return count;
  }, [ledgerData, appealsData, approvalsData]);

  // Inline Login States (For unauthenticated landing screen)
  const [inlineUsername, setInlineUsername] = useState('');
  const [inlinePassword, setInlinePassword] = useState('');
  const [inlineError, setInlineError] = useState('');
  const [showInlineHint, setShowInlineHint] = useState(false);
  const [showInlineRegister, setShowInlineRegister] = useState(false);

  /**
   * 공통 로그인 검증 로직 — LoginModal과 인라인 폼 양쪽에서 사용
   * @param {string} id - 입력된 아이디
   * @param {string} password - 입력된 비밀번호
   * @param {Function} setError - 에러 메시지 setter
   * @returns {object|null} 인증된 사용자 객체 또는 null
   */
  const validateLogin = (id, password, setError) => {
    const cleanId = id.trim();
    if (!cleanId) {
      setError('검찰청 아이디를 입력해주세요.');
      return null;
    }
    const user = prosecutorsList.find(
      p => p.id.toLowerCase() === cleanId.toLowerCase() || p.name === cleanId
    );
    if (!user) {
      setError('존재하지 않는 검찰청 계정 아이디입니다.');
      return null;
    }
    if (password !== user.password) {
      setError('비밀번호가 올바르지 않습니다.');
      return null;
    }
    setError('');
    return user;
  };

  const handleInlineLogin = (e) => {
    if (e) e.preventDefault();
    const user = validateLogin(inlineUsername, inlinePassword, setInlineError);
    if (user) handleLoginSuccess(user);
  };

  // Load Persistence from Backend DB on mount
  useEffect(() => {
    if (!currentUser) return; // 로그인 상태일 때만 로드
    async function loadDbData() {
      const serverCases = await fetchCases();
      if (serverCases && serverCases.length > 0) {
        setLedgerData(serverCases);
      }

      const serverApprovals = await fetchApprovals();
      if (serverApprovals && serverApprovals.length > 0) {
        setApprovalsData(serverApprovals);
      }
    }
    loadDbData();
  }, [currentUser]);

  const pendingApprovalsCount = approvalsData.filter(a => a.status.includes('대기')).length;

  // ── 직급(roleLevel) 기반 정보 보안 스코핑 (이름/ID 하드코딩 제거) ─────
  const isGlobalAdmin = currentUser && (
    currentUser.isSuperAdmin ||
    currentUser.roleLevel === 'SUPER_ADMIN' ||
    currentUser.roleLevel === 'PROSECUTOR_GENERAL' ||
    currentUser.roleLevel === 'CHIEF_PROSECUTOR' ||
    currentUser.roleLevel === 'DEPUTY_CHIEF' ||
    currentUser.roleLevel === 'CHIEF_ADMINISTRATOR' ||
    (currentUser.dept && currentUser.dept.includes('사무국'))
  );

  const isProsecutorInUserDept = (prosecutorNameOrId) => {
    if (isGlobalAdmin || !currentUser) return true;
    const pUser = prosecutorsList.find(p => 
      p.id === prosecutorNameOrId || 
      p.name === prosecutorNameOrId || 
      p.name.includes(prosecutorNameOrId) || 
      (prosecutorNameOrId && prosecutorNameOrId.includes(p.name))
    );
    return pUser ? pUser.dept === currentUser.dept : true;
  };

  const scopedLedgerData = isGlobalAdmin
    ? ledgerData
    : ledgerData.filter(item => isProsecutorInUserDept(item.prosecutorName) || item.prosecutorId === currentUser?.id);

  const scopedApprovalsData = isGlobalAdmin
    ? approvalsData
    : approvalsData.filter(item => isProsecutorInUserDept(item.prosecutorName) || item.prosecutorId === currentUser?.id);

  const scopedReportsData = isGlobalAdmin
    ? reportsData
    : reportsData.filter(item => isProsecutorInUserDept(item.prosecutorName));

  const scopedAppealsData = isGlobalAdmin
    ? appealsData
    : appealsData.filter(item => isProsecutorInUserDept(item.prosecutorName));

  const scopedBookingsData = isGlobalAdmin
    ? bookingsData
    : bookingsData.filter(item => isProsecutorInUserDept(item.prosecutorName));

  // Handler: Login Success (Persists Session — password 필드 제외)
  const handleLoginSuccess = async (user) => {
    const res = await loginApi(user.id, user.password || '');
    const loggedUser = (res && res.success) ? res.user : user;
    // 비밀번호 필드를 세션에 저장하지 않음
    const { password: _pw, ...safeUser } = loggedUser;
    setCurrentUser(safeUser);
    try { sessionStorage.setItem('dose_pros_session', JSON.stringify(safeUser)); } catch {}
    setIsLoginModalOpen(false);
    showToast(`✅ ${user.name} (${user.position || user.title}) 로그인 승인`, 'success');
  };

  // Handler: Logout (Purges Session & Locks System)
  const handleLogout = () => {
    setCurrentUser(null);
    logoutApi();
    try { sessionStorage.removeItem('dose_pros_session'); } catch {}
    setIsLoginModalOpen(true);
    showToast('🔒 보안 로그아웃 완료. 세션이 삭제되었습니다.', 'info');
  };

  // Handler: Change Password
  const handleChangePassword = (userId, newPassword) => {
    setProsecutorsList(prev => prev.map(p => p.id === userId ? { ...p, password: newPassword } : p));
    if (currentUser && currentUser.id === userId) {
      setCurrentUser(prev => ({ ...prev, password: newPassword }));
    }
  };

  // Handler: Update Case Ledger Record (Persists in State & Local Storage)
  const handleUpdateCase = (updatedCase) => {
    setLedgerData(prev => prev.map(item => item.id === updatedCase.id || item.hyeongjeNo === updatedCase.hyeongjeNo ? { ...item, ...updatedCase } : item));
    showToast(`✏️ ${updatedCase.hyeongjeNo}호 사건 원부가 수정되었습니다.`, 'success');
  };

  // Handler: Bulk Import Cases from Excel (검찰사무국 전용)
  const handleBulkImport = (rows) => {
    if (!rows || rows.length === 0) return;
    const newCases = rows.map((r, i) => ({
      id: Date.now() + i,
      hyeongjeNo:        r['형제번호'] || r['수제번호'] || '',
      gyeongjeNo:        r['수제번호'] || '',
      latestHyeongjeNo:  r['형제번호'] || r['수제번호'] || '',
      prosecutorName:    r['검사명'] || '',
      prosecutorId:      r['검사명'] || '',
      suspectName:       r['피고인명'] || '',
      suspectUuid:       r['UUID'] || '',
      bookingStatus:     r['현재 상황'] || '접수',
      bookingDate:       r['접수일시'] || '',
      bookingBasis:      r['접수근거'] || '',
      disposition:       r['처분내용'] || '',
      chargeName:        r['죄명'] || '',
      court1No:          r['1심 사건번호'] || '',
      court1Result:      r['1심 결과'] || '',
      court1Doc:         r['판결문'] || '',
      court1Appealed:    r['항소 여부'] || '',
      court1Appellant:   r['항소장'] || '',
      court2No:          r['2심 사건번호'] || '',
      court2Dismissed:   r['항소기각'] || '',
      court2Result:      r['2심 결과'] || '',
      court2Doc:         r['판결문(항소)'] || '',
      court3Appealed:    r['상고 여부'] || '',
      court3Appellant:   r['상고장'] || '',
      court3No:          r['3심 사건번호'] || '',
      court3Remanded:    r['파기환송'] || '',
      court3Result:      r['3심 결과'] || '',
      court3Doc:         r['판결문(상고)'] || '',
      reAppeal:          '-',
      notes:             '',
      content:           '',
      confiscation:      '',
    }));

    const newReports = newCases.map((c, i) => ({
      id: Date.now() + 1000 + i,
      reportNo: `접수-${Date.now() + i}`,
      hyeongjeNo: c.hyeongjeNo,
      title: `${c.chargeName} 사건 접수 건`,
      prosecutorName: c.prosecutorName,
      suspectName: c.suspectName,
      suspectUuid: c.suspectUuid,
      status: '입건 완료',
      createdAt: c.bookingDate,
      basisUrl: c.bookingBasis,
      period: `${c.bookingDate} ~ 수사중`,
      confiscation: '-',
    }));

    const newBookings = newCases.map((c, i) => ({
      id: Date.now() + 2000 + i,
      hyeongjeNo: c.hyeongjeNo,
      prosecutorName: c.prosecutorName,
      suspectName: c.suspectName,
      suspectUuid: c.suspectUuid,
      dispositionStatus: c.bookingStatus,
      bookingDate: c.bookingDate,
      basisUrl: c.bookingBasis,
      daysElapsed: 0,
      indictmentDecision: c.disposition || '수사 진행 중',
    }));

    setLedgerData(prev => [...newCases, ...prev]);
    setReportsData(prev => [...newReports, ...prev]);
    setBookingsData(prev => [...newBookings, ...prev]);
    showToast(`📥 ${newCases.length}건의 사건이 일괄 등록되었습니다.`, 'success');
  };

  // Handler: Add New Appeal Record
  const handleAddAppeal = (newAppeal) => {
    setAppealsData(prev => [newAppeal, ...prev]);
    showToast(`⚖️ ${newAppeal.appealNo}호 항고 사건이 접수되었습니다.`, 'success');
  };

  // Handler: Update Appeal Record
  const handleUpdateAppeal = (updatedAppeal) => {
    setAppealsData(prev => prev.map(a => a.id === updatedAppeal.id ? updatedAppeal : a));
    showToast(`⚖️ ${updatedAppeal.appealNo}호 항고 처분이 수정되었습니다.`, 'success');
  };

  // 공통 단순 삭제 헬퍼 — 단일 배열에서 id로 제거 후 토스트
  const makeDeleteHandler = (getData, setData, getLabel) => (id) => {
    const target = getData().find(item => item.id === id);
    setData(prev => prev.filter(item => item.id !== id));
    showToast(`🗑️ ${getLabel(target)} 삭제되었습니다.`, 'info');
  };

  // Handler: Delete Case (검찰사무국 전용) — 연계 데이터(reports, bookings)도 함께 제거
  const handleDeleteCase = (caseId) => {
    const target = ledgerData.find(c => c.id === caseId);
    setLedgerData(prev => prev.filter(c => c.id !== caseId));
    setReportsData(prev => prev.filter(r => r.hyeongjeNo !== target?.hyeongjeNo && r.hyeongjeNo !== target?.sujeNo));
    setBookingsData(prev => prev.filter(b => b.hyeongjeNo !== target?.hyeongjeNo && b.hyeongjeNo !== target?.sujeNo));
    showToast(`🗑️ ${target?.sujeNo || target?.hyeongjeNo} 사건이 삭제되었습니다.`, 'info');
  };

  // Handler: Delete Appeal (검찰사무국 전용)
  const handleDeleteAppeal = makeDeleteHandler(
    () => appealsData,
    setAppealsData,
    t => `${t?.appealNo || ''} 항고 사건이`
  );

  // Handler: Delete Approval Doc (검찰사무국 전용)
  const handleDeleteApproval = makeDeleteHandler(
    () => approvalsData,
    setApprovalsData,
    t => `${t?.docNo || ''} 결재 문서가`
  );

  // Handler: Delete Report (검찰사무국 전용)
  const handleDeleteReport = makeDeleteHandler(
    () => reportsData,
    setReportsData,
    t => `${t?.reportNo || ''} 입건 보고서가`
  );

  // Handler: Delete Booking (검찰사무국 전용)
  const handleDeleteBooking = makeDeleteHandler(
    () => bookingsData,
    setBookingsData,
    t => `${t?.hyeongjeNo || ''} 입건 기록이`
  );

  // Handler: Designate Case as requiring supervisor approval before disposition
  // Called by supervisor (SENIOR_PROSECUTOR+) from MyCasesLedger or SecretariatAdmin
  const handleDesignateCase = (caseId, supervisorUser) => {
    setLedgerData(prev => prev.map(item => {
      if (item.id === caseId) {
        return {
          ...item,
          supervisorDesignated: true,
          supervisorId: supervisorUser.id,
          supervisorName: supervisorUser.name,
        };
      }
      return item;
    }));
    const target = ledgerData.find(c => c.id === caseId);
    showToast(`🔒 [결재 지정] ${target?.hyeongjeNo || caseId} 사건이 결재 필수 사건으로 지정되었습니다.`, 'warning');
  };

  // Handler: Undesignate Case (remove supervisor approval requirement)
  const handleUndesignateCase = (caseId) => {
    setLedgerData(prev => prev.map(item => {
      if (item.id === caseId) {
        return {
          ...item,
          supervisorDesignated: false,
          supervisorId: '',
          supervisorName: '',
        };
      }
      return item;
    }));
    const target = ledgerData.find(c => c.id === caseId);
    showToast(`🔓 [결재 지정 해제] ${target?.hyeongjeNo || caseId} 사건의 결재 필수 지정이 해제되었습니다.`, 'info');
  };

  // Handler: Reassign Prosecutor for a Case (Secretariat Action)
  const handleReassignCase = (hyeongjeNo, newProsecutorName, newProsecutorId) => {
    setLedgerData(prev => prev.map(item => {
      if (item.hyeongjeNo === hyeongjeNo) {
        return {
          ...item,
          prosecutorName: newProsecutorName,
          prosecutorId: newProsecutorId
        };
      }
      return item;
    }));
  };

  // Handler: Add New Prosecutor Account (Secretariat Action)
  const handleAddProsecutor = (newP) => {
    setProsecutorsList(prev => [...prev, newP]);
  };

  // Handler: Delete Prosecutor Account (Secretariat Action)
  const handleDeleteProsecutor = (userId) => {
    setProsecutorsList(prev => prev.filter(p => p.id !== userId));
    showToast('🗑️ 계정이 성공적으로 삭제되었습니다.', 'info');
  };

  // Handler: Update Prosecutor Status (휴직, 대결, 결재권한 위임)
  const handleUpdateProsecutorStatus = (userId, statusData) => {
    setProsecutorsList(prev => prev.map(p =>
      p.id === userId ? { ...p, ...statusData } : p
    ));
    showToast('👤 검사 신분 상태 및 결재 위임 권한이 설정되었습니다.', 'success');
  };

  // Handler: Add Department
  const handleAddDepartment = (newDept) => {
    setDepartmentsData(prev => [...prev, newDept]);
  };

  // Handler: Toggle Department Intake Permission
  const handleToggleDeptIntake = (deptId) => {
    setDepartmentsData(prev => prev.map(d => {
      if (d.id === deptId) {
        const nextState = !d.canIntake;
        showToast(`⚙️ '${d.name}' 사건 접수 권한이 ${nextState ? '부여' : '차단'}되었습니다.`, 'info');
        return { ...d, canIntake: nextState };
      }
      return d;
    }));
  };

  // Check current user department intake permission
  const currentUserDeptObj = departmentsData.find(d => d.name === currentUser?.dept);
  const userCanIntake = !currentUser || 
    currentUser.isSuperAdmin || 
    currentUser.roleLevel === 'SUPER_ADMIN' || 
    currentUser.roleLevel === 'PROSECUTOR_GENERAL' ||
    (currentUserDeptObj ? currentUserDeptObj.canIntake !== false : true);

  const handleTryOpenIntakeModal = () => {
    if (!userCanIntake) {
      showToast(`❌ [사건 접수 제한] 소속 부서('${currentUser?.dept}')는 사건 접수 권한이 없습니다. 검찰사무국에 권한을 요청하세요.`, 'error');
      return;
    }
    setIsIntakeModalOpen(true);
  };

  // Handler: Update User Department (and sync Position)
  const handleUpdateUserDept = (userId, newDeptName) => {
    setProsecutorsList(prev => prev.map(p => {
      if (p.id === userId) {
        let newPos = `${newDeptName} 검사`;
        if (p.roleLevel === 'CHIEF_PROSECUTOR' || p.roleLevel === 'PROSECUTOR_GENERAL') {
          newPos = `${newDeptName}장`;
        } else if (p.roleLevel === 'SENIOR_PROSECUTOR' || p.roleLevel === 'DEPUTY_CHIEF') {
          newPos = `${newDeptName} 부장검사`;
        } else if (p.roleLevel === 'CHIEF_ADMINISTRATOR') {
          newPos = `${newDeptName}장`;
        } else if (p.roleLevel === 'ADMINISTRATOR' || p.roleLevel === 'ADMIN_PROBATIONARY') {
          newPos = `${newDeptName} 사무관`;
        }
        return {
          ...p,
          dept: newDeptName,
          position: newPos,
          title: `${newPos}`
        };
      }
      return p;
    }));
  };

  // Handler: Add New Intake Case (Persists to DB)
  const handleAddIntake = async (newCase) => {
    setLedgerData([newCase, ...ledgerData]);
    await createCaseApi(newCase);
    
    // Also add to Bookings & Reports ledger
    const newReport = {
      id: Date.now() + 1,
      reportNo: `2026접수-${Math.floor(120 + Math.random() * 80)}`,
      hyeongjeNo: newCase.hyeongjeNo,
      title: `${newCase.chargeName} 사건 접수 건`,
      prosecutorName: newCase.prosecutorName,
      suspectName: newCase.suspectName,
      suspectUuid: newCase.suspectUuid,
      status: '입건 완료',
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      basisUrl: newCase.bookingBasis,
      period: `${newCase.bookingDate} ~ 수사중`,
      confiscation: newCase.confiscation || '-'
    };
    setReportsData([newReport, ...reportsData]);

    const newBooking = {
      id: Date.now() + 2,
      hyeongjeNo: newCase.hyeongjeNo,
      prosecutorName: newCase.prosecutorName,
      suspectName: newCase.suspectName,
      suspectUuid: newCase.suspectUuid,
      dispositionStatus: newCase.bookingStatus,
      bookingDate: newCase.bookingDate,
      basisUrl: newCase.bookingBasis,
      daysElapsed: 1,
      indictmentDecision: '수사 진행 중'
    };
    setBookingsData([newBooking, ...bookingsData]);

    const assignedCaseNo = newCase.sujeNo || newCase.hyeongjeNo;
    setIntakeNoticeData({
      sujeNo: assignedCaseNo,
      prosecutorName: newCase.prosecutorName,
      registrantName: currentUser?.name || 'Sirokane',
    });

    showToast(`📁 ${assignedCaseNo} 사건이 접수되어 ${newCase.prosecutorName} 검사에게 배당되었습니다.`, 'success');
  };

  // Handler: Update Approval Document Content
  const handleUpdateApprovalDoc = (updatedDoc) => {
    setApprovalsData(prev => prev.map(a => a.id === updatedDoc.id || a.docNo === updatedDoc.docNo ? { ...a, ...updatedDoc } : a));
  };

  // Handler: Approve E-Approval Document (Persists to DB)
  const handleApproveDoc = async (docId, userId, mode, customDoc) => {
    await approveDocApi(docId);

    setApprovalsData(prev => prev.map(doc => {
      if (doc.id === docId) {
        if (customDoc) {
          setLedgerData(lPrev => lPrev.map(item => {
            if (item.hyeongjeNo === customDoc.hyeongjeNo) {
              return {
                ...item,
                disposition: `${customDoc.dispositionType} (결재완료)`
              };
            }
            return item;
          }));
          return customDoc;
        }

        const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
        const updatedApprovals = doc.approvals.map((app, idx) => {
          const isLast = idx === doc.approvals.length - 1;
          return {
            ...app,
            name: isLast ? app.name : (app.status.includes('대기') ? `${app.name} [직권승인]` : app.name),
            status: isLast ? '최종결재(인장날인)' : '승인완료',
            date: app.date === '-' ? now : app.date
          };
        });

        setLedgerData(lPrev => lPrev.map(item => {
          if (item.hyeongjeNo === doc.hyeongjeNo) {
            return {
              ...item,
              disposition: `${doc.dispositionType} (결재완료)`
            };
          }
          return item;
        }));

        return {
          ...doc,
          status: '최종승인',
          approvals: updatedApprovals
        };
      }
      return doc;
    }));
  };

  // Handler: Reject E-Approval Document
  const handleRejectDoc = (docId, userId) => {
    setApprovalsData(prev => prev.map(doc => {
      if (doc.id === docId) {
        return {
          ...doc,
          status: '반려(보완수사요구)'
        };
      }
      return doc;
    }));
    showToast('📋 결재 문서가 반려(보완수사요구) 처리되었습니다.', 'warning');
  };

  // Handler: Update Document Number (Secretariat Admin)
  const handleUpdateDocNo = (docId, newDocNo) => {
    setApprovalsData(prev => prev.map(doc =>
      doc.id === docId ? { ...doc, docNo: newDocNo } : doc
    ));
  };

  // Handler: Delete Department
  const handleDeleteDepartment = (deptId) => {
    setDepartmentsData(prev => prev.filter(d => d.id !== deptId));
  };

  // Helper: generate next sequential doc number
  const nextDocNo = () => {
    const seq = String(docNoCounter).padStart(3, '0');
    setDocNoCounter(c => c + 1);
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
      docTypeName: newDoc.docType === 'NON_INDICTMENT' ? '불기소 결정서' : '검찰 처분 결의서',
      status: '결재진행',
      createdAt: newDoc.createdAt || new Date().toISOString().split('T')[0],
      prosecutorId: currentUser?.id,
      prosecutorName: currentUser?.name,
      approvals: (newDoc.approvalLine || []).map((step, idx) => ({
        role: step.role,
        name: step.name,
        status: idx === 0 ? '상신완료' : '결재대기',
        date: idx === 0 ? new Date().toISOString().replace('T', ' ').substring(0, 16) : '-',
      })),
    };
    setApprovalsData(prev => [docWithNo, ...prev]);
    await createApprovalApi(docWithNo);
    showToast(`📨 [${newDoc.dispositionType}] 결재 문서가 전자결재함에 상신되었습니다.`, 'success');
  };

  // Handler: Create Approval for specific Case from Ledger
  const handleCreateApprovalForCase = async (caseItem) => {
    const seqNo = nextDocNo();
    const newDoc = {
      id: `APP-2026-${String(docNoCounter).padStart(3,'0')}`,
      docNo: seqNo,
      docType: 'DISPOSITION',
      docTypeName: '검찰 처분 결의서',
      title: `${caseItem.hyeongjeNo}호 피의자 ${caseItem.suspectName} 처분 결의서`,
      hyeongjeNo: caseItem.hyeongjeNo,
      prosecutorId: caseItem.prosecutorId,
      prosecutorName: caseItem.prosecutorName,
      suspectName: caseItem.suspectName,
      dispositionType: caseItem.disposition.includes('구속') ? '구속기소' : '불구속기소',
      chargeName: caseItem.chargeName || '형법 위반',
      summary: `피의자 ${caseItem.suspectName}의 범죄 사실이 명백하고 관련 증거가 제출되었으므로 검찰 처분안대로 결재 승인을 구함.`,
      status: '지검장결재대기',
      createdAt: new Date().toISOString().split('T')[0],
      approvals: [
        { role: '담당검사', name: caseItem.prosecutorName, status: '상신완료', date: new Date().toISOString().replace('T', ' ').substring(0, 16) },
        { role: '부장검사', name: '이그몬 검사', status: '검토승인', date: new Date().toISOString().replace('T', ' ').substring(0, 16) },
        { role: '지검장', name: '앤디 검사', status: '결재대기', date: '-' }
      ]
    };

    setApprovalsData([newDoc, ...approvalsData]);
    await createApprovalApi(newDoc);
    setActiveTab('approvals');
    showToast(`📨 ${caseItem.hyeongjeNo}호 처분 결의서가 결재함으로 상신되었습니다.`, 'info');
  };

  // Handler: Export Excel File matching '검찰청 사건조회시스템.xlsx'
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // 1. 원부 Sheet
      const wsMain = XLSX.utils.json_to_sheet(ledgerData.map(item => ({
        '형제번호[277]': item.hyeongjeNo,
        '경제번호[209]': item.gyeongjeNo,
        '형제번호(최신)': item.latestHyeongjeNo,
        '검사명': item.prosecutorName,
        '검사ID': item.prosecutorId,
        '피의자명': item.suspectName,
        'UUID': item.suspectUuid,
        '입건 현황': item.bookingStatus,
        '입건일시': item.bookingDate,
        '입건근거': item.bookingBasis,
        '처분내역': item.disposition,
        '(재)항고': item.reAppeal,
        '1심 법원사건번호': item.court1No,
        '1심 결과': item.court1Result,
        '판결문': item.court1Doc,
        '항소 여부': item.court1Appealed,
        '항소인': item.court1Appellant,
        '2심 법원사건번호': item.court2No,
        '항소기각': item.court2Dismissed,
        '2심 결과': item.court2Result,
        '판결문(항소심)': item.court2Doc,
        '상고 여부': item.court3Appealed,
        '상고인': item.court3Appellant,
        '3심 법원사건번호': item.court3No,
        '파기환송': item.court3Remanded,
        '3심 결과': item.court3Result,
        '판결문(상고심)': item.court3Doc,
        '비고': item.notes,
        '내용': item.content
      })));
      XLSX.utils.book_append_sheet(wb, wsMain, '원부');

      // 2. 신고 Sheet
      const wsReports = XLSX.utils.json_to_sheet(reportsData.map(r => ({
        '접수번호': r.reportNo,
        '형제번호': r.hyeongjeNo,
        '신고 내용 / 죄명': r.title,
        '검사명': r.prosecutorName,
        '피의자명': r.suspectName,
        'UUID': r.suspectUuid,
        '입건 현황': r.status,
        '신고/접수 일시': r.createdAt,
        '근거 링크': r.basisUrl,
        '수임기간': r.period,
        '몰수/추징 내역': r.confiscation
      })));
      XLSX.utils.book_append_sheet(wb, wsReports, '신고');

      // 3. 항고 Sheet
      const wsAppeals = XLSX.utils.json_to_sheet(appealsData.map(a => ({
        '지불항번호': a.jibulhangNo || a.appealNo || '',
        '고불항번호': a.gobulhangNo || '',
        '재불항번호': a.jaebulhangNo || '',
        '대재불항번호': a.daejaebulhangNo || '',
        '죄명': a.chargeName || '',
        '검사명': a.prosecutorName || '',
        '피고인명': a.suspectName || '',
        '항고처분': a.appealDisposition || a.disposition || '',
        '항고일시': a.appealDate || a.dispositionDate || '',
        '항고근거': a.appealBasisUrl || '',
        '항고결정': a.appealDecision || '',
        '항고결정통지서': a.appealNoticeUrl || a.basisUrl || '',
        '수제번호': a.sujeNo || '',
        '형제번호': a.hyeongjeNo || '',
        '법원번호': a.beobwonNo || '',
        '항고 상황': a.appealStatus || a.status || '',
        '검사장': a.chiefProsecutor || '',
        '검찰총장': a.prosecutorGeneral || '',
        'UUID': a.suspectUuid || '',
        '원처분상황': a.originalStatus || '',
        '접수일시': a.intakeDate || '',
        '접수근거': a.intakeBasisUrl || '',
        '기소여부': a.indictmentStatus || '',
        '공소장/불공소장': a.indictmentDocUrl || '',
      })));
      XLSX.utils.book_append_sheet(wb, wsAppeals, '항고');

      // Download
      XLSX.writeFile(wb, `도스온라인_검찰청_사건조회시스템_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (e) {
      showToast('❌ 엑셀 내보내기 중 오류가 발생하였습니다.', 'error');
    }
  };

  // Handler: Import Excel File
  const handleImportExcel = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx, .xls';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          showToast(`📊 '${file.name}' 엑셀 파일이 로드되었습니다. (${workbook.SheetNames.length}개 시트)`, 'success');
        } catch (err) {
          showToast('❌ 엑셀 파일 읽기에 실패하였습니다.', 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    };
    input.click();
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
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
        {!currentUser ? (
          <div className="glass-panel gold-border" style={{ padding: '36px 28px', textAlign: 'center', maxWidth: 520, margin: '30px auto', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            {/* Official Logo */}
            <div style={{ width: 60, height: 60, borderRadius: 18, background: 'linear-gradient(135deg, #1e3a8a, #f59e0b)', border: '1px solid rgba(245,158,11,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Scale size={30} color="#fff" />
            </div>

            {/* Main Title */}
            <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-main)', marginBottom: 4, letterSpacing: '-0.02em' }}>
              도스온라인 검찰청 사건관리 시스템
            </div>

            {/* Sub Instruction */}
            <div style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--primary-amber)', marginBottom: 16 }}>
              사용하려면 로그인 하세요
            </div>

            {/* Legal Warning Notice */}
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#f87171', fontSize: '0.78rem', fontWeight: 600, lineHeight: 1.5, marginBottom: 20 }}>
              ⚠️ * 권한 없는 자의 시스템 사용은 관계 법령에 따라 처벌 될 수 있습니다
            </div>

            {/* Embedded Login ID + Password Form */}
            <form onSubmit={handleInlineLogin} style={{ textAlign: 'left', background: 'var(--bg-elevated)', borderRadius: 12, padding: 18, border: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Username Input */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                  검찰청 계정 아이디 (ID)
                </label>
                <div style={{ position: 'relative' }}>
                  <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    className="input-field" 
                    style={{ paddingLeft: 38 }} 
                    type="text" 
                    placeholder="아이디 입력" 
                    value={inlineUsername} 
                    onChange={e => { setInlineUsername(e.target.value); setInlineError(''); }}
                    autoFocus
                    required 
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                  비밀번호 (Password)
                </label>
                <div style={{ position: 'relative' }}>
                  <KeyRound size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    className="input-field" 
                    style={{ paddingLeft: 38 }} 
                    type="password" 
                    placeholder="비밀번호 입력"
                    value={inlinePassword} 
                    onChange={e => { setInlinePassword(e.target.value); setInlineError(''); }}
                    required 
                  />
                </div>
              </div>

              {inlineError && (
                <div style={{ color: '#f87171', fontSize: '0.75rem', padding: '6px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={14} /> {inlineError}
                </div>
              )}

              <button type="submit" className="btn btn-gold" style={{ width: '100%', padding: '11px', fontSize: '0.92rem', fontWeight: 800, justifyContent: 'center', marginTop: 4 }}>
                <Lock size={16} /> 로그인 인증 및 시스템 접속
              </button>
            </form>

            {/* 가입 신청 버튼 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 4px' }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>계정이 없으신가요?</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
            </div>
            <button
              type="button"
              onClick={() => setShowInlineRegister(true)}
              className="btn btn-secondary"
              style={{ width: '100%', padding: '11px', fontWeight: 700, justifyContent: 'center', fontSize: '0.88rem' }}
            >
              <UserPlus size={15} /> 검찰청 가입 신청
            </button>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: 6 }}>
              가입 신청 후 <strong style={{ color: 'var(--primary-amber)' }}>검찰사무국</strong>의 허가가 완료되면 로그인 가능합니다
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
              <div className="glass-panel" style={{ padding: '10px 16px', borderLeft: '4px solid var(--primary-amber)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.9rem' }}>📍</span>
                  <span>
                    소속 부서 <strong style={{ color: 'var(--primary-amber)' }}>[{currentUser.dept}]</strong> 보안 격리 모드 적용 중 (자기 부서 전용 사건·결재문서만 표시됩니다)
                  </span>
                </div>
                <span className="badge badge-gold" style={{ fontSize: '0.68rem' }}>부서 보안 권한</span>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: '10px 16px', borderLeft: '4px solid #3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.9rem' }}>🌐</span>
                  <span>
                    권한 레벨: <strong style={{ color: '#60a5fa' }}>[{currentUser.position || currentUser.title}]</strong> (전체 부서 사건 및 결재 통합 열람 권한)
                  </span>
                </div>
                <span className="badge badge-info" style={{ fontSize: '0.68rem' }}>전 부서 관람 가능</span>
              </div>
            )}

            {activeTab === 'mycases' && (
              <MyCasesLedger 
                ledgerData={ledgerData}
                currentUser={currentUser}
                prosecutorsList={prosecutorsList}
                onSelectEvidence={(url, caseNo, suspectName) => setEvidenceModalInfo({ url, caseNo, suspectName })}
                onSelectSuspect={(suspectName) => setSuspectHistoryName(suspectName)}
                onOpenApprovalForCase={handleCreateApprovalForCase}
                onUpdateCase={handleUpdateCase}
                onOpenLoginModal={() => setIsLoginModalOpen(true)}
                onAddApproval={handleAddApprovalFromMyCases}
                approvalsData={approvalsData}
                onDesignateCase={(caseId) => handleDesignateCase(caseId, currentUser)}
                onUndesignateCase={handleUndesignateCase}
              />
            )}

            {activeTab === 'warrants' && (
              <WarrantLedger 
                currentUser={currentUser}
                prosecutorsList={prosecutorsList}
                onSelectEvidence={(url, caseNo, suspectName) => setEvidenceModalInfo({ url, caseNo, suspectName })}
                onSelectSuspect={(suspectName) => setSuspectHistoryName(suspectName)}
              />
            )}

            {activeTab === 'ledger' && (
              <MainLedger 
                ledgerData={scopedLedgerData}
                departmentsData={departmentsData}
                prosecutorsList={prosecutorsList}
                onSelectEvidence={(url, caseNo, suspectName) => setEvidenceModalInfo({ url, caseNo, suspectName })}
                onSelectSuspect={(suspectName) => setSuspectHistoryName(suspectName)}
                onCreateApproval={handleCreateApprovalForCase}
                onUpdateCase={handleUpdateCase}
                currentRole={currentUser ? currentUser.id : 'yooa7374'}
                currentUser={currentUser}
                approvalsData={approvalsData}
                onDesignateCase={(caseId) => handleDesignateCase(caseId, currentUser)}
                onUndesignateCase={handleUndesignateCase}
              />
            )}

            {activeTab === 'approvals' && (
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
                prosecutorsList={prosecutorsList}
                onUpdateProsecutorStatus={handleUpdateProsecutorStatus}
              />
            )}

            {activeTab === 'secretariat' && (
              <SecretariatAdmin 
                ledgerData={ledgerData}
                approvalsData={approvalsData}
                appealsData={appealsData}
                reportsData={reportsData}
                bookingsData={bookingsData}
                departmentsData={departmentsData}
                prosecutorsList={prosecutorsList}
                onReassignCase={handleReassignCase}
                onUpdateCase={handleUpdateCase}
                onDeleteCase={handleDeleteCase}
                onDesignateCase={(caseId) => handleDesignateCase(caseId, currentUser)}
                onUndesignateCase={handleUndesignateCase}
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
              />
            )}

            {activeTab === 'reports' && (
              <ReportLedger 
                reports={scopedReportsData}
                onSelectEvidence={(url, caseNo, suspectName) => setEvidenceModalInfo({ url, caseNo, suspectName })}
                onSelectSuspect={(suspectName) => setSuspectHistoryName(suspectName)}
              />
            )}

            {activeTab === 'appeals' && (
              <AppealLedger 
                appeals={scopedAppealsData}
                ledgerData={scopedLedgerData}
                prosecutorsList={prosecutorsList}
                currentUser={currentUser}
                onAddAppeal={handleAddAppeal}
                onUpdateAppeal={handleUpdateAppeal}
                onSelectEvidence={(url, caseNo, suspectName) => setEvidenceModalInfo({ url, caseNo, suspectName })}
                onSelectSuspect={(suspectName) => setSuspectHistoryName(suspectName)}
              />
            )}

            {activeTab === 'bookings' && (
              <BookingLedger 
                bookings={scopedBookingsData}
                onSelectEvidence={(url, caseNo, suspectName) => setEvidenceModalInfo({ url, caseNo, suspectName })}
                onSelectSuspect={(suspectName) => setSuspectHistoryName(suspectName)}
              />
            )}

            {activeTab === 'search' && (
              <SearchSystem 
                ledgerData={scopedLedgerData}
                onSelectEvidence={(url, caseNo, suspectName) => setEvidenceModalInfo({ url, caseNo, suspectName })}
                onSelectSuspect={(suspectName) => setSuspectHistoryName(suspectName)}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsDashboard 
                ledgerData={scopedLedgerData}
              />
            )}
          </>
        )}
      </main>

      {/* Global Modals */}
      <LoginModal 
        isOpen={isLoginModalOpen}
        onLoginSuccess={handleLoginSuccess}
        onClose={() => setIsLoginModalOpen(false)}
        prosecutorsList={prosecutorsList}
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
        suspectName={suspectHistoryName}
        ledgerData={ledgerData}
        onClose={() => setSuspectHistoryName(null)}
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(3, 7, 18, 0.85)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="glass-panel gold-border" style={{ width: '100%', maxWidth: 480, padding: 24, borderRadius: 14, boxShadow: '0 25px 60px rgba(0,0,0,0.7)' }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--primary-amber)', marginBottom: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>📋 사건접수배당 알림 팝업</span>
              <button onClick={() => setIntakeNoticeData(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✕</button>
            </div>

            <div style={{ background: '#fff', color: '#000', padding: 20, borderRadius: 8, fontSize: '0.88rem', lineHeight: 1.7, fontFamily: "'Noto Sans KR', sans-serif", whiteSpace: 'pre-wrap', marginBottom: 16, border: '1px solid #cbd5e1' }}>
              {`[도스온라인 검찰사무국]
[사건접수배당 알림]

${intakeNoticeData.sujeNo}
담당검사 ${intakeNoticeData.prosecutorName}

검찰청에서는 사건접수배당 외에도 사건처분 결과, 구공판 되는 경우 공판개시 및 재판결과를 귀하에게 통지해드릴 예정입니다.

도스온라인 검찰청 검찰사무국 검찰사무원 ${intakeNoticeData.registrantName || currentUser?.name || 'Sirokane'}`}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  const textToCopy = `[도스온라인 검찰사무국]
[사건접수배당 알림]

${intakeNoticeData.sujeNo}
담당검사 ${intakeNoticeData.prosecutorName}

검찰청에서는 사건접수배당 외에도 사건처분 결과, 구공판 되는 경우 공판개시 및 재판결과를 귀하에게 통지해드릴 예정입니다.

도스온라인 검찰청 검찰사무국 검찰사무원 ${intakeNoticeData.registrantName || currentUser?.name || 'Sirokane'}`;
                  navigator.clipboard.writeText(textToCopy);
                  showToast('📋 사건접수배당 알림 문구가 클립보드에 복사되었습니다!', 'success');
                }}
                className="btn btn-gold"
                style={{ padding: '10px 18px', fontWeight: 800, fontSize: '0.85rem' }}
              >
                📋 알림 문구 전체 복사
              </button>
              <button onClick={() => setIntakeNoticeData(null)} className="btn btn-secondary" style={{ padding: '10px 16px', fontSize: '0.85rem' }}>
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
          setActiveTab('approvals');
        }}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        대한민국 도스온라인 검찰청 (Dose Online Prosecution Office) · 검찰사무국 총괄 관리 포털 v4.0
      </footer>
      {/* Toast Notifications */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
      <style>{`@keyframes toastIn { from { opacity: 0; transform: translateX(40px); } to { opacity: 1; transform: translateX(0); } }`}</style>
    </div>
  );
}
