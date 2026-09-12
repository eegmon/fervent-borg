import React, { useState } from "react";
import { Archive, Search } from "lucide-react";

/**
 * 보존기록 서고 패널 (검찰사무국 전용)
 */
export default function ArchiveStoragePanel({
  ledgerData = [],
  onArchiveCase,
  addLog,
}) {
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
