import React, { useState, useMemo } from "react";
import { Archive, Search, RefreshCw, AlertCircle, ExternalLink } from "lucide-react";
import { isCaseConcluded } from "../data/prosecutionData";
import { isArchivedCase, matchesCaseNumber } from "../services/caseUtils";

const STATUS_COLOR = (s) => {
  if (!s) return "#94a3b8";
  if (s.includes("구속")) return "#f87171";
  if (s.includes("기소") && !s.includes("불기소")) return "#fb923c";
  if (s.includes("불기소") || s.includes("무혐의")) return "#34d399";
  return "#93c5fd";
};

export default function PreservedCasesLedger({
  ledgerData = [],
  currentUser,
  onSelectEvidence,
  onSelectSuspect,
  onArchiveCase,
}) {
  const [searchQ, setSearchQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [confirmTarget, setConfirmTarget] = useState(null);

  const canUnarchive =
    currentUser &&
    (currentUser.isSuperAdmin ||
      ["SUPER_ADMIN", "PROSECUTOR_GENERAL", "CHIEF_PROSECUTOR", "CHIEF_ADMINISTRATOR"].includes(currentUser.roleLevel) ||
      (currentUser.dept || "").includes("사무국"));

  const archivedCases = useMemo(
    () => (ledgerData || []).filter((c) => isArchivedCase(c)),
    [ledgerData],
  );

  const stats = useMemo(() => ({
    total: archivedCases.length,
    concluded: archivedCases.filter(isCaseConcluded).length,
    indicted: archivedCases.filter((c) => {
      const d = c.disposition || "";
      return d.includes("기소") && !d.includes("불기소");
    }).length,
  }), [archivedCases]);

  const filtered = useMemo(() => {
    const q = searchQ.toLowerCase().trim();
    return archivedCases.filter((c) => {
      const matchQ =
        !q ||
        matchesCaseNumber(c, q) ||
        (c.suspectName || "").toLowerCase().includes(q) ||
        (c.prosecutorName || "").toLowerCase().includes(q) ||
        (c.chargeName || "").toLowerCase().includes(q) ||
        (c.suspectUuid || "").toLowerCase().includes(q);

      let matchStatus = true;
      if (statusFilter === "CONCLUDED") matchStatus = isCaseConcluded(c);
      else if (statusFilter === "INDICTED") {
        const d = c.disposition || "";
        matchStatus = d.includes("기소") && !d.includes("불기소");
      }

      return matchQ && matchStatus;
    });
  }, [archivedCases, searchQ, statusFilter]);

  const handleReset = () => {
    setSearchQ("");
    setStatusFilter("ALL");
  };

  const doUnarchive = () => {
    if (!confirmTarget || !onArchiveCase) return;
    onArchiveCase(confirmTarget.id, false);
    setConfirmTarget(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {confirmTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div className="glass-panel" style={{ maxWidth: 400, width: "90%", padding: 28, textAlign: "center" }}>
            <div style={{ fontWeight: 800, fontSize: "1rem", color: "var(--text-main)", marginBottom: 10 }}>보존 해제 확인</div>
            <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
              <strong style={{ color: "var(--primary-amber)" }}>
                {confirmTarget.hyeongjeNo || confirmTarget.sujeNo}
              </strong> 사건을 보존 해제하고 원부 목록으로 복원합니다.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button onClick={() => setConfirmTarget(null)} className="btn btn-secondary" style={{ padding: "8px 20px" }}>취소</button>
              <button onClick={doUnarchive} className="btn btn-gold" style={{ padding: "8px 20px" }}>보존 해제</button>
            </div>
          </div>
        </div>
      )}

      <div className="glass-panel gold-border" style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text-main)", display: "flex", alignItems: "center", gap: 8 }}>
              <Archive size={18} color="var(--primary-amber)" />
              보존사건 기록 서고
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>
              보존 처리된 사건 기록을 전체 열람할 수 있습니다. 종국·불기소 등 처분 완료 사건이 보관됩니다.
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            {[
              { label: "보존 전체", value: stats.total, color: "#f59e0b" },
              { label: "종국·불기소", value: stats.concluded, color: "#34d399" },
              { label: "기소", value: stats.indicted, color: "#fb923c" },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "1.3rem", fontWeight: 900, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        <form onSubmit={(e) => e.preventDefault()} style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
            <input
              className="input-field"
              style={{ paddingLeft: 36, fontSize: "0.85rem" }}
              placeholder="사건번호, 피의자, 담당검사, 죄명, UUID 검색..."
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
            />
          </div>
          <select
            className="select-field"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 150, flexShrink: 0 }}
          >
            <option value="ALL">전체 처분</option>
            <option value="CONCLUDED">종국·불기소</option>
            <option value="INDICTED">기소</option>
          </select>
          {(searchQ || statusFilter !== "ALL") && (
            <button type="button" onClick={handleReset} className="btn btn-secondary" style={{ flexShrink: 0, fontSize: "0.78rem", gap: 4 }}>
              <RefreshCw size={13} /> 초기화
            </button>
          )}
        </form>
      </div>

      <div style={{ fontSize: "0.82rem", color: "var(--text-muted)", padding: "0 4px" }}>
        보존 사건: <strong style={{ color: "var(--primary-amber)" }}>{filtered.length}건</strong>
        {searchQ && <> · '{searchQ}' 검색 결과</>}
      </div>

      <div className="glass-panel" style={{ overflow: "hidden" }}>
        {filtered.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-muted)" }}>
            <AlertCircle size={36} color="var(--primary-amber)" style={{ margin: "0 auto 12px", opacity: 0.7 }} />
            <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text-main)", marginBottom: 4 }}>
              {archivedCases.length === 0 ? "보존된 사건이 없습니다." : "검색 조건에 해당하는 보존 사건이 없습니다."}
            </div>
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.82rem" }}>
            <thead>
              <tr style={{ background: "var(--bg-elevated)", borderBottom: "1px solid var(--border-subtle)" }}>
                {["사건번호", "피의자", "죄명", "처분", "담당검사", "보존일", "보존자", ""].map((h) => (
                  <th key={h} style={{ padding: "10px 14px", textAlign: "left", fontWeight: 700, color: "var(--text-muted)", fontSize: "0.75rem" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const statusColor = STATUS_COLOR(c.disposition || c.bookingStatus);
                return (
                  <tr key={c.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                    <td style={{ padding: "10px 14px", fontFamily: "monospace", color: "var(--primary-amber)", fontWeight: 700 }}>
                      {c.hyeongjeNo && c.hyeongjeNo !== "-" && c.sujeNo
                        ? `${c.hyeongjeNo}(${c.sujeNo})`
                        : c.hyeongjeNo || c.sujeNo || "-"}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <button
                        onClick={() => onSelectSuspect?.({ name: c.suspectName, uuid: c.suspectUuid })}
                        style={{ background: "none", border: "none", cursor: "pointer", padding: 0, textAlign: "left" }}
                      >
                        <div style={{ fontWeight: 700, color: "var(--text-main)", textDecoration: "underline dotted" }}>
                          {c.suspectName || "-"}
                        </div>
                      </button>
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text-muted)" }}>{c.chargeName || "-"}</td>
                    <td style={{ padding: "10px 14px" }}>
                      <span className="badge" style={{ background: `${statusColor}20`, color: statusColor, fontSize: "0.72rem" }}>
                        {c.disposition || c.bookingStatus || "-"}
                      </span>
                      {isCaseConcluded(c) && (
                        <span className="badge" style={{ marginLeft: 4, background: "rgba(52,211,153,0.15)", color: "#34d399", fontSize: "0.65rem" }}>
                          종국
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text-muted)" }}>{c.prosecutorName || "-"}</td>
                    <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontFamily: "monospace", fontSize: "0.75rem" }}>
                      {c.archivedAt ? c.archivedAt.slice(0, 10) : "-"}
                    </td>
                    <td style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: "0.75rem" }}>
                      {c.archivedBy || "-"}
                    </td>
                    <td style={{ padding: "10px 14px", display: "flex", gap: 6 }}>
                      {c.bookingBasis?.includes("http") && (
                        <button
                          onClick={() => onSelectEvidence?.(c.bookingBasis, c.hyeongjeNo, c.suspectName)}
                          className="btn btn-outline"
                          style={{ padding: "4px 8px", fontSize: "0.68rem", gap: 3 }}
                        >
                          <ExternalLink size={11} /> 증거
                        </button>
                      )}
                      {canUnarchive && onArchiveCase && (
                        <button
                          onClick={() => setConfirmTarget(c)}
                          className="btn btn-outline"
                          style={{ fontSize: "0.68rem", padding: "4px 8px", color: "#34d399", border: "1px solid rgba(52,211,153,0.4)" }}
                        >
                          보존 해제
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
