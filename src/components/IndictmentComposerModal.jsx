import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Copy,
  Check,
  Printer,
  Download,
  FileText,
  Wand2,
  Plus,
  Trash2,
  ChevronRight,
  Scale,
  ShieldAlert,
  Send,
  Sparkles,
} from "lucide-react";
import { fetchEvidence } from "../services/api";

export default function IndictmentComposerModal({
  isOpen,
  onClose,
  initialCase = null,
  ledgerData = [],
  chargesData = [],
  currentUser,
  showToast,
  onCreateApprovalFromIndictment,
}) {
  if (!isOpen) return null;

  const [selectedCaseId, setSelectedCaseId] = useState(initialCase?.id || "");
  const [courtName, setCourtName] = useState("도스온라인 지방법원 형사부 귀중");
  const [docNo, setDocNo] = useState("");
  const [defendants, setDefendants] = useState([]);
  const [chargesList, setChargesList] = useState([]);
  const [crimeFacts, setCrimeFacts] = useState("");
  const [evidenceList, setEvidenceList] = useState([]);
  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState(new Set());
  const [customEvidenceText, setCustomEvidenceText] = useState("");
  const [confiscationText, setConfiscationText] = useState("");
  const [prosecutorName, setProsecutorName] = useState(currentUser?.name || "담당검사");
  const [prosecutorRank, setProsecutorRank] = useState(currentUser?.rank || "검사");

  const [copied, setCopied] = useState(false);
  const [activeStep, setActiveStep] = useState("FORM"); // FORM | PREVIEW

  const todayStr = new Date().toISOString().slice(0, 10);
  const year = todayStr.slice(0, 4);
  const month = todayStr.slice(5, 7);
  const day = todayStr.slice(8, 10);

  // 사건 선택 시 데이터 자동 로드 및 바인딩
  useEffect(() => {
    const caseItem =
      ledgerData.find((c) => String(c.id) === String(selectedCaseId)) ||
      initialCase;

    if (caseItem) {
      const caseNo = caseItem.sujeNo || caseItem.hyeongjeNo || "";
      setDocNo(caseNo);
      setProsecutorName(caseItem.prosecutorName || currentUser?.name || "담당검사");

      // 피고인 목록 초기화
      let defs = [];
      if (Array.isArray(caseItem.suspects) && caseItem.suspects.length > 0) {
        defs = caseItem.suspects.map((s, idx) => ({
          id: s.id || `def-${idx}`,
          name: s.name || caseItem.suspectName || "",
          uuid: s.uuid || caseItem.suspectUuid || "",
          address: "주거 부정",
          job: "무직",
          detentionStatus: (caseItem.bookingStatus || "").includes("구속") && !(caseItem.bookingStatus || "").includes("불구속")
            ? "구속"
            : "불구속",
        }));
      } else {
        defs = [
          {
            id: "def-0",
            name: caseItem.suspectName || "",
            uuid: caseItem.suspectUuid || "",
            address: "주거 부정",
            job: "무직",
            detentionStatus: (caseItem.bookingStatus || "").includes("구속") && !(caseItem.bookingStatus || "").includes("불구속")
              ? "구속"
              : "불구속",
          },
        ];
      }
      setDefendants(defs);

      // 죄명 및 적용법조 초기화
      const foundCharge = chargesData.find((ch) => ch.name === caseItem.chargeName);
      setChargesList([
        {
          id: "ch-0",
          name: caseItem.chargeName || "형법 위반",
          lawArticle: foundCharge?.lawArticle || "형법 제347조 (사기) 등",
        },
      ]);

      // 공소사실 기본 템플릿 생성
      const defName = defs[0]?.name || "피고인";
      const incDate = caseItem.incidentDate || caseItem.bookingDate || todayStr;
      setCrimeFacts(
        `피고인 ${defName}은(는) ${incDate}경 도스온라인 관할 구역 내에서,\n\n피해자에게 부정한 방법으로 손해를 가할 목적으로 고의로 위법 행위를 감행하여,\n\n이로써 피고인은 ${caseItem.chargeName || "해당 범죄"}의 죄책을 면할 수 없다.`,
      );

      // 압수물
      if (caseItem.confiscation) {
        setConfiscationText(caseItem.confiscation);
      }

      // 증거자료 로드
      if (caseNo) {
        fetchEvidence(caseNo)
          .then((res) => {
            const list = Array.isArray(res) ? res : res?.evidence || [];
            setEvidenceList(list);
            // 기본 전체 선택
            setSelectedEvidenceIds(new Set(list.map((e) => e.id)));
          })
          .catch(() => {});
      }
    }
  }, [selectedCaseId, initialCase, chargesData]);

  // 피고인 추가/삭제
  const handleAddDefendant = () => {
    setDefendants((prev) => [
      ...prev,
      {
        id: `def-${Date.now()}`,
        name: "",
        uuid: "",
        address: "주거 부정",
        job: "무직",
        detentionStatus: "불구속",
      },
    ]);
  };

  const handleRemoveDefendant = (id) => {
    if (defendants.length <= 1) {
      showToast?.("최소 1명의 피고인이 필요합니다.", "error");
      return;
    }
    setDefendants((prev) => prev.filter((d) => d.id !== id));
  };

  // 죄명 추가/삭제
  const handleAddCharge = () => {
    setChargesList((prev) => [
      ...prev,
      { id: `ch-${Date.now()}`, name: "", lawArticle: "" },
    ]);
  };

  const handleRemoveCharge = (id) => {
    if (chargesList.length <= 1) {
      showToast?.("최소 1개의 죄명이 필요합니다.", "error");
      return;
    }
    setChargesList((prev) => prev.filter((c) => c.id !== id));
  };

  // 증거 체크박스 토글
  const toggleEvidence = (id) => {
    setSelectedEvidenceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 공소장 HWP 규격 HTML 생성
  const indictmentHtml = useMemo(() => {
    const selectedEvidences = evidenceList.filter((e) =>
      selectedEvidenceIds.has(e.id),
    );

    const defendantsHtml = defendants
      .map(
        (d, idx) => `
      <tr>
        <td style="border: 1px solid #000; padding: 8px 12px; font-weight: bold; background: #f8fafc; text-align: center; width: 20%;">피 고 인 ${defendants.length > 1 ? idx + 1 : ""}</td>
        <td style="border: 1px solid #000; padding: 8px 12px;" colspan="3">
          <strong>${d.name || "(성명 미상)"}</strong> (UUID: ${d.uuid || "미상"})<br/>
          주거: ${d.address || "주거부정"} · 직업: ${d.job || "무직"}<br/>
          신병 상태: <span style="font-weight: bold; color: ${d.detentionStatus === "구속" ? "#b91c1c" : "#1e3a8a"};">[${d.detentionStatus}]</span>
        </td>
      </tr>
    `,
      )
      .join("");

    const chargeNamesStr = chargesList.map((c) => c.name).filter(Boolean).join(", ");
    const lawArticlesStr = chargesList
      .map((c) => c.lawArticle)
      .filter(Boolean)
      .join("<br/>");

    let evidenceRows = "";
    if (selectedEvidences.length > 0) {
      evidenceRows = selectedEvidences
        .map((e, idx) => `<div>${idx + 1}. ${e.title} (${e.evidenceType || "증거기록"})</div>`)
        .join("");
    }
    if (customEvidenceText) {
      evidenceRows += `<div style="margin-top: 4px;">${customEvidenceText.replace(/\n/g, "<br/>")}</div>`;
    }
    if (!evidenceRows) {
      evidenceRows = "<div>1. 피고인의 일부 법정진술<br/>2. 사법경찰관 작성의 수사보고서 및 관련 증거</div>";
    }

    return `
<div style="font-family: '한컴바탕', 'Batang', serif; max-width: 760px; margin: 0 auto; padding: 40px 30px; background: #fff; color: #000; line-height: 1.8; border: 1px solid #cbd5e1;">
  <div style="text-align: center; margin-bottom: 25px;">
    <div style="font-size: 13pt; letter-spacing: 2px; font-weight: bold; color: #1e3a8a;">도스온라인 검찰청</div>
    <div style="font-size: 26pt; font-weight: 900; letter-spacing: 16px; margin: 15px 0 10px; border-bottom: 2px solid #000; padding-bottom: 12px;">공 소 장</div>
    <div style="font-size: 11pt; text-align: right; color: #475569; font-weight: bold;">사건번호: ${docNo || "2026형제0000호"}</div>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px; font-size: 11pt;">
    ${defendantsHtml}
    <tr>
      <td style="border: 1px solid #000; padding: 8px 12px; font-weight: bold; background: #f8fafc; text-align: center;">죄    명</td>
      <td style="border: 1px solid #000; padding: 8px 12px;" colspan="3"><strong>${chargeNamesStr || "형법 위반"}</strong></td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 8px 12px; font-weight: bold; background: #f8fafc; text-align: center;">적 용 법 조</td>
      <td style="border: 1px solid #000; padding: 8px 12px;" colspan="3">${lawArticlesStr || "소송법 및 형법 해당 조항"}</td>
    </tr>
  </table>

  <div style="margin-bottom: 25px;">
    <div style="font-size: 13pt; font-weight: bold; margin-bottom: 10px; border-bottom: 1.5px solid #000; padding-bottom: 4px; display: inline-block;">
      [ 공 소 사 실 ]
    </div>
    <div style="font-size: 11pt; text-indent: 12px; white-space: pre-wrap; line-height: 2; padding: 4px 6px;">
${crimeFacts || "범죄 사실을 입력해주세요."}
    </div>
  </div>

  <div style="margin-bottom: 25px;">
    <div style="font-size: 13pt; font-weight: bold; margin-bottom: 10px; border-bottom: 1.5px solid #000; padding-bottom: 4px; display: inline-block;">
      [ 증 거 의  요 지 ]
    </div>
    <div style="font-size: 10.5pt; line-height: 1.9; padding: 4px 6px; background: #f8fafc; border-left: 3px solid #1e3a8a;">
      ${evidenceRows}
    </div>
  </div>

  ${
    confiscationText
      ? `
  <div style="margin-bottom: 25px;">
    <div style="font-size: 13pt; font-weight: bold; margin-bottom: 10px; border-bottom: 1.5px solid #000; padding-bottom: 4px; display: inline-block;">
      [ 압 수 물 ]
    </div>
    <div style="font-size: 10.5pt; line-height: 1.8; padding: 4px 6px;">
      ${confiscationText}
    </div>
  </div>`
      : ""
  }

  <div style="margin: 40px 0 20px; font-size: 12pt; text-align: center; font-weight: bold;">
    위와 같이 공소를 제기합니다.
  </div>

  <div style="text-align: center; margin-top: 30px; font-size: 12pt;">
    <div style="margin-bottom: 20px; letter-spacing: 2px;">${year}년 ${month}월 ${day}일</div>
    <div style="font-size: 14pt; font-weight: bold; letter-spacing: 3px;">
      도스온라인 검찰청 ${prosecutorRank} ${prosecutorName}
      <span style="display: inline-block; width: 40px; height: 40px; border: 2.5px solid #b91c1c; border-radius: 50%; color: #b91c1c; font-size: 12px; line-height: 38px; text-align: center; vertical-align: middle; margin-left: 10px; font-weight: 900;">(인)</span>
    </div>
  </div>

  <div style="margin-top: 45px; font-size: 14pt; font-weight: 900; letter-spacing: 4px; text-align: left;">
    ${courtName}
  </div>
</div>
    `.trim();
  }, [
    defendants,
    chargesList,
    docNo,
    crimeFacts,
    evidenceList,
    selectedEvidenceIds,
    customEvidenceText,
    confiscationText,
    year,
    month,
    day,
    prosecutorRank,
    prosecutorName,
    courtName,
  ]);

  // 클립보드 복사
  const handleCopy = async () => {
    try {
      const blob = new Blob([indictmentHtml], { type: "text/html" });
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      showToast?.("📋 공소장 서식 복사 완료! 카페 스마트에디터에 Ctrl+V로 붙여넣기 하세요.", "success");
    } catch (e) {
      showToast?.("복사 실패: " + e.message, "error");
    }
  };

  // 인쇄
  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>공소장 - ${docNo}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { margin: 0; padding: 0; }
        </style>
      </head>
      <body>
        ${indictmentHtml}
        <script>
          window.onload = function() { window.print(); window.close(); }
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  };

  // HWP 파일 다운로드
  const handleDownloadHwp = () => {
    const fullDoc = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>공소장</title>
</head>
<body>
${indictmentHtml}
</body>
</html>`;
    const blob = new Blob([fullDoc], { type: "application/haansofthwp;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `공소장_${defendants[0]?.name || "피고인"}_${docNo || todayStr}.hwp`;
    a.click();
    URL.revokeObjectURL(url);
    showToast?.("💾 HWP 호환 공소장 파일이 다운로드되었습니다.", "success");
  };

  // 전자결재 연동
  const handleSendToApprovals = () => {
    if (!onCreateApprovalFromIndictment) {
      showToast?.("전자결재함에 바로 연결할 수 없습니다.", "error");
      return;
    }

    const selectedCase = ledgerData.find((c) => String(c.id) === String(selectedCaseId)) || initialCase;
    onCreateApprovalFromIndictment({
      templateHtml: indictmentHtml,
      caseItem: selectedCase,
      docTitle: `[공소장 기안] ${docNo} 피고인 ${defendants[0]?.name || "미상"} (${chargesList.map((c) => c.name).join(", ")})`,
      dispositionType: "구공판(기소)",
    });
    onClose();
    showToast?.("🚀 공소장 결재 기안문이 전자결재함에 등록되었습니다.", "success");
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.85)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 10000,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 16,
          width: "100%",
          maxWidth: 1320,
          height: "92vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.8)",
        }}
      >
        {/* ── 헤더 ── */}
        <div
          style={{
            padding: "14px 22px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, rgba(30,58,138,0.25), rgba(245,158,11,0.1))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Scale size={22} color="var(--primary-amber)" />
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.08rem", color: "var(--text-main)" }}>
                HWP 공소장 자동작성기 (Indictment Composer)
              </div>
              <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                대한민국 검찰 표준 공소장 서식 · 사건/피고인/죄명/증거 연동 빌더 · 카페 복사 & HWP 다운로드
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--text-muted)",
              cursor: "pointer",
              padding: 6,
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* ── 바디 (2단 레이아웃) ── */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* 좌측: 작성기 입력 패널 */}
          <div
            style={{
              width: 520,
              flexShrink: 0,
              borderRight: "1px solid var(--border-subtle)",
              padding: "16px 20px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 16,
              background: "var(--bg-elevated)",
            }}
          >
            {/* 1. 사건 선택 & 기본정보 */}
            <div style={{ background: "rgba(0,0,0,0.2)", padding: 12, borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Wand2 size={15} color="var(--primary-amber)" />
                <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--text-main)" }}>
                  1. 사건 연동 및 법원 지정
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                    대상 사건 선택
                  </label>
                  <select
                    className="select-field"
                    style={{ width: "100%", fontSize: "0.78rem" }}
                    value={selectedCaseId}
                    onChange={(e) => setSelectedCaseId(e.target.value)}
                  >
                    <option value="">사건 선택...</option>
                    {ledgerData.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.sujeNo || c.hyeongjeNo} · {c.suspectName} · {c.chargeName}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <div>
                    <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                      사건번호 (공소번호)
                    </label>
                    <input
                      className="input-field"
                      style={{ width: "100%", fontSize: "0.78rem" }}
                      value={docNo}
                      onChange={(e) => setDocNo(e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: 3 }}>
                      관할 법원
                    </label>
                    <input
                      className="input-field"
                      style={{ width: "100%", fontSize: "0.78rem" }}
                      value={courtName}
                      onChange={(e) => setCourtName(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. 피고인 목록 */}
            <div style={{ background: "rgba(0,0,0,0.2)", padding: 12, borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--text-main)" }}>
                  2. 피고인 인적사항 ({defendants.length}명)
                </span>
                <button
                  type="button"
                  onClick={handleAddDefendant}
                  className="btn btn-outline"
                  style={{ fontSize: "0.7rem", padding: "2px 8px", gap: 3 }}
                >
                  <Plus size={12} /> 피고인 추가
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {defendants.map((d, idx) => (
                  <div
                    key={d.id}
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-subtle)",
                      borderRadius: 8,
                      padding: 10,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--primary-amber)" }}>
                        피고인 {idx + 1}
                      </span>
                      {defendants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDefendant(d.id)}
                          style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", padding: 2 }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      <input
                        className="input-field"
                        placeholder="성명"
                        style={{ fontSize: "0.76rem" }}
                        value={d.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDefendants((prev) =>
                            prev.map((item) => (item.id === d.id ? { ...item, name: val } : item)),
                          );
                        }}
                      />
                      <select
                        className="select-field"
                        style={{ fontSize: "0.76rem" }}
                        value={d.detentionStatus}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDefendants((prev) =>
                            prev.map((item) => (item.id === d.id ? { ...item, detentionStatus: val } : item)),
                          );
                        }}
                      >
                        <option value="불구속">불구속</option>
                        <option value="구속">구속</option>
                      </select>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                      <input
                        className="input-field"
                        placeholder="주소 (예: 주거부정)"
                        style={{ fontSize: "0.74rem" }}
                        value={d.address}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDefendants((prev) =>
                            prev.map((item) => (item.id === d.id ? { ...item, address: val } : item)),
                          );
                        }}
                      />
                      <input
                        className="input-field"
                        placeholder="직업"
                        style={{ fontSize: "0.74rem" }}
                        value={d.job}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDefendants((prev) =>
                            prev.map((item) => (item.id === d.id ? { ...item, job: val } : item)),
                          );
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. 죄명 및 적용법조 */}
            <div style={{ background: "rgba(0,0,0,0.2)", padding: 12, borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--text-main)" }}>
                  3. 죄명 및 적용법조 ({chargesList.length}건)
                </span>
                <button
                  type="button"
                  onClick={handleAddCharge}
                  className="btn btn-outline"
                  style={{ fontSize: "0.7rem", padding: "2px 8px", gap: 3 }}
                >
                  <Plus size={12} /> 죄명 추가
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {chargesList.map((ch) => (
                  <div key={ch.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      className="input-field"
                      placeholder="죄명 (예: 사기)"
                      style={{ width: "38%", fontSize: "0.76rem" }}
                      value={ch.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        const match = chargesData.find((c) => c.name === val);
                        setChargesList((prev) =>
                          prev.map((item) =>
                            item.id === ch.id
                              ? { ...item, name: val, lawArticle: match?.lawArticle || item.lawArticle }
                              : item,
                          ),
                        );
                      }}
                    />
                    <input
                      className="input-field"
                      placeholder="적용법조 (예: 형법 제347조제1항)"
                      style={{ flex: 1, fontSize: "0.76rem" }}
                      value={ch.lawArticle}
                      onChange={(e) => {
                        const val = e.target.value;
                        setChargesList((prev) =>
                          prev.map((item) =>
                            item.id === ch.id ? { ...item, lawArticle: val } : item,
                          ),
                        );
                      }}
                    />
                    {chargesList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCharge(ch.id)}
                        style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", padding: 2 }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 4. 공소사실(범죄사실) */}
            <div style={{ background: "rgba(0,0,0,0.2)", padding: 12, borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--text-main)" }}>
                  4. 공소사실 (범죄사실 본문)
                </span>
              </div>
              <textarea
                className="input-field"
                style={{ width: "100%", minHeight: 120, fontSize: "0.78rem", lineHeight: 1.6 }}
                placeholder="일시, 장소, 범행 방법, 결과 등을 상세히 기술하세요."
                value={crimeFacts}
                onChange={(e) => setCrimeFacts(e.target.value)}
              />
            </div>

            {/* 5. 증거의 요지 */}
            <div style={{ background: "rgba(0,0,0,0.2)", padding: 12, borderRadius: 10, border: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--text-main)", display: "block", marginBottom: 6 }}>
                5. 증거의 요지 (체크 시 자동 첨부)
              </span>

              {evidenceList.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 100, overflowY: "auto", marginBottom: 6 }}>
                  {evidenceList.map((e) => (
                    <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.74rem", color: "var(--text-main)", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={selectedEvidenceIds.has(e.id)}
                        onChange={() => toggleEvidence(e.id)}
                      />
                      <span>{e.title}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: 6 }}>
                  사건에 등록된 증거물이 없습니다. 아래에 직접 입력하세요.
                </div>
              )}

              <input
                className="input-field"
                style={{ width: "100%", fontSize: "0.74rem" }}
                placeholder="추가 증거목록 직접 기재 (예: 3. 피의자 자필 진술서)"
                value={customEvidenceText}
                onChange={(e) => setCustomEvidenceText(e.target.value)}
              />
            </div>

            {/* 담당 검사 서명 정보 */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: 2 }}>
                  담당검사 직급
                </label>
                <input
                  className="input-field"
                  style={{ width: "100%", fontSize: "0.76rem" }}
                  value={prosecutorRank}
                  onChange={(e) => setProsecutorRank(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "block", marginBottom: 2 }}>
                  담당검사 성명
                </label>
                <input
                  className="input-field"
                  style={{ width: "100%", fontSize: "0.76rem" }}
                  value={prosecutorName}
                  onChange={(e) => setProsecutorName(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* 우측: 실시간 HWP 공소장 미리보기 & 액션 툴바 */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#334155" }}>
            {/* 툴바 */}
            <div
              style={{
                padding: "10px 18px",
                background: "var(--bg-card)",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--primary-amber)" }}>
                  표준 규격 HWP 공소장 미리보기
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={handleCopy}
                  className="btn btn-gold"
                  style={{ fontSize: "0.8rem", padding: "7px 16px", gap: 5 }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "복사 완료!" : "📋 카페에 복사"}
                </button>
                <button
                  onClick={handleDownloadHwp}
                  className="btn btn-outline"
                  style={{ fontSize: "0.8rem", padding: "7px 12px", gap: 5 }}
                >
                  <Download size={14} /> .hwp 다운로드
                </button>
                <button
                  onClick={handlePrint}
                  className="btn btn-outline"
                  style={{ fontSize: "0.8rem", padding: "7px 12px", gap: 5 }}
                >
                  <Printer size={14} /> 인쇄
                </button>
                <button
                  onClick={handleSendToApprovals}
                  className="btn btn-outline"
                  style={{
                    fontSize: "0.8rem",
                    padding: "7px 14px",
                    gap: 5,
                    background: "rgba(59,130,246,0.18)",
                    color: "#93c5fd",
                    borderColor: "rgba(59,130,246,0.4)",
                  }}
                >
                  <Send size={14} /> 🚀 전자결재 상신
                </button>
              </div>
            </div>

            {/* 미리보기 문서 영역 */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 28,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: 800,
                  boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
                dangerouslySetInnerHTML={{ __html: indictmentHtml }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
