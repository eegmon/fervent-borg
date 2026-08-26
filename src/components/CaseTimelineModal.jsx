import React, { useState, useEffect } from "react";
import {
  Clock,
  X,
  FileCheck,
  Shield,
  FileText,
  Scale,
  User,
  AlertCircle,
  ExternalLink,
  CheckCircle2,
  GitCommit,
  BookOpen,
  Send,
  Building,
} from "lucide-react";
import { fetchEvidence, fetchWarrants } from "../services/api";

export default function CaseTimelineModal({
  isOpen,
  onClose,
  caseItem,
  reportsData = [],
  bookingsData = [],
  approvalsData = [],
  appealsData = [],
  onSelectEvidence,
}) {
  const [warrants, setWarrants] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(false);

  const targetCaseNo =
    (caseItem?.sujeNo && caseItem.sujeNo !== "-" ? caseItem.sujeNo : null) ||
    (caseItem?.hyeongjeNo && caseItem.hyeongjeNo !== "-" ? caseItem.hyeongjeNo : null) ||
    caseItem?.hyeongjeNo ||
    "";

  useEffect(() => {
    if (!isOpen || !targetCaseNo) return;
    setLoading(true);

    const caseNos = [targetCaseNo, caseItem?.hyeongjeNo, caseItem?.sujeNo].filter(
      (n) => n && n !== "-",
    );

    Promise.all([
      fetchWarrants().catch(() => []),
      fetchEvidence(targetCaseNo).catch(() => []),
    ]).then(([wData, eData]) => {
      // fetchWarrants는 전체 목록을 반환하므로 해당 사건 번호로 클라이언트 필터링
      const filteredWarrants = Array.isArray(wData)
        ? wData.filter((w) =>
            caseNos.includes(w.hyeongjeNo) || caseNos.includes(w.sujeNo),
          )
        : [];
      setWarrants(filteredWarrants);
      setEvidence(Array.isArray(eData) ? eData : []);
      setLoading(false);
    });
  }, [isOpen, targetCaseNo, caseItem?.hyeongjeNo, caseItem?.sujeNo]);

  if (!isOpen || !caseItem) return null;

  // Build Chronological Timeline Events
  const events = [];

  // 1. 입건 / 접수 이벤트
  const bookingMatch = bookingsData.find(
    (b) =>
      (b.hyeongjeNo && b.hyeongjeNo === targetCaseNo) ||
      (b.sujeNo && b.sujeNo === targetCaseNo) ||
      (b.hyeongjeNo && b.hyeongjeNo === caseItem.hyeongjeNo) ||
      (b.sujeNo && b.sujeNo === caseItem.sujeNo),
  );
  const reportMatch = reportsData.find(
    (r) =>
      (r.hyeongjeNo && r.hyeongjeNo === targetCaseNo) ||
      (r.sujeNo && r.sujeNo === targetCaseNo) ||
      (r.hyeongjeNo && r.hyeongjeNo === caseItem.hyeongjeNo) ||
      (r.sujeNo && r.sujeNo === caseItem.sujeNo),
  );

  const bookingDate =
    caseItem.bookingDate ||
    bookingMatch?.bookingDate ||
    reportMatch?.createdAt ||
    "2026-01-01";

  events.push({
    id: "evt-intake",
    stage: "INTAKE",
    stageLabel: "1단계: 사건 접수 및 배당",
    date: bookingDate,
    title: `사건 접수 (${caseItem.sujeNo || caseItem.hyeongjeNo})`,
    desc: `피의자 ${caseItem.suspectName} (${caseItem.suspectUuid || "UUID 미지정"}) - ${caseItem.chargeName || "죄명 미지정"} 사건 접수 완료.`,
    actor: `담당검사 ${caseItem.prosecutorName || "-"}`,
    type: "info",
    icon: BookOpen,
    details: [
      { label: "수사번호", val: caseItem.sujeNo || "-" },
      { label: "공식사건번호", val: caseItem.hyeongjeNo || "-" },
      { label: "접수 근거", val: caseItem.bookingBasis || reportMatch?.basisUrl || "-" },
    ],
  });

  // 2. 영장 이벤트들
  warrants.forEach((w, idx) => {
    events.push({
      id: `evt-warrant-${w.id || idx}`,
      stage: "WARRANT",
      stageLabel: "2단계: 영장 청구",
      date: w.requestedAt || w.createdAt || bookingDate,
      title: `${w.warrantType || "영장"} 청구 — ${w.status || "청구중"}`,
      desc: `피의자 ${w.suspectName} 대상 ${w.warrantType} 청구 건 (영장번호: ${w.warrantNo || "-"}).`,
      actor: `청구검사 ${w.prosecutorName || caseItem.prosecutorName}`,
      type: w.status?.includes("발부") ? "success" : w.status?.includes("기각") ? "danger" : "warning",
      icon: Shield,
      details: [
        { label: "발부일자", val: w.issuedAt || "-" },
        { label: "구금/수색 장소", val: w.location || "-" },
        { label: "기각 사유", val: w.rejectReason || "-" },
      ],
    });
  });

  // 3. 증거 제출 이벤트들
  evidence.forEach((e, idx) => {
    events.push({
      id: `evt-evid-${e.id || idx}`,
      stage: "EVIDENCE",
      stageLabel: "3단계: 증거 제출",
      date: e.createdAt || bookingDate,
      title: `증거 수집: ${e.title}`,
      desc: e.description || "제출된 관련 증거 사본 목록.",
      actor: `제출자 ${e.submittedBy || caseItem.prosecutorName}`,
      type: "info",
      icon: FileText,
      url: e.url,
      details: [
        { label: "증거 분류", val: e.category || "일반 증거" },
        { label: "증거 링크", val: e.url || "-" },
      ],
    });
  });

  // 4. 전자 결재 문서 이벤트들
  const matchingApprovals = approvalsData.filter(
    (app) =>
      (app.hyeongjeNo && (app.hyeongjeNo === targetCaseNo || app.hyeongjeNo === caseItem.hyeongjeNo || app.hyeongjeNo === caseItem.sujeNo)) ||
      (app.sujeNo && (app.sujeNo === targetCaseNo || app.sujeNo === caseItem.sujeNo)),
  );

  matchingApprovals.forEach((app, idx) => {
    events.push({
      id: `evt-app-${app.id || idx}`,
      stage: "APPROVAL",
      stageLabel: "4단계: 전자 결재",
      date: app.createdAt || bookingDate,
      title: `전자결재 ${app.status} (${app.docNo || "결재문서"})`,
      desc: `[${app.dispositionType || app.docTypeName}] ${app.title || app.summary}`,
      actor: `상신자 ${app.prosecutorName || caseItem.prosecutorName}`,
      type: app.status?.includes("승인") ? "success" : app.status?.includes("반려") ? "danger" : "warning",
      icon: FileCheck,
      details: [
        { label: "결재 상태", val: app.status },
        { label: "최종 승인자", val: app.approvedBy || "-" },
        {
          label: "결재 라인",
          val: (app.approvals || []).map((s) => `${s.role}:${s.name}(${s.status})`).join(" ➔ "),
        },
      ],
    });
  });

  // 5. 종국 처분 이벤트
  if (caseItem.disposition && caseItem.disposition !== "수사중" && caseItem.disposition !== "-") {
    events.push({
      id: "evt-disposition",
      stage: "DISPOSITION",
      stageLabel: "5단계: 검찰 처분 확정",
      date: caseItem.dispositionDate || bookingDate,
      title: `검찰 처분: ${caseItem.disposition}`,
      desc: `피의자 ${caseItem.suspectName}에 대하여 [${caseItem.disposition}] 처분이 최종 확정/날인되었습니다.`,
      actor: `주임검사 ${caseItem.prosecutorName}`,
      type: caseItem.disposition.includes("구속") || caseItem.disposition.includes("기소")
        ? "success"
        : "warning",
      icon: Scale,
      details: [
        { label: "처분 구분", val: caseItem.disposition },
        { label: "관인 날인", val: caseItem.disposition.includes("결재완료") ? "검찰청 관인 완료" : "사무국 관인" },
      ],
    });
  }

  // 6. 1심/2심/3심 법원 재판 및 항고 이벤트
  if (caseItem.court1No && caseItem.court1No !== "-") {
    events.push({
      id: "evt-court-1",
      stage: "COURT",
      stageLabel: "6단계: 1심 법원 재판",
      date: caseItem.court1Date || caseItem.dispositionDate || bookingDate,
      title: `🏛️ 1심 법원 판결 (${caseItem.court1No})`,
      desc: `1심 재판 결과: ${caseItem.court1Result || "심리 진행 중"} ${caseItem.court1Appealed ? `(항소 여부: ${caseItem.court1Appealed})` : ""}`,
      actor: `담당 관할 법원`,
      type: caseItem.court1Result?.includes("유죄") || caseItem.court1Result?.includes("징역") || caseItem.court1Result?.includes("벌금")
        ? "success"
        : caseItem.court1Result?.includes("무죄")
        ? "warning"
        : "info",
      icon: Building,
      url: caseItem.court1Doc && caseItem.court1Doc.includes("http") ? caseItem.court1Doc : null,
      details: [
        { label: "1심 사건번호", val: caseItem.court1No },
        { label: "1심 재판결과", val: caseItem.court1Result || "심리중" },
        { label: "항소 여부", val: caseItem.court1Appealed || "-" },
        { label: "항소장", val: caseItem.court1Appellant || "-" },
      ],
    });
  }

  if (caseItem.court2No && caseItem.court2No !== "-") {
    events.push({
      id: "evt-court-2",
      stage: "COURT",
      stageLabel: "7단계: 2심 항소심 재판",
      date: caseItem.court2Date || caseItem.court1Date || bookingDate,
      title: `🏛️ 2심 항소심 판결 (${caseItem.court2No})`,
      desc: `2심 재판 결과: ${caseItem.court2Result || "심리 진행 중"} ${caseItem.court2Dismissed ? `(항소기각: ${caseItem.court2Dismissed})` : ""}`,
      actor: `고등법원 항소부`,
      type: "info",
      icon: Building,
      url: caseItem.court2Doc && caseItem.court2Doc.includes("http") ? caseItem.court2Doc : null,
      details: [
        { label: "2심 사건번호", val: caseItem.court2No },
        { label: "2심 재판결과", val: caseItem.court2Result || "심리중" },
        { label: "항소기각 여부", val: caseItem.court2Dismissed || "-" },
        { label: "상고 여부", val: caseItem.court3Appealed || "-" },
      ],
    });
  }

  if (caseItem.court3No && caseItem.court3No !== "-") {
    events.push({
      id: "evt-court-3",
      stage: "COURT",
      stageLabel: "8단계: 3심 상고심 판결",
      date: caseItem.court3Date || caseItem.court2Date || bookingDate,
      title: `🏛️ 3심 상고심 판결 (${caseItem.court3No})`,
      desc: `3심 재판 결과: ${caseItem.court3Result || "심리 진행 중"} ${caseItem.court3Remanded ? `(파기환송: ${caseItem.court3Remanded})` : ""}`,
      actor: `대법원 상고부`,
      type: "success",
      icon: Building,
      url: caseItem.court3Doc && caseItem.court3Doc.includes("http") ? caseItem.court3Doc : null,
      details: [
        { label: "3심 사건번호", val: caseItem.court3No },
        { label: "3심 재판결과", val: caseItem.court3Result || "심리중" },
        { label: "파기환송 여부", val: caseItem.court3Remanded || "-" },
      ],
    });
  }

  const matchingAppeals = appealsData.filter(
    (a) =>
      (a.hyeongjeNo && (a.hyeongjeNo === targetCaseNo || a.hyeongjeNo === caseItem.hyeongjeNo)) ||
      (a.sujeNo && (a.sujeNo === targetCaseNo || a.sujeNo === caseItem.sujeNo)) ||
      (a.caseNo && (a.caseNo === targetCaseNo || a.caseNo === caseItem.hyeongjeNo)),
  );
  matchingAppeals.forEach((app, idx) => {
    events.push({
      id: `evt-appeal-${app.id || idx}`,
      stage: "APPEAL",
      stageLabel: "불복 항고 절차",
      date: app.receivedDate || app.createdAt || bookingDate,
      title: `불복 항고 접수 (${app.appealNo || "항고건"})`,
      desc: `항고인 ${app.appellantName || "피의자/고소인"} — 항고 상태: ${app.appealStatus || app.status}`,
      actor: `고검 담당: ${app.prosecutorName || "-"}`,
      type: app.status?.includes("인용") ? "success" : "warning",
      icon: Send,
      details: [
        { label: "항고 상태", val: app.appealStatus || app.status },
        { label: "처분 결과", val: app.result || "-" },
      ],
    });
  });

  // Sort events by date ascending
  events.sort((a, b) => new Date(a.date) - new Date(b.date));

  // Determine current active stage index
  const hasIntake = events.some((e) => e.stage === "INTAKE");
  const hasWarrant = events.some((e) => e.stage === "WARRANT");
  const hasApproval =
    events.some((e) => e.stage === "APPROVAL") ||
    events.some((e) => e.stage === "EVIDENCE");
  const hasDisposition = events.some((e) => e.stage === "DISPOSITION");
  const hasCourt = Boolean(
    (caseItem.court1No && caseItem.court1No !== "-") ||
    (caseItem.court2No && caseItem.court2No !== "-") ||
    (caseItem.court3No && caseItem.court3No !== "-")
  );
  const hasAppeal = matchingAppeals.length > 0 || hasCourt;

  const currentStageIndex = hasCourt ? 5 : hasAppeal ? 5 : hasDisposition ? 4 : hasApproval ? 3 : hasWarrant ? 2 : 1;

  const stages = [
    { num: 1, label: "입건·배당", done: hasIntake },
    { num: 2, label: "영장 청구", done: hasWarrant },
    { num: 3, label: "증거·결재", done: hasApproval },
    { num: 4, label: "처분 확정", done: hasDisposition },
    { num: 5, label: "재판·항고", done: hasAppeal },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(3, 7, 18, 0.85)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        className="glass-panel gold-border"
        style={{
          width: "100%",
          maxWidth: 780,
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 25px 60px rgba(0,0,0,0.8)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(15, 23, 42, 0.6)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "rgba(245,158,11,0.15)",
                border: "1px solid rgba(245,158,11,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Clock size={20} color="var(--primary-amber)" />
            </div>
            <div>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: "1.05rem",
                  color: "var(--text-main)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                사건 처리 타임라인
                <span
                  style={{
                    fontFamily: "monospace",
                    fontSize: "0.85rem",
                    color: "var(--primary-amber)",
                    background: "rgba(245,158,11,0.1)",
                    padding: "2px 8px",
                    borderRadius: 6,
                    border: "1px solid rgba(245,158,11,0.3)",
                  }}
                >
                  {caseItem.hyeongjeNo || caseItem.sujeNo}
                </span>
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 2 }}>
                피의자: <strong style={{ color: "var(--text-main)" }}>{caseItem.suspectName}</strong> · 담당검사:{" "}
                <strong style={{ color: "#60a5fa" }}>{caseItem.prosecutorName}</strong> · 죄명: {caseItem.chargeName}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              padding: 4,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Step Progress Bar */}
        <div
          style={{
            padding: "14px 24px",
            background: "var(--bg-elevated)",
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {stages.map((st, idx) => {
              const isCurrent = currentStageIndex === st.num;
              return (
                <React.Fragment key={st.num}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      opacity: st.done || isCurrent ? 1 : 0.4,
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: st.done
                          ? "var(--primary-amber)"
                          : isCurrent
                          ? "rgba(245,158,11,0.2)"
                          : "var(--bg-card)",
                        color: st.done ? "#000" : "var(--primary-amber)",
                        border: isCurrent ? "2px solid var(--primary-amber)" : "1px solid var(--border-subtle)",
                        fontSize: "0.72rem",
                        fontWeight: 900,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {st.done ? "✓" : st.num}
                    </div>
                    <span
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: isCurrent || st.done ? 800 : 500,
                        color: isCurrent ? "var(--primary-amber)" : st.done ? "var(--text-main)" : "var(--text-muted)",
                      }}
                    >
                      {st.label}
                    </span>
                  </div>
                  {idx < stages.length - 1 && (
                    <div
                      style={{
                        flex: 1,
                        height: 2,
                        margin: "0 10px",
                        background: stages[idx + 1].done
                          ? "var(--primary-amber)"
                          : "var(--border-subtle)",
                      }}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* Timeline Events Body */}
        <div style={{ padding: 24, overflowY: "auto", flex: 1 }}>
          {loading ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
              사건 이력 수집 중...
            </div>
          ) : (
            <div style={{ position: "relative", paddingLeft: 24 }}>
              {/* Vertical Line */}
              <div
                style={{
                  position: "absolute",
                  left: 9,
                  top: 8,
                  bottom: 8,
                  width: 2,
                  background: "linear-gradient(to bottom, var(--primary-amber), rgba(245,158,11,0.2))",
                }}
              />

              {events.map((evt, idx) => {
                const IconComp = evt.icon || GitCommit;
                return (
                  <div
                    key={evt.id}
                    style={{
                      position: "relative",
                      marginBottom: idx === events.length - 1 ? 0 : 20,
                    }}
                  >
                    {/* Circle Node */}
                    <div
                      style={{
                        position: "absolute",
                        left: -24,
                        top: 2,
                        width: 20,
                        height: 20,
                        borderRadius: "50%",
                        background: evt.type === "danger"
                          ? "#ef4444"
                          : evt.type === "success"
                          ? "#10b981"
                          : evt.type === "warning"
                          ? "var(--primary-amber)"
                          : "#60a5fa",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: "0 0 10px rgba(0,0,0,0.5)",
                      }}
                    >
                      <IconComp size={11} color="#000" />
                    </div>

                    {/* Content Card */}
                    <div
                      style={{
                        background: "var(--bg-elevated)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: 10,
                        padding: "12px 16px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 800,
                            color: "var(--primary-amber)",
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                          }}
                        >
                          {evt.stageLabel}
                        </span>
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: "0.72rem",
                            color: "var(--text-muted)",
                          }}
                        >
                          {evt.date}
                        </span>
                      </div>

                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: "0.9rem",
                          color: "var(--text-main)",
                          marginBottom: 4,
                        }}
                      >
                        {evt.title}
                      </div>

                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "var(--text-muted)",
                          lineHeight: 1.5,
                          marginBottom: 8,
                        }}
                      >
                        {evt.desc}
                      </div>

                      {/* Details Grid */}
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 10,
                          paddingTop: 8,
                          borderTop: "1px dashed var(--border-subtle)",
                          fontSize: "0.73rem",
                        }}
                      >
                        <span style={{ color: "#60a5fa", fontWeight: 700 }}>
                          👤 {evt.actor}
                        </span>
                        {evt.details.map((d, i) => (
                          <span key={i} style={{ color: "var(--text-muted)" }}>
                            <strong>{d.label}:</strong> {d.val}
                          </span>
                        ))}
                        {evt.url && (
                          <button
                            onClick={() => onSelectEvidence?.(evt.url, caseItem.hyeongjeNo, caseItem.suspectName)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#60a5fa",
                              cursor: "pointer",
                              fontSize: "0.73rem",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                              padding: 0,
                            }}
                          >
                            <ExternalLink size={11} /> 증거 보기
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 24px",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            justifyContent: "flex-end",
            background: "rgba(15, 23, 42, 0.6)",
          }}
        >
          <button onClick={onClose} className="btn btn-secondary" style={{ padding: "8px 16px", fontSize: "0.82rem" }}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
