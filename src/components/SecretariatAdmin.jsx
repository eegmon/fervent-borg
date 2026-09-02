import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import {
  Building2,
  UserPlus,
  RefreshCw,
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
  Crown,
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
  createChargeApi,
  deleteChargeApi,
  updateChargeApi,
  restoreChargeApi,
  fetchDeletedChargesApi,
  hardDeleteChargeApi,
  createAuditLogApi,
  fetchAutoArchiveSettings,
  updateAutoArchiveSettings,
  assignOfficialCaseNoApi,
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
            const displayNo =
              c.hyeongjeNo && c.hyeongjeNo !== "-" && c.sujeNo
                ? `${c.hyeongjeNo}(${c.sujeNo})`
                : c.hyeongjeNo || c.sujeNo || "-";
            const label = `${displayNo} (피의자: ${c.suspectName})`;
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
                    {c.hyeongjeNo && c.hyeongjeNo !== "-" && c.sujeNo
                      ? `${c.hyeongjeNo}(${c.sujeNo})`
                      : c.hyeongjeNo || c.sujeNo || "-"}
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

  // 공석 모드: 원 결재권자 계정이 없을 때 직위명을 직접 입력
  const [vacantMode, setVacantMode] = useState(false);

  const [form, setForm] = useState({
    originalUserId: prosecutorsList[0]?.id || "",
    originalVacantTitle: "", // 공석 모드 전용 — 피대리 직위 직접 입력
    vacantRoleLevel: "SENIOR_PROSECUTOR", // 공석 모드 전용 — 부여할 권한 등급
    actingUserId: prosecutorsList[1]?.id || "",
    actingTitle: "부장검사 직무대리",
    orderNo: `검찰사무국 직무대리명령 제2026-00${orders.length + 1}호`,
    reason: "검찰 사무대리 규정 제7조 직무대리 지시",
    actingStart: today,
    actingEnd: "2026-12-31",
  });

  const handleIssueOrder = async (e) => {
    e.preventDefault();
    const act = prosecutorsList.find((p) => p.id === form.actingUserId);
    if (!act) return;

    let origLabel, origId;
    if (vacantMode) {
      // 공석 모드: 계정 없음 — 직위명만 기록, origId는 빈 문자열
      if (!form.originalVacantTitle.trim()) {
        alert("피대리 직위명을 입력해 주세요.");
        return;
      }
      origLabel = `${form.originalVacantTitle.trim()} (공석)`;
      origId = "";
    } else {
      const orig = prosecutorsList.find((p) => p.id === form.originalUserId);
      if (!orig) return;
      origLabel = `${orig.name} (${orig.position || orig.title})`;
      origId = orig.id;
    }

    const newOrder = {
      id: `ACT-${Date.now()}`,
      orderNo:
        form.orderNo || `검찰사무국 직무대리명령 제2026-${orders.length + 1}호`,
      originalUser: origLabel,
      originalUserId: origId,
      actingUser: `${act.name} (${act.position || act.title})`,
      actingUserId: act.id,
      actingTitle: form.actingTitle,
      reason: form.reason,
      actingStart: form.actingStart,
      actingEnd: form.actingEnd,
      period: `${form.actingStart} ~ ${form.actingEnd}`,
      status: "발령중",
      date: today,
    };

    const saved = await createOfficeDocumentApi("order", newOrder);
    if (!saved?.success) {
      alert(saved?.message || "직무대리명령 저장에 실패했습니다.");
      return;
    }
    setOrders((prev) => [saved.document || newOrder, ...prev]);

    // 계정이 있는 경우에만 계정 status 업데이트
    if (onUpdateProsecutorStatus && origId) {
      onUpdateProsecutorStatus(origId, {
        status: "DELEGATED",
        delegateTo: `${act.name} (${form.actingTitle})`,
        delegateReason: `[직무대리명령] ${form.reason}`,
        actingUserId: act.id, // 대리자 ID 저장 (복귀 시 연쇄 초기화에 사용)
      });
    }

    // 직무대리자 계정에 대결 직위 + dualRoleLevel(피대리인 권한 등급) 부여
    // 계정이 있을 때: 피대리인의 roleLevel을 그대로 전달
    // 공석 모드일 때: 폼에서 직접 선택한 vacantRoleLevel을 사용
    const origRoleLevel = vacantMode
      ? form.vacantRoleLevel || ""
      : prosecutorsList.find((p) => p.id === form.originalUserId)?.roleLevel ||
        "";
    if (onUpdateProsecutorStatus) {
      onUpdateProsecutorStatus(act.id, {
        delegateTo: origLabel,
        delegateReason: `[직무대리명령 수임] ${form.orderNo}`,
        actingTitle: form.actingTitle,
        actingStart: form.actingStart,
        actingEnd: form.actingEnd,
        ...(origRoleLevel ? { dualRoleLevel: origRoleLevel } : {}),
      });
    }

    addLog?.(
      "직무대리명령 공식 발령",
      `${form.orderNo}: '${act.name}' 검사를 '${origLabel}' 직무대리로 발령`,
    );
    alert(
      `[검찰사무국 관인 날인] ${form.orderNo} 직무대리명령이 성공적으로 발령되었습니다.`,
    );
  };

  const handleRevokeOrder = async (orderId, origUserId, actingUserId) => {
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
    // 피대리인 계정 복원 (계정 존재할 때만)
    if (onUpdateProsecutorStatus && origUserId) {
      onUpdateProsecutorStatus(origUserId, {
        status: "ACTIVE",
        delegateTo: "",
        delegateReason: "",
      });
    }
    // 대리자 계정의 dualRoleLevel 및 대결 정보 초기화
    if (onUpdateProsecutorStatus && actingUserId) {
      onUpdateProsecutorStatus(actingUserId, {
        actingTitle: "",
        dualRoleLevel: "",
        actingStart: "",
        actingEnd: "",
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
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <Label>원 결재권자 (피대리인) *</Label>
                <button
                  type="button"
                  onClick={() => {
                    setVacantMode((v) => !v);
                    setForm((f) => ({
                      ...f,
                      originalVacantTitle: "",
                      vacantRoleLevel: "SENIOR_PROSECUTOR",
                    }));
                  }}
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    padding: "2px 9px",
                    borderRadius: 6,
                    cursor: "pointer",
                    border: vacantMode
                      ? "1px solid rgba(245,158,11,0.6)"
                      : "1px solid var(--border-subtle)",
                    background: vacantMode
                      ? "rgba(245,158,11,0.12)"
                      : "var(--bg-elevated)",
                    color: vacantMode
                      ? "var(--primary-amber)"
                      : "var(--text-muted)",
                    transition: "all 0.15s",
                  }}
                >
                  {vacantMode ? "🔓 공석 입력 중" : "🏚️ 공석 (계정 없음)"}
                </button>
              </div>
              {vacantMode ? (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <input
                    className="input-field"
                    placeholder="예: 검찰사무국장 / 부장검사 (공석)"
                    value={form.originalVacantTitle}
                    onChange={(e) =>
                      setForm({ ...form, originalVacantTitle: e.target.value })
                    }
                    required
                    autoFocus
                  />
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--text-muted)",
                      paddingLeft: 2,
                    }}
                  >
                    계정 없는 공석 직위명을 직접 입력합니다. 발령 대장에{" "}
                    <em>(공석)</em>으로 표시됩니다.
                  </div>
                  <div style={{ marginTop: 2 }}>
                    <Label>공석 직위 권한 등급 *</Label>
                    <select
                      className="select-field"
                      value={form.vacantRoleLevel}
                      onChange={(e) =>
                        setForm({ ...form, vacantRoleLevel: e.target.value })
                      }
                      required
                    >
                      {Object.entries(ROLE_LABELS)
                        .filter(([key]) => key !== "SUPER_ADMIN")
                        .map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                    </select>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--text-muted)",
                        paddingLeft: 2,
                        marginTop: 3,
                      }}
                    >
                      직무대리자에게 부여할 권한 등급입니다. 피대리 직위의 실제
                      권한과 일치해야 합니다.
                    </div>
                  </div>
                </div>
              ) : (
                <select
                  className="select-field"
                  value={form.originalUserId}
                  onChange={(e) =>
                    setForm({ ...form, originalUserId: e.target.value })
                  }
                >
                  {prosecutorsList
                    .filter((p) => p.status !== "RETIRED")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.position || p.title} / {p.dept})
                      </option>
                    ))}
                </select>
              )}
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
                {prosecutorsList
                  .filter((p) => p.status !== "RETIRED")
                  .map((p) => (
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
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="date"
                  className="input-field"
                  value={form.actingStart}
                  onChange={(e) =>
                    setForm({ ...form, actingStart: e.target.value })
                  }
                  required
                  style={{ flex: 1 }}
                />
                <span
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.82rem",
                    flexShrink: 0,
                  }}
                >
                  ~
                </span>
                <input
                  type="date"
                  className="input-field"
                  value={form.actingEnd}
                  onChange={(e) =>
                    setForm({ ...form, actingEnd: e.target.value })
                  }
                  required
                  style={{ flex: 1 }}
                  min={form.actingStart}
                />
              </div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  marginTop: 3,
                  paddingLeft: 2,
                }}
              >
                종료일이 지나면 직무대리 권한이 자동으로 회수됩니다.
              </div>
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
                            handleRevokeOrder(
                              o.id,
                              o.originalUserId,
                              o.actingUserId,
                            )
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

const CATEGORIES = [
  { id: "ALL", label: "전체 메뉴" },
  { id: "USERS", label: "👥 계정 · 조직 관리" },
  { id: "CASES", label: "⚖️ 사건 · 배당 관리" },
  { id: "DOCS", label: "📁 공문서 · 죄명 관리" },
  { id: "SECURITY", label: "🛡️ 보안 · 감사" },
];

const SUB_TABS = [
  {
    id: "registrations",
    label: "🆕 가입 신청 허가",
    icon: ClipboardList,
    category: "USERS",
  },
  {
    id: "prosecutors",
    label: "검사 계정 관리",
    icon: Users,
    category: "USERS",
  },
  {
    id: "acting",
    label: "🏛️ 직무대리명령 발령",
    icon: Award,
    category: "USERS",
  },
  {
    id: "depts",
    label: "부서 & 부원 관리",
    icon: Building2,
    category: "USERS",
  },

  {
    id: "casenos",
    label: "사건번호 공식 배정",
    icon: Scale,
    category: "CASES",
  },
  { id: "reassign", label: "사건 재배당", icon: RefreshCw, category: "CASES" },
  {
    id: "designate",
    label: "🔒 결재 필수 지정",
    icon: ShieldAlert,
    category: "CASES",
  },
  {
    id: "import",
    label: "엑셀 일괄 등록",
    icon: FileSpreadsheet,
    category: "CASES",
  },

  { id: "docmgmt", label: "문서 관리", icon: FileBox, category: "DOCS" },
  { id: "docnos", label: "문서번호 관리", icon: FilePen, category: "DOCS" },
  { id: "charges", label: "죄명 관리", icon: Scale, category: "DOCS" },

  { id: "delete", label: "🗑️ 기록 삭제", icon: Trash2, category: "SECURITY" },
  { id: "audit", label: "감사 로그", icon: History, category: "SECURITY" },
  {
    id: "autoarchive",
    label: "📦 자동보존 설정",
    icon: Archive,
    category: "CASES",
  },
  {
    id: "archivestore",
    label: "🗄️ 보존기록 서고",
    icon: Archive,
    category: "CASES",
  },
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

// ──────────────────────────────────────────────────────────────────────────────
// 불기소 자동보존 설정 패널
// ──────────────────────────────────────────────────────────────────────────────
function AutoArchiveSettingsPanel({ addLog }) {
  const [enabled, setEnabled] = useState(true);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchAutoArchiveSettings().then((res) => {
      if (res) {
        setEnabled(Boolean(res.enabled));
        setDays(Number(res.days) || 7);
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const res = await updateAutoArchiveSettings({ enabled, days });
    setSaving(false);
    if (res?.success) {
      setSaved(true);
      addLog?.(
        "자동보존 설정 변경",
        `사용: ${enabled ? "ON" : "OFF"}, 기간: ${days}일`,
      );
      setTimeout(() => setSaved(false), 2500);
    }
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
          <Archive size={18} /> 불기소 자동보존 설정
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          불기소 처분 후 설정된 기간 동안 항고가 없으면 사건을 자동으로 보존기록
          서고에 이관합니다.
        </div>
      </div>

      {loading ? (
        <div
          style={{
            color: "var(--text-muted)",
            fontSize: "0.85rem",
            padding: 20,
          }}
        >
          설정 불러오는 중...
        </div>
      ) : (
        <form onSubmit={handleSave}>
          <div
            className="glass-panel"
            style={{
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 18,
              maxWidth: 480,
            }}
          >
            {/* 사용 여부 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "0.88rem",
                    color: "var(--text-main)",
                  }}
                >
                  자동보존 사용
                </div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--text-muted)",
                    marginTop: 2,
                  }}
                >
                  비활성화하면 자동보존이 실행되지 않습니다.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEnabled((v) => !v)}
                style={{
                  width: 52,
                  height: 28,
                  borderRadius: 14,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background: enabled
                    ? "var(--primary-amber)"
                    : "var(--bg-elevated)",
                  boxShadow: enabled
                    ? "0 0 0 1px rgba(245,158,11,0.6)"
                    : "0 0 0 1px var(--border-subtle)",
                  position: "relative",
                }}
                aria-label={enabled ? "자동보존 비활성화" : "자동보존 활성화"}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 4,
                    transition: "all 0.2s",
                    left: enabled ? 28 : 4,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: enabled ? "#000" : "var(--text-muted)",
                  }}
                />
              </button>
            </div>

            {/* 보존 기간 */}
            <div>
              <Label>처분 후 자동보존 기간 (일)</Label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  type="number"
                  className="input-field"
                  value={days}
                  min={1}
                  max={365}
                  onChange={(e) => setDays(Math.max(1, Number(e.target.value)))}
                  disabled={!enabled}
                  style={{ width: 120, opacity: enabled ? 1 : 0.5 }}
                  required
                />
                <span
                  style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}
                >
                  일 경과 후 항고 없으면 자동 보존
                </span>
              </div>
            </div>

            {/* 대상 처분 안내 */}
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: "rgba(99,102,241,0.08)",
                border: "1px solid rgba(99,102,241,0.25)",
                fontSize: "0.78rem",
                color: "#a5b4fc",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                📋 자동보존 대상 처분
              </div>
              <div>
                불기소 · 혐의없음 · 무혐의 · 기소유예 · 공소권없음 · 기소중지 ·
                죄가안됨
              </div>
              <div style={{ marginTop: 6, color: "var(--text-muted)" }}>
                항고가 접수된 경우 자동보존 대상에서 제외됩니다.
              </div>
            </div>

            {/* 저장 버튼 */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="submit"
                className="btn btn-gold"
                style={{ padding: "9px 24px", fontWeight: 800 }}
                disabled={saving}
              >
                {saving ? "저장 중..." : "💾 설정 저장"}
              </button>
              {saved && (
                <span
                  style={{
                    fontSize: "0.82rem",
                    color: "#34d399",
                    fontWeight: 700,
                  }}
                >
                  ✅ 저장되었습니다
                </span>
              )}
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// 보존기록 서고 패널 (검찰사무국 전용)
// ──────────────────────────────────────────────────────────────────────────────
function ArchiveStoragePanel({ ledgerData = [], onArchiveCase, addLog }) {
  const [searchQ, setSearchQ] = useState("");
  const [confirmTarget, setConfirmTarget] = useState(null);

  const archivedCases = ledgerData.filter((c) => Boolean(c.isArchived));
  const q = searchQ.toLowerCase().trim();
  const filtered = archivedCases.filter(
    (c) =>
      !q ||
      (c.sujeNo || "").toLowerCase().includes(q) ||
      (c.hyeongjeNo || "").toLowerCase().includes(q) ||
      (c.suspectName || "").toLowerCase().includes(q) ||
      (c.prosecutorName || "").toLowerCase().includes(q) ||
      (c.chargeName || "").toLowerCase().includes(q),
  );

  const handleUnarchive = (c) => {
    setConfirmTarget(c);
  };

  const doUnarchive = () => {
    if (!confirmTarget) return;
    onArchiveCase?.(confirmTarget.id, false);
    addLog?.(
      "보존 해제",
      `[${confirmTarget.hyeongjeNo || confirmTarget.sujeNo}] 보존 해제 → 원부 복원`,
    );
    setConfirmTarget(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 확인 다이얼로그 */}
      {confirmTarget && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: 400,
              width: "90%",
              padding: 28,
              textAlign: "center",
            }}
          >
            <div
              style={{
                fontWeight: 800,
                fontSize: "1rem",
                color: "var(--text-main)",
                marginBottom: 10,
              }}
            >
              보존 해제 확인
            </div>
            <div
              style={{
                fontSize: "0.82rem",
                color: "var(--text-muted)",
                marginBottom: 20,
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: "var(--primary-amber)" }}>
                {confirmTarget.hyeongjeNo || confirmTarget.sujeNo}
              </strong>{" "}
              사건을 보존 해제하고 원부 목록으로 복원합니다.
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
                onClick={doUnarchive}
                className="btn btn-gold"
                style={{ padding: "8px 20px" }}
              >
                🔄 보존 해제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
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
          <Archive size={18} /> 보존기록 서고
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          보존 처리된 사건 기록 관리 · 총{" "}
          <strong style={{ color: "var(--primary-amber)" }}>
            {archivedCases.length}건
          </strong>{" "}
          보존 중
        </div>
      </div>

      {/* 검색 */}
      <div style={{ position: "relative" }}>
        <Search
          size={14}
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
          style={{ paddingLeft: 32 }}
          placeholder="사건번호, 피의자, 담당검사, 죄명 검색..."
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
        />
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div
          className="glass-panel"
          style={{
            padding: 40,
            textAlign: "center",
            color: "var(--text-muted)",
            fontSize: "0.85rem",
          }}
        >
          {archivedCases.length === 0
            ? "보존된 사건이 없습니다."
            : "검색 조건에 해당하는 보존 사건이 없습니다."}
        </div>
      ) : (
        <div className="glass-panel" style={{ overflow: "hidden" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.82rem",
            }}
          >
            <thead>
              <tr
                style={{
                  background: "var(--bg-elevated)",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                {[
                  "사건번호",
                  "피의자",
                  "죄명",
                  "처분",
                  "담당검사",
                  "보존일",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 14px",
                      textAlign: "left",
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      fontSize: "0.75rem",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}
                >
                  <td
                    style={{
                      padding: "10px 14px",
                      fontFamily: "monospace",
                      color: "var(--primary-amber)",
                      fontWeight: 700,
                    }}
                  >
                    {c.hyeongjeNo && c.hyeongjeNo !== "-" && c.sujeNo
                      ? `${c.hyeongjeNo}(${c.sujeNo})`
                      : c.hyeongjeNo || c.sujeNo || "-"}
                  </td>
                  <td
                    style={{ padding: "10px 14px", color: "var(--text-main)" }}
                  >
                    {c.suspectName || "-"}
                  </td>
                  <td
                    style={{ padding: "10px 14px", color: "var(--text-muted)" }}
                  >
                    {c.chargeName || "-"}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      color: "#34d399",
                      fontWeight: 600,
                    }}
                  >
                    {c.disposition || "-"}
                  </td>
                  <td
                    style={{ padding: "10px 14px", color: "var(--text-muted)" }}
                  >
                    {c.prosecutorName || "-"}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      color: "var(--text-muted)",
                      fontSize: "0.75rem",
                      fontFamily: "monospace",
                    }}
                  >
                    {c.archivedAt ? c.archivedAt.slice(0, 10) : "-"}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    {onArchiveCase && (
                      <button
                        onClick={() => handleUnarchive(c)}
                        className="btn btn-outline"
                        style={{
                          fontSize: "0.72rem",
                          padding: "4px 10px",
                          color: "#34d399",
                          border: "1px solid rgba(52,211,153,0.4)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        🔄 보존 해제
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// 디스코드 ID 인라인 편집 셀
function DiscordIdCell({ prosecutor: p, onUpdateProsecutorStatus, addLog }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(p.discordId || "");

  const handleSave = () => {
    if (onUpdateProsecutorStatus) {
      onUpdateProsecutorStatus(p.id, { discordId: val.trim() });
    }
    addLog(
      "디스코드 ID 변경",
      `'${p.name}' 검사 디스코드 ID: ${val.trim() || "(삭제)"}`,
    );
    setEditing(false);
  };

  if (editing) {
    return (
      <div
        style={{ display: "flex", gap: 4, alignItems: "center", minWidth: 160 }}
      >
        <input
          className="input-field"
          style={{ padding: "3px 7px", fontSize: "0.75rem", height: 28 }}
          placeholder="username"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") {
              setVal(p.discordId || "");
              setEditing(false);
            }
          }}
          autoFocus
        />
        <button
          onClick={handleSave}
          className="btn btn-gold"
          style={{ padding: "3px 8px", fontSize: "0.68rem" }}
        >
          저장
        </button>
        <button
          onClick={() => {
            setVal(p.discordId || "");
            setEditing(false);
          }}
          className="btn btn-secondary"
          style={{ padding: "3px 6px", fontSize: "0.68rem" }}
        >
          ✕
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
      }}
      onClick={() => setEditing(true)}
      title="클릭하여 편집"
    >
      {p.discordId ? (
        <span
          style={{
            fontSize: "0.75rem",
            color: "#818cf8",
            fontFamily: "monospace",
          }}
        >
          @{p.discordId}
        </span>
      ) : (
        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
          —
        </span>
      )}
      <span
        style={{
          fontSize: "0.65rem",
          color: "var(--text-muted)",
          opacity: 0.6,
        }}
      >
        ✏️
      </span>
    </div>
  );
}

export default function SecretariatAdmin({
  ledgerData,
  approvalsData,
  appealsData = [],
  reportsData = [],
  bookingsData = [],
  departmentsData = [],
  prosecutorsList: propProsecutorsList,
  onReassignCase,
  onBulkReassign,
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
  onUpdateDepartment,
  onUpdateUserDept,
  docNoCounter,
  setDocNoCounter,
  currentUser,
  onOpenLoginModal,
  onBulkImport,
  onDesignateCase,
  onUndesignateCase,
  onArchiveCase,
  caseNumberSettings = {
    hyeongjeStart: 280,
    teuggongStart: 1,
    teughyeongStart: 1,
    teugapjeStart: 1,
    apjeStart: 1,
    naesaStart: 1,
  },
  onUpdateCaseNumberSettings,
  chargesData = [],
  onUpdateCharges,
  auditLogs: initialAuditLogs = [],
  isReadOnly = false,
}) {
  const [activeSubTab, setActiveSubTab] = useState("registrations");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const prosecutorsList = (propProsecutorsList || PROSECUTORS).filter(
    (p) => !p.isSuperAdmin,
  );
  const [auditLogs, setAuditLogs] = useState([]);
  const [newP, setNewP] = useState({
    id: "",
    name: "",
    title: "평검사",
    roleLevel: "PROSECUTOR",
    dept: departmentsData[0]?.name || "",
    password: "",
    discordId: "",
  });

  // ── 가입 신청 허가 상태 ──────────────────────────────────────
  const [registrations, setRegistrations] = useState([]);
  const [regLoading, setRegLoading] = useState(false);
  const [rejectModal, setRejectModal] = useState(null); // { id, name }
  const [rejectReason, setRejectReason] = useState("");
  const [regFilter, setRegFilter] = useState("PENDING"); // 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'
  const [newCharge, setNewCharge] = useState("");
  const [newChargeMeta, setNewChargeMeta] = useState({
    statuteDays: 20,
    lawArticle: "소송법 제21조의2",
    isUnlimited: false,
    category: "GENERAL",
    description: "",
  });
  const [chargeMessage, setChargeMessage] = useState("");
  const [chargeEditId, setChargeEditId] = useState(null);
  const [chargeEditName, setChargeEditName] = useState("");
  const [chargeEditMeta, setChargeEditMeta] = useState({
    statuteDays: 20,
    lawArticle: "소송법 제21조의2",
    isUnlimited: false,
    category: "GENERAL",
    description: "",
  });
  const [deletedCharges, setDeletedCharges] = useState([]);
  const [prosecutorStatusFilter, setProsecutorStatusFilter] =
    useState("ACTIVE"); // 'ACTIVE' (재직자) | 'RETIRED' (퇴직자) | 'ALL'

  const loadDeletedCharges = async () => {
    const result = await fetchDeletedChargesApi();
    if (Array.isArray(result)) setDeletedCharges(result);
  };

  useEffect(() => {
    if (activeSubTab === "charges") {
      loadDeletedCharges();
    }
  }, [activeSubTab]);

  useEffect(() => {
    if (Array.isArray(initialAuditLogs)) setAuditLogs(initialAuditLogs);
  }, [initialAuditLogs]);

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
    canArbitraryApprove: false,
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

  // 부서원 특정 사건 선택 재배당 모달 상태
  const [memberReassignModal, setMemberReassignModal] = useState(null);
  // 선택된 부서 (부원 관리용)
  const [selectedDeptId, setSelectedDeptId] = useState(
    departmentsData[0]?.id || "dept_tech",
  );
  const [headSelectId, setHeadSelectId] = useState("");
  const [headMode, setHeadMode] = useState("normal");

  useEffect(() => {
    const selectedDept = departmentsData.find(
      (department) => department.id === selectedDeptId,
    );
    setHeadSelectId(selectedDept?.headId || "");
    setHeadMode(selectedDept?.headMode || "normal");
  }, [departmentsData, selectedDeptId]);

  const [selectedCaseNo, setSelectedCaseNo] = useState(
    ledgerData[0]?.sujeNo || "",
  );
  const [targetPId, setTargetPId] = useState("");
  const [bulkSourcePName, setBulkSourcePName] = useState("");
  const [bulkTargetPId, setBulkTargetPId] = useState("");
  const [selectedBulkCaseIds, setSelectedBulkCaseIds] = useState([]);
  const [bulkReason, setBulkReason] = useState("인사 이동 및 업무 재배당");
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
      naesaStart: Number(caseNumberForm.naesaStart),
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
      `형제 ${settings.hyeongjeStart} / 내사 ${settings.naesaStart} / 특공 ${settings.teuggongStart}`,
    );
    alert("사건번호 자동계산 시작값이 저장되었습니다.");
  };

  const handleAssignOfficialCaseNo = async (e) => {
    e.preventDefault();
    if (!selectedCaseForAssign) {
      alert("사건을 먼저 선택해주세요.");
      return;
    }

    const manualNo = assignNoInput.trim() || null;

    // 서버에서 원자적으로 채번 — 레이스 컨디션 방지
    const result = await assignOfficialCaseNoApi({
      caseId: selectedCaseForAssign.id,
      prefix: assignPrefix,
      manualNo,
      autoSeal,
    });

    if (!result?.success) {
      alert(result?.message || "사건번호 배정에 실패했습니다.");
      return;
    }

    const { assignedNo, sujeNo, disposition } = result;

    const updated = {
      ...selectedCaseForAssign,
      sujeNo,
      hyeongjeNo: assignedNo,
      latestHyeongjeNo: assignedNo,
      disposition,
    };

    if (onUpdateCase) {
      onUpdateCase(updated);
    }
    addLog(
      "검찰사무국 사건번호 공식 배정",
      `${sujeNo}호 -> ${assignedNo}호 (${assignPrefix} 사건번호 공식 부여 완료)`,
    );
    alert(
      `[검찰사무국 관인 날인] 사건 ${sujeNo}호에 공식 사건번호 '${assignedNo}'가 배정되었습니다.`,
    );
  };

  const addLog = (action, details) => {
    const actionType = action.includes("삭제")
      ? "DELETE"
      : action.includes("허가") || action.includes("승인")
        ? "APPROVE"
        : action.includes("생성") || action.includes("등록")
          ? "CREATE"
          : "UPDATE";
    createAuditLogApi({
      action: actionType,
      entityType: "system",
      entityLabel: action,
      detail: details,
    })
      .then((result) => {
        if (result?.success && result.log)
          setAuditLogs((prev) => [result.log, ...prev]);
        else console.warn("[audit log] 저장 실패", result?.message);
      })
      .catch((error) => console.warn("[audit log] 네트워크 오류", error));
  };

  const handleAddProsecutor = async (e) => {
    e.preventDefault();
    if (!newP.id || !newP.name) {
      alert("ID와 이름을 입력해주세요.");
      return;
    }
    const created = { ...newP, activeCases: 0 };
    if (onAddProsecutor) {
      const ok = await onAddProsecutor(created);
      // App.jsx에서 실패 시 return (undefined/void) — 성공 여부를 res로 체크
      // onAddProsecutor가 실패하면 toast를 띄우고 return하므로 여기서는 폼 초기화만
      if (ok === false) return; // 명시적 false면 실패
    }
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

  const handleCreateCharge = async (e) => {
    e.preventDefault();
    const name = newCharge.trim();
    if (!name) return;
    const result = await createChargeApi(name, newChargeMeta);
    if (!result?.success) {
      setChargeMessage(result?.message || "죄명 등록에 실패했습니다.");
      return;
    }
    onUpdateCharges?.(
      [...chargesData, result.charge].sort((a, b) =>
        a.name.localeCompare(b.name),
      ),
    );
    setNewCharge("");
    setNewChargeMeta({
      statuteDays: 20,
      lawArticle: "소송법 제21조의2",
      isUnlimited: false,
      category: "GENERAL",
      description: "",
    });
    setChargeMessage("죄명이 등록되었습니다.");
    addLog("죄명 등록", `${name} (${newChargeMeta.lawArticle})`);
  };

  const handleUpdateCharge = async (charge) => {
    const name = chargeEditName.trim();
    if (!name) return;
    const result = await updateChargeApi(charge.id, name, chargeEditMeta);
    if (!result?.success) {
      setChargeMessage(result?.message || "죄명 수정에 실패했습니다.");
      return;
    }
    onUpdateCharges?.(
      chargesData
        .map((item) =>
          item.id === charge.id
            ? {
                ...item,
                name: result.charge.name,
                statuteDays: result.charge.statuteDays,
                isUnlimited: result.charge.isUnlimited,
                lawArticle: result.charge.lawArticle,
                category: result.charge.category,
                description: result.charge.description,
              }
            : item,
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    );
    setChargeEditId(null);
    setChargeEditName("");
    setChargeEditMeta({
      statuteDays: 20,
      lawArticle: "소송법 제21조의2",
      isUnlimited: false,
      category: "GENERAL",
      description: "",
    });
    setChargeMessage("죄명이 수정되었습니다.");
    addLog("죄명 수정", `${charge.name} → ${name}`);
  };

  const handleDeleteCharge = async (charge) => {
    if (
      !window.confirm(
        `'${charge.name}' 죄명을 소프트 삭제하시겠습니까?\n\n삭제 후에는 기본 목록에서 숨겨지지만 완전 삭제는 별도 권한이 필요합니다.`,
      )
    )
      return;
    const result = await deleteChargeApi(charge.id);
    if (!result?.success) {
      setChargeMessage(result?.message || "죄명 삭제에 실패했습니다.");
      return;
    }
    onUpdateCharges?.(chargesData.filter((item) => item.id !== charge.id));
    await loadDeletedCharges();
    setChargeMessage("죄명이 소프트 삭제되었습니다.");
    addLog("죄명 삭제", `${charge.name} (소프트 삭제)`);
  };

  const handleRestoreCharge = async (charge) => {
    const result = await restoreChargeApi(charge.id);
    if (!result?.success) {
      setChargeMessage(result?.message || "죄명 복구에 실패했습니다.");
      return;
    }
    setDeletedCharges((prev) => prev.filter((item) => item.id !== charge.id));
    const refreshedList = chargesData.some((item) => item.id === charge.id)
      ? chargesData
      : [...chargesData, charge];
    onUpdateCharges?.(
      refreshedList.sort((a, b) => a.name.localeCompare(b.name)),
    );
    setChargeMessage("죄명이 복구되었습니다.");
    addLog("죄명 복구", charge.name);
  };

  const handleHardDeleteCharge = async (charge) => {
    const canHardDelete =
      currentUser?.isSuperAdmin ||
      [
        "SUPER_ADMIN",
        "PROSECUTOR_GENERAL",
        "CHIEF_PROSECUTOR",
        "DEPUTY_CHIEF",
        "CHIEF_ADMINISTRATOR",
      ].includes(currentUser?.roleLevel);

    if (!canHardDelete) {
      setChargeMessage(
        "완전 삭제는 최고 관리자 또는 검사장급 이상만 가능합니다.",
      );
      return;
    }

    if (
      !window.confirm(
        `'${charge.name}' 죄명을 완전히 삭제하시겠습니까?\n\n이 작업은 복구할 수 없습니다.`,
      )
    )
      return;
    const result = await hardDeleteChargeApi(charge.id);
    if (!result?.success) {
      setChargeMessage(result?.message || "하드 삭제에 실패했습니다.");
      return;
    }
    setDeletedCharges((prev) => prev.filter((item) => item.id !== charge.id));
    setChargeMessage("죄명이 완전히 삭제되었습니다.");
    addLog("죄명 하드 삭제", charge.name);
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
          검찰사무국 관리 권한 필요
        </div>
        <div
          style={{
            fontSize: "0.82rem",
            color: "var(--text-muted)",
            lineHeight: 1.6,
            marginBottom: 20,
          }}
        >
          검찰사무국 시스템 관리는{" "}
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
          💡 <strong>권한 포함 대상</strong>: 검찰사무국 소속 직원
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
    if (selectedCategory !== "ALL" && t.category !== selectedCategory) {
      return false;
    }
    return true;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 읽기 전용 상태 안내 배너 */}
      {isReadOnly && (
        <div
          style={{
            background: "rgba(245,158,11,0.12)",
            border: "1px solid rgba(245,158,11,0.4)",
            borderRadius: 10,
            padding: "12px 18px",
            color: "var(--primary-amber)",
            fontSize: "0.84rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <ShieldAlert size={18} />
          <span>
            현재 <strong>읽기 전용 모드</strong>(휴가 또는 직무대리 위임 중)로
            접속 중입니다. 검찰사무국 행정 데이터 변경 및 저장이 제한됩니다.
          </span>
        </div>
      )}
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
              계정 관리 · 사건 재배당 · 죄명 관리 · 보안 감사로그
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
      {/* Category Group Filter Bar (메뉴 간소화) */}
      <div
        style={{
          display: "flex",
          gap: 6,
          alignItems: "center",
          flexWrap: "wrap",
          padding: "8px 12px",
          background: "rgba(15, 23, 42, 0.5)",
          borderRadius: 10,
          border: "1px solid var(--border-subtle)",
        }}
      >
        <span
          style={{
            fontSize: "0.72rem",
            color: "var(--text-muted)",
            fontWeight: 700,
            marginRight: 4,
          }}
        >
          📂 카테고리 분류:
        </span>
        {CATEGORIES.map((cat) => {
          const active = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                // Switch subtab to first subtab in category if activeSubTab is filtered out
                const catTabs = SUB_TABS.filter(
                  (t) => cat.id === "ALL" || t.category === cat.id,
                );
                if (
                  catTabs.length > 0 &&
                  !catTabs.some((t) => t.id === activeSubTab)
                ) {
                  setActiveSubTab(catTabs[0].id);
                }
              }}
              style={{
                fontSize: "0.75rem",
                fontWeight: 800,
                padding: "4px 10px",
                borderRadius: 20,
                cursor: "pointer",
                transition: "all 0.15s",
                background: active
                  ? "var(--primary-amber)"
                  : "var(--bg-elevated)",
                color: active ? "#000" : "var(--text-muted)",
                border: active
                  ? "1px solid var(--primary-amber)"
                  : "1px solid var(--border-subtle)",
              }}
            >
              {cat.label}
            </button>
          );
        })}
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

      {/* 부서 & 부원 관리 탭 */}
      {activeSubTab === "depts" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
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
                    !Boolean(c.isArchived) &&
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

                      {/* ── 부서장 직접 지정 (겸직/직무대리 포함) ── */}
                      <div
                        style={{
                          background: "var(--bg-elevated)",
                          padding: 14,
                          borderRadius: 10,
                          border: "1px solid rgba(167,139,250,0.3)",
                          marginTop: 14,
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.8rem",
                            fontWeight: 700,
                            color: "var(--text-main)",
                            marginBottom: 10,
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Crown size={14} color="#a78bfa" />
                          부서장 지정 / 변경
                          <span
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: 400,
                              color: "var(--text-muted)",
                              marginLeft: 4,
                            }}
                          >
                            겸직 · 직무대리 포함 — 전체 검사 中 지정 가능
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: 8,
                            flexWrap: "wrap",
                            alignItems: "flex-end",
                          }}
                        >
                          <div style={{ flex: "1 1 180px" }}>
                            <div
                              style={{
                                fontSize: "0.7rem",
                                color: "var(--text-muted)",
                                marginBottom: 4,
                              }}
                            >
                              부서장 (전 소속 포함)
                            </div>
                            <select
                              className="select-field"
                              style={{ width: "100%", fontSize: "0.8rem" }}
                              value={headSelectId}
                              onChange={(e) => setHeadSelectId(e.target.value)}
                            >
                              <option value="">— 미지정 —</option>
                              {/* 현재 부서 부원 먼저 */}
                              {members.length > 0 && (
                                <optgroup label={`${deptName} 소속`}>
                                  {members.map((p) => (
                                    <option key={p.id} value={p.id}>
                                      {p.name} (
                                      {ROLE_LABELS[p.roleLevel] || p.roleLevel})
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              {/* 타 부서 / 겸직 가능 인원 */}
                              {nonMembers.filter((p) => !p.isSuperAdmin)
                                .length > 0 && (
                                <optgroup label="타 부서 (겸직 / 직무대리)">
                                  {nonMembers
                                    .filter((p) => !p.isSuperAdmin)
                                    .map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name} [{p.dept}] (
                                        {ROLE_LABELS[p.roleLevel] ||
                                          p.roleLevel}
                                        )
                                      </option>
                                    ))}
                                </optgroup>
                              )}
                            </select>
                          </div>
                          <div style={{ flex: "0 0 auto" }}>
                            <div
                              style={{
                                fontSize: "0.7rem",
                                color: "var(--text-muted)",
                                marginBottom: 4,
                              }}
                            >
                              지정 형태
                            </div>
                            <select
                              className="select-field"
                              style={{ fontSize: "0.8rem" }}
                              value={headMode}
                              onChange={(e) => setHeadMode(e.target.value)}
                            >
                              <option value="normal">정식 부서장</option>
                              <option value="acting">직무대리 (Acting)</option>
                              <option value="concurrent">겸직</option>
                            </select>
                          </div>
                          <button
                            type="button"
                            className="btn btn-outline"
                            style={{
                              padding: "7px 14px",
                              fontSize: "0.8rem",
                              color: "#a78bfa",
                              border: "1px solid rgba(167,139,250,0.45)",
                              flexShrink: 0,
                            }}
                            onClick={() => {
                              if (!onUpdateDepartment) return;
                              const selected = prosecutorsList.find(
                                (p) => p.id === headSelectId,
                              );
                              const modeLabel =
                                headMode === "acting"
                                  ? "(직무대리)"
                                  : headMode === "concurrent"
                                    ? "(겸직)"
                                    : "";
                              if (
                                !window.confirm(
                                  headSelectId
                                    ? `${selected?.name}${modeLabel}을(를) ${deptName} 부서장으로 지정하시겠습니까?`
                                    : `${deptName} 부서장 지정을 해제하시겠습니까?`,
                                )
                              )
                                return;
                              onUpdateDepartment({
                                ...currentDeptObj,
                                headId: headSelectId,
                                headName: selected
                                  ? `${selected.name}${modeLabel}`
                                  : "",
                                headMode: headMode,
                              });
                              addLog(
                                "부서장 지정",
                                selected
                                  ? `${selected.name}${modeLabel} → '${deptName}' 부서장 지정`
                                  : `'${deptName}' 부서장 해제`,
                              );
                            }}
                          >
                            <Crown size={13} /> 지정 저장
                          </button>
                        </div>
                        <div
                          style={{
                            fontSize: "0.68rem",
                            color: "var(--text-muted)",
                            marginTop: 8,
                          }}
                        >
                          💡 <strong>겸직/직무대리</strong> 선택 시 타 부서 소속
                          상급자도 이 부서의 부서장 권한(사건 재배당·부원 휴직
                          처리)을 부여받습니다. 부원 명단 테이블의{" "}
                          <strong>👑 현 부서장</strong> 배지는 정식 부원인
                          경우에만 표시됩니다.
                        </div>
                      </div>

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
                          <UserPlus size={14} color="var(--primary-amber)" />
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
                              <th>부서장 지정</th>
                              <th>부서 변경</th>
                            </tr>
                          </thead>
                          <tbody>
                            {members.length === 0 ? (
                              <tr>
                                <td
                                  colSpan={7}
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
                                    c.prosecutorName.includes(p.name) &&
                                    !Boolean(c.isArchived),
                                );
                                const isCurrentHead =
                                  currentDeptObj?.headId === p.id ||
                                  (!currentDeptObj?.headId &&
                                    currentDeptObj?.headName === p.name);
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
                                    {/* ── 부서장 지정 버튼 ── */}
                                    <td style={{ textAlign: "center" }}>
                                      {isCurrentHead ? (
                                        <span
                                          style={{
                                            fontSize: "0.72rem",
                                            fontWeight: 800,
                                            padding: "3px 10px",
                                            borderRadius: 20,
                                            background: "rgba(245,158,11,0.15)",
                                            color: "var(--primary-amber)",
                                            border:
                                              "1px solid rgba(245,158,11,0.4)",
                                            whiteSpace: "nowrap",
                                          }}
                                        >
                                          👑 현 부서장
                                        </span>
                                      ) : (
                                        <button
                                          type="button"
                                          className="btn btn-outline"
                                          style={{
                                            fontSize: "0.7rem",
                                            padding: "3px 10px",
                                            color: "#a78bfa",
                                            border:
                                              "1px solid rgba(167,139,250,0.4)",
                                          }}
                                          title={`${p.name}을(를) ${deptName} 부서장으로 지정합니다`}
                                          onClick={() => {
                                            if (!onUpdateDepartment) return;
                                            if (
                                              !window.confirm(
                                                `${p.name}님을 ${deptName} 부서장으로 지정하시겠습니까?\n기존 부서장 지정이 해제됩니다.`,
                                              )
                                            )
                                              return;
                                            onUpdateDepartment({
                                              ...currentDeptObj,
                                              headId: p.id,
                                              headName: p.name,
                                            });
                                            addLog(
                                              "부서장 지정",
                                              `${p.name} → '${deptName}' 부서장 지정`,
                                            );
                                          }}
                                        >
                                          부서장 지정
                                        </button>
                                      )}
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
                  ["naesaStart", "내사"],
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
      {activeSubTab === "reassign" && (
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}
        >
          <div className="glass-panel" style={{ padding: 20 }}>
            <div style={{ fontWeight: 800, marginBottom: 14 }}>
              <RefreshCw size={15} color="var(--primary-amber)" /> 단건 사건
              재배당
            </div>
            <form
              onSubmit={handleReassign}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              <div>
                <Label>재배당할 사건 *</Label>
                <select
                  className="select-field"
                  value={selectedCaseNo}
                  onChange={(e) => setSelectedCaseNo(e.target.value)}
                  required
                >
                  {ledgerData.map((item) => (
                    <option key={item.id} value={item.hyeongjeNo}>
                      {item.hyeongjeNo} ({item.suspectName} /{" "}
                      {item.prosecutorName || "미배정"})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>변경할 담당검사 *</Label>
                <select
                  className="select-field"
                  value={targetPId}
                  onChange={(e) => setTargetPId(e.target.value)}
                  required
                >
                  <option value="">담당검사 선택...</option>
                  {prosecutorsList
                    .filter((p) => ["ACTIVE", "ON_LEAVE"].includes(p.status))
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.title || p.position} / {p.dept})
                      </option>
                    ))}
                </select>
              </div>
              <button type="submit" className="btn btn-gold">
                <CheckCircle2 size={14} /> 단건 재배당 실행
              </button>
            </form>
          </div>
          <div className="glass-panel" style={{ padding: 20 }}>
            <div style={{ fontWeight: 800, marginBottom: 14 }}>
              <Users size={15} color="#818cf8" /> 검사별 사건 일괄 재배당
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <Label>기존 담당검사 *</Label>
                <select
                  className="select-field"
                  value={bulkSourcePName}
                  onChange={(e) => {
                    const name = e.target.value;
                    setBulkSourcePName(name);
                    setSelectedBulkCaseIds(
                      ledgerData
                        .filter((item) => item.prosecutorName === name)
                        .map((item) => item.id),
                    );
                  }}
                >
                  <option value="">검사 선택...</option>
                  {[
                    ...new Set(
                      ledgerData
                        .map((item) => item.prosecutorName)
                        .filter(Boolean),
                    ),
                  ].map((name) => (
                    <option key={name} value={name}>
                      {name} (
                      {
                        ledgerData.filter(
                          (item) => item.prosecutorName === name,
                        ).length
                      }
                      건)
                    </option>
                  ))}
                </select>
              </div>
              {bulkSourcePName && (
                <div
                  style={{
                    maxHeight: 180,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                  }}
                >
                  {ledgerData
                    .filter((item) => item.prosecutorName === bulkSourcePName)
                    .map((item) => (
                      <label key={item.id} style={{ fontSize: "0.78rem" }}>
                        <input
                          type="checkbox"
                          checked={selectedBulkCaseIds.includes(item.id)}
                          onChange={(e) =>
                            setSelectedBulkCaseIds((prev) =>
                              e.target.checked
                                ? [...prev, item.id]
                                : prev.filter((id) => id !== item.id),
                            )
                          }
                        />{" "}
                        {item.hyeongjeNo} · {item.suspectName}
                      </label>
                    ))}
                </div>
              )}
              <div>
                <Label>새 담당검사 *</Label>
                <select
                  className="select-field"
                  value={bulkTargetPId}
                  onChange={(e) => setBulkTargetPId(e.target.value)}
                >
                  <option value="">담당검사 선택...</option>
                  {prosecutorsList
                    .filter((p) => p.status === "ACTIVE")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.dept})
                      </option>
                    ))}
                </select>
              </div>
              <button
                className="btn btn-gold"
                disabled={!selectedBulkCaseIds.length || !bulkTargetPId}
                onClick={async () => {
                  const target = prosecutorsList.find(
                    (p) => p.id === bulkTargetPId,
                  );
                  const ok = await onBulkReassign?.(
                    selectedBulkCaseIds,
                    target.id,
                    target.name,
                    bulkReason,
                  );
                  if (ok !== false) {
                    addLog(
                      "사건 일괄 재배당",
                      `${selectedBulkCaseIds.length}건 → ${target.name}`,
                    );
                    setSelectedBulkCaseIds([]);
                  }
                }}
              >
                <RefreshCw size={14} /> 선택 사건 재배당
              </button>
            </div>
          </div>
        </div>
      )}
      {activeSubTab === "docmgmt" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            className="glass-panel"
            style={{
              padding: 16,
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <div style={{ fontWeight: 800 }}>
              <FileBox size={16} color="var(--primary-amber)" /> 문서 관리
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[
                ["receive", "문서 접수", receivedDocs],
                ["send", "문서 발송", sentDocs],
                ["archive", "문서 보존", archivedDocs],
              ].map(([id, label, docs]) => (
                <button
                  key={id}
                  onClick={() => setDocMgmtTab(id)}
                  className={
                    docMgmtTab === id ? "btn btn-gold" : "btn btn-secondary"
                  }
                  style={{ fontSize: "0.78rem", padding: "5px 10px" }}
                >
                  {label} ({docs.length})
                </button>
              ))}
            </div>
          </div>
          {(() => {
            const isReceive = docMgmtTab === "receive";
            const isArchive = docMgmtTab === "archive";
            const docs = isReceive
              ? receivedDocs
              : isArchive
                ? archivedDocs
                : sentDocs;
            const setDocs = isReceive
              ? setReceivedDocs
              : isArchive
                ? setArchivedDocs
                : setSentDocs;
            const [draft, setDraft] = isReceive
              ? [newReceive, setNewReceive]
              : isArchive
                ? [newArchive, setNewArchive]
                : [newSend, setNewSend];
            const fields = isReceive
              ? [
                  ["title", "문서 제목"],
                  ["from", "발신처"],
                  ["to", "수신처"],
                ]
              : isArchive
                ? [
                    ["title", "문서 제목"],
                    ["caseNo", "사건번호"],
                  ]
                : [
                    ["title", "문서 제목"],
                    ["to", "수신처"],
                  ];
            return (
              <div className="glass-panel" style={{ padding: 18 }}>
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (!draft.title) return;
                    const item = {
                      id: `${docMgmtTab.toUpperCase()}-${Date.now()}`,
                      docNo:
                        draft.docNo ||
                        `2026-${docMgmtTab}-${String(docs.length + 1).padStart(3, "0")}`,
                      date: today,
                      type: draft.type || "공문",
                      status: isArchive
                        ? "보존"
                        : isReceive
                          ? "접수완료"
                          : "발송완료",
                      ...draft,
                    };
                    const result = await createOfficeDocumentApi(
                      docMgmtTab,
                      item,
                    );
                    if (!result?.success)
                      return alert(
                        result?.message || "문서 저장에 실패했습니다.",
                      );
                    setDocs((prev) => [result.document || item, ...prev]);
                    addLog("문서 관리 등록", `[${item.docNo}] ${item.title}`);
                    setDraft(
                      isReceive
                        ? {
                            docNo: "",
                            title: "",
                            from: "",
                            to: "",
                            type: "공문",
                            note: "",
                          }
                        : isArchive
                          ? {
                              docNo: "",
                              title: "",
                              caseNo: "",
                              retentionYears: 10,
                              category: "형사사건기록",
                              note: "",
                            }
                          : {
                              docNo: "",
                              title: "",
                              to: "",
                              type: "공문",
                              note: "",
                            },
                    );
                  }}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                    gap: 10,
                    alignItems: "end",
                  }}
                >
                  <div>
                    <Label>문서번호</Label>
                    <input
                      className="input-field"
                      value={draft.docNo}
                      onChange={(e) =>
                        setDraft({ ...draft, docNo: e.target.value })
                      }
                    />
                  </div>
                  {fields.map(([key, label]) => (
                    <div key={key}>
                      <Label>{label} *</Label>
                      <input
                        className="input-field"
                        value={draft[key] || ""}
                        onChange={(e) =>
                          setDraft({ ...draft, [key]: e.target.value })
                        }
                        required={key === "title"}
                      />
                    </div>
                  ))}
                  <button className="btn btn-gold">
                    <Plus size={14} /> 등록
                  </button>
                </form>
                <div
                  className="ledger-table-container"
                  style={{ marginTop: 16 }}
                >
                  <table className="ledger-table">
                    <thead>
                      <tr>
                        <th>문서번호</th>
                        <th>제목</th>
                        <th>일자</th>
                        <th>관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docs.map((doc) => (
                        <tr key={doc.id}>
                          <td>{doc.docNo}</td>
                          <td>{doc.title}</td>
                          <td>{doc.date || "-"}</td>
                          <td>
                            <button
                              className="btn btn-outline"
                              style={{ padding: "3px 7px" }}
                              onClick={async () => {
                                const result = await deleteOfficeDocumentApi(
                                  doc.id,
                                );
                                if (result?.success !== false)
                                  setDocs((prev) =>
                                    prev.filter((item) => item.id !== doc.id),
                                  );
                              }}
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}
      {activeSubTab === "docnos" && (
        <div className="glass-panel" style={{ padding: 18 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 14,
            }}
          >
            <div style={{ fontWeight: 800 }}>
              <FilePen size={15} color="var(--primary-amber)" /> 문서번호 관리
            </div>
            <button
              className="btn btn-gold"
              onClick={() => {
                (approvalsData || []).forEach((doc, index) =>
                  onUpdateDocNo(
                    doc.id,
                    `2026-결재-${String(index + 1).padStart(3, "0")}`,
                  ),
                );
                if (setDocNoCounter)
                  setDocNoCounter((approvalsData || []).length + 1);
                addLog(
                  "문서번호 일괄 재채번",
                  `${approvalsData?.length || 0}건`,
                );
              }}
            >
              <RefreshCw size={13} /> 전체 재채번
            </button>
          </div>
          <div className="ledger-table-container">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>문서번호</th>
                  <th>제목</th>
                  <th>상태</th>
                  <th>저장</th>
                </tr>
              </thead>
              <tbody>
                {(approvalsData || []).map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <input
                        className="input-field"
                        value={
                          editingDocId === doc.id
                            ? editingDocNoValue
                            : doc.docNo || ""
                        }
                        onChange={(e) => {
                          setEditingDocId(doc.id);
                          setEditingDocNoValue(e.target.value);
                        }}
                      />
                    </td>
                    <td>{doc.title || doc.caseNo || "처분 결의서"}</td>
                    <td>{doc.status || "-"}</td>
                    <td>
                      <button
                        className="btn btn-outline"
                        style={{ padding: "3px 7px" }}
                        onClick={() => {
                          onUpdateDocNo(
                            doc.id,
                            editingDocId === doc.id
                              ? editingDocNoValue
                              : doc.docNo,
                          );
                          setEditingDocId(null);
                        }}
                      >
                        저장
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {/* Sub Tab Content */}
      {activeSubTab === "prosecutors" && (
        <div
          style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 16 }}
        >
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
                <Label>디스코드 ID (선택)</Label>
                <input
                  className="input-field"
                  placeholder="예: username 또는 username#1234"
                  value={newP.discordId || ""}
                  onChange={(e) =>
                    setNewP({ ...newP, discordId: e.target.value })
                  }
                />
                <div
                  style={{
                    fontSize: "0.68rem",
                    color: "var(--text-muted)",
                    marginTop: 4,
                  }}
                >
                  입력 시 사건 접수 알림 메시지에 멘션이 포함됩니다.
                </div>
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

          <div className="glass-panel" style={{ overflow: "hidden" }}>
            {(() => {
              const activeCount = prosecutorsList.filter(
                (p) => p.status !== "RETIRED",
              ).length;
              const retiredCount = prosecutorsList.filter(
                (p) => p.status === "RETIRED",
              ).length;
              const displayedProsecutors = prosecutorsList.filter((p) => {
                if (prosecutorStatusFilter === "RETIRED")
                  return p.status === "RETIRED";
                if (prosecutorStatusFilter === "ALL") return true;
                return p.status !== "RETIRED";
              });

              return (
                <>
                  <div
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--border-subtle)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 800,
                        fontSize: "0.88rem",
                        color: "var(--text-main)",
                      }}
                    >
                      {prosecutorStatusFilter === "RETIRED"
                        ? `퇴직 계정 목록 (${retiredCount}명)`
                        : `관리 대상 재직 계정 목록 (${activeCount}명)`}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setProsecutorStatusFilter("ACTIVE")}
                        className={
                          prosecutorStatusFilter === "ACTIVE"
                            ? "btn btn-gold"
                            : "btn btn-secondary"
                        }
                        style={{ padding: "4px 10px", fontSize: "0.74rem" }}
                      >
                        🟢 재직 계정 ({activeCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setProsecutorStatusFilter("RETIRED")}
                        className={
                          prosecutorStatusFilter === "RETIRED"
                            ? "btn btn-gold"
                            : "btn btn-secondary"
                        }
                        style={{ padding: "4px 10px", fontSize: "0.74rem" }}
                      >
                        ⚫ 퇴직 계정 ({retiredCount})
                      </button>
                    </div>
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
                          <th>디스코드 ID</th>
                          <th>신분 / 결재권한</th>
                          <th>계정 관리</th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedProsecutors.map((p) => {
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
                                    color:
                                      ROLE_COLORS[p.roleLevel] || "#3b82f6",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {ROLE_LABELS[p.roleLevel] ||
                                    p.rank ||
                                    p.roleLevel}
                                </span>
                              </td>
                              <td style={{ color: "var(--text-muted)" }}>
                                {p.dept}
                              </td>
                              <td>
                                <DiscordIdCell
                                  prosecutor={p}
                                  onUpdateProsecutorStatus={
                                    onUpdateProsecutorStatus
                                  }
                                  addLog={addLog}
                                />
                              </td>
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
                                      {p.delegateTo
                                        ? `(대결: ${p.delegateTo})`
                                        : ""}
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
                                      🔵 권한위임 (대결자:{" "}
                                      {p.delegateTo || "미지정"})
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
                                  {st === "RETIRED" && (
                                    <span
                                      style={{
                                        fontSize: "0.68rem",
                                        padding: "2px 7px",
                                        borderRadius: 10,
                                        background: "rgba(100,116,139,0.2)",
                                        color: "#94a3b8",
                                        fontWeight: 800,
                                      }}
                                    >
                                      ⚫ 퇴직 (업무종료)
                                    </span>
                                  )}
                                  {Boolean(p.isAutoAssignExcluded) && (
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
                                              isAutoAssignExcluded:
                                                updatedState,
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
                                            canArbitraryApprove:
                                              !!p.canArbitraryApprove,
                                            roleLevel:
                                              p.roleLevel || "PROSECUTOR",
                                            rank: p.rank || "",
                                            position:
                                              p.position || p.title || "",
                                            delegateTo: p.delegateTo || "",
                                            delegateReason:
                                              p.delegateReason || "",
                                            dualPosition: p.dualPosition || "",
                                            dualDept: p.dualDept || "",
                                            dualRoleLevel:
                                              p.dualRoleLevel || "",
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
                                        onClick={() =>
                                          handleDeleteProsecutor(p)
                                        }
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
                          maxHeight: "85vh",
                          overflowY: "auto",
                          overflowX: "hidden",
                          padding: 24,
                          borderRadius: 14,
                          boxSizing: "border-box",
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
                            padding: "12px",
                            borderRadius: 8,
                            background: "rgba(245,158,11,0.08)",
                            border: "1px solid rgba(245,158,11,0.25)",
                            marginBottom: 14,
                          }}
                        >
                          <Label>승진·직급 변경</Label>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: 8,
                            }}
                          >
                            <select
                              className="select-field"
                              value={
                                statusForm.roleLevel ||
                                statusModalUser.roleLevel ||
                                "PROSECUTOR"
                              }
                              onChange={(e) => {
                                const roleLevel = e.target.value;
                                const labels = {
                                  PROSECUTOR_GENERAL: "검찰총장",
                                  CHIEF_PROSECUTOR: "검사장",
                                  DEPUTY_CHIEF: "차장검사",
                                  CHIEF_ADMINISTRATOR: "검찰관리관",
                                  SENIOR_PROSECUTOR: "부장검사",
                                  PROSECUTOR: "평검사",
                                  PROBATIONARY: "검사시보",
                                  ADMINISTRATOR: "검찰사무관",
                                  ADMIN_PROBATIONARY: "검찰사무관시보",
                                };
                                setStatusForm({
                                  ...statusForm,
                                  roleLevel,
                                  rank: labels[roleLevel] || roleLevel,
                                });
                              }}
                            >
                              {ROLE_HIERARCHY.filter(
                                (role) => role !== "SUPER_ADMIN",
                              ).map((role) => (
                                <option key={role} value={role}>
                                  {ROLE_LABELS[role]}
                                </option>
                              ))}
                            </select>
                            <input
                              className="input-field"
                              value={statusForm.rank || ""}
                              onChange={(e) =>
                                setStatusForm({
                                  ...statusForm,
                                  rank: e.target.value,
                                })
                              }
                              placeholder="직급 표시명"
                            />
                          </div>
                          <input
                            className="input-field"
                            style={{ marginTop: 8 }}
                            value={statusForm.position || ""}
                            onChange={(e) =>
                              setStatusForm({
                                ...statusForm,
                                position: e.target.value,
                                title: e.target.value,
                              })
                            }
                            placeholder="직위 (예: 형사부장)"
                          />
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
                              onChange={(e) => {
                                const nextStatus = e.target.value;
                                const clearsDelegate =
                                  nextStatus === "ACTIVE" ||
                                  nextStatus === "RETIRED";
                                setStatusForm({
                                  ...statusForm,
                                  status: nextStatus,
                                  ...(clearsDelegate
                                    ? { delegateTo: "", delegateReason: "" }
                                    : {}),
                                });
                              }}
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
                              <option value="RETIRED">
                                ⚫ 퇴직 (업무 및 사건배정 종료)
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
                              🚫 신규 사건 자동 배정 대상에서 제외하기 (고위
                              관리자 / 전담 제외)
                            </label>
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
                              id="arbitraryApproveCheck"
                              checked={!!statusForm.canArbitraryApprove}
                              onChange={(e) =>
                                setStatusForm({
                                  ...statusForm,
                                  canArbitraryApprove: e.target.checked,
                                })
                              }
                            />
                            <label
                              htmlFor="arbitraryApproveCheck"
                              style={{
                                fontSize: "0.78rem",
                                color: "var(--text-main)",
                                cursor: "pointer",
                              }}
                            >
                              ⚡ 전결 승인 권한 허용
                            </label>
                          </div>

                          {(statusForm.status === "DELEGATED" ||
                            statusForm.status === "ON_LEAVE") && (
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
                                    .filter(
                                      (p) =>
                                        p.id !== statusModalUser.id &&
                                        p.status !== "RETIRED",
                                    )
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
                </>
              );
            })()}
          </div>
        </div>
      )}
      {activeSubTab === "charges" && (
        <div className="glass-panel" style={{ padding: 24 }}>
          <div
            style={{
              fontWeight: 800,
              fontSize: "0.9rem",
              color: "var(--text-main)",
              marginBottom: 6,
            }}
          >
            죄명 관리
          </div>
          <div
            style={{
              fontSize: "0.78rem",
              color: "var(--text-muted)",
              marginBottom: 18,
            }}
          >
            등록한 죄명은 신규 사건 접수 화면에서 선택할 수 있습니다.
          </div>
          <form
            onSubmit={handleCreateCharge}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="input-field"
                value={newCharge}
                onChange={(e) => {
                  setNewCharge(e.target.value);
                  setChargeMessage("");
                }}
                placeholder="추가할 죄명 입력"
                maxLength={120}
                style={{ flex: 1 }}
              />
              <button
                type="submit"
                className="btn btn-gold"
                style={{ flexShrink: 0 }}
              >
                <Plus size={15} /> 추가
              </button>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: 8,
              }}
            >
              <input
                className="input-field"
                type="number"
                min={1}
                value={newChargeMeta.statuteDays}
                onChange={(e) =>
                  setNewChargeMeta((prev) => ({
                    ...prev,
                    statuteDays: Number(e.target.value || 20),
                  }))
                }
                placeholder="시효일수"
              />
              <input
                className="input-field"
                value={newChargeMeta.lawArticle}
                onChange={(e) =>
                  setNewChargeMeta((prev) => ({
                    ...prev,
                    lawArticle: e.target.value,
                  }))
                }
                placeholder="법적 근거"
              />
              <select
                className="input-field"
                value={newChargeMeta.category}
                onChange={(e) =>
                  setNewChargeMeta((prev) => ({
                    ...prev,
                    category: e.target.value,
                  }))
                }
              >
                <option value="GENERAL">GENERAL</option>
                <option value="ECONOMIC">ECONOMIC</option>
                <option value="SPECIAL">SPECIAL</option>
                <option value="OTHER">OTHER</option>
              </select>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 8,
                  padding: "0 10px",
                }}
              >
                <input
                  type="checkbox"
                  checked={newChargeMeta.isUnlimited}
                  onChange={(e) =>
                    setNewChargeMeta((prev) => ({
                      ...prev,
                      isUnlimited: e.target.checked,
                    }))
                  }
                />
                시효 없음
              </label>
            </div>
            <input
              className="input-field"
              value={newChargeMeta.description}
              onChange={(e) =>
                setNewChargeMeta((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              placeholder="설명(선택)"
            />
          </form>
          {chargeMessage && (
            <div
              style={{
                color: "var(--primary-amber)",
                fontSize: "0.78rem",
                marginBottom: 12,
              }}
            >
              {chargeMessage}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {chargesData.map((charge) => {
              const isEditing = chargeEditId === charge.id;
              return (
                <div
                  key={charge.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "10px 12px",
                    background: "var(--bg-elevated)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: 8,
                  }}
                >
                  {isEditing ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                        flex: 1,
                      }}
                    >
                      <input
                        className="input-field"
                        value={chargeEditName}
                        onChange={(e) => setChargeEditName(e.target.value)}
                        maxLength={120}
                      />
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(140px, 1fr))",
                          gap: 8,
                        }}
                      >
                        <input
                          className="input-field"
                          type="number"
                          min={1}
                          value={chargeEditMeta.statuteDays}
                          onChange={(e) =>
                            setChargeEditMeta((prev) => ({
                              ...prev,
                              statuteDays: Number(e.target.value || 20),
                            }))
                          }
                          placeholder="시효일수"
                        />
                        <input
                          className="input-field"
                          value={chargeEditMeta.lawArticle}
                          onChange={(e) =>
                            setChargeEditMeta((prev) => ({
                              ...prev,
                              lawArticle: e.target.value,
                            }))
                          }
                          placeholder="법적 근거"
                        />
                        <select
                          className="input-field"
                          value={chargeEditMeta.category}
                          onChange={(e) =>
                            setChargeEditMeta((prev) => ({
                              ...prev,
                              category: e.target.value,
                            }))
                          }
                        >
                          <option value="GENERAL">GENERAL</option>
                          <option value="ECONOMIC">ECONOMIC</option>
                          <option value="SPECIAL">SPECIAL</option>
                          <option value="OTHER">OTHER</option>
                        </select>
                        <label
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            background: "var(--bg-elevated)",
                            border: "1px solid var(--border-subtle)",
                            borderRadius: 8,
                            padding: "0 10px",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={chargeEditMeta.isUnlimited}
                            onChange={(e) =>
                              setChargeEditMeta((prev) => ({
                                ...prev,
                                isUnlimited: e.target.checked,
                              }))
                            }
                          />
                          시효 없음
                        </label>
                      </div>
                      <input
                        className="input-field"
                        value={chargeEditMeta.description}
                        onChange={(e) =>
                          setChargeEditMeta((prev) => ({
                            ...prev,
                            description: e.target.value,
                          }))
                        }
                        placeholder="설명(선택)"
                      />
                    </div>
                  ) : (
                    <div
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.85rem",
                          color: "var(--text-main)",
                        }}
                      >
                        {charge.name || charge}
                      </span>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        {charge.isUnlimited
                          ? "시효 없음"
                          : `${charge.statuteDays ?? 20}일`}{" "}
                        · {charge.lawArticle || "소송법 제21조의2"}
                      </span>
                    </div>
                  )}

                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-gold"
                          onClick={() => handleUpdateCharge(charge)}
                          style={{ padding: "4px 8px" }}
                        >
                          <Save size={13} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline"
                          onClick={() => {
                            setChargeEditId(null);
                            setChargeEditName("");
                            setChargeEditMeta({
                              statuteDays: 20,
                              lawArticle: "소송법 제21조의2",
                              isUnlimited: false,
                              category: "GENERAL",
                              description: "",
                            });
                          }}
                          style={{ padding: "4px 8px" }}
                        >
                          <X size={13} />
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-outline"
                        onClick={() => {
                          setChargeEditId(charge.id);
                          setChargeEditName(charge.name || "");
                          setChargeEditMeta({
                            statuteDays: charge.statuteDays ?? 20,
                            lawArticle: charge.lawArticle || "소송법 제21조의2",
                            isUnlimited: Boolean(charge.isUnlimited),
                            category: charge.category || "GENERAL",
                            description: charge.description || "",
                          });
                        }}
                        style={{ padding: "4px 8px" }}
                      >
                        <Pencil size={13} />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDeleteCharge(charge)}
                      className="btn btn-outline"
                      style={{ padding: "4px 8px", color: "#f87171" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {deletedCharges.length > 0 && (
            <div style={{ marginTop: 20 }}>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: "0.8rem",
                  color: "var(--text-muted)",
                  marginBottom: 10,
                }}
              >
                소프트 삭제된 죄명
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {deletedCharges.map((charge) => (
                  <div
                    key={charge.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "10px 12px",
                      background: "rgba(248,113,113,0.05)",
                      border: "1px solid rgba(248,113,113,0.2)",
                      borderRadius: 8,
                    }}
                  >
                    <span
                      style={{ fontSize: "0.8rem", color: "var(--text-main)" }}
                    >
                      {charge.name}
                    </span>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => handleRestoreCharge(charge)}
                        className="btn btn-outline"
                        style={{ padding: "4px 8px", color: "#34d399" }}
                      >
                        복구
                      </button>
                      <button
                        type="button"
                        onClick={() => handleHardDeleteCharge(charge)}
                        className="btn btn-outline"
                        style={{ padding: "4px 8px", color: "#fca5a5" }}
                      >
                        <Trash2 size={13} /> 완전 삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
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
          addLog={(log) => addLog(log, "결재 필수 지정 상태 변경")}
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
                      {log.id}
                    </td>
                    <td
                      style={{ fontWeight: 700, color: "var(--primary-amber)" }}
                    >
                      {log.action}
                    </td>
                    <td style={{ maxWidth: 300 }}>
                      <div style={{ whiteSpace: "normal", lineHeight: 1.4 }}>
                        {log.detail || log.details || "-"}
                      </div>
                    </td>
                    <td style={{ fontFamily: "monospace", color: "#60a5fa" }}>
                      {log.actorName || log.actor || "-"}
                    </td>
                    <td
                      style={{
                        fontFamily: "monospace",
                        fontSize: "0.72rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      {log.createdAt || log.timestamp || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {activeSubTab === "autoarchive" && (
        <AutoArchiveSettingsPanel addLog={addLog} />
      )}
      {activeSubTab === "archivestore" && (
        <ArchiveStoragePanel
          ledgerData={ledgerData}
          onArchiveCase={onArchiveCase}
          addLog={addLog}
        />
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
const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;
const MAX_IMPORT_ROWS = 5000;

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
    if (file.size > MAX_IMPORT_FILE_BYTES) {
      setError("엑셀 파일은 10MB 이하만 업로드할 수 있습니다.");
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), {
          type: "array",
          cellFormula: false,
          cellHTML: false,
          sheetRows: MAX_IMPORT_ROWS + 1,
        });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(ws, {
          defval: "",
          raw: false,
        });
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
      {/* ── 부서원 특정 사건 선택 재배당 모달 ── */}
      {memberReassignModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 14,
              width: "100%",
              maxWidth: 720,
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 24px 70px rgba(0,0,0,0.7)",
            }}
          >
            {/* 모달 헤더 */}
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--bg-elevated)",
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  fontSize: "0.98rem",
                  color: "var(--text-main)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <RefreshCw size={18} color="var(--primary-amber)" />
                {memberReassignModal.member.name} 검사 담당 사건 재배당 (총 {memberReassignModal.cases.length}건)
              </div>
              <button
                type="button"
                onClick={() => setMemberReassignModal(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <XCircle size={18} />
              </button>
            </div>

            {/* 모달 바디 */}
            <div style={{ padding: 16, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
              <div
                style={{
                  fontSize: "0.78rem",
                  color: "var(--text-muted)",
                  background: "rgba(96,165,250,0.08)",
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(96,165,250,0.2)",
                }}
              >
                💡 {memberReassignModal.member.name} 검사에게 배정된 활성 사건 목록입니다. 특정 사건을 선택하여 타 검사에게 즉시 재배당할 수 있습니다.
              </div>

              {memberReassignModal.cases.length === 0 ? (
                <div style={{ textAlign: "center", padding: 30, color: "var(--text-muted)", fontSize: "0.82rem" }}>
                  현재 이 검사에 배정된 활성 사건이 없습니다.
                </div>
              ) : (
                memberReassignModal.cases.map((c) => (
                  <div
                    key={c.id}
                    style={{
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 10,
                      padding: "12px 16px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 14,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "var(--text-main)" }}>
                        {c.sujeNo || c.hyeongjeNo} · {c.suspectName}
                      </div>
                      <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 2 }}>
                        죄명: {c.chargeName || "형사피의사건"} · 접수일: {c.bookingDate || "-"} · 상태:{" "}
                        <span style={{ color: "var(--primary-amber)", fontWeight: 700 }}>
                          {c.bookingStatus || c.status || "수사중"}
                        </span>
                      </div>
                    </div>

                    {/* 개별 사건 재배당 셀렉트 */}
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <select
                        className="select-field"
                        style={{ fontSize: "0.76rem", padding: "5px 10px", minWidth: 160 }}
                        onChange={async (e) => {
                          const toProsecutorId = e.target.value;
                          if (!toProsecutorId) return;
                          const toProsecutor = (propProsecutorsList || []).find((p) => String(p.id) === String(toProsecutorId));
                          if (!toProsecutor) return;

                          if (
                            window.confirm(
                              `사건 [${c.sujeNo || c.hyeongjeNo}] (${c.suspectName})을(를)\n'${toProsecutor.name}' 검사에게 재배당하시겠습니까?`,
                            )
                          ) {
                            if (onBulkReassign) {
                              await onBulkReassign(
                                [c.id],
                                toProsecutor.id,
                                toProsecutor.name,
                                `부서원 특정 사건 재배당 (${memberReassignModal.member.name} → ${toProsecutor.name})`,
                              );
                            } else if (onReassignCase) {
                              await onReassignCase(c.hyeongjeNo, toProsecutor.name, toProsecutor.id);
                            }
                            addLog("사건 재배당", `사건 [${c.sujeNo || c.hyeongjeNo}] (${memberReassignModal.member.name} → ${toProsecutor.name})`);
                            // 팝업 내부 목록 실시간 업데이트
                            setMemberReassignModal((prev) => ({
                              ...prev,
                              cases: prev.cases.filter((item) => item.id !== c.id),
                            }));
                          }
                        }}
                        defaultValue=""
                      >
                        <option value="" disabled>
                          재배당할 검사 선택...
                        </option>
                        {(propProsecutorsList || [])
                          .filter((p) => p.id !== memberReassignModal.member.id)
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.dept || "부서미지정"})
                            </option>
                          ))}
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
