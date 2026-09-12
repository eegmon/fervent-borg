import React, { useState } from "react";
import { ShieldAlert, Search } from "lucide-react";

/**
 * [결재 필수 지정 관리] 직근상급자 권한으로 사건에 결재 필수 태그 부여
 */
export default function DesignateApprovalPanel({
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
