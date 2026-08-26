import React, { useState } from "react";
import {
  Search,
  ExternalLink,
  User,
  FileCheck,
  Scale,
  AlertCircle,
  Eye,
  Filter,
  Pencil,
  Lock,
  Clock,
  MessageSquare,
} from "lucide-react";
import EditCaseModal from "./EditCaseModal";

const STATUS_COLOR = (s) => {
  if (!s) return "#94a3b8";
  if (s.includes("구속")) return "#f87171";
  if (s.includes("기소")) return "#fb923c";
  if (s.includes("불기소") || s.includes("무혐의")) return "#34d399";
  return "#93c5fd";
};

const COURT_PILL = ({ no, result, label, color }) => {
  if (!no || no === "-") return null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "4px 10px",
        borderRadius: 6,
        background: `${color}18`,
        border: `1px solid ${color}40`,
        marginBottom: 4,
      }}
    >
      <span
        style={{ fontSize: "0.68rem", fontWeight: 800, color, minWidth: 24 }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "0.72rem",
          color: "#f1f5f9",
          fontFamily: "monospace",
        }}
      >
        {no}
      </span>
      {result && result !== "-" && (
        <span style={{ fontSize: "0.7rem", color: "#94a3b8", marginLeft: 4 }}>
          · {result.slice(0, 14)}
        </span>
      )}
    </div>
  );
};

export default function MainLedger({
  ledgerData,
  departmentsData = [],
  prosecutorsList = [],
  chargesData = [],
  onSelectEvidence,
  onSelectSuspect,
  onCreateApproval,
  onUpdateCase,
  currentUser,
  approvalsData = [],
  onDesignateCase,
  onUndesignateCase,
  onOpenTimeline,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [prosecutorFilter, setProsecutorFilter] = useState("ALL");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [expandedId, setExpandedId] = useState(null);
  const [editingCase, setEditingCase] = useState(null);

  // 결재 완료 여부: 해당 사건의 최종승인된 결재 문서 존재 여부
  const isCaseApprovalComplete = (caseItem) =>
    approvalsData.some(
      (doc) =>
        doc.hyeongjeNo === caseItem.hyeongjeNo &&
        (doc.status === "최종승인" ||
          doc.status === "최종승인 (전결)" ||
          doc.status === "대결승인"),
    );

  // EditCaseModal의 onSave를 가로채어 결재 필수 사건 차단
  const handleSaveGuarded = (updatedCase) => {
    const original = (ledgerData || []).find((c) => c.id === updatedCase.id);
    if (original?.supervisorDesignated && !isCaseApprovalComplete(original)) {
      alert(
        `🔒 [결재 필수 사건]\n\n이 사건은 직근상급자(${original.supervisorName || "상급자"})가 결재 필수로 지정하였습니다.\n\n` +
          `전자 결재함에서 결재가 최종 승인된 후에만 사건 정보를 수정할 수 있습니다.`,
      );
      return;
    }
    if (onUpdateCase) onUpdateCase(updatedCase);
  };

  // 상급자 여부 (지정/해제 버튼 노출 조건)
  const canDesignate =
    currentUser &&
    (currentUser.isSuperAdmin ||
      [
        "SUPER_ADMIN",
        "PROSECUTOR_GENERAL",
        "CHIEF_PROSECUTOR",
        "DEPUTY_CHIEF",
        "CHIEF_ADMINISTRATOR",
        "SENIOR_PROSECUTOR",
      ].includes(currentUser.roleLevel));

  const filtered = (ledgerData || []).filter((item) => {
    const q = (searchTerm || "").toLowerCase().trim();
    const hNo = (item.hyeongjeNo || "").toLowerCase();
    const sName = (item.suspectName || "").toLowerCase();
    const pName = (item.prosecutorName || "").toLowerCase();
    const cName = (item.chargeName || "").toLowerCase();
    const sUuid = (item.suspectUuid || "").toLowerCase();

    const matchQ =
      !q ||
      hNo.includes(q) ||
      sName.includes(q) ||
      pName.includes(q) ||
      cName.includes(q) ||
      sUuid.includes(q);
    const matchStatus =
      statusFilter === "ALL" ||
      (item.bookingStatus || item.disposition || "").includes(statusFilter);
    const matchP =
      prosecutorFilter === "ALL" ||
      (item.prosecutorName || "").includes(prosecutorFilter);

    // 부서 필터링
    let matchDept = true;
    if (deptFilter !== "ALL") {
      const pUser = prosecutorsList.find(
        (p) =>
          p.name.includes(item.prosecutorName || "") ||
          (item.prosecutorName || "").includes(p.name),
      );
      matchDept = pUser ? pUser.dept === deptFilter : false;
    }

    return matchQ && matchStatus && matchP && matchDept;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header + Stats */}
      <div className="glass-panel gold-border" style={{ padding: "16px 20px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 14,
            flexWrap: "wrap",
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: "1rem",
                color: "var(--text-main)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <Scale size={18} color="var(--primary-amber)" />
              사건 원부 통합 대장
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                marginTop: 2,
              }}
            >
              형제번호 · 1·2·3심 재판 · 처분 · 부서별 사건 통합 관리
            </div>
          </div>
          {/* Quick Stats */}
          <div style={{ display: "flex", gap: 16 }}>
            {[
              { label: "전체", value: ledgerData.length, color: "#93c5fd" },
              {
                label: "구속·기소",
                value: ledgerData.filter(
                  (d) =>
                    d.disposition.includes("구속") ||
                    d.bookingStatus.includes("구속"),
                ).length,
                color: "#f87171",
              },
              {
                label: "수사중",
                value: ledgerData.filter((d) =>
                  d.disposition.includes("수사중"),
                ).length,
                color: "#fcd34d",
              },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div
                  style={{
                    fontSize: "1.4rem",
                    fontWeight: 900,
                    color: s.color,
                  }}
                >
                  {s.value}
                </div>
                <div
                  style={{
                    fontSize: "0.68rem",
                    color: "var(--text-muted)",
                    marginTop: 1,
                  }}
                >
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filter Bar */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 2, minWidth: 200 }}>
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
              placeholder="형제번호, 피의자, 검사명, 죄명 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="select-field"
            style={{ flex: 1, minWidth: 140 }}
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
          >
            <option value="ALL">전체 담당 부서</option>
            {departmentsData.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
          <select
            className="select-field"
            style={{ flex: 1, minWidth: 130 }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="ALL">전체 입건 상태</option>
            <option value="구속">구속</option>
            <option value="불구속">불구속</option>
            <option value="입건 전 조사">입건 전 조사</option>
          </select>
          <select
            className="select-field"
            style={{ flex: 1, minWidth: 140 }}
            value={prosecutorFilter}
            onChange={(e) => setProsecutorFilter(e.target.value)}
          >
            <option value="ALL">전체 담당자/검사</option>
            {prosecutorsList.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name} ({p.position || p.title})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Case List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
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
            검색 조건에 해당하는 사건이 없습니다.
          </div>
        ) : (
          filtered.map((item) => {
            const isExpanded = expandedId === item.id;
            const pUser = prosecutorsList.find(
              (p) =>
                p.name.includes(item.prosecutorName) ||
                item.prosecutorName.includes(p.name),
            );
            return (
              <div
                key={item.id}
                className="glass-panel"
                style={{ overflow: "hidden", transition: "all 0.2s" }}
              >
                {/* Case Row */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  style={{
                    padding: "14px 18px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 14,
                    cursor: "pointer",
                  }}
                >
                  {/* Case No */}
                  <div style={{ flexShrink: 0, minWidth: 120 }}>
                    <div
                      style={{
                        fontFamily: "monospace",
                        fontWeight: 800,
                        fontSize: "0.85rem",
                        color: "var(--primary-amber)",
                      }}
                    >
                      {item.sujeNo ||
                        (item.hyeongjeNo || "").replace("형제", "수제")}
                    </div>
                    {/* 기소 결정 시 형제번호 표시 */}
                    {(item.disposition || "").includes("기소") &&
                    !(item.disposition || "").includes("불기소") &&
                    !(item.disposition || "").includes("유예") ? (
                      <span
                        className="badge badge-gold"
                        style={{
                          fontSize: "0.68rem",
                          marginTop: 3,
                          display: "inline-block",
                        }}
                      >
                        ⚖️{" "}
                        {item.hyeongjeNo && item.hyeongjeNo !== "-" && item.hyeongjeNo !== "00"
                          ? item.hyeongjeNo
                          : (item.sujeNo || item.hyeongjeNo).replace(
                              "수제",
                              "형제",
                            )}
                      </span>
                    ) : (
                      <span
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--text-muted)",
                          display: "block",
                          marginTop: 2,
                        }}
                      >
                        미기소 (수사중)
                      </span>
                    )}
                  </div>

                  {/* Prosecutor */}
                  <div
                    style={{
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      minWidth: 120,
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: "50%",
                        background: "rgba(245,158,11,0.15)",
                        border: "1px solid rgba(245,158,11,0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        color: "var(--primary-amber)",
                      }}
                    >
                      {(item.prosecutorName || "?")[0]}
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 700,
                          color: "var(--text-main)",
                        }}
                      >
                        {item.prosecutorName}
                      </div>
                      <div
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--primary-amber)",
                          fontWeight: 600,
                        }}
                      >
                        {pUser?.dept || ""}
                      </div>
                    </div>
                  </div>

                  {/* Suspect + Charge */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        flexWrap: "wrap",
                      }}
                    >
                      {item.suspects && item.suspects.length > 0 ? (
                        item.suspects.map((s, sIdx) => (
                          <button
                            key={sIdx}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectSuspect(s.name);
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: 0,
                              textAlign: "left",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <span
                              style={{
                                fontWeight: 800,
                                fontSize: "0.9rem",
                                color: "var(--text-main)",
                              }}
                            >
                              {s.name}
                            </span>
                            <span
                              className="badge badge-gold"
                              style={{
                                fontSize: "0.65rem",
                                padding: "1px 5px",
                              }}
                            >
                              {s.role || "피의자"}
                            </span>
                          </button>
                        ))
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectSuspect(item.suspectName);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            padding: 0,
                            textAlign: "left",
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 800,
                              fontSize: "0.92rem",
                              color: "var(--text-main)",
                            }}
                          >
                            {item.suspectName}
                          </span>
                        </button>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--text-muted)",
                        fontFamily: "monospace",
                        marginTop: 2,
                      }}
                    >
                      {item.suspectUuid && item.suspectUuid !== "-" && item.suspectUuid !== "00" ? item.suspectUuid : ""}
                    </div>
                    <div
                      style={{
                        fontSize: "0.78rem",
                        color: "#cbd5e1",
                        marginTop: 4,
                      }}
                    >
                      {item.chargeName}
                    </div>
                  </div>

                  {/* Status + Disposition */}
                  <div
                    style={{
                      flexShrink: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: 5,
                      alignItems: "flex-end",
                    }}
                  >
                    <span
                      className="badge"
                      style={{
                        background: `${STATUS_COLOR(item.bookingStatus)}20`,
                        color: STATUS_COLOR(item.bookingStatus),
                      }}
                    >
                      <AlertCircle size={10} />
                      {item.bookingStatus}
                    </span>
                    <span
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        color: STATUS_COLOR(item.disposition),
                      }}
                    >
                      {item.disposition}
                    </span>
                    <div
                      style={{
                        fontSize: "0.68rem",
                        color: "var(--text-muted)",
                        fontFamily: "monospace",
                      }}
                    >
                      {item.bookingDate}
                    </div>
                  </div>

                  {/* Court Progress Pills */}
                  <div style={{ flexShrink: 0, minWidth: 140 }}>
                    <COURT_PILL
                      no={item.court1No}
                      result={item.court1Result}
                      label="1심"
                      color="#3b82f6"
                    />
                    <COURT_PILL
                      no={item.court2No}
                      result={item.court2Result}
                      label="2심"
                      color="#8b5cf6"
                    />
                    <COURT_PILL
                      no={item.court3No}
                      result={item.court3Result}
                      label="3심"
                      color="#10b981"
                    />
                  </div>

                  {/* Actions */}
                  <div
                    style={{
                      flexShrink: 0,
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                    }}
                  >
                    {/* 결재 필수 / 완료 배지 */}
                    {!!item.supervisorDesignated &&
                      !isCaseApprovalComplete(item) && (
                        <span
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 800,
                            color: "var(--primary-amber)",
                            background: "rgba(245,158,11,0.15)",
                            border: "1px solid rgba(245,158,11,0.4)",
                            borderRadius: 6,
                            padding: "3px 8px",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Lock size={10} /> 결재 필수
                        </span>
                      )}
                    {!!item.supervisorDesignated &&
                      isCaseApprovalComplete(item) && (
                        <span
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 800,
                            color: "#34d399",
                            background: "rgba(52,211,153,0.12)",
                            border: "1px solid rgba(52,211,153,0.35)",
                            borderRadius: 6,
                            padding: "3px 8px",
                          }}
                        >
                          ✅ 결재 완료
                        </span>
                      )}

                    <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectEvidence(
                            item.bookingBasis || "",
                            item.hyeongjeNo && item.hyeongjeNo !== "-"
                              ? item.hyeongjeNo
                              : item.sujeNo || item.hyeongjeNo,
                            item.suspectName,
                          );
                        }}
                        className="btn btn-outline"
                        style={{
                          padding: "5px 10px",
                          fontSize: "0.75rem",
                          color: "var(--primary-amber)",
                          border: "1px solid rgba(245,158,11,0.3)",
                        }}
                      >
                        <ExternalLink size={12} />
                        증거
                      </button>

                    {/* 수정 버튼 — 결재 필수 사건은 잠금 표시 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCase(item);
                      }}
                      className="btn btn-outline"
                      style={{
                        padding: "5px 10px",
                        fontSize: "0.75rem",
                        color:
                          item.supervisorDesignated &&
                          !isCaseApprovalComplete(item)
                            ? "rgba(147,197,253,0.5)"
                            : "#93c5fd",
                        border: `1px solid ${item.supervisorDesignated && !isCaseApprovalComplete(item) ? "rgba(147,197,253,0.15)" : "rgba(147,197,253,0.3)"}`,
                      }}
                    >
                      {item.supervisorDesignated &&
                      !isCaseApprovalComplete(item) ? (
                        <>
                          <Lock size={11} />
                          수정
                        </>
                      ) : (
                        <>
                          <Pencil size={12} />
                          수정
                        </>
                      )}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenTimeline && onOpenTimeline(item);
                      }}
                      className="btn btn-outline"
                      style={{
                        padding: "5px 10px",
                        fontSize: "0.75rem",
                        color: "#a78bfa",
                        border: "1px solid rgba(167,139,250,0.4)",
                      }}
                    >
                      <Clock size={12} />
                      타임라인
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onCreateApproval(item);
                      }}
                      className="btn btn-gold"
                      style={{ padding: "5px 10px", fontSize: "0.75rem" }}
                    >
                      <FileCheck size={12} />
                      결재
                    </button>

                    {/* 지정/해제 버튼 — 상급자만 표시 */}
                    {canDesignate &&
                      (item.supervisorDesignated ? (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onUndesignateCase && onUndesignateCase(item.id);
                          }}
                          className="btn btn-outline"
                          style={{
                            padding: "5px 10px",
                            fontSize: "0.72rem",
                            color: "#94a3b8",
                            border: "1px solid rgba(100,116,139,0.3)",
                          }}
                        >
                          🔓 지정해제
                        </button>
                      ) : (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDesignateCase && onDesignateCase(item.id);
                          }}
                          className="btn btn-outline"
                          style={{
                            padding: "5px 10px",
                            fontSize: "0.72rem",
                            color: "var(--primary-amber)",
                            border: "1px solid rgba(245,158,11,0.3)",
                          }}
                        >
                          🔒 결재지정
                        </button>
                      ))}
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div
                    style={{
                      borderTop: "1px solid var(--border-subtle)",
                      padding: "16px 18px",
                      background: "rgba(255,255,255,0.02)",
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(260px, 1fr))",
                      gap: 16,
                    }}
                  >
                    {/* 1심 Detail */}
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: 8,
                        background: "rgba(59,130,246,0.07)",
                        border: "1px solid rgba(59,130,246,0.2)",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: "0.78rem",
                          color: "#60a5fa",
                          marginBottom: 8,
                        }}
                      >
                        1심 재판 (지방법원)
                      </div>
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--text-main)",
                          lineHeight: 1.8,
                        }}
                      >
                        <div>
                          사건번호:{" "}
                          <span style={{ fontFamily: "monospace" }}>
                            {item.court1No}
                          </span>
                        </div>
                        <div>
                          결과: <strong>{item.court1Result}</strong>
                        </div>
                        <div>
                          항소: {item.court1Appealed} ({item.court1Appellant})
                        </div>
                      </div>
                    </div>
                    {/* 2심 Detail */}
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: 8,
                        background: "rgba(139,92,246,0.07)",
                        border: "1px solid rgba(139,92,246,0.2)",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: "0.78rem",
                          color: "#a78bfa",
                          marginBottom: 8,
                        }}
                      >
                        2심 재판 (고등법원)
                      </div>
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--text-main)",
                          lineHeight: 1.8,
                        }}
                      >
                        <div>
                          사건번호:{" "}
                          <span style={{ fontFamily: "monospace" }}>
                            {item.court2No}
                          </span>
                        </div>
                        <div>
                          결과: <strong>{item.court2Result}</strong>
                        </div>
                        <div>항소기각: {item.court2Dismissed}</div>
                      </div>
                    </div>
                    {/* 3심 Detail */}
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: 8,
                        background: "rgba(16,185,129,0.07)",
                        border: "1px solid rgba(16,185,129,0.2)",
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: "0.78rem",
                          color: "#34d399",
                          marginBottom: 8,
                        }}
                      >
                        3심 재판 (대법원)
                      </div>
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--text-main)",
                          lineHeight: 1.8,
                        }}
                      >
                        <div>
                          사건번호:{" "}
                          <span style={{ fontFamily: "monospace" }}>
                            {item.court3No}
                          </span>
                        </div>
                        <div>
                          최종확정: <strong>{item.court3Result}</strong>
                        </div>
                        <div>파기환송: {item.court3Remanded}</div>
                      </div>
                    </div>
                    {/* Date & Statute Info */}
                    <div
                      style={{
                        padding: "12px 14px",
                        borderRadius: 8,
                        background: "rgba(245,158,11,0.05)",
                        border: "1px solid rgba(245,158,11,0.15)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 8,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: "0.78rem",
                            color: "var(--primary-amber)",
                          }}
                        >
                          📅 일자 & 공소시효
                        </span>
                        <button
                          onClick={() => setEditingCase(item)}
                          className="btn btn-outline"
                          style={{
                            padding: "2px 8px",
                            fontSize: "0.7rem",
                            opacity:
                              item.supervisorDesignated &&
                              !isCaseApprovalComplete(item)
                                ? 0.5
                                : 1,
                          }}
                        >
                          {item.supervisorDesignated &&
                          !isCaseApprovalComplete(item)
                            ? "🔒 수정 잠김"
                            : "✏️ 사건정보 전체 수정"}
                        </button>
                      </div>
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--text-main)",
                          lineHeight: 1.8,
                        }}
                      >
                        <div>
                          사건 발생일:{" "}
                          <strong>
                            {item.incidentDate || item.bookingDate || "-"}
                          </strong>
                        </div>
                        <div>
                          사건 접수일: <span>{item.bookingDate || "-"}</span>
                        </div>
                        <div>
                          몰수·추징:{" "}
                          <strong style={{ color: "#34d399" }}>
                            {item.confiscation || "-"}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Edit Case Modal */}
      <EditCaseModal
        isOpen={!!editingCase}
        onClose={() => setEditingCase(null)}
        caseItem={editingCase}
        onSave={handleSaveGuarded}
        prosecutorsList={prosecutorsList}
        chargesData={chargesData}
      />
    </div>
  );
}
