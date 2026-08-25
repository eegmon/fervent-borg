import React, { useState } from "react";
import {
  ShieldAlert,
  ExternalLink,
  PlusCircle,
  Pencil,
  Search,
  CheckCircle2,
  X,
  ChevronDown,
  ChevronUp,
  FileText,
  UserCheck,
  Scale,
  Link,
  Info,
  RefreshCw,
} from "lucide-react";
import { fetchMojangUuid } from "../services/mojangApi";

const APPEAL_STATUS_OPTIONS = [
  "항고접수",
  "항고 진행중",
  "항고기각(직접경정)",
  "항고기각(원처분 적정)",
  "항고인용(재기수사명령)",
  "공소제기명령",
  "재항고 진행중",
  "재항고 기각",
];

export default function AppealLedger({
  appeals = [],
  ledgerData = [],
  prosecutorsList = [],
  currentUser,
  onAddAppeal,
  onUpdateAppeal,
  onSelectEvidence,
  onSelectSuspect,
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expandedId, setExpandedId] = useState(null);

  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAppeal, setEditingAppeal] = useState(null);

  // 24개 전체 필드를 지원하는 신규 접수 폼 초기 상태
  const initialFormState = {
    jibulhangNo: "",
    gobulhangNo: "",
    jaebulhangNo: "",
    daejaebulhangNo: "",
    sujeNo: "",
    hyeongjeNo: "",
    beobwonNo: "",
    chargeName: "",
    prosecutorName: currentUser?.name || "",
    chiefProsecutor: "",
    prosecutorGeneral: "",
    suspectName: "",
    suspectUuid: "",
    appealStatus: "항고접수",
    appealDisposition: "",
    appealDate: new Date().toISOString().split("T")[0],
    appealBasisUrl: "",
    appealDecision: "",
    appealNoticeUrl: "",
    originalStatus: "종국:불기소",
    intakeDate: "",
    intakeBasisUrl: "",
    indictmentStatus: "",
    indictmentDocUrl: "",
  };

  const [addForm, setAddForm] = useState(initialFormState);
  const [editForm, setEditForm] = useState(initialFormState);

  // Filtered Appeals
  const filteredAppeals = appeals.filter((a) => {
    const s = searchTerm.toLowerCase();
    const matchSearch =
      !s ||
      (a.jibulhangNo || "").toLowerCase().includes(s) ||
      (a.gobulhangNo || "").toLowerCase().includes(s) ||
      (a.jaebulhangNo || "").toLowerCase().includes(s) ||
      (a.daejaebulhangNo || "").toLowerCase().includes(s) ||
      (a.sujeNo || "").toLowerCase().includes(s) ||
      (a.hyeongjeNo || "").toLowerCase().includes(s) ||
      (a.prosecutorName || "").toLowerCase().includes(s) ||
      (a.suspectName || "").toLowerCase().includes(s) ||
      (a.chargeName || "").toLowerCase().includes(s) ||
      (a.appealStatus || a.status || "").toLowerCase().includes(s);

    const matchStatus =
      statusFilter === "ALL" ||
      (a.appealStatus || a.status || "").includes(statusFilter);
    return matchSearch && matchStatus;
  });

  // Select case from ledger in add modal -> Auto-fills matching fields
  const handleSelectCase = (hyeongjeNo) => {
    const selected = ledgerData.find((c) => c.hyeongjeNo === hyeongjeNo);
    if (selected) {
      setAddForm((prev) => ({
        ...prev,
        sujeNo: selected.hyeongjeNo || "미지정",
        hyeongjeNo: selected.hyeongjeNo,
        beobwonNo: selected.court1No || "-",
        chargeName: selected.chargeName || "",
        prosecutorName: selected.prosecutorName || prev.prosecutorName,
        suspectName: selected.suspectName || "",
        suspectUuid: selected.suspectUuid || "",
        originalStatus: selected.disposition || "종국:불기소",
        intakeDate: selected.bookingDate || "",
        intakeBasisUrl: selected.bookingBasis || "",
        indictmentStatus: selected.court1Result || "",
        indictmentDocUrl: selected.court1Doc || "",
      }));
    } else {
      setAddForm((prev) => ({ ...prev, hyeongjeNo }));
    }
  };

  // Submit New Appeal
  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!addForm.sujeNo && !addForm.hyeongjeNo && !addForm.jibulhangNo) {
      alert("번호(지불항번호 또는 형제/수제번호)를 입력해주세요.");
      return;
    }
    const newSeq = appeals.length + 1;
    const jNo = addForm.jibulhangNo || `2026지불항${newSeq}`;
    const newAppeal = {
      id: Date.now(),
      ...addForm,
      jibulhangNo: jNo,
      appealNo: jNo,
      status: addForm.appealStatus || "항고접수",
      disposition: addForm.appealDisposition || "항고 접수 심리 중",
      dispositionDate: addForm.appealDate,
      basisUrl: addForm.appealNoticeUrl || addForm.appealBasisUrl,
    };
    if (onAddAppeal) onAddAppeal(newAppeal);
    setIsAddModalOpen(false);
    setAddForm(initialFormState);
  };

  // Open Edit Modal
  const handleOpenEdit = (appeal) => {
    setEditingAppeal(appeal);
    setEditForm({
      jibulhangNo: appeal.jibulhangNo || appeal.appealNo || "",
      gobulhangNo: appeal.gobulhangNo || "",
      jaebulhangNo: appeal.jaebulhangNo || "",
      daejaebulhangNo: appeal.daejaebulhangNo || "",
      sujeNo: appeal.sujeNo || "",
      hyeongjeNo: appeal.hyeongjeNo || "",
      beobwonNo: appeal.beobwonNo || "",
      chargeName: appeal.chargeName || "",
      prosecutorName: appeal.prosecutorName || "",
      chiefProsecutor: appeal.chiefProsecutor || "",
      prosecutorGeneral: appeal.prosecutorGeneral || "",
      suspectName: appeal.suspectName || "",
      suspectUuid: appeal.suspectUuid || "",
      appealStatus: appeal.appealStatus || appeal.status || "항고접수",
      appealDisposition: appeal.appealDisposition || appeal.disposition || "",
      appealDate: appeal.appealDate || appeal.dispositionDate || "",
      appealBasisUrl: appeal.appealBasisUrl || "",
      appealDecision: appeal.appealDecision || "",
      appealNoticeUrl: appeal.appealNoticeUrl || appeal.basisUrl || "",
      originalStatus: appeal.originalStatus || "",
      intakeDate: appeal.intakeDate || "",
      intakeBasisUrl: appeal.intakeBasisUrl || "",
      indictmentStatus: appeal.indictmentStatus || "",
      indictmentDocUrl: appeal.indictmentDocUrl || "",
    });
  };

  // Submit Edit Appeal
  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!editingAppeal) return;
    const updated = {
      ...editingAppeal,
      ...editForm,
      status: editForm.appealStatus,
      disposition: editForm.appealDisposition || editForm.disposition,
      dispositionDate: editForm.appealDate,
      basisUrl: editForm.appealNoticeUrl || editForm.appealBasisUrl,
    };
    if (onUpdateAppeal) onUpdateAppeal(updated);
    setEditingAppeal(null);
  };

  const getStatusBadge = (status) => {
    if (!status) return "badge-secondary";
    if (status.includes("기각")) return "badge-danger";
    if (
      status.includes("인용") ||
      status.includes("명령") ||
      status.includes("경정")
    )
      return "badge-success";
    if (status.includes("접수")) return "badge-gold";
    return "badge-info";
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Top Banner */}
      <div
        className="glass-panel gold-border"
        style={{
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <ShieldAlert size={20} color="var(--primary-amber)" />
          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: "1.05rem",
                color: "var(--text-main)",
              }}
            >
              도스온라인 검찰청 항고·재항고 종합 관리 대장
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
              지불항·고불항·재불항·대재불항 사건 추적 & 원처분·심리결정 통합
              관리 포털
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            className="badge badge-warning"
            style={{ fontSize: "0.8rem", padding: "5px 10px" }}
          >
            총 {appeals.length}건
          </span>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="btn btn-gold"
            style={{ fontSize: "0.8rem", padding: "7px 14px", gap: 6 }}
          >
            <PlusCircle size={15} />
            신규 항고 사건 접수
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div
        className="glass-panel"
        style={{
          padding: "12px 16px",
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <Search
            size={14}
            color="var(--text-muted)"
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
            }}
          />
          <input
            className="input-field"
            style={{ paddingLeft: 30, fontSize: "0.8rem" }}
            placeholder="지불항/고불항/수제/형제번호, 검사명, 피고인명, 죄명 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="select-field"
          style={{ width: 180, fontSize: "0.8rem" }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">전체 항고 상황</option>
          {APPEAL_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Appeal Table */}
      <div className="glass-panel" style={{ overflow: "hidden" }}>
        <div className="ledger-table-container">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>상세</th>
                <th>지불항 / 고불항 / 재불항</th>
                <th>수제 / 형제 / 법원번호</th>
                <th>죄명</th>
                <th>담당검사 / 검사장 / 총장</th>
                <th>피고인 (UUID)</th>
                <th>항고 상황</th>
                <th>원처분 / 기소여부</th>
                <th>문서 & 링크</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppeals.length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    style={{
                      textAlign: "center",
                      padding: "36px",
                      color: "var(--text-muted)",
                    }}
                  >
                    등록되거나 검색 조건에 맞는 항고 사건이 없습니다.
                  </td>
                </tr>
              ) : (
                filteredAppeals.map((a) => {
                  const isExpanded = expandedId === a.id;
                  return (
                    <React.Fragment key={a.id}>
                      <tr>
                        <td>
                          <button
                            onClick={() =>
                              setExpandedId(isExpanded ? null : a.id)
                            }
                            className="btn btn-outline"
                            style={{ padding: "4px 6px", fontSize: "0.7rem" }}
                            title="24개 전체 상세 정보 보기"
                          >
                            {isExpanded ? (
                              <ChevronUp size={14} />
                            ) : (
                              <ChevronDown size={14} />
                            )}
                          </button>
                        </td>
                        <td
                          style={{
                            fontFamily: "monospace",
                            fontWeight: 800,
                            fontSize: "0.78rem",
                          }}
                        >
                          <div style={{ color: "var(--primary-amber)" }}>
                            {a.jibulhangNo || a.appealNo || "-"}
                          </div>
                          {a.gobulhangNo && (
                            <div
                              style={{ fontSize: "0.7rem", color: "#93c5fd" }}
                            >
                              {a.gobulhangNo}
                            </div>
                          )}
                          {a.jaebulhangNo && (
                            <div
                              style={{ fontSize: "0.7rem", color: "#a78bfa" }}
                            >
                              {a.jaebulhangNo}
                            </div>
                          )}
                        </td>
                        <td
                          style={{
                            fontFamily: "monospace",
                            fontSize: "0.78rem",
                          }}
                        >
                          <div style={{ color: "#60a5fa", fontWeight: 700 }}>
                            {a.hyeongjeNo || "-"}
                          </div>
                          {a.sujeNo && (
                            <div
                              style={{
                                fontSize: "0.7rem",
                                color: "var(--text-muted)",
                              }}
                            >
                              {a.sujeNo}
                            </div>
                          )}
                          {a.beobwonNo && (
                            <div
                              style={{ fontSize: "0.7rem", color: "#fbbf24" }}
                            >
                              {a.beobwonNo}
                            </div>
                          )}
                        </td>
                        <td
                          style={{
                            fontWeight: 700,
                            fontSize: "0.8rem",
                            maxWidth: 120,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {a.chargeName || "-"}
                        </td>
                        <td style={{ fontSize: "0.78rem" }}>
                          <div style={{ fontWeight: 700 }}>
                            {a.prosecutorName || "-"}
                          </div>
                          {a.chiefProsecutor && (
                            <div
                              style={{
                                fontSize: "0.68rem",
                                color: "var(--text-muted)",
                              }}
                            >
                              지검장: {a.chiefProsecutor}
                            </div>
                          )}
                          {a.prosecutorGeneral && (
                            <div
                              style={{
                                fontSize: "0.68rem",
                                color: "var(--text-muted)",
                              }}
                            >
                              총장: {a.prosecutorGeneral}
                            </div>
                          )}
                        </td>
                        <td style={{ fontSize: "0.78rem" }}>
                          <button
                            onClick={() =>
                              onSelectSuspect && onSelectSuspect(a.suspectName)
                            }
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--text-main)",
                              fontWeight: 800,
                              textDecoration: "underline dotted",
                            }}
                          >
                            {a.suspectName || "-"}
                          </button>
                          {a.suspectUuid && (
                            <div
                              style={{
                                fontFamily: "monospace",
                                fontSize: "0.65rem",
                                color: "var(--text-muted)",
                                maxWidth: 100,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {a.suspectUuid}
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            className={`badge ${getStatusBadge(a.appealStatus || a.status)}`}
                          >
                            {a.appealStatus || a.status || "접수"}
                          </span>
                        </td>
                        <td style={{ fontSize: "0.75rem" }}>
                          <div style={{ color: "#f87171" }}>
                            {a.originalStatus || "-"}
                          </div>
                          <div
                            style={{
                              color: "var(--text-muted)",
                              fontSize: "0.7rem",
                            }}
                          >
                            {a.indictmentStatus || "-"}
                          </div>
                        </td>
                        <td>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 2,
                            }}
                          >
                            {a.appealNoticeUrl?.includes("http") && (
                              <button
                                onClick={() =>
                                  onSelectEvidence &&
                                  onSelectEvidence(
                                    a.appealNoticeUrl,
                                    a.hyeongjeNo,
                                    a.suspectName,
                                  )
                                }
                                className="btn btn-outline"
                                style={{
                                  padding: "2px 6px",
                                  fontSize: "0.68rem",
                                  color: "var(--primary-amber)",
                                  border: "1px solid rgba(245,158,11,0.3)",
                                }}
                              >
                                <ExternalLink size={10} /> 통지서
                              </button>
                            )}
                            {a.indictmentDocUrl?.includes("http") && (
                              <button
                                onClick={() =>
                                  onSelectEvidence &&
                                  onSelectEvidence(
                                    a.indictmentDocUrl,
                                    a.hyeongjeNo,
                                    a.suspectName,
                                  )
                                }
                                className="btn btn-outline"
                                style={{
                                  padding: "2px 6px",
                                  fontSize: "0.68rem",
                                  color: "#60a5fa",
                                  border: "1px solid rgba(96,165,250,0.3)",
                                }}
                              >
                                <ExternalLink size={10} /> 공소장
                              </button>
                            )}
                          </div>
                        </td>
                        <td>
                          <button
                            onClick={() => handleOpenEdit(a)}
                            className="btn btn-secondary"
                            style={{
                              padding: "4px 8px",
                              fontSize: "0.72rem",
                              gap: 4,
                            }}
                          >
                            <Pencil size={12} /> 수정
                          </button>
                        </td>
                      </tr>

                      {/* 24개 전체 상세 아코디언 확장 패널 */}
                      {isExpanded && (
                        <tr>
                          <td
                            colSpan={10}
                            style={{
                              padding: 0,
                              background: "rgba(10, 18, 32, 0.95)",
                              borderBottom: "2px solid var(--primary-amber)",
                            }}
                          >
                            <div
                              style={{
                                padding: 20,
                                display: "grid",
                                gridTemplateColumns:
                                  "repeat(auto-fit, minmax(280px, 1fr))",
                                gap: 16,
                                fontSize: "0.8rem",
                              }}
                            >
                              {/* 1. 번호 체계 */}
                              <div
                                style={{
                                  background: "var(--bg-elevated)",
                                  padding: 14,
                                  borderRadius: 10,
                                  border: "1px solid var(--border-subtle)",
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: 800,
                                    color: "var(--primary-amber)",
                                    marginBottom: 10,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <FileText size={14} /> 📌 사건 번호 체계
                                </div>
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "110px 1fr",
                                    rowGap: 6,
                                  }}
                                >
                                  <span style={{ color: "var(--text-muted)" }}>
                                    지불항번호:
                                  </span>
                                  <strong>{a.jibulhangNo || "-"}</strong>
                                  <span style={{ color: "var(--text-muted)" }}>
                                    고불항번호:
                                  </span>
                                  <strong>{a.gobulhangNo || "-"}</strong>
                                  <span style={{ color: "var(--text-muted)" }}>
                                    재불항번호:
                                  </span>
                                  <strong>{a.jaebulhangNo || "-"}</strong>
                                  <span style={{ color: "var(--text-muted)" }}>
                                    대재불항번호:
                                  </span>
                                  <strong>{a.daejaebulhangNo || "-"}</strong>
                                  <span style={{ color: "var(--text-muted)" }}>
                                    수제번호:
                                  </span>
                                  <strong>{a.sujeNo || "-"}</strong>
                                  <span style={{ color: "var(--text-muted)" }}>
                                    형제번호:
                                  </span>
                                  <strong>{a.hyeongjeNo || "-"}</strong>
                                  <span style={{ color: "var(--text-muted)" }}>
                                    법원번호:
                                  </span>
                                  <strong>{a.beobwonNo || "-"}</strong>
                                </div>
                              </div>

                              {/* 2. 결재 & 피고인 */}
                              <div
                                style={{
                                  background: "var(--bg-elevated)",
                                  padding: 14,
                                  borderRadius: 10,
                                  border: "1px solid var(--border-subtle)",
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: 800,
                                    color: "#60a5fa",
                                    marginBottom: 10,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <UserCheck size={14} /> ⚖️ 결재권자 & 피고인
                                  정보
                                </div>
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "110px 1fr",
                                    rowGap: 6,
                                  }}
                                >
                                  <span style={{ color: "var(--text-muted)" }}>
                                    담당 검사:
                                  </span>
                                  <strong>{a.prosecutorName || "-"}</strong>
                                  <span style={{ color: "var(--text-muted)" }}>
                                    검사장:
                                  </span>
                                  <strong>{a.chiefProsecutor || "-"}</strong>
                                  <span style={{ color: "var(--text-muted)" }}>
                                    검찰총장:
                                  </span>
                                  <strong>{a.prosecutorGeneral || "-"}</strong>
                                  <span style={{ color: "var(--text-muted)" }}>
                                    피고인 성명:
                                  </span>
                                  <strong>{a.suspectName || "-"}</strong>
                                  <span style={{ color: "var(--text-muted)" }}>
                                    피고인 UUID:
                                  </span>
                                  <strong
                                    style={{
                                      fontFamily: "monospace",
                                      fontSize: "0.72rem",
                                    }}
                                  >
                                    {a.suspectUuid || "-"}
                                  </strong>
                                  <span style={{ color: "var(--text-muted)" }}>
                                    적용 죄명:
                                  </span>
                                  <strong
                                    style={{ color: "var(--primary-amber)" }}
                                  >
                                    {a.chargeName || "-"}
                                  </strong>
                                </div>
                              </div>

                              {/* 3. 원처분 & 수사 기록 */}
                              <div
                                style={{
                                  background: "var(--bg-elevated)",
                                  padding: 14,
                                  borderRadius: 10,
                                  border: "1px solid var(--border-subtle)",
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: 800,
                                    color: "#f87171",
                                    marginBottom: 10,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <Scale size={14} /> 📂 원처분 & 수사 기록
                                </div>
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "110px 1fr",
                                    rowGap: 6,
                                  }}
                                >
                                  <span style={{ color: "var(--text-muted)" }}>
                                    원처분 상황:
                                  </span>
                                  <strong style={{ color: "#f87171" }}>
                                    {a.originalStatus || "-"}
                                  </strong>
                                  <span style={{ color: "var(--text-muted)" }}>
                                    원 사건 접수일:
                                  </span>
                                  <strong>{a.intakeDate || "-"}</strong>
                                  <span style={{ color: "var(--text-muted)" }}>
                                    기소 여부:
                                  </span>
                                  <strong>{a.indictmentStatus || "-"}</strong>
                                  <span style={{ color: "var(--text-muted)" }}>
                                    원 사건 근거:
                                  </span>
                                  <span>
                                    {a.intakeBasisUrl?.includes("http") ? (
                                      <a
                                        href={a.intakeBasisUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                          color: "#60a5fa",
                                          textDecoration: "underline",
                                        }}
                                      >
                                        링크 이동
                                      </a>
                                    ) : (
                                      "-"
                                    )}
                                  </span>
                                  <span style={{ color: "var(--text-muted)" }}>
                                    공소장/불공소장:
                                  </span>
                                  <span>
                                    {a.indictmentDocUrl?.includes("http") ? (
                                      <a
                                        href={a.indictmentDocUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                          color: "#60a5fa",
                                          textDecoration: "underline",
                                        }}
                                      >
                                        문서 열기
                                      </a>
                                    ) : (
                                      "-"
                                    )}
                                  </span>
                                </div>
                              </div>

                              {/* 4. 항고 심리 & 결정 */}
                              <div
                                style={{
                                  background: "var(--bg-elevated)",
                                  padding: 14,
                                  borderRadius: 10,
                                  border: "1px solid var(--border-subtle)",
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: 800,
                                    color: "#4ade80",
                                    marginBottom: 10,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 6,
                                  }}
                                >
                                  <ShieldAlert size={14} /> 📜 항고 심리 & 결정
                                  정보
                                </div>
                                <div
                                  style={{
                                    display: "grid",
                                    gridTemplateColumns: "110px 1fr",
                                    rowGap: 6,
                                  }}
                                >
                                  <span style={{ color: "var(--text-muted)" }}>
                                    항고 진행 상황:
                                  </span>
                                  <strong style={{ color: "#4ade80" }}>
                                    {a.appealStatus || a.status || "-"}
                                  </strong>
                                  <span style={{ color: "var(--text-muted)" }}>
                                    항고 처분 내용:
                                  </span>
                                  <strong>
                                    {a.appealDisposition ||
                                      a.disposition ||
                                      "-"}
                                  </strong>
                                  <span style={{ color: "var(--text-muted)" }}>
                                    항고 일시:
                                  </span>
                                  <strong>
                                    {a.appealDate || a.dispositionDate || "-"}
                                  </strong>
                                  <span style={{ color: "var(--text-muted)" }}>
                                    항고 결정:
                                  </span>
                                  <strong>{a.appealDecision || "-"}</strong>
                                  <span style={{ color: "var(--text-muted)" }}>
                                    항고 근거 URL:
                                  </span>
                                  <span>
                                    {a.appealBasisUrl?.includes("http") ? (
                                      <a
                                        href={a.appealBasisUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                          color: "#60a5fa",
                                          textDecoration: "underline",
                                        }}
                                      >
                                        근거 확인
                                      </a>
                                    ) : (
                                      "-"
                                    )}
                                  </span>
                                  <span style={{ color: "var(--text-muted)" }}>
                                    항고결정통지서:
                                  </span>
                                  <span>
                                    {a.appealNoticeUrl?.includes("http") ? (
                                      <a
                                        href={a.appealNoticeUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        style={{
                                          color: "var(--primary-amber)",
                                          textDecoration: "underline",
                                        }}
                                      >
                                        통지서 확인
                                      </a>
                                    ) : (
                                      "-"
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal 1: 신규 항고 사건 접수 (24개 전체 필드 지원) ────────── */}
      {isAddModalOpen && (
        <AppealFormModal
          title="신규 항고 사건 접수 등록 (전체 필드)"
          form={addForm}
          setForm={setAddForm}
          onSelectCase={handleSelectCase}
          ledgerData={ledgerData}
          prosecutorsList={prosecutorsList}
          onSubmit={handleAddSubmit}
          onClose={() => setIsAddModalOpen(false)}
        />
      )}

      {/* ── Modal 2: 항고 처분 및 정보 수정 (24개 전체 필드 지원) ─────── */}
      {editingAppeal && (
        <AppealFormModal
          title={`항고 사건 정보 및 처분 수정 (${editingAppeal.jibulhangNo || editingAppeal.appealNo})`}
          form={editForm}
          setForm={setEditForm}
          onSelectCase={handleSelectCase}
          ledgerData={ledgerData}
          prosecutorsList={prosecutorsList}
          onSubmit={handleEditSubmit}
          onClose={() => setEditingAppeal(null)}
          isEdit
        />
      )}
    </div>
  );
}

// ── 항고 접수/수정 양방향 모달 컴포넌트 ─────────────────────────
function AppealFormModal({
  title,
  form,
  setForm,
  onSelectCase,
  ledgerData,
  prosecutorsList,
  onSubmit,
  onClose,
  isEdit,
}) {
  const [mojangLoading, setMojangLoading] = useState(false);

  const handleMojangSearch = async () => {
    if (!form.suspectName || !form.suspectName.trim()) {
      alert("피고인 닉네임을 먼저 입력해주세요.");
      return;
    }
    setMojangLoading(true);
    const res = await fetchMojangUuid(form.suspectName);
    setMojangLoading(false);
    if (res.success && res.uuid) {
      setForm((prev) => ({ ...prev, suspectUuid: res.uuid }));
      alert(
        `[Mojang 연동 완료] '${res.name}' 피고인의 UUID (${res.uuid})를 자동 입력하였습니다.`,
      );
    } else {
      alert(
        res.message ||
          "모장(Mojang) DB에서 해당 닉네임의 UUID를 찾을 수 없습니다.",
      );
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 16,
      }}
    >
      <div
        className="glass-panel gold-border"
        style={{
          width: "100%",
          maxWidth: 780,
          maxHeight: "90vh",
          overflowY: "auto",
          padding: 24,
          borderRadius: 14,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
            borderBottom: "1px solid var(--border-subtle)",
            paddingBottom: 12,
          }}
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: "1.05rem",
              color: "var(--text-main)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <ShieldAlert size={20} color="var(--primary-amber)" />
            {title}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {!isEdit && (
          <div
            style={{
              marginBottom: 16,
              background: "var(--bg-elevated)",
              padding: 12,
              borderRadius: 8,
              border: "1px solid var(--border-subtle)",
            }}
          >
            <label
              style={{
                display: "block",
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "var(--primary-amber)",
                marginBottom: 4,
              }}
            >
              💡 원 처분 사건 선택 시 자동 채우기
            </label>
            <select
              className="select-field"
              value={form.hyeongjeNo}
              onChange={(e) => onSelectCase(e.target.value)}
            >
              <option value="">사건 원부에서 사건 선택...</option>
              {ledgerData.map((c) => (
                <option key={c.id} value={c.hyeongjeNo}>
                  {c.hyeongjeNo}호 | {c.suspectName} | {c.chargeName} (
                  {c.disposition || "불기소"})
                </option>
              ))}
            </select>
          </div>
        )}

        <form
          onSubmit={onSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          {/* Section 1: 번호 체계 */}
          <div>
            <div
              style={{
                fontSize: "0.82rem",
                fontWeight: 800,
                color: "var(--primary-amber)",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              📌 사건 번호 체계
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 10,
              }}
            >
              <div>
                <label
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  지불항번호
                </label>
                <input
                  className="input-field"
                  placeholder="예: 2026지불항1"
                  value={form.jibulhangNo}
                  onChange={(e) =>
                    setForm({ ...form, jibulhangNo: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  고불항번호
                </label>
                <input
                  className="input-field"
                  placeholder="예: 2026고불항1"
                  value={form.gobulhangNo}
                  onChange={(e) =>
                    setForm({ ...form, gobulhangNo: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  재불항번호
                </label>
                <input
                  className="input-field"
                  placeholder="예: 2026재불항1"
                  value={form.jaebulhangNo}
                  onChange={(e) =>
                    setForm({ ...form, jaebulhangNo: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  대재불항번호
                </label>
                <input
                  className="input-field"
                  placeholder="예: 2026대재불항1"
                  value={form.daejaebulhangNo}
                  onChange={(e) =>
                    setForm({ ...form, daejaebulhangNo: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  수제번호
                </label>
                <input
                  className="input-field"
                  placeholder="예: 2026수제196"
                  value={form.sujeNo}
                  onChange={(e) => setForm({ ...form, sujeNo: e.target.value })}
                />
              </div>
              <div>
                <label
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  형제번호
                </label>
                <input
                  className="input-field"
                  placeholder="예: 2026형제196"
                  value={form.hyeongjeNo}
                  onChange={(e) =>
                    setForm({ ...form, hyeongjeNo: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  법원번호
                </label>
                <input
                  className="input-field"
                  placeholder="예: 2026고단104"
                  value={form.beobwonNo}
                  onChange={(e) =>
                    setForm({ ...form, beobwonNo: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          {/* Section 2: 검찰 & 피고인 정보 */}
          <div>
            <div
              style={{
                fontSize: "0.82rem",
                fontWeight: 800,
                color: "#60a5fa",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              ⚖️ 검찰 관계자 & 피고인 정보
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 10,
              }}
            >
              <div>
                <label
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  죄명
                </label>
                <input
                  className="input-field"
                  placeholder="예: 협박, 모욕"
                  value={form.chargeName}
                  onChange={(e) =>
                    setForm({ ...form, chargeName: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  담당검사
                </label>
                <input
                  className="input-field"
                  placeholder="검사명 입력"
                  value={form.prosecutorName}
                  onChange={(e) =>
                    setForm({ ...form, prosecutorName: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  검사장
                </label>
                <input
                  className="input-field"
                  placeholder="검사장 입력"
                  value={form.chiefProsecutor}
                  onChange={(e) =>
                    setForm({ ...form, chiefProsecutor: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  검찰총장
                </label>
                <input
                  className="input-field"
                  placeholder="검찰총장 입력"
                  value={form.prosecutorGeneral}
                  onChange={(e) =>
                    setForm({ ...form, prosecutorGeneral: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  피고인명
                </label>
                <input
                  className="input-field"
                  placeholder="피의자 닉네임 입력"
                  value={form.suspectName}
                  onChange={(e) =>
                    setForm({ ...form, suspectName: e.target.value })
                  }
                />
              </div>
              <div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 2,
                  }}
                >
                  <label
                    style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                  >
                    피고인 UUID
                  </label>
                  <button
                    type="button"
                    onClick={handleMojangSearch}
                    disabled={mojangLoading}
                    className="btn btn-outline"
                    style={{
                      padding: "1px 6px",
                      fontSize: "0.65rem",
                      color: "var(--primary-amber)",
                      border: "1px solid rgba(245,158,11,0.3)",
                      gap: 3,
                    }}
                    title="입력한 피고인 닉네임으로 모장(Mojang) 공식 DB에서 UUID 연동 검색"
                  >
                    {mojangLoading ? (
                      <RefreshCw size={10} className="animate-spin" />
                    ) : (
                      <Search size={10} />
                    )}
                    {mojangLoading ? "조회중..." : "🔍 Mojang 연동"}
                  </button>
                </div>
                <input
                  className="input-field"
                  style={{ fontFamily: "monospace", fontSize: "0.75rem" }}
                  placeholder="모장 UUID 연동/입력"
                  value={form.suspectUuid}
                  onChange={(e) =>
                    setForm({ ...form, suspectUuid: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          {/* Section 3: 원처분 & 수사 정보 */}
          <div>
            <div
              style={{
                fontSize: "0.82rem",
                fontWeight: 800,
                color: "#f87171",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              📂 원처분 & 수사 기록
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 10,
              }}
            >
              <div>
                <label
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  원처분 상황
                </label>
                <input
                  className="input-field"
                  placeholder="예: 종국:불기소"
                  value={form.originalStatus}
                  onChange={(e) =>
                    setForm({ ...form, originalStatus: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  원 사건 접수일시
                </label>
                <input
                  className="input-field"
                  placeholder="예: 2026. 7. 5"
                  value={form.intakeDate}
                  onChange={(e) =>
                    setForm({ ...form, intakeDate: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  기소 여부
                </label>
                <input
                  className="input-field"
                  placeholder="예: 혐의없음(범죄인정안됨)"
                  value={form.indictmentStatus}
                  onChange={(e) =>
                    setForm({ ...form, indictmentStatus: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  원 사건 접수근거 URL
                </label>
                <input
                  className="input-field"
                  placeholder="https://cafe.naver.com/..."
                  value={form.intakeBasisUrl}
                  onChange={(e) =>
                    setForm({ ...form, intakeBasisUrl: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  공소장/불공소장 URL
                </label>
                <input
                  className="input-field"
                  placeholder="https://naver.me/..."
                  value={form.indictmentDocUrl}
                  onChange={(e) =>
                    setForm({ ...form, indictmentDocUrl: e.target.value })
                  }
                />
              </div>
            </div>
          </div>

          {/* Section 4: 항고 심리 & 결정 정보 */}
          <div>
            <div
              style={{
                fontSize: "0.82rem",
                fontWeight: 800,
                color: "#4ade80",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              📜 항고 심리 & 결정 정보
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                gap: 10,
              }}
            >
              <div>
                <label
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  항고 상황 (상태)
                </label>
                <select
                  className="select-field"
                  value={form.appealStatus}
                  onChange={(e) =>
                    setForm({ ...form, appealStatus: e.target.value })
                  }
                >
                  {APPEAL_STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  항고 결정
                </label>
                <input
                  className="input-field"
                  placeholder="예: 항고기각 / 직접경정"
                  value={form.appealDecision}
                  onChange={(e) =>
                    setForm({ ...form, appealDecision: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  항고 일시
                </label>
                <input
                  className="input-field"
                  placeholder="예: 2026. 7. 5"
                  value={form.appealDate}
                  onChange={(e) =>
                    setForm({ ...form, appealDate: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  항고 근거 URL
                </label>
                <input
                  className="input-field"
                  placeholder="https://cafe.naver.com/..."
                  value={form.appealBasisUrl}
                  onChange={(e) =>
                    setForm({ ...form, appealBasisUrl: e.target.value })
                  }
                />
              </div>
              <div>
                <label
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  항고결정통지서 URL
                </label>
                <input
                  className="input-field"
                  placeholder="https://cafe.naver.com/..."
                  value={form.appealNoticeUrl}
                  onChange={(e) =>
                    setForm({ ...form, appealNoticeUrl: e.target.value })
                  }
                />
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <label
                style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
              >
                항고 처분 상세 요지
              </label>
              <textarea
                className="input-field"
                rows={2}
                placeholder="예: 원처분 적정으로 항고기각 결정 / 직접경정 처분"
                value={form.appealDisposition}
                onChange={(e) =>
                  setForm({ ...form, appealDisposition: e.target.value })
                }
              />
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              marginTop: 10,
              borderTop: "1px solid var(--border-subtle)",
              paddingTop: 14,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              취소
            </button>
            <button
              type="submit"
              className="btn btn-gold"
              style={{ flex: 1, gap: 6, justifyContent: "center" }}
            >
              <CheckCircle2 size={16} />
              {isEdit ? "수정 내용 저장" : "항고 사건 등록 완료"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
