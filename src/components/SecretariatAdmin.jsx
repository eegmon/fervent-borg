import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  Building2,
  UserPlus,
  RefreshCw,
  Database,
  History,
  CheckCircle2,
  Download,
  Upload,
  Award,
  Users,
  FilePen,
  Pencil,
  Save,
  X,
  FileBox,
  FileInput,
  Send,
  Archive,
  Plus,
  Trash2,
  Eye,
  FileSpreadsheet,
  AlertCircle,
  Scale,
  ShieldAlert,
  FileText,
  ClipboardList,
  CheckCircle,
  XCircle,
  Clock,
  Search,
} from "lucide-react";

import {
  PROSECUTORS,
  INITIAL_AUDIT_LOGS,
  ROLE_LABELS,
  ROLE_COLORS,
  ROLE_HIERARCHY,
} from "../data/prosecutionData";
import {
  fetchRegistrations,
  approveRegistrationApi,
  rejectRegistrationApi,
  updateCaseNumberSettings,
  fetchOfficeDocuments,
  createOfficeDocumentApi,
  deleteOfficeDocumentApi,
  updateOfficeDocumentApi,
} from "../services/api";

// ──────────────────────────────────────────────────────────────────────────────
// [결재 필수 지정 관리] 직근상급자 권한으로 사건에 결재 필수 태그 부여
// ──────────────────────────────────────────────────────────────────────────────
function DesignateApprovalPanel({
  ledgerData = [],
  prosecutorsList = [],
  currentUser,
  onDesignateCase,
  onUndesignateCase,
  addLog,
}) {
  const [searchQ, setSearchQ] = useState("");
  const [filterDesignated, setFilterDesignated] = useState("ALL"); // 'ALL' | 'DESIGNATED' | 'UNDESIGNATED'
  const [confirmTarget, setConfirmTarget] = useState(null); // { caseId, action: 'designate'|'undesignate', label }

  const q = searchQ.toLowerCase();

  const filtered = ledgerData.filter((c) => {
    const matchQ =
      !q ||
      (c.hyeongjeNo || "").toLowerCase().includes(q) ||
      (c.sujeNo || "").toLowerCase().includes(q) ||
      (c.suspectName || "").toLowerCase().includes(q) ||
      (c.prosecutorName || "").toLowerCase().includes(q) ||
      (c.chargeName || "").toLowerCase().includes(q);
    const matchDesig =
      filterDesignated === "ALL" ||
      (filterDesignated === "DESIGNATED" && c.supervisorDesignated) ||
      (filterDesignated === "UNDESIGNATED" && !c.supervisorDesignated);
    return matchQ && matchDesig;
  });

  const designatedCount = ledgerData.filter(
    (c) => c.supervisorDesignated,
  ).length;

  const handleConfirm = () => {
    if (!confirmTarget) return;
    const { caseId, action, label } = confirmTarget;
    if (action === "designate") {
      onDesignateCase?.(caseId);
      addLog?.(`결재 필수 지정: ${label}`);
    } else {
      onUndesignateCase?.(caseId);
      addLog?.(`결재 필수 지정 해제: ${label}`);
    }
    setConfirmTarget(null);
  };

  const rowStyle = {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr 1fr auto",
    gap: 0,
    borderBottom: "1px solid var(--border-subtle)",
    padding: "10px 14px",
    alignItems: "center",
    fontSize: "0.8rem",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 확인 다이얼로그 */}
      {confirmTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: 440,
              width: "90%",
              padding: 28,
              textAlign: "center",
              border: `1px solid ${confirmTarget.action === "designate" ? "rgba(245,158,11,0.5)" : "rgba(100,116,139,0.4)"}`,
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background:
                  confirmTarget.action === "designate"
                    ? "rgba(245,158,11,0.15)"
                    : "rgba(100,116,139,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <ShieldAlert
                size={24}
                color={
                  confirmTarget.action === "designate"
                    ? "var(--primary-amber)"
                    : "#94a3b8"
                }
              />
            </div>
            <div
              style={{
                fontWeight: 800,
                fontSize: "1rem",
                color: "var(--text-main)",
                marginBottom: 8,
              }}
            >
              {confirmTarget.action === "designate"
                ? "결재 필수 지정 확인"
                : "결재 필수 지정 해제 확인"}
            </div>
            <div
              style={{
                fontSize: "0.82rem",
                color: "var(--text-muted)",
                marginBottom: 6,
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: "var(--text-main)" }}>
                {confirmTarget.label}
              </strong>
            </div>
            <div
              style={{
                fontSize: "0.78rem",
                color: "var(--text-muted)",
                marginBottom: 20,
                lineHeight: 1.6,
              }}
            >
              {confirmTarget.action === "designate"
                ? "이 사건은 결재가 최종 승인될 때까지 처분을 내릴 수 없게 됩니다."
                : "이 사건의 결재 필수 제한이 해제됩니다. 처분 변경이 자유롭게 허용됩니다."}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={() => setConfirmTarget(null)}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                취소
              </button>
              <button
                onClick={handleConfirm}
                className="btn"
                style={{
                  flex: 1,
                  background:
                    confirmTarget.action === "designate"
                      ? "var(--primary-amber)"
                      : "rgba(100,116,139,0.25)",
                  color:
                    confirmTarget.action === "designate"
                      ? "#000"
                      : "var(--text-main)",
                  border: "none",
                  borderRadius: 8,
                  fontWeight: 700,
                  cursor: "pointer",
                  padding: "9px",
                }}
              >
                {confirmTarget.action === "designate"
                  ? "🔒 지정 확인"
                  : "🔓 해제 확인"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="glass-panel gold-border" style={{ padding: "14px 18px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 10,
          }}
        >
          <ShieldAlert size={18} color="var(--primary-amber)" />
          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: "0.95rem",
                color: "var(--text-main)",
              }}
            >
              결재 필수 사건 지정 관리
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                color: "var(--text-muted)",
                marginTop: 2,
              }}
            >
              직근상급자가 지정한 사건은 결재가 최종 승인될 때까지 처분 변경이
              차단됩니다
            </div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div
              style={{
                fontSize: "1.5rem",
                fontWeight: 900,
                color: "var(--primary-amber)",
              }}
            >
              {designatedCount}
            </div>
            <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
              지정된 사건
            </div>
          </div>
        </div>

        {/* 필터 */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 2, minWidth: 200 }}>
            <Search
              size={13}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
                pointerEvents: "none",
              }}
            />
            <input
              className="input-field"
              style={{ paddingLeft: 30, fontSize: "0.8rem" }}
              placeholder="형제번호, 피의자, 검사명, 죄명 검색..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
          </div>
          {["ALL", "DESIGNATED", "UNDESIGNATED"].map((f) => (
            <button
              key={f}
              onClick={() => setFilterDesignated(f)}
              className={
                filterDesignated === f ? "btn btn-gold" : "btn btn-secondary"
              }
              style={{ fontSize: "0.78rem", padding: "6px 12px" }}
            >
              {f === "ALL"
                ? "전체"
                : f === "DESIGNATED"
                  ? "🔒 지정됨"
                  : "🔓 미지정"}
            </button>
          ))}
        </div>
      </div>

      {/* 테이블 */}
      <div className="glass-panel" style={{ overflow: "hidden" }}>
        {/* 헤더행 */}
        <div
          style={{
            ...rowStyle,
            background: "var(--bg-elevated)",
            fontWeight: 700,
            fontSize: "0.72rem",
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          <span>사건번호</span>
          <span>담당 검사</span>
          <span>피의자 / 죄명</span>
          <span>현황</span>
          <span style={{ textAlign: "right" }}>지정 상태 / 액션</span>
        </div>

        {filtered.length === 0 ? (
          <div
            style={{
              padding: "32px",
              textAlign: "center",
              fontSize: "0.8rem",
              color: "var(--text-muted)",
            }}
          >
            검색 조건에 해당하는 사건이 없습니다.
          </div>
        ) : (
          filtered.map((c) => {
            const isDesignated = !!c.supervisorDesignated;
            const label = `${c.hyeongjeNo || c.sujeNo} (피의자: ${c.suspectName})`;
            return (
              <div
                key={c.id}
                style={{
                  ...rowStyle,
                  background: isDesignated
                    ? "rgba(245,158,11,0.04)"
                    : "transparent",
                }}
              >
                {/* 사건번호 */}
                <div>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontWeight: 700,
                      fontSize: "0.78rem",
                      color: "var(--primary-amber)",
                    }}
                  >
                    {c.sujeNo || c.hyeongjeNo}
                  </div>
                  <div
                    style={{
                      fontSize: "0.68rem",
                      color: "var(--text-muted)",
                      marginTop: 2,
                    }}
                  >
                    {c.hyeongjeNo}
                  </div>
                </div>

                {/* 담당 검사 */}
                <div style={{ fontSize: "0.78rem", color: "var(--text-main)" }}>
                  {c.prosecutorName}
                  {isDesignated && c.supervisorName && (
                    <div
                      style={{
                        fontSize: "0.68rem",
                        color: "var(--primary-amber)",
                        marginTop: 2,
                      }}
                    >
                      지정자: {c.supervisorName}
                    </div>
                  )}
                </div>

                {/* 피의자 / 죄명 */}
                <div>
                  <div
                    style={{
                      fontWeight: 700,
                      fontSize: "0.8rem",
                      color: "var(--text-main)",
                    }}
                  >
                    {c.suspectName}
                  </div>
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "#94a3b8",
                      marginTop: 2,
                    }}
                  >
                    {c.chargeName}
                  </div>
                </div>

                {/* 현황 */}
                <div style={{ fontSize: "0.75rem", color: "#93c5fd" }}>
                  {c.disposition || c.bookingStatus || "-"}
                </div>

                {/* 지정 상태 + 버튼 */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    justifyContent: "flex-end",
                  }}
                >
                  {isDesignated ? (
                    <>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: "var(--primary-amber)",
                          background: "rgba(245,158,11,0.15)",
                          border: "1px solid rgba(245,158,11,0.3)",
                          borderRadius: 6,
                          padding: "3px 8px",
                          whiteSpace: "nowrap",
                        }}
                      >
                        🔒 결재 필수
                      </span>
                      <button
                        onClick={() =>
                          setConfirmTarget({
                            caseId: c.id,
                            action: "undesignate",
                            label,
                          })
                        }
                        style={{
                          background: "rgba(100,116,139,0.15)",
                          border: "1px solid rgba(100,116,139,0.3)",
                          color: "#94a3b8",
                          borderRadius: 6,
                          padding: "4px 10px",
                          cursor: "pointer",
                          fontSize: "0.72rem",
                          whiteSpace: "nowrap",
                        }}
                      >
                        🔓 해제
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() =>
                        setConfirmTarget({
                          caseId: c.id,
                          action: "designate",
                          label,
                        })
                      }
                      style={{
                        background: "rgba(245,158,11,0.12)",
                        border: "1px solid rgba(245,158,11,0.35)",
                        color: "var(--primary-amber)",
                        borderRadius: 6,
                        padding: "4px 10px",
                        cursor: "pointer",
                        fontSize: "0.72rem",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      🔒 지정
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// [검찰사무국 전용] 기록 삭제 관리 패널
// ──────────────────────────────────────────────────────────────────────────────
function DeleteManagementPanel({
  ledgerData = [],
  appealsData = [],
  approvalsData = [],
  reportsData = [],
  bookingsData = [],
  onDeleteCase,
  onDeleteAppeal,
  onDeleteApproval,
  onDeleteReport,
  onDeleteBooking,
  addLog,
}) {
  const [deleteTab, setDeleteTab] = useState("cases");
  const [searchQ, setSearchQ] = useState("");
  const [confirmTarget, setConfirmTarget] = useState(null); // { type, id, label }

  const DELETE_TABS = [
    { id: "cases", label: "⚖️ 사건 원부", count: ledgerData.length },
    { id: "appeals", label: "📢 항고 사건", count: appealsData.length },
    { id: "approvals", label: "📋 결재 문서", count: approvalsData.length },
    { id: "reports", label: "📁 입건 보고서", count: reportsData.length },
    { id: "bookings", label: "🗄️ 입건 기록", count: bookingsData.length },
  ];

  const q = searchQ.toLowerCase();

  const filteredCases = ledgerData.filter(
    (c) =>
      !q ||
      (c.sujeNo || "").toLowerCase().includes(q) ||
      (c.hyeongjeNo || "").toLowerCase().includes(q) ||
      (c.suspectName || "").toLowerCase().includes(q) ||
      (c.chargeName || "").toLowerCase().includes(q) ||
      (c.prosecutorName || "").toLowerCase().includes(q),
  );
  const filteredAppeals = appealsData.filter(
    (a) =>
      !q ||
      (a.appealNo || "").toLowerCase().includes(q) ||
      (a.suspectName || "").toLowerCase().includes(q) ||
      (a.appealReason || "").toLowerCase().includes(q),
  );
  const filteredApprovals = approvalsData.filter(
    (a) =>
      !q ||
      (a.docNo || "").toLowerCase().includes(q) ||
      (a.title || "").toLowerCase().includes(q) ||
      (a.prosecutorName || "").toLowerCase().includes(q),
  );
  const filteredReports = reportsData.filter(
    (r) =>
      !q ||
      (r.reportNo || "").toLowerCase().includes(q) ||
      (r.suspectName || "").toLowerCase().includes(q) ||
      (r.title || "").toLowerCase().includes(q),
  );
  const filteredBookings = bookingsData.filter(
    (b) =>
      !q ||
      (b.hyeongjeNo || "").toLowerCase().includes(q) ||
      (b.suspectName || "").toLowerCase().includes(q),
  );

  const handleConfirmDelete = () => {
    if (!confirmTarget) return;
    const { type, id, label } = confirmTarget;
    if (type === "cases") onDeleteCase?.(id);
    if (type === "appeals") onDeleteAppeal?.(id);
    if (type === "approvals") onDeleteApproval?.(id);
    if (type === "reports") onDeleteReport?.(id);
    if (type === "bookings") onDeleteBooking?.(id);
    addLog?.("검찰사무국 기록 삭제", `[${type}] ${label} 영구 삭제 처리`);
    setConfirmTarget(null);
  };

  const rowStyle = {
    display: "grid",
    gap: 0,
    borderBottom: "1px solid var(--border-subtle)",
    padding: "10px 14px",
    alignItems: "center",
  };
  const btnDel = {
    background: "rgba(239,68,68,0.12)",
    border: "1px solid rgba(239,68,68,0.35)",
    color: "#f87171",
    borderRadius: 6,
    padding: "4px 10px",
    cursor: "pointer",
    fontSize: "0.75rem",
    display: "flex",
    alignItems: "center",
    gap: 4,
    whiteSpace: "nowrap",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Confirm Dialog */}
      {confirmTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: 420,
              width: "90%",
              padding: 28,
              textAlign: "center",
              border: "1px solid rgba(239,68,68,0.5)",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: "50%",
                background: "rgba(239,68,68,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <Trash2 size={24} color="#f87171" />
            </div>
            <div
              style={{
                fontWeight: 800,
                fontSize: "1rem",
                color: "var(--text-main)",
                marginBottom: 8,
              }}
            >
              영구 삭제 확인
            </div>
            <div
              style={{
                fontSize: "0.82rem",
                color: "var(--text-muted)",
                marginBottom: 20,
                lineHeight: 1.6,
              }}
            >
              다음 기록을{" "}
              <strong style={{ color: "#f87171" }}>영구 삭제</strong>합니다.
              <br />이 작업은 <strong>되돌릴 수 없습니다.</strong>
              <br />
              <br />
              <span
                style={{
                  background: "var(--bg-elevated)",
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontFamily: "monospace",
                  fontSize: "0.88rem",
                  color: "var(--primary-amber)",
                }}
              >
                {confirmTarget.label}
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={() => setConfirmTarget(null)}
                className="btn btn-secondary"
                style={{ padding: "8px 20px" }}
              >
                취소
              </button>
              <button
                onClick={handleConfirmDelete}
                style={{
                  ...btnDel,
                  padding: "8px 20px",
                  fontSize: "0.85rem",
                  fontWeight: 800,
                }}
              >
                <Trash2 size={14} /> 영구 삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div
        className="glass-panel"
        style={{
          padding: "14px 18px",
          background: "rgba(239,68,68,0.06)",
          border: "1px solid rgba(239,68,68,0.25)",
        }}
      >
        <div
          style={{
            fontWeight: 800,
            fontSize: "0.95rem",
            color: "#f87171",
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <Trash2 size={18} /> 검찰사무국 기록 영구 삭제 관리
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          사건 원부 · 항고 사건 · 결재 문서 · 입건 보고서 · 입건 기록을
          검찰사무국 권한으로 영구 삭제합니다. 삭제된 기록은 복구되지 않습니다.
        </div>
      </div>

      {/* Type Tabs + Search */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        {DELETE_TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setDeleteTab(t.id);
              setSearchQ("");
            }}
            className={
              deleteTab === t.id ? "btn btn-gold" : "btn btn-secondary"
            }
            style={{ fontSize: "0.78rem", padding: "6px 14px" }}
          >
            {t.label}
            <span
              style={{
                marginLeft: 6,
                background:
                  deleteTab === t.id ? "rgba(0,0,0,0.2)" : "var(--bg-elevated)",
                padding: "1px 7px",
                borderRadius: 10,
                fontSize: "0.7rem",
                fontWeight: 800,
              }}
            >
              {t.count}
            </span>
          </button>
        ))}
        <input
          className="input-field"
          style={{
            marginLeft: "auto",
            width: 220,
            fontSize: "0.78rem",
            padding: "6px 12px",
          }}
          placeholder="검색 (사건번호, 피의자, 검사명...)"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
        />
      </div>

      {/* Record List */}
      <div className="glass-panel" style={{ overflow: "hidden" }}>
        {/* Column Headers */}
        <div
          style={{
            padding: "8px 14px",
            background: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            gap: 8,
            fontSize: "0.72rem",
            fontWeight: 800,
            color: "var(--text-muted)",
            letterSpacing: "0.05em",
          }}
        >
          {deleteTab === "cases" && (
            <>
              <span style={{ flex: 2 }}>사건번호</span>
              <span style={{ flex: 2 }}>피의자</span>
              <span style={{ flex: 2 }}>죄명</span>
              <span style={{ flex: 1.5 }}>담당검사</span>
              <span style={{ flex: 1 }}>상태</span>
              <span style={{ width: 80, textAlign: "center" }}>삭제</span>
            </>
          )}
          {deleteTab === "appeals" && (
            <>
              <span style={{ flex: 2 }}>항고번호</span>
              <span style={{ flex: 2 }}>피의자</span>
              <span style={{ flex: 2 }}>항고사유</span>
              <span style={{ flex: 1.5 }}>접수일</span>
              <span style={{ flex: 1 }}>상태</span>
              <span style={{ width: 80, textAlign: "center" }}>삭제</span>
            </>
          )}
          {deleteTab === "approvals" && (
            <>
              <span style={{ flex: 2 }}>문서번호</span>
              <span style={{ flex: 3 }}>제목</span>
              <span style={{ flex: 2 }}>작성검사</span>
              <span style={{ flex: 1.5 }}>작성일</span>
              <span style={{ flex: 1 }}>상태</span>
              <span style={{ width: 80, textAlign: "center" }}>삭제</span>
            </>
          )}
          {deleteTab === "reports" && (
            <>
              <span style={{ flex: 2 }}>보고서번호</span>
              <span style={{ flex: 3 }}>제목</span>
              <span style={{ flex: 2 }}>피의자</span>
              <span style={{ flex: 1.5 }}>검사</span>
              <span style={{ flex: 1 }}>상태</span>
              <span style={{ width: 80, textAlign: "center" }}>삭제</span>
            </>
          )}
          {deleteTab === "bookings" && (
            <>
              <span style={{ flex: 2 }}>사건번호</span>
              <span style={{ flex: 2 }}>피의자</span>
              <span style={{ flex: 2 }}>담당검사</span>
              <span style={{ flex: 2 }}>처분</span>
              <span style={{ flex: 1 }}>접수일</span>
              <span style={{ width: 80, textAlign: "center" }}>삭제</span>
            </>
          )}
        </div>

        {/* Rows */}
        <div style={{ maxHeight: 480, overflowY: "auto" }}>
          {deleteTab === "cases" &&
            (filteredCases.length === 0 ? (
              <div
                style={{
                  padding: 40,
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: "0.82rem",
                }}
              >
                검색 결과가 없습니다.
              </div>
            ) : (
              filteredCases.map((c) => (
                <div
                  key={c.id}
                  style={{
                    ...rowStyle,
                    gridTemplateColumns: "2fr 2fr 2fr 1.5fr 1fr 80px",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(239,68,68,0.04)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.8rem",
                      color: "var(--primary-amber)",
                      fontWeight: 700,
                    }}
                  >
                    {c.sujeNo || c.hyeongjeNo}
                  </span>
                  <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                    {c.suspectName}
                  </span>
                  <span
                    style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}
                  >
                    {c.chargeName}
                  </span>
                  <span style={{ fontSize: "0.78rem" }}>
                    {c.prosecutorName}
                  </span>
                  <span style={{ fontSize: "0.72rem" }}>
                    <span
                      style={{
                        background: "rgba(59,130,246,0.15)",
                        color: "#60a5fa",
                        padding: "2px 7px",
                        borderRadius: 10,
                      }}
                    >
                      {c.bookingStatus || "수사중"}
                    </span>
                  </span>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <button
                      style={btnDel}
                      onClick={() =>
                        setConfirmTarget({
                          type: "cases",
                          id: c.id,
                          label: `${c.sujeNo || c.hyeongjeNo} (${c.suspectName})`,
                        })
                      }
                    >
                      <Trash2 size={12} /> 삭제
                    </button>
                  </div>
                </div>
              ))
            ))}

          {deleteTab === "appeals" &&
            (filteredAppeals.length === 0 ? (
              <div
                style={{
                  padding: 40,
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: "0.82rem",
                }}
              >
                항고 사건이 없습니다.
              </div>
            ) : (
              filteredAppeals.map((a) => (
                <div
                  key={a.id}
                  style={{
                    ...rowStyle,
                    gridTemplateColumns: "2fr 2fr 2fr 1.5fr 1fr 80px",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(239,68,68,0.04)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.8rem",
                      color: "var(--primary-amber)",
                      fontWeight: 700,
                    }}
                  >
                    {a.appealNo}
                  </span>
                  <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                    {a.suspectName}
                  </span>
                  <span
                    style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}
                  >
                    {a.appealReason || "-"}
                  </span>
                  <span style={{ fontSize: "0.78rem" }}>
                    {a.createdAt || a.appealDate || "-"}
                  </span>
                  <span style={{ fontSize: "0.72rem" }}>
                    <span
                      style={{
                        background: "rgba(245,158,11,0.15)",
                        color: "var(--primary-amber)",
                        padding: "2px 7px",
                        borderRadius: 10,
                      }}
                    >
                      {a.appealStatus || a.status || "접수"}
                    </span>
                  </span>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <button
                      style={btnDel}
                      onClick={() =>
                        setConfirmTarget({
                          type: "appeals",
                          id: a.id,
                          label: `${a.appealNo} (${a.suspectName})`,
                        })
                      }
                    >
                      <Trash2 size={12} /> 삭제
                    </button>
                  </div>
                </div>
              ))
            ))}

          {deleteTab === "approvals" &&
            (filteredApprovals.length === 0 ? (
              <div
                style={{
                  padding: 40,
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: "0.82rem",
                }}
              >
                결재 문서가 없습니다.
              </div>
            ) : (
              filteredApprovals.map((a) => (
                <div
                  key={a.id}
                  style={{
                    ...rowStyle,
                    gridTemplateColumns: "2fr 3fr 2fr 1.5fr 1fr 80px",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(239,68,68,0.04)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.8rem",
                      color: "var(--primary-amber)",
                      fontWeight: 700,
                    }}
                  >
                    {a.docNo}
                  </span>
                  <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                    {a.title}
                  </span>
                  <span style={{ fontSize: "0.78rem" }}>
                    {a.prosecutorName}
                  </span>
                  <span
                    style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}
                  >
                    {a.createdAt?.slice(0, 10) || "-"}
                  </span>
                  <span style={{ fontSize: "0.72rem" }}>
                    <span
                      style={{
                        background: a.status?.includes("완료")
                          ? "rgba(52,211,153,0.15)"
                          : "rgba(245,158,11,0.15)",
                        color: a.status?.includes("완료")
                          ? "#34d399"
                          : "var(--primary-amber)",
                        padding: "2px 7px",
                        borderRadius: 10,
                      }}
                    >
                      {a.status}
                    </span>
                  </span>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <button
                      style={btnDel}
                      onClick={() =>
                        setConfirmTarget({
                          type: "approvals",
                          id: a.id,
                          label: `${a.docNo} (${a.title})`,
                        })
                      }
                    >
                      <Trash2 size={12} /> 삭제
                    </button>
                  </div>
                </div>
              ))
            ))}

          {deleteTab === "reports" &&
            (filteredReports.length === 0 ? (
              <div
                style={{
                  padding: 40,
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: "0.82rem",
                }}
              >
                입건 보고서가 없습니다.
              </div>
            ) : (
              filteredReports.map((r) => (
                <div
                  key={r.id}
                  style={{
                    ...rowStyle,
                    gridTemplateColumns: "2fr 3fr 2fr 1.5fr 1fr 80px",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(239,68,68,0.04)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.8rem",
                      color: "var(--primary-amber)",
                      fontWeight: 700,
                    }}
                  >
                    {r.reportNo}
                  </span>
                  <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                    {r.title}
                  </span>
                  <span style={{ fontSize: "0.78rem" }}>{r.suspectName}</span>
                  <span
                    style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}
                  >
                    {r.prosecutorName}
                  </span>
                  <span style={{ fontSize: "0.72rem" }}>
                    <span
                      style={{
                        background: "rgba(52,211,153,0.15)",
                        color: "#34d399",
                        padding: "2px 7px",
                        borderRadius: 10,
                      }}
                    >
                      {r.status}
                    </span>
                  </span>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <button
                      style={btnDel}
                      onClick={() =>
                        setConfirmTarget({
                          type: "reports",
                          id: r.id,
                          label: `${r.reportNo} (${r.suspectName})`,
                        })
                      }
                    >
                      <Trash2 size={12} /> 삭제
                    </button>
                  </div>
                </div>
              ))
            ))}

          {deleteTab === "bookings" &&
            (filteredBookings.length === 0 ? (
              <div
                style={{
                  padding: 40,
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: "0.82rem",
                }}
              >
                입건 기록이 없습니다.
              </div>
            ) : (
              filteredBookings.map((b) => (
                <div
                  key={b.id}
                  style={{
                    ...rowStyle,
                    gridTemplateColumns: "2fr 2fr 2fr 2fr 1fr 80px",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(239,68,68,0.04)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.8rem",
                      color: "var(--primary-amber)",
                      fontWeight: 700,
                    }}
                  >
                    {b.hyeongjeNo}
                  </span>
                  <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                    {b.suspectName}
                  </span>
                  <span style={{ fontSize: "0.78rem" }}>
                    {b.prosecutorName}
                  </span>
                  <span
                    style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}
                  >
                    {b.indictmentDecision || b.dispositionStatus || "-"}
                  </span>
                  <span
                    style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}
                  >
                    {(b.bookingDate || "").slice(0, 10)}
                  </span>
                  <div style={{ display: "flex", justifyContent: "center" }}>
                    <button
                      style={btnDel}
                      onClick={() =>
                        setConfirmTarget({
                          type: "bookings",
                          id: b.id,
                          label: `${b.hyeongjeNo} (${b.suspectName})`,
                        })
                      }
                    >
                      <Trash2 size={12} /> 삭제
                    </button>
                  </div>
                </div>
              ))
            ))}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// [검찰사무국 전용] 직무대리명령 공식 발령 및 관리 패널
// ──────────────────────────────────────────────────────────────────────────────
function ActingOrderPanel({
  prosecutorsList: rawList = [],
  onUpdateProsecutorStatus,
  addLog,
}) {
  const prosecutorsList = rawList.filter((p) => !p.isSuperAdmin);
  const today = new Date().toISOString().slice(0, 10);
  const [orders, setOrders] = useState([]);
  useEffect(() => {
    fetchOfficeDocuments("order").then((data) => {
      if (Array.isArray(data)) setOrders(data);
    });
  }, []);

  const [form, setForm] = useState({
    originalUserId: prosecutorsList[0]?.id || "",
    actingUserId: prosecutorsList[1]?.id || "",
    actingTitle: "부장검사 직무대리",
    orderNo: `검찰사무국 직무대리명령 제2026-00${orders.length + 1}호`,
    reason: "검찰 사무대리 규정 제7조 직무대리 지시",
    period: `${today} ~ 2026-12-31`,
  });

  const handleIssueOrder = async (e) => {
    e.preventDefault();
    const orig = prosecutorsList.find((p) => p.id === form.originalUserId);
    const act = prosecutorsList.find((p) => p.id === form.actingUserId);
    if (!orig || !act) return;

    const newOrder = {
      id: `ACT-${Date.now()}`,
      orderNo:
        form.orderNo || `검찰사무국 직무대리명령 제2026-${orders.length + 1}호`,
      originalUser: `${orig.name} (${orig.position || orig.title})`,
      originalUserId: orig.id,
      actingUser: `${act.name} (${act.position || act.title})`,
      actingUserId: act.id,
      actingTitle: form.actingTitle,
      reason: form.reason,
      period: form.period,
      status: "발령중",
      date: today,
    };

    const saved = await createOfficeDocumentApi("order", newOrder);
    if (!saved?.success) {
      alert(saved?.message || "직무대리명령 저장에 실패했습니다.");
      return;
    }
    setOrders((prev) => [saved.document || newOrder, ...prev]);

    if (onUpdateProsecutorStatus) {
      onUpdateProsecutorStatus(orig.id, {
        status: "DELEGATED",
        delegateTo: `${act.name} (${form.actingTitle})`,
        delegateReason: `[직무대리명령] ${form.reason}`,
      });
    }

    addLog?.(
      "직무대리명령 공식 발령",
      `${form.orderNo}: '${act.name}' 검사를 '${orig.name}' 직무대리로 발령`,
    );
    alert(
      `[검찰사무국 관인 날인] ${form.orderNo} 직무대리명령이 성공적으로 발령되었습니다.`,
    );
  };

  const handleRevokeOrder = async (orderId, origUserId) => {
    if (!window.confirm("해당 직무대리명령을 해제하시겠습니까?")) return;
    const saved = await updateOfficeDocumentApi(orderId, {
      status: "해제완료",
    });
    if (!saved?.success) {
      alert(saved?.message || "직무대리명령 저장에 실패했습니다.");
      return;
    }
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? saved.document : o)),
    );
    if (onUpdateProsecutorStatus && origUserId) {
      onUpdateProsecutorStatus(origUserId, {
        status: "ACTIVE",
        delegateTo: "",
        delegateReason: "",
      });
    }
    addLog?.("직무대리명령 해제", `명령 번호 ${orderId} 직무대리 해제 처리`);
    alert("[직권 해제] 직무대리명령이 해제되었습니다.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        className="glass-panel gold-border"
        style={{ padding: "14px 20px", background: "rgba(245,158,11,0.06)" }}
      >
        <div
          style={{
            fontWeight: 800,
            fontSize: "0.95rem",
            color: "var(--primary-amber)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <Award size={18} /> 검찰 직무대리명령 공식 발령 대장 (검찰청법 제32조)
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          결재권자의 부재·휴직·출장 시 직무대리자를 공식 지정하여 결재권과 승인
          권한을 위임 발령합니다.
        </div>
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16 }}
      >
        <div
          className="glass-panel"
          style={{
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: "0.9rem",
              color: "var(--text-main)",
            }}
          >
            🏛️ 직무대리명령 신규 발령
          </div>

          <form
            onSubmit={handleIssueOrder}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div>
              <Label>명령서 번호 *</Label>
              <input
                className="input-field"
                value={form.orderNo}
                onChange={(e) => setForm({ ...form, orderNo: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>원 결재권자 (피대리인) *</Label>
              <select
                className="select-field"
                value={form.originalUserId}
                onChange={(e) =>
                  setForm({ ...form, originalUserId: e.target.value })
                }
              >
                {prosecutorsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.position || p.title} / {p.dept})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>직무대리자 (대리 수행 검사) *</Label>
              <select
                className="select-field"
                value={form.actingUserId}
                onChange={(e) =>
                  setForm({ ...form, actingUserId: e.target.value })
                }
              >
                {prosecutorsList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.position || p.title} / {p.dept})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>부여할 직무대리 직위 명칭 *</Label>
              <input
                className="input-field"
                placeholder="예: 부장검사 직무대리 / 지검장 직무대리"
                value={form.actingTitle}
                onChange={(e) =>
                  setForm({ ...form, actingTitle: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label>발령 기간 *</Label>
              <input
                className="input-field"
                value={form.period}
                onChange={(e) => setForm({ ...form, period: e.target.value })}
                required
              />
            </div>

            <div>
              <Label>발령 근거 및 사유</Label>
              <textarea
                className="textarea-field"
                rows={2}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>

            <button
              type="submit"
              className="btn btn-gold"
              style={{ padding: 10, fontWeight: 800, justifyContent: "center" }}
            >
              <Award size={15} /> 직무대리명령 발령 & 관인 날인
            </button>
          </form>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: "0.9rem",
              color: "var(--text-main)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>📋 발령된 직무대리명령 대장</span>
            <span className="badge badge-gold" style={{ fontSize: "0.72rem" }}>
              총 {orders.length}건
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.78rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "var(--bg-elevated)",
                    borderBottom: "1px solid var(--border-subtle)",
                    color: "var(--text-muted)",
                  }}
                >
                  <th style={{ padding: 8, textAlign: "left" }}>명령서 번호</th>
                  <th style={{ padding: 8, textAlign: "left" }}>원 결재자</th>
                  <th style={{ padding: 8, textAlign: "left" }}>직무대리자</th>
                  <th style={{ padding: 8, textAlign: "left" }}>
                    직무대리 직위
                  </th>
                  <th style={{ padding: 8, textAlign: "left" }}>발령 기간</th>
                  <th style={{ padding: 8, textAlign: "center" }}>상태</th>
                  <th style={{ padding: 8, textAlign: "center" }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    style={{ borderBottom: "1px solid var(--border-subtle)" }}
                  >
                    <td
                      style={{
                        fontFamily: "monospace",
                        color: "var(--primary-amber)",
                        fontWeight: 700,
                      }}
                    >
                      {o.orderNo}
                    </td>
                    <td style={{ fontWeight: 700 }}>{o.originalUser}</td>
                    <td style={{ color: "#38bdf8", fontWeight: 700 }}>
                      {o.actingUser}
                    </td>
                    <td style={{ color: "var(--text-main)" }}>
                      {o.actingTitle}
                    </td>
                    <td style={{ color: "var(--text-muted)" }}>{o.period}</td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 10,
                          fontSize: "0.7rem",
                          fontWeight: 800,
                          background:
                            o.status === "발령중"
                              ? "rgba(52,211,153,0.15)"
                              : "var(--bg-elevated)",
                          color:
                            o.status === "발령중"
                              ? "#34d399"
                              : "var(--text-muted)",
                        }}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {o.status === "발령중" && (
                        <button
                          onClick={() =>
                            handleRevokeOrder(o.id, o.originalUserId)
                          }
                          className="btn btn-secondary"
                          style={{
                            padding: "3px 8px",
                            fontSize: "0.7rem",
                            color: "#f87171",
                          }}
                        >
                          명령 해제
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

const SUB_TABS = [
  { id: "registrations", label: "🆕 가입 신청 허가", icon: ClipboardList },
  { id: "prosecutors", label: "검사 계정 관리", icon: Users },
  { id: "acting", label: "🏛️ 직무대리명령 발령", icon: Award },
  { id: "depts", label: "부서 & 부원 관리", icon: Building2 },
  { id: "casenos", label: "사건번호 공식 배정", icon: Scale },
  { id: "delete", label: "🗑️ 기록 삭제", icon: Trash2 },
  { id: "reassign", label: "사건 재배당", icon: RefreshCw },
  { id: "import", label: "엑셀 일괄 등록", icon: FileSpreadsheet },
  { id: "docnos", label: "문서번호 관리", icon: FilePen },
  { id: "designate", label: "🔒 결재 필수 지정", icon: ShieldAlert },
  { id: "docmgmt", label: "문서 관리", icon: FileBox },
  { id: "backup", label: "DB 백업·복원", icon: Database },
  { id: "audit", label: "감사 로그", icon: History },
];

const Label = ({ children }) => (
  <label
    style={{
      display: "block",
      fontSize: "0.78rem",
      fontWeight: 700,
      color: "var(--text-muted)",
      marginBottom: 6,
    }}
  >
    {children}
  </label>
);

export default function SecretariatAdmin({
  ledgerData,
  approvalsData,
  appealsData = [],
  reportsData = [],
  bookingsData = [],
  departmentsData = [],
  prosecutorsList: propProsecutorsList,
  onReassignCase,
  onUpdateCase,
  onDeleteCase,
  onDeleteAppeal,
  onDeleteApproval,
  onDeleteReport,
  onDeleteBooking,
  onAddProsecutor,
  onDeleteProsecutor,
  onUpdateProsecutorStatus,
  onUpdateDocNo,
  onAddDepartment,
  onDeleteDepartment,
  onToggleDeptIntake,
  onUpdateUserDept,
  docNoCounter,
  setDocNoCounter,
  currentUser,
  onOpenLoginModal,
  onBulkImport,
  onDesignateCase,
  onUndesignateCase,
  caseNumberSettings = {
    hyeongjeStart: 280,
    teuggongStart: 1,
    teughyeongStart: 1,
    teugapjeStart: 1,
    apjeStart: 1,
  },
  onUpdateCaseNumberSettings,
}) {
  const [activeSubTab, setActiveSubTab] = useState("registrations");
  const prosecutorsList = (propProsecutorsList || PROSECUTORS).filter(
    (p) => !p.isSuperAdmin,
  );
  const [auditLogs, setAuditLogs] = useState(INITIAL_AUDIT_LOGS);
  const [newP, setNewP] = useState({
    id: "",
    name: "",
    title: "평검사",
    roleLevel: "PROSECUTOR",
    dept: departmentsData[0]?.name || "",
    password: "",
  });

  // ── 가입 신청 허가 상태 ──────────────────────────────────────
  const [registrations, setRegistrations] = useState([]);
  const [regLoading, setRegLoading] = useState(false);
  const [rejectModal, setRejectModal] = useState(null); // { id, name }
  const [rejectReason, setRejectReason] = useState("");
  const [regFilter, setRegFilter] = useState("PENDING"); // 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'

  // 가입 신청 목록 로드
  const loadRegistrations = async () => {
    setRegLoading(true);
    const data = await fetchRegistrations();
    if (data) setRegistrations(data);
    setRegLoading(false);
  };

  useEffect(() => {
    if (activeSubTab === "registrations") {
      loadRegistrations();
    }
  }, [activeSubTab]);

  const handleApproveRegistration = async (reg) => {
    if (
      !window.confirm(
        `'${reg.name} (${reg.reqId})' 의 가입 신청을 허가하시겠습니까?\n\n허가 시 검찰 시스템에 계정이 즉시 등록됩니다.`,
      )
    )
      return;
    const res = await approveRegistrationApi(reg.id);
    if (res?.success) {
      // 로컬 목록 업데이트
      setRegistrations((prev) =>
        prev.map((r) => (r.id === reg.id ? { ...r, status: "APPROVED" } : r)),
      );
      // App의 prosecutorsList에도 반영
      if (onAddProsecutor) {
        onAddProsecutor({
          id: reg.reqId,
          name: reg.name,
          rank: reg.rank || reg.roleLevel,
          position: reg.position || `${reg.dept} ${reg.title || ""}`.trim(),
          title: reg.title || reg.roleLevel,
          roleLevel: reg.roleLevel || "PROSECUTOR",
          dept: reg.dept || "",
          password: "",
          activeCases: 0,
          status: "ACTIVE",
          delegateTo: "",
          delegateReason: "",
          note: reg.note || "",
        });
      }
      addLog(
        "가입 신청 허가",
        `'${reg.name} (${reg.reqId})' 계정 가입 신청 허가 완료`,
      );
      alert(
        `✅ [검찰사무국 허가] '${reg.name}' 계정이 성공적으로 등록되었습니다.`,
      );
    } else {
      alert(`❌ 허가 실패: ${res?.message || "서버 오류"}`);
    }
  };

  const handleRejectRegistration = async () => {
    if (!rejectModal) return;
    const res = await rejectRegistrationApi(
      rejectModal.id,
      rejectReason || "검찰사무국 심사 불허",
    );
    if (res?.success) {
      setRegistrations((prev) =>
        prev.map((r) =>
          r.id === rejectModal.id ? { ...r, status: "REJECTED" } : r,
        ),
      );
      addLog(
        "가입 신청 거부",
        `'${rejectModal.name}' 가입 신청 거부 (사유: ${rejectReason || "검찰사무국 심사 불허"})`,
      );
      alert(`가입 신청이 거부되었습니다.`);
    } else {
      alert(`❌ 거부 실패: ${res?.message || "서버 오류"}`);
    }
    setRejectModal(null);
    setRejectReason("");
  };

  // 휴직/결재권한 위임 설정 모달 상태
  const [statusModalUser, setStatusModalUser] = useState(null);
  const [statusForm, setStatusForm] = useState({
    status: "ACTIVE",
    delegateTo: "",
    delegateReason: "",
    dualPosition: "",
    dualDept: "",
    dualRoleLevel: "",
    dualSecretariatWork: false,
  });

  // 부서 신규 등록 폼 상태
  const [newDeptForm, setNewDeptForm] = useState({
    name: "",
    desc: "",
    headId: "",
    canIntake: true,
  });
  // 선택된 부서 (부원 관리용)
  const [selectedDeptId, setSelectedDeptId] = useState(
    departmentsData[0]?.id || "dept_tech",
  );

  const [selectedCaseNo, setSelectedCaseNo] = useState(
    ledgerData[0]?.hyeongjeNo || "",
  );
  const [targetPId, setTargetPId] = useState("");
  const [editingDocId, setEditingDocId] = useState(null);
  const [editingDocNoValue, setEditingDocNoValue] = useState("");

  // ── 문서 관리 상태 (접수·발송·보존) ─────────────────────────
  const today = new Date().toISOString().split("T")[0];
  const [docMgmtTab, setDocMgmtTab] = useState("receive"); // 'receive' | 'send' | 'archive'
  const [receivedDocs, setReceivedDocs] = useState([]);
  const [sentDocs, setSentDocs] = useState([]);
  const [archivedDocs, setArchivedDocs] = useState([]);
  useEffect(() => {
    Promise.all([
      fetchOfficeDocuments("receive"),
      fetchOfficeDocuments("send"),
      fetchOfficeDocuments("archive"),
    ]).then(([received, sent, archived]) => {
      if (Array.isArray(received)) setReceivedDocs(received);
      if (Array.isArray(sent)) setSentDocs(sent);
      if (Array.isArray(archived)) setArchivedDocs(archived);
    });
  }, []);
  const [newReceive, setNewReceive] = useState({
    docNo: "",
    title: "",
    from: "",
    to: "",
    type: "공문",
    note: "",
  });
  const [newSend, setNewSend] = useState({
    docNo: "",
    title: "",
    to: "",
    type: "공문",
    note: "",
  });
  const [newArchive, setNewArchive] = useState({
    docNo: "",
    title: "",
    caseNo: "",
    retentionYears: 10,
    category: "형사사건기록",
  });

  // ── 사건번호 공식 배정 상태 (검찰사무국) ─────────────────────
  const [selectedCaseForAssign, setSelectedCaseForAssign] = useState(
    ledgerData[0] || null,
  );
  const [assignPrefix, setAssignPrefix] = useState("형제");
  const [assignNoInput, setAssignNoInput] = useState("");
  const [autoSeal, setAutoSeal] = useState(true);
  const [caseNumberForm, setCaseNumberForm] = useState(caseNumberSettings);
  const [caseNumberSaving, setCaseNumberSaving] = useState(false);

  useEffect(() => {
    setCaseNumberForm(caseNumberSettings);
  }, [caseNumberSettings]);

  const handleSaveCaseNumberSettings = async (e) => {
    e.preventDefault();
    const settings = {
      hyeongjeStart: Number(caseNumberForm.hyeongjeStart),
      teuggongStart: Number(caseNumberForm.teuggongStart),
      teughyeongStart: Number(caseNumberForm.teughyeongStart),
      teugapjeStart: Number(caseNumberForm.teugapjeStart),
      apjeStart: Number(caseNumberForm.apjeStart),
    };
    if (
      Object.values(settings).some(
        (value) => !Number.isInteger(value) || value < 1,
      )
    ) {
      alert("시작번호는 1 이상의 정수로 입력해주세요.");
      return;
    }
    setCaseNumberSaving(true);
    const result = await updateCaseNumberSettings(settings);
    setCaseNumberSaving(false);
    if (!result?.success) {
      alert(`저장 실패: ${result?.message || "서버 오류"}`);
      return;
    }
    onUpdateCaseNumberSettings?.(settings);
    addLog(
      "사건번호 자동계산 시작값 변경",
      `형제 ${settings.hyeongjeStart} / 특공 ${settings.teuggongStart} / 특형 ${settings.teughyeongStart}`,
    );
    alert("사건번호 자동계산 시작값이 저장되었습니다.");
  };

  const handleAssignOfficialCaseNo = (e) => {
    e.preventDefault();
    if (!selectedCaseForAssign) {
      alert("사건을 먼저 선택해주세요.");
      return;
    }

    const currentSuje =
      selectedCaseForAssign.sujeNo ||
      (selectedCaseForAssign.hyeongjeNo || "").replace("형제", "수제");
    const currentYear = new Date().getFullYear();

    // 유형별로 기존 사건번호 중 최대 일련번호를 찾아 +1 자동 부여
    const getNextSeqNo = (prefix) => {
      const regex = new RegExp(`^${currentYear}${prefix}(\\d+)$`);
      const nums = ledgerData
        .map((c) => {
          const m = (c.hyeongjeNo || "").match(regex);
          return m ? parseInt(m[1], 10) : 0;
        })
        .filter((n) => n > 0);
      const settingKey = {
        형제: "hyeongjeStart",
        특공: "teuggongStart",
        특형: "teughyeongStart",
        특압제: "teugapjeStart",
        압제: "apjeStart",
      }[prefix];
      const configuredStart = Number(caseNumberSettings[settingKey]) || 1;
      return Math.max(
        configuredStart,
        nums.length > 0 ? Math.max(...nums) + 1 : configuredStart,
      );
    };

    const numPart = assignNoInput.trim() || getNextSeqNo(assignPrefix);
    const assignedNo = `${currentYear}${assignPrefix}${numPart}`;

    const updated = {
      ...selectedCaseForAssign,
      sujeNo: currentSuje,
      hyeongjeNo: assignedNo,
      latestHyeongjeNo: assignedNo,
      disposition: autoSeal
        ? `피의자(기소 - 사무국승인 [${assignedNo}])`
        : selectedCaseForAssign.disposition,
    };

    if (onUpdateCase) {
      onUpdateCase(updated);
    }
    addLog(
      "검찰사무국 사건번호 공식 배정",
      `${currentSuje}호 -> ${assignedNo}호 (${assignPrefix} 사건번호 공식 부여 완료)`,
    );
    alert(
      `[검찰사무국 관인 날인] 사건 ${currentSuje}호에 공식 사건번호 '${assignedNo}'가 배정되었습니다.`,
    );
  };

  const addLog = (action, details) => {
    setAuditLogs((prev) => [
      {
        id: Date.now(),
        action,
        details,
        actor: "admin_secretariat",
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
      },
      ...prev,
    ]);
  };

  const handleAddProsecutor = (e) => {
    e.preventDefault();
    if (!newP.id || !newP.name) {
      alert("ID와 이름을 입력해주세요.");
      return;
    }
    const created = { ...newP, activeCases: 0 };
    if (onAddProsecutor) onAddProsecutor(created);
    addLog(
      "신규 검사 계정 생성",
      `${newP.name} (${newP.dept} / ${newP.title}) 계정 생성`,
    );
    setNewP({
      id: "",
      name: "",
      title: "담당검사",
      roleLevel: "PROSECUTOR",
      dept: departmentsData[0]?.name || "",
      password: "",
    });
    alert(`[사무국 처리] 신규 검사 계정 '${created.name}'이 등록되었습니다.`);
  };

  const handleDeleteProsecutor = (pUser) => {
    if (!pUser) return;
    if (pUser.id === currentUser?.id) {
      alert("현재 로그인 중인 본인 계정은 삭제할 수 없습니다.");
      return;
    }
    if (
      !window.confirm(
        `정말로 검사 계정 '${pUser.name} (${pUser.id})'을 삭제하시겠습니까?`,
      )
    )
      return;
    if (onDeleteProsecutor) onDeleteProsecutor(pUser.id);
    addLog(
      "검사 계정 영구 삭제",
      `'${pUser.name}' (${pUser.id}) 계정 영구 삭제`,
    );
    alert(`[사무국 처리] 계정 '${pUser.name}'이 삭제되었습니다.`);
  };

  const handleReassign = (e) => {
    e.preventDefault();
    const targetP = prosecutorsList.find((p) => p.id === targetPId);
    if (!targetP) return;
    onReassignCase(selectedCaseNo, targetP.name, targetP.id);
    addLog(
      "사건 직권 재배당",
      `${selectedCaseNo}호 → '${targetP.name}' 검사로 직권 변경`,
    );
    alert(
      `[직권 처리] ${selectedCaseNo}호 사건이 '${targetP.name}' 검사로 재배당되었습니다.`,
    );
  };

  const handleDbBackup = () => {
    const data =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(
        JSON.stringify({ ledgerData, prosecutorsList, auditLogs }, null, 2),
      );
    const a = document.createElement("a");
    a.setAttribute("href", data);
    a.setAttribute(
      "download",
      `DosePROS_Backup_${new Date().toISOString().split("T")[0]}.json`,
    );
    document.body.appendChild(a);
    a.click();
    a.remove();
    addLog("DB 영구 백업 다운로드", "JSON 백업본 파일 생성 및 다운로드 완료");
  };

  const hasSecretariatAccess =
    currentUser &&
    (currentUser.isSuperAdmin ||
      currentUser.roleLevel === "SUPER_ADMIN" ||
      currentUser.roleLevel === "PROSECUTOR_GENERAL" ||
      currentUser.roleLevel === "CHIEF_PROSECUTOR" ||
      currentUser.roleLevel === "DEPUTY_CHIEF" ||
      currentUser.roleLevel === "CHIEF_ADMINISTRATOR" ||
      (currentUser.dept && currentUser.dept.includes("사무국")) ||
      (currentUser.dualSecretariatWork &&
        currentUser.dualDept?.includes("사무국")));

  const hasHighLevelAdminAccess =
    currentUser &&
    (currentUser.isSuperAdmin ||
      currentUser.roleLevel === "SUPER_ADMIN" ||
      currentUser.roleLevel === "PROSECUTOR_GENERAL" ||
      currentUser.roleLevel === "CHIEF_PROSECUTOR" ||
      currentUser.roleLevel === "DEPUTY_CHIEF" ||
      currentUser.roleLevel === "CHIEF_ADMINISTRATOR");
  const canManageSecretariatPersonnel =
    currentUser?.isSuperAdmin ||
    currentUser?.dept?.includes("사무국") ||
    ["SUPER_ADMIN", "PROSECUTOR_GENERAL", "CHIEF_PROSECUTOR"].includes(
      currentUser?.roleLevel,
    );

  if (!hasSecretariatAccess) {
    return (
      <div
        className="glass-panel gold-border"
        style={{
          padding: "50px 24px",
          textAlign: "center",
          maxWidth: 520,
          margin: "40px auto",
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: "rgba(239,68,68,0.12)",
            border: "1px solid rgba(239,68,68,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <Building2 size={28} color="#f87171" />
        </div>
        <div
          style={{
            fontSize: "1.15rem",
            fontWeight: 800,
            color: "var(--text-main)",
            marginBottom: 8,
          }}
        >
          검찰사무국 총괄 관리 권한 필요
        </div>
        <div
          style={{
            fontSize: "0.82rem",
            color: "var(--text-muted)",
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          검찰사무국 총괄 시스템 관리는{" "}
          <strong>검찰사무국 소속 직원 또는 검사장급 이상 직급</strong>부터
          사용할 수 있습니다.
          <br />
          현재 계정:{" "}
          <span style={{ color: "var(--primary-amber)", fontWeight: 700 }}>
            {currentUser?.name} ({currentUser?.position || currentUser?.title} /{" "}
            {currentUser?.dept || "부서 미지정"})
          </span>
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "#94a3b8",
            padding: "10px 14px",
            borderRadius: 8,
            background: "var(--bg-elevated)",
            display: "inline-block",
            marginBottom: 16,
          }}
        >
          💡 <strong>권한 포함 대상</strong>: 검찰사무국 소속 직원, 최고 관리자,
          검찰총장, 검사장, 차장검사, 검찰관리관
        </div>
        {onOpenLoginModal && (
          <button
            onClick={onOpenLoginModal}
            className="btn btn-gold"
            style={{
              width: "100%",
              padding: "11px",
              fontWeight: 800,
              justifyContent: "center",
              fontSize: "0.88rem",
            }}
          >
            🔑 관리자 권한 계정으로 전환 / 로그인
          </button>
        )}
      </div>
    );
  }

  const visibleSubTabs = SUB_TABS.filter((t) => {
    if ((t.id === "delete" || t.id === "import") && !hasHighLevelAdminAccess) {
      return false;
    }
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div
        className="glass-panel gold-border"
        style={{
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Building2 size={20} color="var(--primary-amber)" />
          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: "1rem",
                color: "var(--text-main)",
              }}
            >
              검찰사무국 총괄 시스템 관리
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
              계정 관리 · 사건 재배당 · DB 백업 · 보안 감사로그
            </div>
          </div>
        </div>
        <span
          className="badge badge-gold"
          style={{ display: "flex", alignItems: "center", gap: 5 }}
        >
          <Award size={12} />
          SECRETARIAT ADMIN
        </span>
      </div>

      {/* Sub Tab Bar */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {visibleSubTabs.map((t) => {
          const Icon = t.icon;
          const active = activeSubTab === t.id;
          const pendingCount =
            t.id === "registrations"
              ? registrations.filter((r) => r.status === "PENDING").length
              : 0;
          return (
            <button
              key={t.id}
              onClick={() => setActiveSubTab(t.id)}
              className={active ? "btn btn-gold" : "btn btn-secondary"}
              style={{
                fontSize: "0.82rem",
                padding: "7px 14px",
                position: "relative",
              }}
            >
              <Icon size={14} />
              {t.label}
              {pendingCount > 0 && (
                <span
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    minWidth: 16,
                    height: 16,
                    borderRadius: 8,
                    background: "#ef4444",
                    color: "#fff",
                    fontSize: "0.65rem",
                    fontWeight: 900,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 4px",
                  }}
                >
                  {pendingCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Sub Tab Content */}
      {activeSubTab === "acting" && (
        <ActingOrderPanel
          prosecutorsList={prosecutorsList}
          onUpdateProsecutorStatus={onUpdateProsecutorStatus}
          addLog={addLog}
        />
      )}

      {/* ─── 기록 삭제 탭 ─────────────────────────────────────── */}
      {activeSubTab === "delete" && hasHighLevelAdminAccess && (
        <DeleteManagementPanel
          ledgerData={ledgerData}
          appealsData={appealsData}
          approvalsData={approvalsData}
          reportsData={reportsData}
          bookingsData={bookingsData}
          onDeleteCase={onDeleteCase}
          onDeleteAppeal={onDeleteAppeal}
          onDeleteApproval={onDeleteApproval}
          onDeleteReport={onDeleteReport}
          onDeleteBooking={onDeleteBooking}
          addLog={addLog}
        />
      )}

      {activeSubTab === "casenos" && (
        <div
          style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16 }}
        >
          {/* Left Form: Official Number Assignment */}
          <div
            style={{
              padding: 14,
              borderRadius: 8,
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.3)",
            }}
          >
            <div
              style={{
                fontWeight: 800,
                fontSize: "0.82rem",
                color: "var(--primary-amber)",
                marginBottom: 5,
              }}
            >
              사건번호 자동계산 시작 설정
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                color: "var(--text-muted)",
                lineHeight: 1.5,
                marginBottom: 10,
              }}
            >
              새 접수 사건은 기존 번호보다 낮지 않게 이 시작값부터 자동
              채번됩니다.
            </div>
            <form
              onSubmit={handleSaveCaseNumberSettings}
              style={{ display: "flex", flexDirection: "column", gap: 10 }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: 8,
                }}
              >
                {[
                  ["hyeongjeStart", "형제"],
                  ["teuggongStart", "특공"],
                  ["teughyeongStart", "특형"],
                  ["teugapjeStart", "특압제"],
                  ["apjeStart", "압제"],
                ].map(([key, label]) => (
                  <div key={key}>
                    <Label>{label} 시작 일련번호</Label>
                    <input
                      className="input-field"
                      type="number"
                      min="1"
                      step="1"
                      value={caseNumberForm[key] ?? 1}
                      onChange={(e) =>
                        setCaseNumberForm((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
              <button
                type="submit"
                className="btn btn-gold"
                disabled={caseNumberSaving}
                style={{ padding: "9px 12px", alignSelf: "flex-start" }}
              >
                <Save size={14} />{" "}
                {caseNumberSaving ? "저장 중" : "전체 시작값 저장"}
              </button>
            </form>
          </div>
          <div
            className="glass-panel gold-border"
            style={{
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                fontWeight: 800,
                fontSize: "0.95rem",
                color: "var(--text-main)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Scale size={18} color="var(--primary-amber)" />
              검찰사무국 사건번호 공식 배정 (제16조)
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              수사 중인 사건에 대하여 검찰사무국 규정에 따라 형제 · 특공 · 특형
              · 특압제 등 공식 사건번호를 배정하고 관인을 날인합니다.
            </div>

            <form
              onSubmit={handleAssignOfficialCaseNo}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              <div>
                <Label>배정 대상 사건 선택 *</Label>
                <select
                  className="select-field"
                  value={selectedCaseForAssign?.id || ""}
                  onChange={(e) => {
                    const found = ledgerData.find(
                      (c) => String(c.id) === String(e.target.value),
                    );
                    setSelectedCaseForAssign(found);
                  }}
                  required
                >
                  <option value="">사건을 선택하세요...</option>
                  {ledgerData.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.sujeNo || c.hyeongjeNo} | {c.suspectName} (
                      {c.chargeName})
                    </option>
                  ))}
                </select>
              </div>

              {selectedCaseForAssign && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-subtle)",
                    fontSize: "0.78rem",
                    lineHeight: 1.6,
                  }}
                >
                  <div>
                    수사사건번호:{" "}
                    <strong style={{ color: "var(--primary-amber)" }}>
                      {selectedCaseForAssign.sujeNo ||
                        (selectedCaseForAssign.hyeongjeNo || "").replace(
                          "형제",
                          "수제",
                        )}
                    </strong>
                  </div>
                  <div>
                    현재 형제번호:{" "}
                    <strong>{selectedCaseForAssign.hyeongjeNo || "-"}</strong>
                  </div>
                  <div>
                    피의자: <strong>{selectedCaseForAssign.suspectName}</strong>{" "}
                    (담당: {selectedCaseForAssign.prosecutorName})
                  </div>
                  <div>
                    현재 처분:{" "}
                    <span
                      className="badge badge-gold"
                      style={{ fontSize: "0.68rem" }}
                    >
                      {selectedCaseForAssign.disposition || "수사중"}
                    </span>
                  </div>
                </div>
              )}

              <div>
                <Label>배정할 사건번호 유형 (사무규칙 제16조) *</Label>
                <select
                  className="select-field"
                  value={assignPrefix}
                  onChange={(e) => setAssignPrefix(e.target.value)}
                >
                  <option value="형제">
                    ⚖️ 형제 (공소 제기된 일반 형사사건: ○○○○형제○호)
                  </option>
                  <option value="특공">
                    🏛️ 특공 (공무원을 공소 제기한 사건: ○○○○특공○호)
                  </option>
                  <option value="특형">
                    ⚡ 특형 (특수 형사 사건 공소제기: ○○○○특형○호)
                  </option>
                  <option value="특압제">
                    🔍 특압제 (공소 제기된 사건의 압수수색: ○○○○특압제○호)
                  </option>
                  <option value="압제">
                    🔍 압제 (수사 사건 압수수색 영장: ○○○○압제○호)
                  </option>
                </select>
              </div>

              <div>
                <Label>일련번호 지정 (비워둘 시 자동 매칭)</Label>
                <input
                  className="input-field"
                  placeholder="예: 196 (비워두면 유형별 자동 채번)"
                  value={assignNoInput}
                  onChange={(e) => setAssignNoInput(e.target.value)}
                />
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 4,
                }}
              >
                <input
                  type="checkbox"
                  id="autoSealCheck"
                  checked={autoSeal}
                  onChange={(e) => setAutoSeal(e.target.checked)}
                />
                <label
                  htmlFor="autoSealCheck"
                  style={{
                    fontSize: "0.75rem",
                    color: "var(--text-main)",
                    cursor: "pointer",
                  }}
                >
                  검찰사무국 관인 날인 및 기소 결정 상태로 승인 업데이트
                </label>
              </div>

              <button
                type="submit"
                className="btn btn-gold"
                style={{
                  marginTop: 8,
                  padding: 10,
                  fontWeight: 800,
                  justifyContent: "center",
                }}
              >
                <Scale size={16} /> 검찰사무국 사건번호 공식 배정
              </button>
            </form>
          </div>

          {/* Right Table: All Cases & Case Number Status */}
          <div
            className="glass-panel"
            style={{
              padding: 20,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div
              style={{
                fontWeight: 800,
                fontSize: "0.95rem",
                color: "var(--text-main)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>📋 통합 사건번호 공식 배정 대장</span>
              <span
                className="badge badge-gold"
                style={{ fontSize: "0.72rem" }}
              >
                총 {ledgerData.length}건
              </span>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: "0.8rem",
                }}
              >
                <thead>
                  <tr
                    style={{
                      background: "var(--bg-elevated)",
                      borderBottom: "1px solid var(--border-subtle)",
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                    }}
                  >
                    <th style={{ padding: 10, textAlign: "left" }}>
                      수사번호 (수제)
                    </th>
                    <th style={{ padding: 10, textAlign: "left" }}>
                      공식배정 (형제/특공/특형)
                    </th>
                    <th style={{ padding: 10, textAlign: "left" }}>피의자</th>
                    <th style={{ padding: 10, textAlign: "left" }}>담당검사</th>
                    <th style={{ padding: 10, textAlign: "left" }}>처분상태</th>
                    <th style={{ padding: 10, textAlign: "center" }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerData.map((c) => {
                    const sujeStr =
                      c.sujeNo || (c.hyeongjeNo || "").replace("형제", "수제");
                    const isIndicted =
                      (c.disposition || "").includes("기소") &&
                      !(c.disposition || "").includes("불기소");

                    return (
                      <tr
                        key={c.id}
                        style={{
                          borderBottom: "1px solid var(--border-subtle)",
                        }}
                      >
                        <td
                          style={{
                            padding: 10,
                            fontFamily: "monospace",
                            fontWeight: 700,
                            color: "var(--primary-amber)",
                          }}
                        >
                          {sujeStr}
                        </td>
                        <td
                          style={{
                            padding: 10,
                            fontFamily: "monospace",
                            fontWeight: 800,
                          }}
                        >
                          {isIndicted ||
                          (c.hyeongjeNo && c.hyeongjeNo !== "-") ? (
                            <span
                              className="badge badge-gold"
                              style={{ fontSize: "0.72rem" }}
                            >
                              {c.hyeongjeNo}
                            </span>
                          ) : (
                            <span
                              style={{
                                color: "var(--text-muted)",
                                fontSize: "0.72rem",
                              }}
                            >
                              미배정 (수사중)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: 10, fontWeight: 700 }}>
                          {c.suspectName}
                        </td>
                        <td style={{ padding: 10 }}>{c.prosecutorName}</td>
                        <td style={{ padding: 10 }}>
                          <span
                            className={`badge ${isIndicted ? "badge-success" : "badge-warning"}`}
                            style={{ fontSize: "0.7rem" }}
                          >
                            {c.disposition || "수사중"}
                          </span>
                        </td>
                        <td style={{ padding: 10, textAlign: "center" }}>
                          <button
                            onClick={() => {
                              setSelectedCaseForAssign(c);
                              setAssignNoInput("");
                            }}
                            className="btn btn-outline"
                            style={{ padding: "3px 8px", fontSize: "0.7rem" }}
                          >
                            ✏️ 번호 배정
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sub Tab Content */}
      {activeSubTab === "prosecutors" && (
        <div
          style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}
        >
          {/* Add Form */}
          <div className="glass-panel" style={{ padding: 20 }}>
            <div
              style={{
                fontWeight: 800,
                fontSize: "0.9rem",
                color: "var(--text-main)",
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 16,
              }}
            >
              <UserPlus size={15} color="var(--primary-amber)" />
              신규 검사 계정 등록
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                onAddProsecutor(newP);
              }}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              <div>
                <Label>계정 ID *</Label>
                <input
                  className="input-field"
                  placeholder="예: prosecutor_kim"
                  value={newP.id}
                  onChange={(e) => setNewP({ ...newP, id: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>성명 *</Label>
                <input
                  className="input-field"
                  placeholder="예: 김검사"
                  value={newP.name}
                  onChange={(e) => setNewP({ ...newP, name: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>직위 (Position)</Label>
                <input
                  className="input-field"
                  placeholder="예: 검찰사무국장 / 첨단범죄수사부 검사"
                  value={newP.position || ""}
                  onChange={(e) =>
                    setNewP({
                      ...newP,
                      position: e.target.value,
                      title: e.target.value,
                    })
                  }
                />
              </div>
              <div>
                <Label>직급 (Rank) 선택</Label>
                <select
                  className="select-field"
                  value={newP.roleLevel}
                  onChange={(e) => {
                    const label = ROLE_LABELS[e.target.value] || e.target.value;
                    const rankName = label.split(" ")[0];
                    setNewP({
                      ...newP,
                      roleLevel: e.target.value,
                      rank: rankName,
                    });
                  }}
                >
                  <optgroup label="── 검사 직급 ──────────────">
                    <option value="PROSECUTOR_GENERAL">검찰총장</option>
                    <option value="CHIEF_PROSECUTOR">검사장</option>
                    <option value="DEPUTY_CHIEF">차장검사</option>
                    <option value="SENIOR_PROSECUTOR">부장검사</option>
                    <option value="PROSECUTOR">평검사</option>
                    <option value="PROBATIONARY">검사시보</option>
                  </optgroup>
                  <optgroup label="── 검찰청직원 직급 ─────────">
                    <option value="CHIEF_ADMINISTRATOR">
                      검찰관리관 (차장검사 대우)
                    </option>
                    <option value="ADMINISTRATOR">검찰사무관</option>
                    <option value="ADMIN_PROBATIONARY">검찰사무관시보</option>
                  </optgroup>
                </select>
                {newP.roleLevel && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: "0.72rem",
                      padding: "4px 10px",
                      borderRadius: 6,
                      background: `${ROLE_COLORS[newP.roleLevel] || "#3b82f6"}15`,
                      color: ROLE_COLORS[newP.roleLevel] || "#3b82f6",
                      display: "inline-block",
                    }}
                  >
                    {ROLE_LABELS[newP.roleLevel]}
                  </div>
                )}
              </div>

              <div>
                <Label>소속 부서</Label>
                <select
                  className="select-field"
                  value={newP.dept}
                  onChange={(e) => setNewP({ ...newP, dept: e.target.value })}
                >
                  {departmentsData.map((d) => (
                    <option key={d.id} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>초기 비밀번호</Label>
                <input
                  className="input-field"
                  type="password"
                  value={newP.password}
                  onChange={(e) =>
                    setNewP({ ...newP, password: e.target.value })
                  }
                />
              </div>
              <button
                type="submit"
                className="btn btn-gold"
                style={{ marginTop: 4 }}
              >
                <UserPlus size={14} />
                계정 발급
              </button>
            </form>
          </div>

          {/* Prosecutor List */}
          <div className="glass-panel" style={{ overflow: "hidden" }}>
            <div
              style={{
                padding: "14px 16px",
                borderBottom: "1px solid var(--border-subtle)",
                fontWeight: 700,
                fontSize: "0.85rem",
                color: "var(--text-main)",
              }}
            >
              등록 계정 목록 ({prosecutorsList.length}명)
            </div>
            <div
              className="ledger-table-container"
              style={{ border: "none", borderRadius: 0 }}
            >
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>계정 ID</th>
                    <th>성명</th>
                    <th>직위 (Position)</th>
                    <th>직급 (Rank)</th>
                    <th>소속 부서</th>
                    <th>신분 / 결재권한</th>
                    <th>계정 관리</th>
                  </tr>
                </thead>
                <tbody>
                  {prosecutorsList.map((p) => {
                    const st = p.status || "ACTIVE";
                    return (
                      <tr key={p.id}>
                        <td
                          style={{
                            fontFamily: "monospace",
                            color: "var(--primary-amber)",
                            fontWeight: 700,
                          }}
                        >
                          {p.id}
                        </td>
                        <td style={{ fontWeight: 700 }}>{p.name}</td>
                        <td
                          style={{
                            color: "var(--text-main)",
                            fontSize: "0.8rem",
                          }}
                        >
                          {p.position || p.title || "-"}
                          {p.dualPosition && (
                            <div
                              style={{
                                color: "#a7f3d0",
                                fontSize: "0.7rem",
                                marginTop: 3,
                              }}
                            >
                              겸직: {p.dualPosition}
                              {p.dualDept ? ` · ${p.dualDept}` : ""}
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              padding: "3px 9px",
                              borderRadius: 20,
                              background: `${ROLE_COLORS[p.roleLevel] || "#3b82f6"}20`,
                              color: ROLE_COLORS[p.roleLevel] || "#3b82f6",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {ROLE_LABELS[p.roleLevel] || p.rank || p.roleLevel}
                          </span>
                        </td>
                        <td style={{ color: "var(--text-muted)" }}>{p.dept}</td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 4,
                              alignItems: "flex-start",
                            }}
                          >
                            {st === "ON_LEAVE" && (
                              <span
                                style={{
                                  fontSize: "0.68rem",
                                  padding: "2px 7px",
                                  borderRadius: 10,
                                  background: "rgba(239,68,68,0.15)",
                                  color: "#f87171",
                                  fontWeight: 800,
                                }}
                              >
                                🟡 휴직중{" "}
                                {p.delegateTo ? `(대결: ${p.delegateTo})` : ""}
                              </span>
                            )}
                            {st === "DELEGATED" && (
                              <span
                                style={{
                                  fontSize: "0.68rem",
                                  padding: "2px 7px",
                                  borderRadius: 10,
                                  background: "rgba(59,130,246,0.15)",
                                  color: "#60a5fa",
                                  fontWeight: 800,
                                }}
                              >
                                🔵 권한위임 (대결자: {p.delegateTo || "미지정"})
                              </span>
                            )}
                            {st === "ACTIVE" && (
                              <span
                                style={{
                                  fontSize: "0.68rem",
                                  padding: "2px 7px",
                                  borderRadius: 10,
                                  background: "rgba(52,211,153,0.15)",
                                  color: "#34d399",
                                  fontWeight: 800,
                                }}
                              >
                                🟢 정상 (재직)
                              </span>
                            )}
                            {p.isAutoAssignExcluded && (
                              <span
                                style={{
                                  fontSize: "0.65rem",
                                  padding: "2px 6px",
                                  borderRadius: 8,
                                  background: "rgba(239,68,68,0.12)",
                                  color: "#f87171",
                                  fontWeight: 800,
                                }}
                              >
                                🚫 자동배정 제외 대상
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          {hasSecretariatAccess &&
                            (!p.dept?.includes("사무국") ||
                              canManageSecretariatPersonnel) && (
                              <div
                                style={{
                                  display: "flex",
                                  gap: 4,
                                  flexWrap: "wrap",
                                }}
                              >
                                <button
                                  onClick={() => {
                                    const updatedState =
                                      !p.isAutoAssignExcluded;
                                    if (onUpdateProsecutorStatus) {
                                      onUpdateProsecutorStatus(p.id, {
                                        isAutoAssignExcluded: updatedState,
                                      });
                                    }
                                    addLog(
                                      "자동배정 설정 변경",
                                      `'${p.name}' 검사의 자동배정 상태 변경 (${updatedState ? "제외" : "포함"})`,
                                    );
                                  }}
                                  className="btn btn-secondary"
                                  style={{
                                    padding: "3px 7px",
                                    fontSize: "0.68rem",
                                    color: p.isAutoAssignExcluded
                                      ? "#f87171"
                                      : "#34d399",
                                    borderColor: p.isAutoAssignExcluded
                                      ? "rgba(239,68,68,0.3)"
                                      : "rgba(52,211,153,0.3)",
                                  }}
                                  title={
                                    p.isAutoAssignExcluded
                                      ? "자동배정 포함으로 전환"
                                      : "자동배정 제외로 전환"
                                  }
                                >
                                  {p.isAutoAssignExcluded
                                    ? "⭕ 배정 포함"
                                    : "🚫 배정 제외"}
                                </button>
                                <button
                                  onClick={() => {
                                    setStatusModalUser(p);
                                    setStatusForm({
                                      status: p.status || "ACTIVE",
                                      delegateTo: p.delegateTo || "",
                                      delegateReason: p.delegateReason || "",
                                      dualPosition: p.dualPosition || "",
                                      dualDept: p.dualDept || "",
                                      dualRoleLevel: p.dualRoleLevel || "",
                                      dualSecretariatWork:
                                        !!p.dualSecretariatWork,
                                      isAutoAssignExcluded:
                                        !!p.isAutoAssignExcluded,
                                    });
                                  }}
                                  className="btn btn-secondary"
                                  style={{
                                    padding: "3px 7px",
                                    fontSize: "0.68rem",
                                    color: "var(--primary-amber)",
                                    borderColor: "rgba(245,158,11,0.3)",
                                  }}
                                  title="휴직/결재위임 설정"
                                >
                                  ⚙️ 상세 설정
                                </button>
                                <button
                                  onClick={() => handleDeleteProsecutor(p)}
                                  className="btn btn-secondary"
                                  style={{
                                    padding: "3px 7px",
                                    fontSize: "0.68rem",
                                    color: "#f87171",
                                    borderColor: "rgba(239,68,68,0.3)",
                                  }}
                                  title="계정 삭제"
                                >
                                  <Trash2 size={11} /> 삭제
                                </button>
                              </div>
                            )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* 휴직 / 결재권한 위임 설정 팝업 모달 */}
            {statusModalUser && (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,0.75)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 9999,
                }}
              >
                <div
                  className="glass-panel"
                  style={{
                    maxWidth: 460,
                    width: "92%",
                    padding: 24,
                    borderRadius: 14,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: "0.95rem",
                      color: "var(--text-main)",
                      marginBottom: 16,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span>⚙️ 결재권한 위임 & 신분 상태 설정</span>
                    <button
                      onClick={() => setStatusModalUser(null)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                        fontSize: "1.1rem",
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <div
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: "var(--bg-elevated)",
                      marginBottom: 16,
                      fontSize: "0.8rem",
                      lineHeight: 1.5,
                    }}
                  >
                    대상 계정:{" "}
                    <strong style={{ color: "var(--primary-amber)" }}>
                      {statusModalUser.name} (
                      {statusModalUser.position || statusModalUser.title})
                    </strong>
                    <br />
                    소속 부서: {statusModalUser.dept}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 14,
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: "rgba(52,211,153,0.08)",
                        border: "1px solid rgba(52,211,153,0.25)",
                      }}
                    >
                      <Label>겸직 정보 (선택)</Label>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 8,
                        }}
                      >
                        <input
                          className="input-field"
                          placeholder="겸직 직위"
                          value={statusForm.dualPosition || ""}
                          onChange={(e) =>
                            setStatusForm({
                              ...statusForm,
                              dualPosition: e.target.value,
                            })
                          }
                        />
                        <select
                          className="select-field"
                          value={statusForm.dualDept || ""}
                          onChange={(e) =>
                            setStatusForm({
                              ...statusForm,
                              dualDept: e.target.value,
                            })
                          }
                        >
                          <option value="">겸직 부서 없음</option>
                          {departmentsData.map((dept) => (
                            <option key={dept.id} value={dept.name}>
                              {dept.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <select
                        className="select-field"
                        style={{ marginTop: 8 }}
                        value={statusForm.dualRoleLevel || ""}
                        onChange={(e) =>
                          setStatusForm({
                            ...statusForm,
                            dualRoleLevel: e.target.value,
                          })
                        }
                      >
                        <option value="">겸직 직급 없음</option>
                        {ROLE_HIERARCHY.filter(
                          (role) => role !== "SUPER_ADMIN",
                        ).map((role) => (
                          <option key={role} value={role}>
                            {ROLE_LABELS[role]}
                          </option>
                        ))}
                      </select>
                      <label
                        style={{
                          display: "flex",
                          gap: 8,
                          alignItems: "center",
                          marginTop: 8,
                          fontSize: "0.75rem",
                          color: "var(--text-main)",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!statusForm.dualSecretariatWork}
                          onChange={(e) =>
                            setStatusForm({
                              ...statusForm,
                              dualSecretariatWork: e.target.checked,
                            })
                          }
                        />
                        겸직 사무국 업무 권한 승인
                      </label>
                    </div>
                    <div>
                      <Label>신분 / 결재 권한 상태 선택 *</Label>
                      <select
                        className="select-field"
                        value={statusForm.status}
                        onChange={(e) =>
                          setStatusForm({
                            ...statusForm,
                            status: e.target.value,
                          })
                        }
                      >
                        <option value="ACTIVE">
                          🟢 정상 재직 (직접 결재 수행)
                        </option>
                        <option value="DELEGATED">
                          🔵 결재권한 위임 (대결자에게 결재권 부여)
                        </option>
                        <option value="ON_LEAVE">
                          🟡 휴직중 (사무대리 및 대결자 지정)
                        </option>
                      </select>
                    </div>

                    <div
                      style={{
                        padding: "10px 12px",
                        borderRadius: 8,
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-subtle)",
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <input
                        type="checkbox"
                        id="autoAssignExCheck"
                        checked={!!statusForm.isAutoAssignExcluded}
                        onChange={(e) =>
                          setStatusForm({
                            ...statusForm,
                            isAutoAssignExcluded: e.target.checked,
                          })
                        }
                      />
                      <label
                        htmlFor="autoAssignExCheck"
                        style={{
                          fontSize: "0.78rem",
                          color: "var(--text-main)",
                          cursor: "pointer",
                        }}
                      >
                        🚫 신규 사건 자동 배정 대상에서 제외하기 (고위 관리자 /
                        전담 제외)
                      </label>
                    </div>

                    {statusForm.status !== "ACTIVE" && (
                      <>
                        <div>
                          <Label>대결자 (대리 결재 승인자) 지정 *</Label>
                          <select
                            className="select-field"
                            value={statusForm.delegateTo}
                            onChange={(e) =>
                              setStatusForm({
                                ...statusForm,
                                delegateTo: e.target.value,
                              })
                            }
                          >
                            <option value="">대결자 선택...</option>
                            {prosecutorsList
                              .filter((p) => p.id !== statusModalUser.id)
                              .map((p) => (
                                <option key={p.id} value={p.name}>
                                  {p.name} ({p.title} / {p.dept})
                                </option>
                              ))}
                          </select>
                        </div>
                        <div>
                          <Label>휴직 / 위임 사유</Label>
                          <input
                            className="input-field"
                            placeholder="예: 연가, 해외 출장, 육아 휴직"
                            value={statusForm.delegateReason}
                            onChange={(e) =>
                              setStatusForm({
                                ...statusForm,
                                delegateReason: e.target.value,
                              })
                            }
                          />
                        </div>
                      </>
                    )}

                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        justifyContent: "flex-end",
                        marginTop: 10,
                      }}
                    >
                      <button
                        onClick={() => setStatusModalUser(null)}
                        className="btn btn-secondary"
                        style={{ padding: "8px 16px" }}
                      >
                        취소
                      </button>
                      <button
                        onClick={() => {
                          if (onUpdateProsecutorStatus) {
                            onUpdateProsecutorStatus(
                              statusModalUser.id,
                              statusForm,
                            );
                          }
                          addLog(
                            "검사 신분/위임 설정",
                            `'${statusModalUser.name}' 검사 상태 변경 (${statusForm.status}, 대결자: ${statusForm.delegateTo || "없음"})`,
                          );
                          setStatusModalUser(null);
                        }}
                        className="btn btn-gold"
                        style={{ padding: "8px 16px" }}
                      >
                        설정 저장
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 부서 & 부원 관리 탭 */}
      {activeSubTab === "depts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 상단 통합 안내 */}
          <div
            className="glass-panel"
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  color: "var(--text-main)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Building2 size={16} color="var(--primary-amber)" />
                검찰 부서 신설·삭제 & 부서장 부원 직위 관리
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "var(--text-muted)",
                  marginTop: 2,
                }}
              >
                부서를 신설/삭제하고 담당 부서장이 부원을 배치하며, 소속 부서
                변경 시 직위가 부서명에 맞춰 자동으로 연동됩니다.
              </div>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "320px 1fr",
              gap: 16,
            }}
          >
            {/* 왼쪽: 부서 목록 및 신설 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* 1. 신규 부서 등록 폼 */}
              <div className="glass-panel" style={{ padding: 18 }}>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: "0.85rem",
                    color: "var(--text-main)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 12,
                  }}
                >
                  <Plus size={14} color="var(--primary-amber)" />
                  신규 부서 신설
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newDeptForm.name) {
                      alert("부서명을 입력하세요.");
                      return;
                    }
                    const selectedHead = prosecutorsList.find(
                      (p) => p.id === newDeptForm.headId,
                    );
                    const newDept = {
                      id: `dept_${Date.now()}`,
                      name: newDeptForm.name,
                      desc: newDeptForm.desc || "검찰 수사 및 사무 담당 부서",
                      headId: newDeptForm.headId || "",
                      headName: selectedHead ? selectedHead.name : "미지정",
                      canIntake: newDeptForm.canIntake !== false,
                    };
                    if (onAddDepartment) onAddDepartment(newDept);
                    addLog(
                      "부서 신설",
                      `'${newDept.name}' 신설 (부서장: ${newDept.headName}, 사건접수: ${newDept.canIntake ? "허용" : "차단"})`,
                    );
                    setNewDeptForm({
                      name: "",
                      desc: "",
                      headId: "",
                      canIntake: true,
                    });
                    alert(
                      `'${newDept.name}' 부서가 성공적으로 신설되었습니다.`,
                    );
                  }}
                  style={{ display: "flex", flexDirection: "column", gap: 10 }}
                >
                  <div>
                    <Label>부서 명칭 *</Label>
                    <input
                      className="input-field"
                      placeholder="예: 지능범죄수사부"
                      value={newDeptForm.name}
                      onChange={(e) =>
                        setNewDeptForm({ ...newDeptForm, name: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>사건 접수 권한 설정</Label>
                    <select
                      className="select-field"
                      value={newDeptForm.canIntake ? "true" : "false"}
                      onChange={(e) =>
                        setNewDeptForm({
                          ...newDeptForm,
                          canIntake: e.target.value === "true",
                        })
                      }
                    >
                      <option value="true">
                        ✅ 사건 접수 허용 (접수 권한 부여)
                      </option>
                      <option value="false">
                        🚫 사건 접수 차단 (수사 전담 부서)
                      </option>
                    </select>
                  </div>
                  <div>
                    <Label>담당 부서장 지정 (선택)</Label>
                    <select
                      className="select-field"
                      value={newDeptForm.headId}
                      onChange={(e) =>
                        setNewDeptForm({
                          ...newDeptForm,
                          headId: e.target.value,
                        })
                      }
                    >
                      <option value="">부서장 미지정</option>
                      {prosecutorsList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.dept} · {p.position || p.title})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>부서 관장 사무 (설명)</Label>
                    <input
                      className="input-field"
                      placeholder="부서의 담당 수사/사무 분야 설명"
                      value={newDeptForm.desc}
                      onChange={(e) =>
                        setNewDeptForm({ ...newDeptForm, desc: e.target.value })
                      }
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn btn-gold"
                    style={{ marginTop: 4, fontSize: "0.82rem" }}
                  >
                    <Plus size={14} /> 부서 신설 완료
                  </button>
                </form>
              </div>

              {/* 2. 부서 카드 리스트 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    padding: "0 4px",
                  }}
                >
                  등록 부서 목록 ({departmentsData.length}개)
                </div>
                {departmentsData.map((d) => {
                  const isSelected =
                    selectedDeptId === d.id || selectedDeptId === d.name;
                  const members = prosecutorsList.filter(
                    (p) => p.dept === d.name,
                  );
                  const headUser = prosecutorsList.find(
                    (p) => p.id === d.headId || p.dept === d.name,
                  );
                  return (
                    <div
                      key={d.id}
                      onClick={() => setSelectedDeptId(d.name)}
                      className="glass-panel"
                      style={{
                        padding: "12px 14px",
                        cursor: "pointer",
                        borderRadius: 10,
                        border: isSelected
                          ? "1px solid var(--primary-amber)"
                          : "1px solid var(--border-subtle)",
                        background: isSelected
                          ? "rgba(245,158,11,0.08)"
                          : "var(--bg-card)",
                        transition: "all 0.15s",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 4,
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: "0.88rem",
                            color: isSelected
                              ? "var(--primary-amber)"
                              : "var(--text-main)",
                          }}
                        >
                          {d.name}
                        </div>
                        <span
                          className="badge badge-info"
                          style={{ fontSize: "0.68rem" }}
                        >
                          {members.length}명 소속
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--text-muted)",
                          lineHeight: 1.4,
                        }}
                      >
                        부서장:{" "}
                        <strong style={{ color: "var(--text-main)" }}>
                          {d.headName || headUser?.name || "미지정"}
                        </strong>
                      </div>
                      <div
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--text-muted)",
                          marginTop: 4,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {d.desc}
                      </div>

                      {/* 권한 및 삭제 버튼 */}
                      <div
                        style={{
                          marginTop: 8,
                          paddingTop: 6,
                          borderTop: "1px solid var(--border-subtle)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onToggleDeptIntake) onToggleDeptIntake(d.id);
                            addLog(
                              "부서 사건접수권한 변경",
                              `'${d.name}' 사건접수권한 ${d.canIntake !== false ? "차단" : "부여"}`,
                            );
                          }}
                          className="btn btn-outline"
                          style={{
                            padding: "3px 8px",
                            fontSize: "0.68rem",
                            color:
                              d.canIntake !== false ? "#4ade80" : "#f87171",
                            borderColor:
                              d.canIntake !== false
                                ? "rgba(74,222,128,0.3)"
                                : "rgba(239,68,68,0.3)",
                            background:
                              d.canIntake !== false
                                ? "rgba(74,222,128,0.08)"
                                : "rgba(239,68,68,0.08)",
                          }}
                          title="클릭하여 이 부서의 신규 사건 접수 권한 부여/차단 전환"
                        >
                          사건접수:{" "}
                          {d.canIntake !== false ? "✅ 허용" : "🚫 차단"}
                        </button>

                        {departmentsData.length > 1 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (
                                !window.confirm(
                                  `'${d.name}' 부서를 해체/삭제하시겠습니까?`,
                                )
                              )
                                return;
                              if (onDeleteDepartment) onDeleteDepartment(d.id);
                              addLog("부서 삭제", `'${d.name}' 부서 해체`);
                            }}
                            className="btn btn-outline"
                            style={{
                              padding: "3px 8px",
                              fontSize: "0.68rem",
                              color: "#f87171",
                            }}
                          >
                            <Trash2 size={11} /> 삭제
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 오른쪽: 선택된 부서의 부원 배치 및 관리 */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {(() => {
                const currentDeptObj =
                  departmentsData.find(
                    (d) => d.id === selectedDeptId || d.name === selectedDeptId,
                  ) || departmentsData[0];
                const deptName = currentDeptObj?.name || selectedDeptId;
                const members = prosecutorsList.filter(
                  (p) => p.dept === deptName,
                );
                const deptCases = ledgerData.filter(
                  (c) =>
                    c.prosecutorName &&
                    members.some(
                      (m) =>
                        m.name.includes(c.prosecutorName) ||
                        c.prosecutorName.includes(m.name),
                    ),
                );
                const nonMembers = prosecutorsList.filter(
                  (p) => p.dept !== deptName,
                );

                return (
                  <>
                    {/* 부서 요약 패널 */}
                    <div className="glass-panel" style={{ padding: 20 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 12,
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: "1.1rem",
                              fontWeight: 800,
                              color: "var(--text-main)",
                              display: "flex",
                              alignItems: "center",
                              gap: 8,
                            }}
                          >
                            <Building2 size={20} color="var(--primary-amber)" />
                            {deptName} 부원 & 조직 관리
                          </div>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                              marginTop: 2,
                            }}
                          >
                            {currentDeptObj?.desc} · 부서장:{" "}
                            <strong style={{ color: "var(--primary-amber)" }}>
                              {currentDeptObj?.headName || "지정 필요"}
                            </strong>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 10 }}>
                          <div
                            style={{
                              textAlign: "center",
                              padding: "6px 12px",
                              background: "var(--bg-elevated)",
                              borderRadius: 8,
                              border: "1px solid var(--border-subtle)",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "1.1rem",
                                fontWeight: 900,
                                color: "var(--primary-amber)",
                              }}
                            >
                              {members.length}명
                            </div>
                            <div
                              style={{
                                fontSize: "0.68rem",
                                color: "var(--text-muted)",
                              }}
                            >
                              소속 부원
                            </div>
                          </div>
                          <div
                            style={{
                              textAlign: "center",
                              padding: "6px 12px",
                              background: "var(--bg-elevated)",
                              borderRadius: 8,
                              border: "1px solid var(--border-subtle)",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "1.1rem",
                                fontWeight: 900,
                                color: "#60a5fa",
                              }}
                            >
                              {deptCases.length}건
                            </div>
                            <div
                              style={{
                                fontSize: "0.68rem",
                                color: "var(--text-muted)",
                              }}
                            >
                              부서 사건 수
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 부서원 발령/이동 폼 */}
                      <div
                        style={{
                          background: "var(--bg-elevated)",
                          padding: 14,
                          borderRadius: 10,
                          border: "1px solid var(--border-subtle)",
                          marginTop: 14,
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            color: "var(--text-main)",
                            marginBottom: 8,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <UserPlus size={14} color="var(--primary-amber)" />{" "}
                          신규 부원 이관 / {deptName} 발령
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 10,
                            alignItems: "center",
                          }}
                        >
                          <select
                            id="deptTransferSelect"
                            className="select-field"
                            style={{ flex: 1 }}
                            defaultValue=""
                          >
                            <option value="" disabled>
                              이동할 인원 선택 (현재 타 부서 소속)...
                            </option>
                            {nonMembers.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.dept} · {p.position || p.title})
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            onClick={() => {
                              const sel =
                                document.getElementById(
                                  "deptTransferSelect",
                                )?.value;
                              if (!sel) {
                                alert("발령할 인원을 선택해주세요.");
                                return;
                              }
                              const targetUser = prosecutorsList.find(
                                (p) => p.id === sel,
                              );
                              if (onUpdateUserDept)
                                onUpdateUserDept(sel, deptName);
                              addLog(
                                "부서원 인사이동",
                                `${targetUser?.name} → '${deptName}'(으)로 인사이동 발령 (직위 자동 갱신)`,
                              );
                              alert(
                                `${targetUser?.name}님이 '${deptName}'(으)로 성공적으로 발령되었습니다.`,
                              );
                            }}
                            className="btn btn-gold"
                            style={{
                              padding: "8px 16px",
                              fontSize: "0.8rem",
                              flexShrink: 0,
                            }}
                          >
                            <UserPlus size={14} /> 인사 발령
                          </button>
                        </div>
                        <div
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--text-muted)",
                            marginTop: 6,
                          }}
                        >
                          💡 발령 시 사용자의 **직위(Position)**가{" "}
                          <span style={{ color: "var(--primary-amber)" }}>
                            [{deptName} ...]
                          </span>{" "}
                          형태로 자동 변경 및 반영됩니다.
                        </div>
                      </div>
                    </div>

                    {/* 소속 부원 명단 테이블 */}
                    <div className="glass-panel" style={{ overflow: "hidden" }}>
                      <div
                        style={{
                          padding: "14px 16px",
                          borderBottom: "1px solid var(--border-subtle)",
                          fontWeight: 700,
                          fontSize: "0.85rem",
                          color: "var(--text-main)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span>
                          {deptName} 소속 부원 명단 ({members.length}명)
                        </span>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            color: "var(--text-muted)",
                            fontWeight: 400,
                          }}
                        >
                          직급과 직위가 부서에 맞춰 동적 표시됩니다
                        </span>
                      </div>
                      <div
                        className="ledger-table-container"
                        style={{ border: "none", borderRadius: 0 }}
                      >
                        <table className="ledger-table">
                          <thead>
                            <tr>
                              <th>계정 ID</th>
                              <th>성명</th>
                              <th>부서 반영 직위 (Position)</th>
                              <th>직급 (Rank)</th>
                              <th>담당 사건 수</th>
                              <th>부서 변경</th>
                            </tr>
                          </thead>
                          <tbody>
                            {members.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={6}
                                  style={{
                                    textAlign: "center",
                                    padding: 24,
                                    color: "var(--text-muted)",
                                  }}
                                >
                                  현재 {deptName} 소속 부원이 없습니다. 위의
                                  인사 발령 폼을 통해 부원을 배치해보세요.
                                </td>
                              </tr>
                            ) : (
                              members.map((p) => {
                                const pCases = ledgerData.filter(
                                  (c) =>
                                    c.prosecutorName &&
                                    c.prosecutorName.includes(p.name),
                                );
                                return (
                                  <tr key={p.id}>
                                    <td
                                      style={{
                                        fontFamily: "monospace",
                                        color: "var(--primary-amber)",
                                        fontWeight: 700,
                                      }}
                                    >
                                      {p.id}
                                    </td>
                                    <td style={{ fontWeight: 700 }}>
                                      {p.name}
                                    </td>
                                    <td>
                                      <span
                                        style={{
                                          fontWeight: 700,
                                          color: "var(--text-main)",
                                          fontSize: "0.82rem",
                                        }}
                                      >
                                        {p.position || `${deptName} 검사`}
                                      </span>
                                    </td>
                                    <td>
                                      <span
                                        style={{
                                          fontSize: "0.68rem",
                                          fontWeight: 700,
                                          padding: "3px 9px",
                                          borderRadius: 20,
                                          background: `${ROLE_COLORS[p.roleLevel] || "#3b82f6"}20`,
                                          color:
                                            ROLE_COLORS[p.roleLevel] ||
                                            "#3b82f6",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        {ROLE_LABELS[p.roleLevel] ||
                                          p.rank ||
                                          p.roleLevel}
                                      </span>
                                    </td>
                                    <td
                                      style={{
                                        fontWeight: 700,
                                        color: "#60a5fa",
                                      }}
                                    >
                                      {pCases.length}건
                                    </td>
                                    <td>
                                      <select
                                        className="select-field"
                                        style={{
                                          fontSize: "0.72rem",
                                          padding: "3px 6px",
                                        }}
                                        value={p.dept}
                                        onChange={(e) => {
                                          if (onUpdateUserDept)
                                            onUpdateUserDept(
                                              p.id,
                                              e.target.value,
                                            );
                                          addLog(
                                            "부원 소속 변경",
                                            `${p.name} → '${e.target.value}' 소속 변경`,
                                          );
                                        }}
                                      >
                                        {departmentsData.map((d) => (
                                          <option key={d.id} value={d.name}>
                                            {d.name}
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "reassign" && (
        <div className="glass-panel" style={{ padding: 24, maxWidth: 520 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: "0.9rem",
              color: "var(--text-main)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 20,
            }}
          >
            <RefreshCw size={15} color="var(--primary-amber)" />
            검찰사무국 직권 담당검사 재배당
          </div>
          <form
            onSubmit={handleReassign}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            <div>
              <Label>재배당 대상 사건 *</Label>
              <select
                className="select-field"
                value={selectedCaseNo}
                onChange={(e) => setSelectedCaseNo(e.target.value)}
              >
                {ledgerData.map((c) => (
                  <option key={c.id} value={c.hyeongjeNo}>
                    {c.hyeongjeNo} (담당: {c.prosecutorName} | 피의자:{" "}
                    {c.suspectName})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>변경할 신규 담당검사 *</Label>
              <select
                className="select-field"
                value={targetPId}
                onChange={(e) => setTargetPId(e.target.value)}
              >
                {prosecutorsList
                  .filter((p) => p.id !== "admin_secretariat")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.title} / {p.dept})
                    </option>
                  ))}
              </select>
            </div>
            <button
              type="submit"
              className="btn btn-gold"
              style={{ marginTop: 4 }}
            >
              <CheckCircle2 size={14} />
              직권 재배당 실행
            </button>
          </form>
        </div>
      )}

      {activeSubTab === "import" && hasHighLevelAdminAccess && (
        <ExcelImportTab onBulkImport={onBulkImport} />
      )}

      {activeSubTab === "docnos" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 안내 + 일괄 재부여 */}
          <div
            className="glass-panel"
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: "0.9rem",
                  color: "var(--text-main)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <FilePen size={15} color="var(--primary-amber)" />
                문서번호 관리 — 검찰사무국 전용
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "var(--text-muted)",
                  marginTop: 2,
                }}
              >
                각 결재 문서의 문서번호를 직접 수정하거나, 전체를 순번대로 일괄
                재부여할 수 있습니다.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                다음 자동 순번:{" "}
                <strong
                  style={{
                    color: "var(--primary-amber)",
                    fontFamily: "monospace",
                  }}
                >
                  2026-결재-{String(docNoCounter || 1).padStart(3, "0")}
                </strong>
              </span>
              <button
                onClick={() => {
                  if (
                    !window.confirm(
                      "전체 결재 문서 번호를 1번부터 순서대로 재부여하시겠습니까?",
                    )
                  )
                    return;
                  const sorted = [...(approvalsData || [])].sort(
                    (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
                  );
                  sorted.forEach((doc, idx) => {
                    const newNo = `2026-결재-${String(idx + 1).padStart(3, "0")}`;
                    onUpdateDocNo(doc.id, newNo);
                  });
                  if (setDocNoCounter)
                    setDocNoCounter((approvalsData || []).length + 1);
                  addLog(
                    "문서번호 일괄 재부여",
                    `전체 ${(approvalsData || []).length}건 문서번호 순번 재정렬 완료`,
                  );
                  alert("문서번호 일괄 재부여가 완료되었습니다.");
                }}
                className="btn btn-gold"
                style={{ fontSize: "0.8rem" }}
              >
                <RefreshCw size={13} />
                전체 순번 재부여
              </button>
            </div>
          </div>

          {/* 결재 문서 목록 + 인라인 편집 */}
          <div className="glass-panel" style={{ overflow: "hidden" }}>
            <div
              className="ledger-table-container"
              style={{ border: "none", borderRadius: 0 }}
            >
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th style={{ width: 48 }}>#</th>
                    <th>문서번호</th>
                    <th>제목</th>
                    <th>담당검사</th>
                    <th>상태</th>
                    <th>생성일</th>
                    <th style={{ width: 100, textAlign: "center" }}>편집</th>
                  </tr>
                </thead>
                <tbody>
                  {(approvalsData || []).map((doc, idx) => (
                    <tr key={doc.id}>
                      <td
                        style={{
                          color: "var(--text-muted)",
                          fontFamily: "monospace",
                          textAlign: "center",
                        }}
                      >
                        {idx + 1}
                      </td>
                      <td>
                        {editingDocId === doc.id ? (
                          <input
                            className="input-field"
                            style={{
                              fontFamily: "monospace",
                              fontWeight: 700,
                              color: "var(--primary-amber)",
                              padding: "5px 8px",
                              fontSize: "0.82rem",
                              width: 180,
                            }}
                            value={editingDocNoValue}
                            onChange={(e) =>
                              setEditingDocNoValue(e.target.value)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                onUpdateDocNo(doc.id, editingDocNoValue);
                                addLog(
                                  "문서번호 수동 수정",
                                  `${doc.docNo} → ${editingDocNoValue} (${doc.title.slice(0, 20)}...)`,
                                );
                                setEditingDocId(null);
                              }
                              if (e.key === "Escape") setEditingDocId(null);
                            }}
                            autoFocus
                          />
                        ) : (
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontWeight: 700,
                              color: "var(--primary-amber)",
                            }}
                          >
                            {doc.docNo}
                          </span>
                        )}
                      </td>
                      <td style={{ maxWidth: 260 }}>
                        <div
                          style={{
                            whiteSpace: "normal",
                            lineHeight: 1.4,
                            fontSize: "0.8rem",
                          }}
                        >
                          {doc.title}
                        </div>
                      </td>
                      <td style={{ fontWeight: 700 }}>{doc.prosecutorName}</td>
                      <td>
                        <span
                          className={`badge ${doc.status === "최종승인" ? "badge-success" : doc.status.includes("대기") ? "badge-warning" : "badge-info"}`}
                          style={{ fontSize: "0.68rem" }}
                        >
                          {doc.status}
                        </span>
                      </td>
                      <td
                        style={{
                          fontFamily: "monospace",
                          fontSize: "0.72rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {doc.createdAt}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {editingDocId === doc.id ? (
                          <div
                            style={{
                              display: "flex",
                              gap: 4,
                              justifyContent: "center",
                            }}
                          >
                            <button
                              onClick={() => {
                                onUpdateDocNo(doc.id, editingDocNoValue);
                                addLog(
                                  "문서번호 수동 수정",
                                  `${doc.docNo} → ${editingDocNoValue}`,
                                );
                                setEditingDocId(null);
                              }}
                              className="btn btn-gold"
                              style={{
                                padding: "4px 8px",
                                fontSize: "0.72rem",
                              }}
                            >
                              <Save size={12} />
                              저장
                            </button>
                            <button
                              onClick={() => setEditingDocId(null)}
                              className="btn btn-outline"
                              style={{
                                padding: "4px 8px",
                                fontSize: "0.72rem",
                              }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingDocId(doc.id);
                              setEditingDocNoValue(doc.docNo);
                            }}
                            className="btn btn-outline"
                            style={{ padding: "4px 10px", fontSize: "0.72rem" }}
                          >
                            <Pencil size={12} />
                            수정
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "docmgmt" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* 상단 탭 헤더 */}
          <div
            className="glass-panel"
            style={{
              padding: "16px 20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  color: "var(--text-main)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <FileBox size={16} color="var(--primary-amber)" />
                문서 관리 (접수 · 발송 · 보존)
              </div>
              <div
                style={{
                  fontSize: "0.72rem",
                  color: "var(--text-muted)",
                  marginTop: 2,
                }}
              >
                검찰청법 제4조 / 검찰사무관 직무 제5호: 문서의 접수ㆍ발송ㆍ보존
                및 문서관리에 관한 통합 처리
              </div>
            </div>
            {/* 서브 카테고리 스위치 */}
            <div
              style={{
                display: "flex",
                gap: 6,
                background: "var(--bg-elevated)",
                padding: 4,
                borderRadius: 8,
              }}
            >
              <button
                onClick={() => setDocMgmtTab("receive")}
                className={
                  docMgmtTab === "receive" ? "btn btn-gold" : "btn btn-outline"
                }
                style={{ fontSize: "0.78rem", padding: "5px 12px" }}
              >
                <FileInput size={13} /> 문서 접수 ({receivedDocs.length})
              </button>
              <button
                onClick={() => setDocMgmtTab("send")}
                className={
                  docMgmtTab === "send" ? "btn btn-gold" : "btn btn-outline"
                }
                style={{ fontSize: "0.78rem", padding: "5px 12px" }}
              >
                <Send size={13} /> 문서 발송 ({sentDocs.length})
              </button>
              <button
                onClick={() => setDocMgmtTab("archive")}
                className={
                  docMgmtTab === "archive" ? "btn btn-gold" : "btn btn-outline"
                }
                style={{ fontSize: "0.78rem", padding: "5px 12px" }}
              >
                <Archive size={13} /> 문서 보존 ({archivedDocs.length})
              </button>
            </div>
          </div>

          {/* 1. 문서 접수 탭 */}
          {docMgmtTab === "receive" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* 신규 접수 등록 폼 */}
              <div className="glass-panel" style={{ padding: 18 }}>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: "0.85rem",
                    color: "var(--text-main)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 12,
                  }}
                >
                  <Plus size={14} color="var(--primary-amber)" />
                  신규 대외/대내 문서 접수 등록
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newReceive.title || !newReceive.from) {
                      alert("문서 제목과 발송처를 입력하세요.");
                      return;
                    }
                    const newNo =
                      newReceive.docNo ||
                      `2026-접수-${String(receivedDocs.length + 1).padStart(3, "0")}`;
                    const item = {
                      id: `RCV-${Date.now()}`,
                      docNo: newNo,
                      title: newReceive.title,
                      from: newReceive.from,
                      to: newReceive.to || "검찰사무국",
                      date: today,
                      type: newReceive.type,
                      status: "접수완료",
                      note: newReceive.note,
                    };
                    const saved = await createOfficeDocumentApi(
                      "receive",
                      item,
                    );
                    if (!saved?.success) {
                      alert(saved?.message || "문서 저장에 실패했습니다.");
                      return;
                    }
                    setReceivedDocs((prev) => [
                      saved.document || item,
                      ...prev,
                    ]);
                    addLog(
                      "문서 접수 등록",
                      `[${newNo}] ${newReceive.title} (발신: ${newReceive.from})`,
                    );
                    setNewReceive({
                      docNo: "",
                      title: "",
                      from: "",
                      to: "",
                      type: "공문",
                      note: "",
                    });
                    alert(
                      `문서가 성공적으로 접수 등록되었습니다. (접수번호: ${newNo})`,
                    );
                  }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 10,
                    alignItems: "flex-end",
                  }}
                >
                  <div>
                    <Label>접수 번호 (자동부여)</Label>
                    <input
                      className="input-field"
                      placeholder={`2026-접수-${String(receivedDocs.length + 1).padStart(3, "0")}`}
                      value={newReceive.docNo}
                      onChange={(e) =>
                        setNewReceive({ ...newReceive, docNo: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>문서 제목 *</Label>
                    <input
                      className="input-field"
                      placeholder="예: 사건기록 송부 및 인계서"
                      value={newReceive.title}
                      onChange={(e) =>
                        setNewReceive({ ...newReceive, title: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>발신처 (보낸 곳) *</Label>
                    <input
                      className="input-field"
                      placeholder="예: 서울지방법원 / 경찰청"
                      value={newReceive.from}
                      onChange={(e) =>
                        setNewReceive({ ...newReceive, from: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>수신/담당 (받을 곳)</Label>
                    <input
                      className="input-field"
                      placeholder="예: 첨단범죄수사부"
                      value={newReceive.to}
                      onChange={(e) =>
                        setNewReceive({ ...newReceive, to: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>문서 유형</Label>
                    <select
                      className="select-field"
                      value={newReceive.type}
                      onChange={(e) =>
                        setNewReceive({ ...newReceive, type: e.target.value })
                      }
                    >
                      <option value="공문">공문서</option>
                      <option value="사건기록">사건기록/이송</option>
                      <option value="영장">영장관련통보</option>
                      <option value="민원서류">고소/고발 민원</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-gold"
                    style={{ padding: "9px 16px", fontSize: "0.82rem" }}
                  >
                    <FileInput size={14} /> 접수 처리
                  </button>
                </form>
              </div>

              {/* 접수 문서 목록 */}
              <div className="glass-panel" style={{ overflow: "hidden" }}>
                <div
                  className="ledger-table-container"
                  style={{ border: "none", borderRadius: 0 }}
                >
                  <table className="ledger-table">
                    <thead>
                      <tr>
                        <th>접수번호</th>
                        <th>문서 제목</th>
                        <th>발신처</th>
                        <th>수신/담당</th>
                        <th>유형</th>
                        <th>접수일자</th>
                        <th>상태</th>
                        <th style={{ textAlign: "center" }}>삭제</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receivedDocs.map((doc) => (
                        <tr key={doc.id}>
                          <td
                            style={{
                              fontFamily: "monospace",
                              fontWeight: 700,
                              color: "var(--primary-amber)",
                            }}
                          >
                            {doc.docNo}
                          </td>
                          <td style={{ fontWeight: 600 }}>{doc.title}</td>
                          <td>{doc.from}</td>
                          <td style={{ color: "var(--text-muted)" }}>
                            {doc.to}
                          </td>
                          <td>
                            <span className="badge badge-info">{doc.type}</span>
                          </td>
                          <td
                            style={{
                              fontFamily: "monospace",
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            {doc.date}
                          </td>
                          <td>
                            <span
                              className={`badge ${doc.status === "처리완료" ? "badge-success" : "badge-warning"}`}
                            >
                              {doc.status}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              onClick={async () => {
                                const result = await deleteOfficeDocumentApi(
                                  doc.id,
                                );
                                if (!result?.success) {
                                  alert(
                                    result?.message ||
                                      "문서 삭제에 실패했습니다.",
                                  );
                                  return;
                                }
                                setReceivedDocs((prev) =>
                                  prev.filter((d) => d.id !== doc.id),
                                );
                                addLog(
                                  "접수문서 삭제",
                                  `${doc.docNo} (${doc.title})`,
                                );
                              }}
                              className="btn btn-outline"
                              style={{
                                padding: "3px 8px",
                                fontSize: "0.7rem",
                                color: "#f87171",
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 2. 문서 발송 탭 */}
          {docMgmtTab === "send" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* 신규 발송 등록 폼 */}
              <div className="glass-panel" style={{ padding: 18 }}>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: "0.85rem",
                    color: "var(--text-main)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 12,
                  }}
                >
                  <Plus size={14} color="var(--primary-amber)" />
                  대외 공문 및 기소장/영장 발송 처리
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newSend.title || !newSend.to) {
                      alert("문서 제목과 수신처를 입력하세요.");
                      return;
                    }
                    const newNo =
                      newSend.docNo ||
                      `2026-발송-${String(sentDocs.length + 1).padStart(3, "0")}`;
                    const item = {
                      id: `SND-${Date.now()}`,
                      docNo: newNo,
                      title: newSend.title,
                      to: newSend.to,
                      from: "도스온라인 검찰청",
                      date: today,
                      type: newSend.type,
                      status: "발송완료",
                      note: newSend.note,
                    };
                    const saved = await createOfficeDocumentApi("send", item);
                    if (!saved?.success) {
                      alert(saved?.message || "문서 저장에 실패했습니다.");
                      return;
                    }
                    setSentDocs((prev) => [saved.document || item, ...prev]);
                    addLog(
                      "문서 발송 등록",
                      `[${newNo}] ${newSend.title} (수신: ${newSend.to})`,
                    );
                    setNewSend({
                      docNo: "",
                      title: "",
                      to: "",
                      type: "공문",
                      note: "",
                    });
                    alert(
                      `문서가 성공적으로 발송 등록되었습니다. (발송번호: ${newNo})`,
                    );
                  }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 10,
                    alignItems: "flex-end",
                  }}
                >
                  <div>
                    <Label>발송 번호 (자동부여)</Label>
                    <input
                      className="input-field"
                      placeholder={`2026-발송-${String(sentDocs.length + 1).padStart(3, "0")}`}
                      value={newSend.docNo}
                      onChange={(e) =>
                        setNewSend({ ...newSend, docNo: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>문서 제목 *</Label>
                    <input
                      className="input-field"
                      placeholder="예: 공소장 송부 및 집행요청"
                      value={newSend.title}
                      onChange={(e) =>
                        setNewSend({ ...newSend, title: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>수신처 (받는 기관/부서) *</Label>
                    <input
                      className="input-field"
                      placeholder="예: 서울지방법원 형사합의부"
                      value={newSend.to}
                      onChange={(e) =>
                        setNewSend({ ...newSend, to: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>문서 유형</Label>
                    <select
                      className="select-field"
                      value={newSend.type}
                      onChange={(e) =>
                        setNewSend({ ...newSend, type: e.target.value })
                      }
                    >
                      <option value="공문">공문서</option>
                      <option value="기소장">기소장/공소장</option>
                      <option value="영장">영장청구서</option>
                      <option value="수사지휘">수사지휘서</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-gold"
                    style={{ padding: "9px 16px", fontSize: "0.82rem" }}
                  >
                    <Send size={14} /> 발송 처리
                  </button>
                </form>
              </div>

              {/* 발송 문서 목록 */}
              <div className="glass-panel" style={{ overflow: "hidden" }}>
                <div
                  className="ledger-table-container"
                  style={{ border: "none", borderRadius: 0 }}
                >
                  <table className="ledger-table">
                    <thead>
                      <tr>
                        <th>발송번호</th>
                        <th>문서 제목</th>
                        <th>수신처</th>
                        <th>발신처</th>
                        <th>유형</th>
                        <th>발송일자</th>
                        <th>상태</th>
                        <th style={{ textAlign: "center" }}>삭제</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sentDocs.map((doc) => (
                        <tr key={doc.id}>
                          <td
                            style={{
                              fontFamily: "monospace",
                              fontWeight: 700,
                              color: "var(--primary-amber)",
                            }}
                          >
                            {doc.docNo}
                          </td>
                          <td style={{ fontWeight: 600 }}>{doc.title}</td>
                          <td>{doc.to}</td>
                          <td style={{ color: "var(--text-muted)" }}>
                            {doc.from}
                          </td>
                          <td>
                            <span className="badge badge-info">{doc.type}</span>
                          </td>
                          <td
                            style={{
                              fontFamily: "monospace",
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            {doc.date}
                          </td>
                          <td>
                            <span className="badge badge-success">
                              {doc.status}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              onClick={async () => {
                                const result = await deleteOfficeDocumentApi(
                                  doc.id,
                                );
                                if (!result?.success) {
                                  alert(
                                    result?.message ||
                                      "문서 삭제에 실패했습니다.",
                                  );
                                  return;
                                }
                                setSentDocs((prev) =>
                                  prev.filter((d) => d.id !== doc.id),
                                );
                                addLog(
                                  "발송문서 삭제",
                                  `${doc.docNo} (${doc.title})`,
                                );
                              }}
                              className="btn btn-outline"
                              style={{
                                padding: "3px 8px",
                                fontSize: "0.7rem",
                                color: "#f87171",
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* 3. 문서 보존 탭 */}
          {docMgmtTab === "archive" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* 보존 이전 폼 */}
              <div className="glass-panel" style={{ padding: 18 }}>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: "0.85rem",
                    color: "var(--text-main)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 12,
                  }}
                >
                  <Plus size={14} color="var(--primary-amber)" />
                  종결 사건 및 중요 보존 문서 이관 등록
                </div>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!newArchive.title) {
                      alert("보존 대상 문서 제목을 입력하세요.");
                      return;
                    }
                    const newNo =
                      newArchive.docNo ||
                      `2026-보존-${String(archivedDocs.length + 1).padStart(3, "0")}`;
                    const item = {
                      id: `ARC-${Date.now()}`,
                      docNo: newNo,
                      title: newArchive.title,
                      caseNo: newArchive.caseNo || "-",
                      retentionYears: Number(newArchive.retentionYears),
                      archivedDate: today,
                      category: newArchive.category,
                      status: "보존중",
                    };
                    const saved = await createOfficeDocumentApi(
                      "archive",
                      item,
                    );
                    if (!saved?.success) {
                      alert(saved?.message || "문서 저장에 실패했습니다.");
                      return;
                    }
                    setArchivedDocs((prev) => [
                      saved.document || item,
                      ...prev,
                    ]);
                    addLog(
                      "문서 보존 등록",
                      `[${newNo}] ${newArchive.title} (보존기간: ${newArchive.retentionYears}년)`,
                    );
                    setNewArchive({
                      docNo: "",
                      title: "",
                      caseNo: "",
                      retentionYears: 10,
                      category: "형사사건기록",
                    });
                    alert(
                      `문서가 성공적으로 영구/기한 보존 서고로 이관되었습니다. (보존번호: ${newNo})`,
                    );
                  }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 10,
                    alignItems: "flex-end",
                  }}
                >
                  <div>
                    <Label>보존 번호 (자동부여)</Label>
                    <input
                      className="input-field"
                      placeholder={`2026-보존-${String(archivedDocs.length + 1).padStart(3, "0")}`}
                      value={newArchive.docNo}
                      onChange={(e) =>
                        setNewArchive({ ...newArchive, docNo: e.target.value })
                      }
                    />
                  </div>
                  <div>
                    <Label>보존 문서/사건 제목 *</Label>
                    <input
                      className="input-field"
                      placeholder="예: 2026형제210호 판결 확정 사건기록"
                      value={newArchive.title}
                      onChange={(e) =>
                        setNewArchive({ ...newArchive, title: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div>
                    <Label>관련 사건번호 (선택)</Label>
                    <select
                      className="select-field"
                      value={newArchive.caseNo}
                      onChange={(e) =>
                        setNewArchive({
                          ...newArchive,
                          caseNo: e.target.value,
                          title: `${e.target.value}호 사건기록 및 서류`,
                        })
                      }
                    >
                      <option value="">사건 직접 선택...</option>
                      {ledgerData.map((c) => (
                        <option key={c.id} value={c.hyeongjeNo}>
                          {c.hyeongjeNo} ({c.suspectName})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label>보존 연한 (년)</Label>
                    <select
                      className="select-field"
                      value={newArchive.retentionYears}
                      onChange={(e) =>
                        setNewArchive({
                          ...newArchive,
                          retentionYears: e.target.value,
                        })
                      }
                    >
                      <option value={3}>3년 (일반행정)</option>
                      <option value={5}>5년 (불기소기록)</option>
                      <option value={10}>10년 (단기형사사건)</option>
                      <option value={30}>30년 (중형사사건/판결문)</option>
                      <option value={99}>영구보존 (주요사례/대법원확정)</option>
                    </select>
                  </div>
                  <div>
                    <Label>보존 분류</Label>
                    <select
                      className="select-field"
                      value={newArchive.category}
                      onChange={(e) =>
                        setNewArchive({
                          ...newArchive,
                          category: e.target.value,
                        })
                      }
                    >
                      <option value="형사사건기록">형사사건기록</option>
                      <option value="판결문">판결문/결정서</option>
                      <option value="처분결의서">전자결재문서</option>
                      <option value="행정공문">행정/인사서류</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="btn btn-gold"
                    style={{ padding: "9px 16px", fontSize: "0.82rem" }}
                  >
                    <Archive size={14} /> 보존서고 이관
                  </button>
                </form>
              </div>

              {/* 보존 문서 목록 */}
              <div className="glass-panel" style={{ overflow: "hidden" }}>
                <div
                  className="ledger-table-container"
                  style={{ border: "none", borderRadius: 0 }}
                >
                  <table className="ledger-table">
                    <thead>
                      <tr>
                        <th>보존번호</th>
                        <th>보존 문서 제목</th>
                        <th>사건번호</th>
                        <th>보존 분류</th>
                        <th>보존 기한</th>
                        <th>이관 일자</th>
                        <th>상태</th>
                        <th style={{ textAlign: "center" }}>삭제</th>
                      </tr>
                    </thead>
                    <tbody>
                      {archivedDocs.map((doc) => (
                        <tr key={doc.id}>
                          <td
                            style={{
                              fontFamily: "monospace",
                              fontWeight: 700,
                              color: "var(--primary-amber)",
                            }}
                          >
                            {doc.docNo}
                          </td>
                          <td style={{ fontWeight: 600 }}>{doc.title}</td>
                          <td
                            style={{
                              fontFamily: "monospace",
                              color: "#93c5fd",
                            }}
                          >
                            {doc.caseNo}
                          </td>
                          <td>
                            <span className="badge badge-info">
                              {doc.category}
                            </span>
                          </td>
                          <td
                            style={{
                              fontWeight: 700,
                              color:
                                doc.retentionYears === 99
                                  ? "#dc2626"
                                  : "var(--text-main)",
                            }}
                          >
                            {doc.retentionYears === 99
                              ? "영구 보존"
                              : `${doc.retentionYears}년`}
                          </td>
                          <td
                            style={{
                              fontFamily: "monospace",
                              fontSize: "0.75rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            {doc.archivedDate}
                          </td>
                          <td>
                            <span className="badge badge-success">
                              {doc.status}
                            </span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              onClick={async () => {
                                const result = await deleteOfficeDocumentApi(
                                  doc.id,
                                );
                                if (!result?.success) {
                                  alert(
                                    result?.message ||
                                      "문서 삭제에 실패했습니다.",
                                  );
                                  return;
                                }
                                setArchivedDocs((prev) =>
                                  prev.filter((d) => d.id !== doc.id),
                                );
                                addLog(
                                  "보존문서 삭제",
                                  `${doc.docNo} (${doc.title})`,
                                );
                              }}
                              className="btn btn-outline"
                              style={{
                                padding: "3px 8px",
                                fontSize: "0.7rem",
                                color: "#f87171",
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {activeSubTab === "backup" && (
        <div className="glass-panel" style={{ padding: 24 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: "0.9rem",
              color: "var(--text-main)",
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 20,
            }}
          >
            <Database size={15} color="var(--primary-amber)" />
            DB 영구 백업 & 복원
          </div>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
          >
            <div
              style={{
                padding: 18,
                borderRadius: 10,
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  color: "var(--text-main)",
                  marginBottom: 8,
                }}
              >
                DB 덤프 다운로드
              </div>
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "var(--text-muted)",
                  marginBottom: 14,
                  lineHeight: 1.6,
                }}
              >
                현재 DB의 전 사건·결재·계정 데이터를 JSON 백업 파일로
                내보냅니다.
              </div>
              <button
                onClick={handleDbBackup}
                className="btn btn-gold"
                style={{ fontSize: "0.82rem" }}
              >
                <Download size={14} />
                JSON 백업 다운로드
              </button>
            </div>
            <div
              style={{
                padding: 18,
                borderRadius: 10,
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "0.85rem",
                  color: "var(--text-main)",
                  marginBottom: 8,
                }}
              >
                백업본 복원
              </div>
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "var(--text-muted)",
                  marginBottom: 14,
                  lineHeight: 1.6,
                }}
              >
                기존 백업 파일을 업로드하여 과거 DB 상태로 복원합니다.
              </div>
              <button
                onClick={() => alert("복원 기능 준비 중입니다.")}
                className="btn btn-secondary"
                style={{ fontSize: "0.82rem" }}
              >
                <Upload size={14} />
                백업 파일 복원
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── 가입 신청 허가 탭 ─────────────────────────────────── */}
      {activeSubTab === "registrations" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* 안내 배너 */}
          <div
            className="glass-panel gold-border"
            style={{
              padding: "14px 20px",
              background: "rgba(245,158,11,0.06)",
            }}
          >
            <div
              style={{
                fontWeight: 800,
                fontSize: "0.95rem",
                color: "var(--primary-amber)",
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <ClipboardList size={18} /> 검찰청 가입 신청 허가 관리
            </div>
            <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
              가입 신청자를 검토하고 허가 또는 거부를 처리합니다. 허가 시 검찰
              시스템에 즉시 계정이 등록됩니다.
            </div>
          </div>

          {/* 필터 + 새로고침 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {["ALL", "PENDING", "APPROVED", "REJECTED"].map((f) => (
              <button
                key={f}
                onClick={() => setRegFilter(f)}
                className={
                  regFilter === f ? "btn btn-gold" : "btn btn-secondary"
                }
                style={{ fontSize: "0.8rem", padding: "6px 14px" }}
              >
                {f === "ALL"
                  ? "전체"
                  : f === "PENDING"
                    ? "⏳ 대기중"
                    : f === "APPROVED"
                      ? "✅ 허가됨"
                      : "❌ 거부됨"}
                <span style={{ marginLeft: 5, opacity: 0.7 }}>
                  (
                  {
                    registrations.filter((r) => f === "ALL" || r.status === f)
                      .length
                  }
                  )
                </span>
              </button>
            ))}
            <button
              onClick={loadRegistrations}
              className="btn btn-secondary"
              style={{
                fontSize: "0.8rem",
                padding: "6px 12px",
                marginLeft: "auto",
              }}
              disabled={regLoading}
            >
              <RefreshCw size={13} /> {regLoading ? "로딩중..." : "새로고침"}
            </button>
          </div>

          {/* 목록 테이블 */}
          <div className="glass-panel" style={{ overflow: "hidden" }}>
            {regLoading ? (
              <div
                style={{
                  padding: 40,
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: "0.85rem",
                }}
              >
                <Clock size={20} style={{ marginBottom: 8 }} />
                <br />
                신청 목록 로딩 중...
              </div>
            ) : registrations.filter(
                (r) => regFilter === "ALL" || r.status === regFilter,
              ).length === 0 ? (
              <div
                style={{
                  padding: 40,
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: "0.85rem",
                }}
              >
                {regFilter === "PENDING"
                  ? "대기 중인 가입 신청이 없습니다."
                  : "해당 상태의 신청이 없습니다."}
              </div>
            ) : (
              <div
                className="ledger-table-container"
                style={{ border: "none", borderRadius: 0 }}
              >
                <table className="ledger-table">
                  <thead>
                    <tr>
                      <th>신청일시</th>
                      <th>신청 아이디</th>
                      <th>이름</th>
                      <th>신청 직급</th>
                      <th>희망 부서</th>
                      <th>직위명</th>
                      <th>신청 사유</th>
                      <th style={{ textAlign: "center" }}>상태</th>
                      <th style={{ textAlign: "center" }}>처리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations
                      .filter(
                        (r) => regFilter === "ALL" || r.status === regFilter,
                      )
                      .map((reg) => (
                        <tr key={reg.id}>
                          <td
                            style={{
                              fontFamily: "monospace",
                              fontSize: "0.72rem",
                              color: "var(--text-muted)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {reg.createdAt?.substring(0, 16) || "-"}
                          </td>
                          <td
                            style={{
                              fontFamily: "monospace",
                              fontWeight: 700,
                              color: "#60a5fa",
                            }}
                          >
                            {reg.reqId}
                          </td>
                          <td style={{ fontWeight: 700 }}>{reg.name}</td>
                          <td>
                            <span
                              style={{
                                fontSize: "0.75rem",
                                padding: "2px 8px",
                                borderRadius: 10,
                                background: "var(--bg-elevated)",
                                color: "var(--text-main)",
                              }}
                            >
                              {ROLE_LABELS[reg.roleLevel] || reg.roleLevel}
                            </span>
                          </td>
                          <td>{reg.dept || "-"}</td>
                          <td
                            style={{
                              fontSize: "0.78rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            {reg.position || "-"}
                          </td>
                          <td style={{ maxWidth: 180 }}>
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "var(--text-muted)",
                                whiteSpace: "normal",
                                lineHeight: 1.4,
                              }}
                            >
                              {reg.note || "-"}
                              {reg.status === "REJECTED" &&
                                reg.rejectReason && (
                                  <div
                                    style={{ color: "#f87171", marginTop: 2 }}
                                  >
                                    거부 사유: {reg.rejectReason}
                                  </div>
                                )}
                            </div>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {reg.status === "PENDING" && (
                              <span
                                style={{
                                  padding: "2px 10px",
                                  borderRadius: 10,
                                  fontSize: "0.72rem",
                                  fontWeight: 800,
                                  background: "rgba(251,191,36,0.15)",
                                  color: "#fbbf24",
                                }}
                              >
                                ⏳ 심사대기
                              </span>
                            )}
                            {reg.status === "APPROVED" && (
                              <span
                                style={{
                                  padding: "2px 10px",
                                  borderRadius: 10,
                                  fontSize: "0.72rem",
                                  fontWeight: 800,
                                  background: "rgba(52,211,153,0.15)",
                                  color: "#34d399",
                                }}
                              >
                                ✅ 허가
                              </span>
                            )}
                            {reg.status === "REJECTED" && (
                              <span
                                style={{
                                  padding: "2px 10px",
                                  borderRadius: 10,
                                  fontSize: "0.72rem",
                                  fontWeight: 800,
                                  background: "rgba(248,113,113,0.15)",
                                  color: "#f87171",
                                }}
                              >
                                ❌ 거부
                              </span>
                            )}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {reg.status === "PENDING" && (
                              <div
                                style={{
                                  display: "flex",
                                  gap: 6,
                                  justifyContent: "center",
                                }}
                              >
                                <button
                                  onClick={() => handleApproveRegistration(reg)}
                                  className="btn btn-gold"
                                  style={{
                                    padding: "4px 10px",
                                    fontSize: "0.75rem",
                                    gap: 4,
                                  }}
                                >
                                  <CheckCircle size={12} /> 허가
                                </button>
                                <button
                                  onClick={() => {
                                    setRejectModal({
                                      id: reg.id,
                                      name: reg.name,
                                    });
                                    setRejectReason("");
                                  }}
                                  className="btn btn-secondary"
                                  style={{
                                    padding: "4px 10px",
                                    fontSize: "0.75rem",
                                    color: "#f87171",
                                    gap: 4,
                                  }}
                                >
                                  <XCircle size={12} /> 거부
                                </button>
                              </div>
                            )}
                            {reg.status !== "PENDING" && (
                              <span
                                style={{
                                  fontSize: "0.72rem",
                                  color: "var(--text-muted)",
                                }}
                              >
                                {reg.reviewedAt?.substring(0, 10) || "처리완료"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── 거부 사유 입력 모달 ──────────────────────────────── */}
      {rejectModal && (
        <div className="modal-overlay" style={{ zIndex: 9999 }}>
          <div className="modal-content" style={{ maxWidth: 420 }}>
            <div
              style={{
                fontWeight: 800,
                fontSize: "1rem",
                color: "var(--text-main)",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <XCircle size={18} color="#f87171" /> 가입 신청 거부
            </div>
            <div
              style={{
                fontSize: "0.85rem",
                color: "var(--text-muted)",
                marginBottom: 14,
              }}
            >
              <strong style={{ color: "var(--text-main)" }}>
                {rejectModal.name}
              </strong>
              의 가입 신청을 거부합니다.
            </div>
            <Label>거부 사유 (선택)</Label>
            <textarea
              className="textarea-field"
              rows={3}
              placeholder="거부 사유를 입력하세요 (미입력 시 '검찰사무국 심사 불허'로 처리)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              style={{ marginBottom: 16 }}
            />
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleRejectRegistration}
                className="btn btn-secondary"
                style={{
                  flex: 1,
                  justifyContent: "center",
                  color: "#f87171",
                  fontWeight: 800,
                }}
              >
                <XCircle size={14} /> 거부 확정
              </button>
              <button
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason("");
                }}
                className="btn btn-secondary"
                style={{ flex: 1, justifyContent: "center" }}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "designate" && (
        <DesignateApprovalPanel
          ledgerData={ledgerData}
          prosecutorsList={prosecutorsList}
          currentUser={currentUser}
          onDesignateCase={onDesignateCase}
          onUndesignateCase={onUndesignateCase}
          addLog={(log) =>
            setAuditLogs((prev) => [
              {
                id: prev.length + 1,
                action: log,
                details: "",
                actor: currentUser?.name || "-",
                timestamp: new Date()
                  .toISOString()
                  .replace("T", " ")
                  .substring(0, 16),
              },
              ...prev,
            ])
          }
        />
      )}

      {activeSubTab === "audit" && (
        <div className="glass-panel" style={{ overflow: "hidden" }}>
          <div
            style={{
              padding: "14px 16px",
              borderBottom: "1px solid var(--border-subtle)",
              fontWeight: 700,
              fontSize: "0.85rem",
              color: "var(--text-main)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <History size={15} color="var(--primary-amber)" />
            보안 감사 로그 (Audit Trail)
          </div>
          <div
            className="ledger-table-container"
            style={{ border: "none", borderRadius: 0 }}
          >
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>로그 ID</th>
                  <th>수행 행위</th>
                  <th>상세 내용</th>
                  <th>수행자</th>
                  <th>일시</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td
                      style={{
                        fontFamily: "monospace",
                        color: "var(--text-muted)",
                        fontSize: "0.72rem",
                      }}
                    >
                      LOG-{log.id}
                    </td>
                    <td
                      style={{ fontWeight: 700, color: "var(--primary-amber)" }}
                    >
                      {log.action}
                    </td>
                    <td style={{ maxWidth: 300 }}>
                      <div style={{ whiteSpace: "normal", lineHeight: 1.4 }}>
                        {log.details}
                      </div>
                    </td>
                    <td style={{ fontFamily: "monospace", color: "#60a5fa" }}>
                      {log.actor}
                    </td>
                    <td
                      style={{
                        fontFamily: "monospace",
                        fontSize: "0.72rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      {log.timestamp}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 엑셀 일괄 가져오기 컴포넌트 ──────────────────────────────────
const REQUIRED_COLS = [
  "수제번호",
  "형제번호",
  "죄명",
  "검사명",
  "피고인명",
  "UUID",
  "현재 상황",
  "접수일시",
  "접수근거",
  "처분내용",
];

const PREVIEW_COLS = [
  { key: "수제번호", label: "수제번호" },
  { key: "형제번호", label: "형제번호" },
  { key: "죄명", label: "죄명" },
  { key: "검사명", label: "검사명" },
  { key: "피고인명", label: "피고인명" },
  { key: "현재 상황", label: "현재 상황" },
  { key: "접수일시", label: "접수일시" },
  { key: "처분내용", label: "처분내용" },
];

function ExcelImportTab({ onBulkImport }) {
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [imported, setImported] = useState(false);

  const parseFile = (file) => {
    setError("");
    setRows([]);
    setImported(false);
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["xlsx", "xls"].includes(ext)) {
      setError(".xlsx 또는 .xls 파일만 지원합니다.");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), {
          type: "array",
        });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, { defval: "" });
        // 헤더 행(예시 행)과 빈 행 필터링
        const filtered = data.filter((r) => {
          const key = r["형제번호"] || r["수제번호"] || "";
          // 예시 행(ex) 또는 안내 행 제거
          return (
            key &&
            !String(key).startsWith("20xx") &&
            !String(key).startsWith("ex)")
          );
        });
        if (filtered.length === 0) {
          setError(
            "유효한 데이터 행이 없습니다. 예시 행을 제외한 실제 데이터를 포함해주세요.",
          );
          return;
        }
        setRows(filtered);
      } catch (err) {
        setError("파일을 읽는 중 오류가 발생했습니다: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleFileInput = (e) => parseFile(e.target.files[0]);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    parseFile(e.dataTransfer.files[0]);
  };

  const handleImport = () => {
    if (!rows.length) return;
    onBulkImport(rows);
    setImported(true);
  };

  const downloadTemplate = () => {
    const headers = [
      "수제번호",
      "형제번호",
      "법원번호(최신)",
      "죄명",
      "검사명",
      "피고인명",
      "UUID",
      "현재 상황",
      "접수일시",
      "접수근거",
      "처분내용",
      "(불)공소장",
      "1심 사건번호",
      "1심 결과",
      "판결문",
      "항소 여부",
      "항소장",
      "2심 사건번호",
      "항소기각",
      "2심 결과",
      "판결문(항소)",
      "상고 여부",
      "상고장",
      "3심 사건번호",
      "파기환송",
      "3심 결과",
      "판결문(상고)",
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "사건원부");
    XLSX.writeFile(wb, "도스온라인_검찰청_사건원부_양식.xlsx");
  };

  const downloadAppealTemplate = () => {
    const headers = [
      "지불항번호",
      "고불항번호",
      "재불항번호",
      "대재불항번호",
      "죄명",
      "검사명",
      "피고인명",
      "항고처분",
      "항고일시",
      "항고근거",
      "항고결정",
      "항고결정통지서",
      "수제번호",
      "형제번호",
      "법원번호",
      "항고 상황",
      "검사장",
      "검찰총장",
      "UUID",
      "원처분상황",
      "접수일시",
      "접수근거",
      "기소여부",
      "공소장/불공소장",
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "항고대장");
    XLSX.writeFile(wb, "도스온라인_검찰청_항고대장_양식.xlsx");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* 헤더 */}
      <div className="glass-panel" style={{ padding: "18px 24px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: "0.95rem",
                color: "var(--text-main)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <FileSpreadsheet size={16} color="var(--primary-amber)" />
              엑셀 파일 일괄 사건 등록
            </div>
            <div
              style={{
                fontSize: "0.72rem",
                color: "var(--text-muted)",
                marginTop: 4,
              }}
            >
              지정된 컬럼 형식의 .xlsx 파일을 업로드하면 사건 원부에 일괄
              등록됩니다. 예시 행(20xx수제xxx)은 자동으로 제외됩니다.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={downloadTemplate}
              className="btn btn-secondary"
              style={{ fontSize: "0.8rem", gap: 6 }}
            >
              <Download size={14} />
              원부 양식
            </button>
            <button
              onClick={downloadAppealTemplate}
              className="btn btn-gold"
              style={{ fontSize: "0.8rem", gap: 6 }}
            >
              <Download size={14} />
              항고대장 양식
            </button>
          </div>
        </div>

        {/* 컬럼 안내 */}
        <div
          style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 6 }}
        >
          {REQUIRED_COLS.map((c) => (
            <span
              key={c}
              style={{
                fontSize: "0.7rem",
                padding: "2px 8px",
                background: "rgba(245,158,11,0.12)",
                border: "1px solid rgba(245,158,11,0.3)",
                borderRadius: 4,
                color: "#f59e0b",
              }}
            >
              {c}
            </span>
          ))}
          <span
            style={{
              fontSize: "0.7rem",
              color: "var(--text-muted)",
              alignSelf: "center",
            }}
          >
            외 17개 컬럼
          </span>
        </div>
      </div>

      {/* 드래그앤드롭 업로드 */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById("bulk-excel-input").click()}
        style={{
          border: `2px dashed ${isDragOver ? "var(--primary-amber)" : "var(--border-subtle)"}`,
          borderRadius: 12,
          padding: "40px 24px",
          textAlign: "center",
          cursor: "pointer",
          background: isDragOver ? "rgba(245,158,11,0.05)" : "transparent",
          transition: "all 0.2s",
        }}
      >
        <Upload
          size={32}
          color={isDragOver ? "var(--primary-amber)" : "var(--text-muted)"}
          style={{ margin: "0 auto 12px" }}
        />
        <div
          style={{
            fontWeight: 700,
            color: "var(--text-main)",
            fontSize: "0.9rem",
          }}
        >
          엑셀 파일을 드래그하거나 클릭하여 선택
        </div>
        <div
          style={{
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            marginTop: 4,
          }}
        >
          {fileName ? `📄 ${fileName}` : ".xlsx, .xls 지원"}
        </div>
        <input
          id="bulk-excel-input"
          type="file"
          accept=".xlsx,.xls"
          style={{ display: "none" }}
          onChange={handleFileInput}
        />
      </div>

      {/* 오류 */}
      {error && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 8,
            color: "#f87171",
            fontSize: "0.82rem",
          }}
        >
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {/* 성공 */}
      {imported && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            background: "rgba(22,163,74,0.1)",
            border: "1px solid rgba(22,163,74,0.3)",
            borderRadius: 8,
            color: "#4ade80",
            fontSize: "0.82rem",
          }}
        >
          <CheckCircle2 size={15} />
          {rows.length}건이 사건 원부에 성공적으로 등록되었습니다.
        </div>
      )}

      {/* 미리보기 + 등록 버튼 */}
      {rows.length > 0 && (
        <div className="glass-panel" style={{ overflow: "hidden" }}>
          <div
            style={{
              padding: "14px 18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <div
              style={{
                fontWeight: 800,
                fontSize: "0.88rem",
                color: "var(--text-main)",
              }}
            >
              미리보기 —{" "}
              <span style={{ color: "var(--primary-amber)" }}>
                {rows.length}건
              </span>{" "}
              감지됨
            </div>
            <button
              onClick={handleImport}
              className="btn btn-gold"
              style={{ fontSize: "0.82rem" }}
              disabled={imported}
            >
              <CheckCircle2 size={14} />
              {imported ? "등록 완료" : `${rows.length}건 일괄 등록`}
            </button>
          </div>
          <div style={{ overflowX: "auto", maxHeight: 400 }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.78rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "var(--bg-elevated)",
                    position: "sticky",
                    top: 0,
                  }}
                >
                  <th
                    style={{
                      padding: "8px 12px",
                      textAlign: "left",
                      color: "var(--text-muted)",
                      fontWeight: 700,
                      whiteSpace: "nowrap",
                    }}
                  >
                    #
                  </th>
                  {PREVIEW_COLS.map((c) => (
                    <th
                      key={c.key}
                      style={{
                        padding: "8px 12px",
                        textAlign: "left",
                        color: "var(--text-muted)",
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    style={{
                      borderTop: "1px solid var(--border-subtle)",
                      background:
                        i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
                    }}
                  >
                    <td
                      style={{
                        padding: "7px 12px",
                        color: "var(--text-muted)",
                      }}
                    >
                      {i + 1}
                    </td>
                    {PREVIEW_COLS.map((c) => (
                      <td
                        key={c.key}
                        style={{
                          padding: "7px 12px",
                          color: "var(--text-main)",
                          whiteSpace: "nowrap",
                          maxWidth: 180,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {String(row[c.key] || "-")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
