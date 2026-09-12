import React, { useState } from "react";
import { Trash2 } from "lucide-react";

/**
 * [검찰사무국 전용] 기록 삭제 관리 패널
 */
export default function DeleteManagementPanel({
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
                    {a.appealNo || a.jibulhangNo || "-"}
                  </span>
                  <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                    {a.suspectName}
                  </span>
                  <span
                    style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}
                  >
                    {a.appealReason || a.chargeName || "-"}
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
                          label: `${a.appealNo || a.jibulhangNo} (${a.suspectName})`,
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
