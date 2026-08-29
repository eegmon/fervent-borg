import React, { useState, useMemo } from "react";
import {
  X,
  Bell,
  ShieldAlert,
  Clock,
  AlertTriangle,
  Scale,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import {
  calculateStatuteOfLimitations,
  isCaseClosedOrIndicted,
} from "../data/prosecutionData";

export default function DeadlineAlertModal({
  isOpen,
  onClose,
  ledgerData = [],
  appealsData = [],
  approvalsData = [],
  onNavigateTab,
}) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState("ALL");

  // Compute all deadline alerts dynamically
  const alerts = useMemo(() => {
    const list = [];
    const today = new Date();

    // 1. 구속 기간 만료 (도스온라인 소송법 제14조제6항: 48시간 이내 기소 제한)
    ledgerData.forEach((c) => {
      // 이미 종국 처분되었거나 기소된 사건은 48시간 영장 기한 경보 대상에서 제외
      if (isCaseClosedOrIndicted(c)) return;

      const statusStr = (c.bookingStatus || "").trim();
      // '불구속' / '미구속' 제외, 체포·구속영장 발부 포함
      const isArrested =
        (statusStr.includes("구속") &&
          !statusStr.includes("불구속") &&
          !statusStr.includes("미구속")) ||
        statusStr.includes("체포영장") ||
        statusStr.includes("구속영장");

      if (isArrested) {
        const baseDate = c.bookingDate
          ? new Date(c.bookingDate.replace(/\./g, "-"))
          : new Date();
        const expireDate = new Date(baseDate.getTime() + 48 * 60 * 60 * 1000);
        const diffHours = Math.ceil((expireDate - today) / (1000 * 60 * 60));

        let urgency = "INFO";
        if (diffHours <= 12) urgency = "CRITICAL";
        else if (diffHours <= 24) urgency = "WARNING";

        const displayNo =
          c.sujeNo && c.sujeNo !== "-" ? c.sujeNo : c.hyeongjeNo;

        list.push({
          id: `ARREST-${c.id}`,
          category: "ARREST",
          categoryLabel: "🚨 구속 48시간 기한 (소송법 제14조)",
          title: `${displayNo} | 피의자 ${c.suspectName} 구속 48시간 기한 임박`,
          desc: `소송법 제14조제6항: 구속 피의자 48시간 이내 미기소 시 즉시 석방 (담당: ${c.prosecutorName || "미지정"})`,
          dDay: diffHours <= 0 ? "석방 대상 (만료)" : `${diffHours}시간 남음`,
          dDayVal: diffHours,
          urgency,
          targetTab: "mycases",
          caseNo: displayNo,
        });
      }
    });

    // 2. 검찰 항고/재항고 처리 기한 (검찰청법 제10조: 7일 이내 기한)
    appealsData.forEach((a) => {
      if (
        (a.appealStatus || a.status || "").includes("접수") ||
        (a.appealStatus || a.status || "").includes("심리")
      ) {
        const baseDate = a.appealDate
          ? new Date(a.appealDate.replace(/\./g, "-"))
          : new Date();
        const limitDate = new Date(
          baseDate.getTime() + 7 * 24 * 60 * 60 * 1000,
        );
        const diffDays = Math.ceil((limitDate - today) / (1000 * 60 * 60 * 24));

        let urgency = "INFO";
        if (diffDays <= 1) urgency = "CRITICAL";
        else if (diffDays <= 3) urgency = "WARNING";

        list.push({
          id: `APPEAL-${a.id}`,
          category: "APPEAL",
          categoryLabel: "⚖️ 항고 7일 처리기한 (검찰청법 제10조)",
          title: `${a.jibulhangNo || a.appealNo || "항고사건"}호 | 검사장 항고 경정/결정 7일 법정기한`,
          desc: `검찰청법 제10조제3항: 항고 후 7일 내 미처분 시 총장 재항고 대상 (검사장: ${a.chiefProsecutor || "-"})`,
          dDay: diffDays <= 0 ? "7일 경과 (재항고 사유)" : `D-${diffDays}`,
          dDayVal: diffDays,
          urgency,
          targetTab: "appeals",
          caseNo: a.jibulhangNo || a.appealNo,
        });
      }
    });

    // 3. 미결재 문서 (Pending Approvals)
    approvalsData.forEach((doc) => {
      if (
        (doc.status || "").includes("대기") ||
        (doc.status || "").includes("진행")
      ) {
        list.push({
          id: `APPROVAL-${doc.id}`,
          category: "APPROVAL",
          categoryLabel: "📄 전자 결재 대기",
          title: `[미결재] ${doc.title || doc.docNo || "결재문서"}`,
          desc: `상신자: ${doc.createdBy || doc.prosecutorName || "담당검사"} · 작성일: ${doc.createdAt || "오늘"}`,
          dDay: "결재대기",
          dDayVal: 1,
          urgency: "WARNING",
          targetTab: "approvals",
          caseNo: doc.docNo,
        });
      }
    });

    // 4. 공소시효 (도스온라인 소송법 제21조의2, 제21조의3 기준)
    ledgerData.forEach((c) => {
      // 종국 처분되었거나 이미 기소된 사건은 공소시효 만료 경보 대상에서 제외
      if (isCaseClosedOrIndicted(c)) return;

      const sol = calculateStatuteOfLimitations(
        c.chargeName,
        c.incidentDate || c.bookingDate,
      );

      let urgency = "INFO";
      if (sol.dDay <= 3) urgency = "CRITICAL";
      else if (sol.dDay <= 7) urgency = "WARNING";

      list.push({
        id: `STATUTE-${c.id}`,
        category: "STATUTE",
        categoryLabel: "⏳ 공소시효 D-day (소송법)",
        title: `${c.hyeongjeNo}호 | ${c.suspectName} (${c.chargeName || "범죄"}) 공소시효 계산`,
        desc: `${sol.lawArticle} · 법정시효: ${sol.periodDays}일 · 시효 만료 예정일: ${sol.expireDateStr} (담당: ${c.prosecutorName || "미지정"})`,
        dDay: sol.dDayText,
        dDayVal: sol.dDay,
        urgency,
        targetTab: "mycases",
        caseNo: c.hyeongjeNo,
      });
    });

    // Sort by urgency and D-day value
    return list.sort((a, b) => {
      const uOrder = { CRITICAL: 0, WARNING: 1, INFO: 2 };
      if (uOrder[a.urgency] !== uOrder[b.urgency]) {
        return uOrder[a.urgency] - uOrder[b.urgency];
      }
      return a.dDayVal - b.dDayVal;
    });
  }, [ledgerData, appealsData, approvalsData]);

  // Tab Filtering
  const filteredAlerts = useMemo(() => {
    if (activeTab === "ALL") return alerts;
    return alerts.filter((a) => a.category === activeTab);
  }, [alerts, activeTab]);

  const criticalCount = alerts.filter((a) => a.urgency === "CRITICAL").length;
  const warningCount = alerts.filter((a) => a.urgency === "WARNING").length;

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
          maxWidth: 760,
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          borderRadius: 16,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-elevated)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
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
              <Bell size={20} color="var(--primary-amber)" />
              검찰 사건 법정 기한 & 긴급 알림 대시보드
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--text-muted)",
                marginTop: 2,
              }}
            >
              구속 기한 만료, 공소시효, 항고 처리 법정 기한 및 미결재 문서 관리
            </div>
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

        {/* Urgency Summary Bar */}
        <div
          style={{
            padding: "12px 24px",
            background: "rgba(245,158,11,0.06)",
            borderBottom: "1px solid rgba(245,158,11,0.15)",
            display: "flex",
            gap: 14,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.8rem",
              fontWeight: 800,
              color: "#ef4444",
            }}
          >
            <ShieldAlert size={16} /> 긴급 처리 필요 ({criticalCount}건)
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: "0.8rem",
              fontWeight: 700,
              color: "#f59e0b",
            }}
          >
            <AlertTriangle size={16} /> 주의 / 진행 경보 ({warningCount}건)
          </div>
          <div
            style={{
              marginLeft: "auto",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
            }}
          >
            총 경보 알림:{" "}
            <strong style={{ color: "var(--primary-amber)" }}>
              {alerts.length}건
            </strong>
          </div>
        </div>

        {/* Category Tabs */}
        <div
          style={{
            padding: "10px 24px",
            display: "flex",
            gap: 8,
            borderBottom: "1px solid var(--border-subtle)",
            background: "var(--bg-card)",
          }}
        >
          {[
            { id: "ALL", label: `전체 (${alerts.length})` },
            {
              id: "ARREST",
              label: `🚨 구속 기한만료 (${alerts.filter((a) => a.category === "ARREST").length})`,
            },
            {
              id: "STATUTE",
              label: `⏳ 공소시효 (${alerts.filter((a) => a.category === "STATUTE").length})`,
            },
            {
              id: "APPEAL",
              label: `⚖️ 항고 심리기한 (${alerts.filter((a) => a.category === "APPEAL").length})`,
            },
            {
              id: "APPROVAL",
              label: `📄 미결재 (${alerts.filter((a) => a.category === "APPROVAL").length})`,
            },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className="btn"
              style={{
                fontSize: "0.78rem",
                padding: "5px 12px",
                background:
                  activeTab === t.id
                    ? "var(--primary-amber)"
                    : "rgba(255,255,255,0.05)",
                color: activeTab === t.id ? "#000" : "var(--text-main)",
                fontWeight: activeTab === t.id ? 800 : 500,
                border: "none",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Alert List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          {filteredAlerts.length === 0 ? (
            <div
              style={{
                padding: 48,
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: "0.85rem",
              }}
            >
              해당되는 법정 기한 경보 항목이 없습니다.
            </div>
          ) : (
            filteredAlerts.map((item) => {
              const isCritical = item.urgency === "CRITICAL";
              const isWarning = item.urgency === "WARNING";
              const badgeColor = isCritical
                ? "#ef4444"
                : isWarning
                  ? "#f59e0b"
                  : "#3b82f6";

              return (
                <div
                  key={item.id}
                  style={{
                    padding: "14px 18px",
                    borderRadius: 12,
                    background: isCritical
                      ? "rgba(239,68,68,0.08)"
                      : "var(--bg-elevated)",
                    border: isCritical
                      ? "1px solid rgba(239,68,68,0.3)"
                      : "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    transition: "all 0.15s",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      flex: 1,
                    }}
                  >
                    <span
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        fontWeight: 900,
                        fontSize: "0.78rem",
                        background: `${badgeColor}20`,
                        color: badgeColor,
                        border: `1px solid ${badgeColor}40`,
                        fontFamily: "monospace",
                        flexShrink: 0,
                      }}
                    >
                      {item.dDay}
                    </span>
                    <div>
                      <div
                        style={{
                          fontSize: "0.7rem",
                          color: badgeColor,
                          fontWeight: 800,
                          marginBottom: 2,
                        }}
                      >
                        {item.categoryLabel}
                      </div>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: "0.88rem",
                          color: "var(--text-main)",
                        }}
                      >
                        {item.title}
                      </div>
                      <div
                        style={{
                          fontSize: "0.72rem",
                          color: "var(--text-muted)",
                          marginTop: 2,
                        }}
                      >
                        {item.desc}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (onNavigateTab) onNavigateTab(item.targetTab);
                      onClose();
                    }}
                    className="btn btn-gold"
                    style={{
                      fontSize: "0.75rem",
                      padding: "6px 12px",
                      gap: 4,
                      flexShrink: 0,
                    }}
                  >
                    이동 및 처리 <ChevronRight size={13} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
