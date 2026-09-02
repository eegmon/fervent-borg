import React, { useState, useMemo } from "react";
import {
  X,
  Copy,
  Check,
  Printer,
  Download,
  FileText,
  AlertTriangle,
  Calendar,
  MapPin,
  User,
  Shield,
} from "lucide-react";
import { updateScheduleApi } from "../services/api";

export default function SummonsModal({
  isOpen,
  onClose,
  scheduleItem,
  caseItem,
  currentUser,
  showToast,
  onScheduleUpdated,
}) {
  if (!isOpen || !scheduleItem) return null;

  const [targetType, setTargetType] = useState(scheduleItem.targetType || "SUSPECT");
  const [targetName, setTargetName] = useState(scheduleItem.targetName || "");
  const [targetContact, setTargetContact] = useState(scheduleItem.targetContact || "");
  const [scheduledAt, setScheduledAt] = useState(scheduleItem.scheduledAt || "");
  const [location, setLocation] = useState(scheduleItem.location || "검찰청 검사실");
  const [prosecutorName, setProsecutorName] = useState(
    scheduleItem.investigatorName || caseItem?.prosecutorName || currentUser?.name || "담당검사",
  );
  const [chargeName, setChargeName] = useState(caseItem?.chargeName || "형사 피고사건");
  const [purpose, setPurpose] = useState(scheduleItem.purpose || "피고사건에 관한 피의자 신문 조사");
  const [docNo, setDocNo] = useState(
    scheduleItem.summonsDocNo ||
      `출석-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);
  const year = todayStr.slice(0, 4);
  const month = todayStr.slice(5, 7);
  const day = todayStr.slice(8, 10);

  const isSuspect = targetType === "SUSPECT";
  const displayCaseNo = caseItem?.sujeNo || caseItem?.hyeongjeNo || scheduleItem.hyeongjeNo || "2026형제0000호";

  // 포맷팅된 조사일시
  const formattedScheduledAt = useMemo(() => {
    if (!scheduledAt) return "2026년   월   일   시   분";
    try {
      const d = new Date(scheduledAt);
      if (isNaN(d)) return scheduledAt;
      return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2, "0")}시 ${String(d.getMinutes()).padStart(2, "0")}분`;
    } catch {
      return scheduledAt;
    }
  }, [scheduledAt]);

  // HWP 및 복사용 HTML 서식
  const summonsHtml = useMemo(() => {
    const title = isSuspect ? "출 석 요 구 서" : "참고인 출석요구서";
    const subNotice = isSuspect
      ? `※ 정당한 사유 없이 출석요구에 응하지 아니하는 때에는 형사소송법 제200조의2의 규정에 의하여 체포영장이 발부될 수 있습니다.`
      : `※ 부득이한 사유로 지정된 일시에 출석할 수 없는 때에는 미리 담당자에게 연락하여 일시를 변경하시기 바랍니다.`;

    return `
<div style="font-family: '한컴바탕', 'Batang', serif; max-width: 720px; margin: 0 auto; padding: 30px; background: #fff; color: #000; line-height: 1.8; border: 1px solid #ccc;">
  <div style="text-align: center; margin-bottom: 25px;">
    <div style="font-size: 13pt; letter-spacing: 2px; font-weight: bold; color: #1e3a8a;">도스온라인 검찰청</div>
    <div style="font-size: 22pt; font-weight: 900; letter-spacing: 12px; margin: 15px 0 10px; border-bottom: 2px solid #000; padding-bottom: 10px;">${title}</div>
    <div style="font-size: 10pt; text-align: right; color: #555;">문서번호: ${docNo}</div>
  </div>

  <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 11pt;">
    <tr>
      <td style="border: 1px solid #000; padding: 8px 12px; width: 22%; background: #f1f5f9; font-weight: bold; text-align: center;">사 건 번 호</td>
      <td style="border: 1px solid #000; padding: 8px 12px; width: 28%;">${displayCaseNo}</td>
      <td style="border: 1px solid #000; padding: 8px 12px; width: 22%; background: #f1f5f9; font-weight: bold; text-align: center;">죄    명</td>
      <td style="border: 1px solid #000; padding: 8px 12px; width: 28%;">${chargeName}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 8px 12px; background: #f1f5f9; font-weight: bold; text-align: center;">피출석인 성명</td>
      <td style="border: 1px solid #000; padding: 8px 12px;"><strong>${targetName}</strong> (${isSuspect ? "피의자" : "참고인"})</td>
      <td style="border: 1px solid #000; padding: 8px 12px; background: #f1f5f9; font-weight: bold; text-align: center;">연  락  처</td>
      <td style="border: 1px solid #000; padding: 8px 12px;">${targetContact || "미기재"}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 8px 12px; background: #f1f5f9; font-weight: bold; text-align: center;">출 석 일 시</td>
      <td colspan="3" style="border: 1px solid #000; padding: 8px 12px; font-weight: bold; color: #1e3a8a;">${formattedScheduledAt}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 8px 12px; background: #f1f5f9; font-weight: bold; text-align: center;">출 석 장 소</td>
      <td colspan="3" style="border: 1px solid #000; padding: 8px 12px;">${location}</td>
    </tr>
    <tr>
      <td style="border: 1px solid #000; padding: 8px 12px; background: #f1f5f9; font-weight: bold; text-align: center;">출 석 목 적</td>
      <td colspan="3" style="border: 1px solid #000; padding: 8px 12px;">${purpose}</td>
    </tr>
  </table>

  <div style="margin: 25px 0 35px; font-size: 11pt; text-indent: 10px; line-height: 2;">
    귀하에 대한 위 사건의 조사를 위하여 위 일시 및 장소에 출석하여 주시기 바랍니다.<br/>
    출석 시 신분증(주민등록증, 운전면허증 등) 및 사건 관련 소명자료가 있는 경우 이를 지참하시기 바랍니다.
  </div>

  <div style="background: #f8fafc; border: 1px dashed #64748b; padding: 12px 16px; margin-bottom: 30px; font-size: 9.5pt; color: #334155; line-height: 1.6;">
    ${subNotice}
  </div>

  <div style="text-align: center; margin-top: 40px; font-size: 12pt;">
    <div style="margin-bottom: 15px; letter-spacing: 2px;">${year}년 ${month}월 ${day}일</div>
    <div style="font-size: 14pt; font-weight: bold; letter-spacing: 4px; margin-top: 10px;">
      도스온라인 검찰청 검사 ${prosecutorName}
      <span style="display: inline-block; width: 36px; height: 36px; border: 2px solid #b91c1c; border-radius: 50%; color: #b91c1c; font-size: 11px; line-height: 34px; text-align: center; vertical-align: middle; margin-left: 8px; font-weight: bold;">(인)</span>
    </div>
  </div>
</div>
    `.trim();
  }, [
    isSuspect,
    docNo,
    displayCaseNo,
    chargeName,
    targetName,
    targetContact,
    formattedScheduledAt,
    location,
    purpose,
    year,
    month,
    day,
    prosecutorName,
  ]);

  // 클립보드 복사
  const handleCopy = async () => {
    try {
      const blob = new Blob([summonsHtml], { type: "text/html" });
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      showToast?.("📋 출석요구서 서식이 복사되었습니다. 스마트에디터에 붙여넣기 하세요.", "success");
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
        <title>출석요구서 - ${targetName}</title>
        <style>
          @page { size: A4 portrait; margin: 15mm; }
          body { margin: 0; padding: 0; }
        </style>
      </head>
      <body>
        ${summonsHtml}
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
<title>출석요구서</title>
</head>
<body>
${summonsHtml}
</body>
</html>`;
    const blob = new Blob([fullDoc], { type: "application/haansofthwp;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `출석요구서_${targetName}_${todayStr}.hwp`;
    a.click();
    URL.revokeObjectURL(url);
    showToast?.("💾 출석요구서 HWP 호환 파일이 다운로드되었습니다.", "success");
  };

  // 발급 이력 저장
  const handleSaveIssueRecord = async () => {
    setIsSaving(true);
    try {
      const now = new Date().toISOString();
      const res = await updateScheduleApi(scheduleItem.id, {
        summonsDocNo: docNo,
        summonsIssuedAt: now,
        targetType,
        targetName,
        targetContact,
        scheduledAt,
        location,
        purpose,
      });
      if (res?.success) {
        showToast?.("✅ 출석요구서 발급 이력이 기록되었습니다.", "success");
        if (onScheduleUpdated) onScheduleUpdated(res.schedule);
        onClose();
      } else {
        showToast?.(res?.message || "발급 기록 저장 실패", "error");
      }
    } catch (err) {
      showToast?.("저장 오류: " + err.message, "error");
    } finally {
      setIsSaving(false);
    }
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
        zIndex: 10001,
        padding: 16,
      }}
    >
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 16,
          width: "100%",
          maxWidth: 1100,
          height: "90vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, rgba(30,58,138,0.2), rgba(245,158,11,0.08))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FileText size={20} color="var(--primary-amber)" />
            <div>
              <div style={{ fontWeight: 800, fontSize: "1.05rem", color: "var(--text-main)" }}>
                출석요구서(소환장) 서식 발급 및 관리
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                대한민국 검찰 표준 출석요구서 · HWP 카페 복사 · 인쇄 · 발급 이력 관리
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

        {/* 바디 (2단 분할: 좌측 설정 / 우측 실시간 미리보기) */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* 좌측: 서식 파라미터 입력 패널 */}
          <div
            style={{
              width: 380,
              flexShrink: 0,
              borderRight: "1px solid var(--border-subtle)",
              padding: "16px 20px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 14,
              background: "var(--bg-elevated)",
            }}
          >
            <div>
              <label style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
                출석 대상 구분
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setTargetType("SUSPECT")}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    border: targetType === "SUSPECT" ? "none" : "1px solid var(--border-subtle)",
                    background: targetType === "SUSPECT" ? "var(--primary-amber)" : "transparent",
                    color: targetType === "SUSPECT" ? "#000" : "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  🚨 피의자 출석요구서
                </button>
                <button
                  type="button"
                  onClick={() => setTargetType("WITNESS")}
                  style={{
                    flex: 1,
                    padding: "8px 0",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    border: targetType === "WITNESS" ? "none" : "1px solid var(--border-subtle)",
                    background: targetType === "WITNESS" ? "#60a5fa" : "transparent",
                    color: targetType === "WITNESS" ? "#000" : "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  👤 참고인 출석요구서
                </button>
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                문서 번호
              </label>
              <input
                className="input-field"
                style={{ width: "100%", fontSize: "0.8rem" }}
                value={docNo}
                onChange={(e) => setDocNo(e.target.value)}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <div>
                <label style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  대상자 성명
                </label>
                <input
                  className="input-field"
                  style={{ width: "100%", fontSize: "0.8rem" }}
                  value={targetName}
                  onChange={(e) => setTargetName(e.target.value)}
                />
              </div>
              <div>
                <label style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  연락처
                </label>
                <input
                  className="input-field"
                  style={{ width: "100%", fontSize: "0.8rem" }}
                  placeholder="디스코드 / 전화번호"
                  value={targetContact}
                  onChange={(e) => setTargetContact(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                조사·출석 일시
              </label>
              <input
                type="datetime-local"
                className="input-field"
                style={{ width: "100%", fontSize: "0.8rem" }}
                value={scheduledAt ? scheduledAt.replace(" ", "T").slice(0, 16) : ""}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                출석 장소
              </label>
              <input
                className="input-field"
                style={{ width: "100%", fontSize: "0.8rem" }}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                담당 검사 / 수사관
              </label>
              <input
                className="input-field"
                style={{ width: "100%", fontSize: "0.8rem" }}
                value={prosecutorName}
                onChange={(e) => setProsecutorName(e.target.value)}
              />
            </div>

            <div>
              <label style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                출석 목적 및 요지
              </label>
              <textarea
                className="input-field"
                style={{ width: "100%", minHeight: 60, fontSize: "0.8rem" }}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>

            <div style={{ marginTop: "auto", paddingTop: 12, borderTop: "1px solid var(--border-subtle)" }}>
              <button
                onClick={handleSaveIssueRecord}
                disabled={isSaving}
                className="btn btn-gold"
                style={{ width: "100%", padding: "10px", fontSize: "0.85rem", fontWeight: 800 }}
              >
                {isSaving ? "저장 중..." : "✅ 발급 이력 기록 및 완료"}
              </button>
            </div>
          </div>

          {/* 우측: 서식 미리보기 & 액션 툴바 */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#475569" }}>
            {/* 상단 툴바 */}
            <div
              style={{
                padding: "10px 16px",
                background: "var(--bg-card)",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--text-muted)" }}>
                  미리보기 ({isSuspect ? "피의자용" : "참고인용"})
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={handleCopy}
                  className="btn btn-gold"
                  style={{ fontSize: "0.78rem", padding: "6px 14px", gap: 5 }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "복사 완료!" : "📋 카페에 복사"}
                </button>
                <button
                  onClick={handleDownloadHwp}
                  className="btn btn-outline"
                  style={{ fontSize: "0.78rem", padding: "6px 12px", gap: 5 }}
                >
                  <Download size={14} /> .hwp 다운로드
                </button>
                <button
                  onClick={handlePrint}
                  className="btn btn-outline"
                  style={{ fontSize: "0.78rem", padding: "6px 12px", gap: 5 }}
                >
                  <Printer size={14} /> 인쇄
                </button>
              </div>
            </div>

            {/* 인쇄/문서 뷰어 컨테이너 */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: 24,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: 760,
                  boxShadow: "0 8px 30px rgba(0,0,0,0.3)",
                  borderRadius: 4,
                  overflow: "hidden",
                }}
                dangerouslySetInnerHTML={{ __html: summonsHtml }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
