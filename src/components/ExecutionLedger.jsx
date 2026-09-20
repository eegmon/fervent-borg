import React, { useState, useMemo } from "react";
import { Scale, Pencil, Save, X, Search } from "lucide-react";
import { getDisplayCaseNumber } from "../services/caseUtils";

// ── 형종 한글 변환 ────────────────────────────────────────────────────
const SENTENCE_TYPE_LABELS = {
  imprisonment: "징역/금고(5h↑)",
  light_imprisonment: "금고(5h↓)",
  fine: "벌금",
  detention: "구류/과료",
  "": "미지정",
};

const SENTENCE_TYPE_OPTIONS = [
  { value: "", label: "미지정" },
  { value: "imprisonment", label: "징역/금고(5h↑)" },
  { value: "light_imprisonment", label: "금고(5h↓)" },
  { value: "fine", label: "벌금" },
  { value: "detention", label: "구류/과료" },
];

// 형종별 기간(일 단위) — D-day 계산용
const SENTENCE_DURATION_DAYS = {
  imprisonment: 30,       // 징역/금고 장기: 30일 기본 (실제 선고일수로 계산하나 미입력 시 30일)
  light_imprisonment: 14, // 금고 단기
  fine: 30,               // 벌금 납부 기한 기본 30일
  detention: 7,           // 구류 최대 30일이나 과료는 더 짧음, 기본 7일
  "": 0,
};

const EXECUTION_STATUS_OPTIONS = [
  { value: "", label: "미지정" },
  { value: "pending", label: "집행 전" },
  { value: "in_progress", label: "집행 중" },
  { value: "completed", label: "집행 완료" },
];

const EXECUTION_STATUS_LABELS = {
  "": "미지정",
  pending: "집행 전",
  in_progress: "집행 중",
  completed: "집행 완료",
};

function getStatusBadgeStyle(status) {
  switch (status) {
    case "pending":
      return { background: "rgba(251,191,36,0.15)", color: "#fbbf24", border: "1px solid rgba(251,191,36,0.3)" };
    case "in_progress":
      return { background: "rgba(96,165,250,0.15)", color: "#60a5fa", border: "1px solid rgba(96,165,250,0.3)" };
    case "completed":
      return { background: "rgba(52,211,153,0.15)", color: "#34d399", border: "1px solid rgba(52,211,153,0.3)" };
    default:
      return { background: "rgba(156,163,175,0.15)", color: "#9ca3af", border: "1px solid rgba(156,163,175,0.3)" };
  }
}

function getSentenceBadgeStyle(type) {
  switch (type) {
    case "imprisonment":
      return { background: "rgba(239,68,68,0.13)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" };
    case "light_imprisonment":
      return { background: "rgba(249,115,22,0.13)", color: "#f97316", border: "1px solid rgba(249,115,22,0.3)" };
    case "fine":
      return { background: "rgba(234,179,8,0.13)", color: "#eab308", border: "1px solid rgba(234,179,8,0.3)" };
    case "detention":
      return { background: "rgba(139,92,246,0.13)", color: "#8b5cf6", border: "1px solid rgba(139,92,246,0.3)" };
    default:
      return { background: "rgba(156,163,175,0.12)", color: "#9ca3af", border: "1px solid rgba(156,163,175,0.3)" };
  }
}

/**
 * 실효까지 D-day 계산
 * executionDate + 형종별 기간 - 오늘
 */
function getDdayInfo(caseItem) {
  const execDate = caseItem?.executionDate;
  const sentenceType = caseItem?.sentenceType || "";
  if (!execDate) return null;

  const durationDays = SENTENCE_DURATION_DAYS[sentenceType] ?? 0;
  if (durationDays === 0) return null;

  const exec = new Date(`${execDate}T00:00:00`);
  if (Number.isNaN(exec.getTime())) return null;

  const expiry = new Date(exec);
  expiry.setDate(expiry.getDate() + durationDays);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diff = Math.floor((expiry.getTime() - today.getTime()) / 86400000);
  return diff;
}

// ── 필터 탭 정의 ─────────────────────────────────────────────────────
const FILTER_TABS = [
  { id: "all", label: "전체" },
  { id: "pending", label: "집행 전" },
  { id: "in_progress", label: "집행 중" },
  { id: "completed", label: "집행 완료" },
  { id: "fine", label: "벌금" },
];

export default function ExecutionLedger({ cases = [], onSave, onSelectSuspect }) {
  const [filterTab, setFilterTab] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [saving, setSaving] = useState(false);

  // ── 필터링 ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let list = (cases || []).filter(
      (c) =>
        !c.isArchived &&
        (!c.deletedAt || c.deletedAt === "") &&
        // 처분이 유죄판결(징역·벌금 등)인 사건만 표시
        // disposition에 "유죄" 또는 "판결" 포함하거나 sentenceType이 있는 경우
        (c.sentenceType ||
          String(c.disposition || "").includes("유죄") ||
          String(c.disposition || "").includes("판결") ||
          String(c.disposition || "").includes("집행") ||
          String(c.bookingStatus || "").includes("판결")),
    );

    // 탭 필터
    if (filterTab === "pending") list = list.filter((c) => c.executionStatus === "pending");
    else if (filterTab === "in_progress") list = list.filter((c) => c.executionStatus === "in_progress");
    else if (filterTab === "completed") list = list.filter((c) => c.executionStatus === "completed");
    else if (filterTab === "fine") list = list.filter((c) => c.sentenceType === "fine");

    // 검색
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (c) =>
          (c.sujeNo || "").toLowerCase().includes(q) ||
          (c.hyeongjeNo || "").toLowerCase().includes(q) ||
          (c.suspectName || "").toLowerCase().includes(q) ||
          (c.prosecutorName || "").toLowerCase().includes(q) ||
          (c.chargeName || "").toLowerCase().includes(q),
      );
    }

    return list.sort((a, b) => {
      // 집행 전 → 집행 중 → 완료 → 미지정 순
      const order = { pending: 0, in_progress: 1, completed: 2, "": 3 };
      const oa = order[a.executionStatus ?? ""] ?? 3;
      const ob = order[b.executionStatus ?? ""] ?? 3;
      if (oa !== ob) return oa - ob;
      return (b.bookingDate || "").localeCompare(a.bookingDate || "");
    });
  }, [cases, filterTab, searchQuery]);

  // ── 인라인 편집 핸들러 ──────────────────────────────────────────────
  const startEdit = (c) => {
    setEditingId(c.id);
    setEditDraft({
      sentenceType: c.sentenceType || "",
      executionStatus: c.executionStatus || "",
      executionDate: c.executionDate || "",
      executionNotes: c.executionNotes || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft({});
  };

  const commitEdit = async (c) => {
    if (!onSave) return;
    setSaving(true);
    try {
      await onSave({ ...c, ...editDraft });
      setEditingId(null);
      setEditDraft({});
    } catch {
      // 저장 실패 시 편집 상태 유지
    } finally {
      setSaving(false);
    }
  };

  // ── 렌더링 ─────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* 헤더 */}
      <div
        className="glass-panel"
        style={{
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Scale size={18} color="var(--primary-amber)" />
          <span style={{ fontWeight: 700, fontSize: "1rem", color: "var(--text-main)" }}>
            형집행 관리
          </span>
          <span
            style={{
              background: "rgba(251,191,36,0.15)",
              color: "#fbbf24",
              border: "1px solid rgba(251,191,36,0.3)",
              borderRadius: 4,
              padding: "2px 8px",
              fontSize: "0.72rem",
              fontWeight: 700,
            }}
          >
            {filtered.length}건
          </span>
        </div>

        {/* 검색 */}
        <div style={{ position: "relative", minWidth: 220 }}>
          <Search
            size={13}
            style={{
              position: "absolute",
              left: 9,
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--text-muted)",
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            placeholder="사건번호·피의자·담당검사 검색"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: "var(--input-bg)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 6,
              padding: "6px 10px 6px 28px",
              fontSize: "0.78rem",
              color: "var(--text-main)",
              width: "100%",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* 필터 탭 */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {FILTER_TABS.map((tab) => {
          const active = filterTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilterTab(tab.id)}
              className={active ? "btn btn-gold" : "btn btn-outline"}
              style={{ fontSize: "0.78rem", padding: "4px 14px" }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 테이블 */}
      <div className="glass-panel" style={{ overflow: "hidden" }}>
        <div className="ledger-table-container" style={{ border: "none", borderRadius: 0 }}>
          <table className="ledger-table">
            <thead>
              <tr>
                <th>사건번호</th>
                <th>담당검사</th>
                <th>피의자</th>
                <th>형종</th>
                <th>집행 상태</th>
                <th>집행(완료)일</th>
                <th>실효까지</th>
                <th>비고</th>
                <th style={{ width: 60 }}>편집</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      textAlign: "center",
                      color: "var(--text-muted)",
                      padding: "32px 0",
                      fontSize: "0.85rem",
                    }}
                  >
                    표시할 형집행 사건이 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const isEditing = editingId === c.id;
                  const caseNo = getDisplayCaseNumber(c) || c.sujeNo || c.hyeongjeNo || "-";
                  const dday = getDdayInfo(isEditing ? { ...c, ...editDraft } : c);

                  let ddayDisplay = "-";
                  let ddayColor = "var(--text-muted)";
                  if ((isEditing ? editDraft.executionDate : c.executionDate)) {
                    if (dday === null) {
                      ddayDisplay = "-";
                    } else if (dday < 0) {
                      ddayDisplay = "실효됨";
                      ddayColor = "#9ca3af";
                    } else if (dday === 0) {
                      ddayDisplay = "D-0";
                      ddayColor = "#ef4444";
                    } else {
                      ddayDisplay = `D-${dday}`;
                      ddayColor = dday <= 3 ? "#ef4444" : dday <= 7 ? "#f97316" : "#34d399";
                    }
                  }

                  return (
                    <tr
                      key={c.id}
                      style={isEditing ? { background: "rgba(251,191,36,0.05)" } : undefined}
                    >
                      {/* 사건번호 */}
                      <td style={{ fontFamily: "monospace", color: "#fbbf24", fontSize: "0.8rem" }}>
                        {caseNo}
                      </td>

                      {/* 담당검사 */}
                      <td style={{ fontWeight: 600 }}>{c.prosecutorName || "-"}</td>

                      {/* 피의자 */}
                      <td>
                        {c.suspectName ? (
                          <button
                            className="btn-link"
                            style={{ color: "var(--text-main)", fontWeight: 500, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                            onClick={() =>
                              onSelectSuspect?.({ name: c.suspectName, uuid: c.suspectUuid })
                            }
                          >
                            {c.suspectName}
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* 형종 */}
                      <td>
                        {isEditing ? (
                          <select
                            value={editDraft.sentenceType}
                            onChange={(e) =>
                              setEditDraft((d) => ({ ...d, sentenceType: e.target.value }))
                            }
                            style={{
                              background: "var(--input-bg)",
                              border: "1px solid var(--border-subtle)",
                              borderRadius: 4,
                              color: "var(--text-main)",
                              fontSize: "0.78rem",
                              padding: "2px 6px",
                            }}
                          >
                            {SENTENCE_TYPE_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            style={{
                              ...getSentenceBadgeStyle(c.sentenceType || ""),
                              borderRadius: 4,
                              padding: "2px 7px",
                              fontSize: "0.72rem",
                              fontWeight: 600,
                            }}
                          >
                            {SENTENCE_TYPE_LABELS[c.sentenceType || ""] ?? "미지정"}
                          </span>
                        )}
                      </td>

                      {/* 집행 상태 */}
                      <td>
                        {isEditing ? (
                          <select
                            value={editDraft.executionStatus}
                            onChange={(e) =>
                              setEditDraft((d) => ({ ...d, executionStatus: e.target.value }))
                            }
                            style={{
                              background: "var(--input-bg)",
                              border: "1px solid var(--border-subtle)",
                              borderRadius: 4,
                              color: "var(--text-main)",
                              fontSize: "0.78rem",
                              padding: "2px 6px",
                            }}
                          >
                            {EXECUTION_STATUS_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>
                                {o.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span
                            style={{
                              ...getStatusBadgeStyle(c.executionStatus || ""),
                              borderRadius: 4,
                              padding: "2px 7px",
                              fontSize: "0.72rem",
                              fontWeight: 600,
                            }}
                          >
                            {EXECUTION_STATUS_LABELS[c.executionStatus || ""] ?? "미지정"}
                          </span>
                        )}
                      </td>

                      {/* 집행(완료)일 */}
                      <td style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                        {isEditing ? (
                          <input
                            type="date"
                            value={editDraft.executionDate}
                            onChange={(e) =>
                              setEditDraft((d) => ({ ...d, executionDate: e.target.value }))
                            }
                            style={{
                              background: "var(--input-bg)",
                              border: "1px solid var(--border-subtle)",
                              borderRadius: 4,
                              color: "var(--text-main)",
                              fontSize: "0.78rem",
                              padding: "2px 6px",
                            }}
                          />
                        ) : (
                          c.executionDate || "-"
                        )}
                      </td>

                      {/* 실효까지 D-day */}
                      <td
                        style={{
                          fontFamily: "monospace",
                          fontWeight: 700,
                          fontSize: "0.82rem",
                          color: ddayColor,
                        }}
                      >
                        {ddayDisplay}
                      </td>

                      {/* 비고 */}
                      <td style={{ maxWidth: 200 }}>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editDraft.executionNotes}
                            onChange={(e) =>
                              setEditDraft((d) => ({ ...d, executionNotes: e.target.value }))
                            }
                            placeholder="비고"
                            style={{
                              background: "var(--input-bg)",
                              border: "1px solid var(--border-subtle)",
                              borderRadius: 4,
                              color: "var(--text-main)",
                              fontSize: "0.78rem",
                              padding: "2px 8px",
                              width: "100%",
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              whiteSpace: "normal",
                              lineHeight: 1.4,
                              color: c.executionNotes ? "var(--text-main)" : "var(--text-muted)",
                              fontSize: "0.78rem",
                            }}
                          >
                            {c.executionNotes || "-"}
                          </span>
                        )}
                      </td>

                      {/* 편집 버튼 */}
                      <td>
                        {isEditing ? (
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              className="btn btn-gold"
                              style={{ padding: "3px 8px", fontSize: "0.72rem" }}
                              onClick={() => commitEdit(c)}
                              disabled={saving}
                              title="저장"
                            >
                              <Save size={12} />
                            </button>
                            <button
                              className="btn btn-outline"
                              style={{ padding: "3px 8px", fontSize: "0.72rem" }}
                              onClick={cancelEdit}
                              disabled={saving}
                              title="취소"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn btn-outline"
                            style={{ padding: "3px 8px", fontSize: "0.72rem" }}
                            onClick={() => startEdit(c)}
                            title="편집"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
