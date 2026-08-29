import React, { useState } from "react";
import { AlertOctagon, ExternalLink, Eye, EyeOff } from "lucide-react";

function getBookingElapsedDays(booking) {
  const raw = Number(booking?.daysElapsed ?? 0);
  if (booking?.bookingDate) {
    const date = new Date(`${booking.bookingDate}T00:00:00`);
    if (!Number.isNaN(date.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return Math.max(
        0,
        Math.floor((today.getTime() - date.getTime()) / 86400000),
      );
    }
  }
  return Number.isFinite(raw) ? raw : 0;
}

function getBookingDisplayKey(booking) {
  return [
    booking?.hyeongjeNo || "",
    booking?.suspectName || "",
    booking?.suspectUuid || "",
    booking?.prosecutorName || "",
  ].join("|");
}

export default function BookingLedger({
  bookings,
  onSelectEvidence,
  onSelectSuspect,
}) {
  const [showArchived, setShowArchived] = useState(false);

  const displayBookings = React.useMemo(() => {
    const map = new Map();
    for (const booking of bookings || []) {
      const key = getBookingDisplayKey(booking);
      if (!map.has(key)) {
        map.set(key, booking);
        continue;
      }
      const current = map.get(key);
      const pick =
        (current?.bookingDate || "") < (booking?.bookingDate || "")
          ? booking
          : current;
      map.set(key, pick);
    }
    
    // 1. 입건일자 기준 정렬 (최신순)
    const sorted = [...map.values()].sort((a, b) => {
      const dateA = new Date(`${a.bookingDate || ""}T00:00:00`).getTime();
      const dateB = new Date(`${b.bookingDate || ""}T00:00:00`).getTime();
      return dateB - dateA; // 내림차순 (최신순)
    });

    // 3. 보존처리된 사건 필터링
    if (!showArchived) {
      return sorted.filter((b) => !b.isArchived);
    }
    return sorted;
  }, [bookings, showArchived]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        className="glass-panel gold-border"
        style={{
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <AlertOctagon size={18} color="var(--primary-amber)" />
          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: "1rem",
                color: "var(--text-main)",
              }}
            >
              입건 현황 (입건)
            </div>
            <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
              입건 피의자 수사 진행 및 기소결정 현황
            </div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setShowArchived(!showArchived)}
            style={{
              background: showArchived
                ? "rgba(245, 158, 11, 0.15)"
                : "rgba(200, 200, 200, 0.1)",
              border: `1px solid ${
                showArchived
                  ? "rgba(245, 158, 11, 0.4)"
                  : "rgba(200, 200, 200, 0.2)"
              }`,
              borderRadius: 6,
              padding: "6px 12px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              color: showArchived ? "var(--primary-amber)" : "var(--text-muted)",
              fontSize: "0.75rem",
              fontWeight: 600,
              transition: "all 0.2s ease",
            }}
            title={showArchived ? "보존사건 숨기기" : "보존사건 보이기"}
          >
            {showArchived ? (
              <Eye size={14} />
            ) : (
              <EyeOff size={14} />
            )}
            {showArchived ? "보존사건 표시" : "보존사건 숨김"}
          </button>
          <span className="badge badge-danger">{displayBookings.length}건</span>
        </div>
      </div>

      <div className="glass-panel" style={{ overflow: "hidden" }}>
        <div className="ledger-table-container">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>형제번호</th>
                <th>담당검사</th>
                <th>피의자</th>
                <th>UUID</th>
                <th>처분 현황</th>
                <th>입건일자</th>
                <th>경과 일수</th>
                <th>기소결정</th>
                <th>증거</th>
              </tr>
            </thead>
            <tbody>
              {displayBookings.map((b) => {
                const elapsedDays = getBookingElapsedDays(b);
                return (
                  <tr key={b.id}>
                    <td
                      style={{
                        fontFamily: "monospace",
                        fontWeight: 700,
                        color: "var(--primary-amber)",
                      }}
                    >
                      {b.hyeongjeNo}
                    </td>
                    <td style={{ fontWeight: 700 }}>{b.prosecutorName}</td>
                    <td>
                      <button
                        onClick={() =>
                          onSelectSuspect &&
                          onSelectSuspect({
                            name: b.suspectName,
                            uuid: b.suspectUuid || null,
                          })
                        }
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: "var(--text-main)",
                          fontWeight: 700,
                          textDecoration: "underline dotted",
                        }}
                      >
                        {b.suspectName}
                      </button>
                    </td>
                    <td
                      style={{
                        fontFamily: "monospace",
                        fontSize: "0.72rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      {b.suspectUuid}
                    </td>
                    <td>
                      <span
                        className={`badge ${b.dispositionStatus?.includes("구속") ? "badge-danger" : b.dispositionStatus?.includes("기소") ? "badge-warning" : "badge-info"}`}
                      >
                        {b.dispositionStatus}
                      </span>
                    </td>
                    <td
                      style={{
                        fontFamily: "monospace",
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      {b.bookingDate}
                    </td>
                    <td
                      style={{
                        fontWeight: 700,
                        color:
                          elapsedDays > 30
                            ? "#f87171"
                            : elapsedDays > 14
                              ? "#fcd34d"
                              : "#6ee7b7",
                      }}
                    >
                      {elapsedDays}일
                    </td>
                    <td style={{ maxWidth: 160 }}>
                      <div style={{ whiteSpace: "normal", lineHeight: 1.4 }}>
                        {b.indictmentDecision}
                      </div>
                    </td>
                    <td>
                      <button
                        onClick={() =>
                          onSelectEvidence(
                            b.basisUrl || "",
                            b.hyeongjeNo,
                            b.suspectName,
                          )
                        }
                        className="btn btn-outline"
                        style={{
                          padding: "4px 10px",
                          fontSize: "0.72rem",
                          color: "var(--primary-amber)",
                          border: "1px solid rgba(245,158,11,0.3)",
                        }}
                      >
                        <ExternalLink size={12} />
                        증거
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
  );
}
