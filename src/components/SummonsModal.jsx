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
import { HWP_TEMPLATES } from "../data/hwpTemplates";

export default function SummonsModal({
  isOpen,
  onClose,
  scheduleItem,
  caseItem,
  currentUser,
  showToast,
  onScheduleUpdated,
}) {
  const [targetType, setTargetType] = useState(scheduleItem?.targetType || "SUSPECT");
  const [targetName, setTargetName] = useState(scheduleItem?.targetName || "");
  const [targetContact, setTargetContact] = useState(scheduleItem?.targetContact || "");
  const [scheduledAt, setScheduledAt] = useState(scheduleItem?.scheduledAt || "");
  const [location, setLocation] = useState(scheduleItem?.location || "검찰청 검사실");
  const [prosecutorName, setProsecutorName] = useState(
    scheduleItem?.investigatorName || caseItem?.prosecutorName || currentUser?.name || "담당검사",
  );
  const [chargeName, setChargeName] = useState(caseItem?.chargeName || "형사 피고사건");
  const [crimeFactsSummary, setCrimeFactsSummary] = useState(
    scheduleItem?.purpose || caseItem?.chargeName
      ? `피의자 ${scheduleItem?.targetName || ""}에 대한 ${caseItem?.chargeName || "형사 피의사건"} 피의사실 요지\n\n피의자는 도스온라인 관할 구역 내에서 ${caseItem?.chargeName || "해당 범죄"}를 저질렀다는 혐의를 받고 있습니다.`
      : "피의사실 요지를 입력하세요.",
  );
  const [docNo, setDocNo] = useState(
    scheduleItem?.summonsDocNo ||
      `출석-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);
  const year = todayStr.slice(0, 4);
  const month = todayStr.slice(5, 7);
  const day = todayStr.slice(8, 10);

  const isSuspect = targetType === "SUSPECT";
  const displayCaseNo = caseItem?.sujeNo || caseItem?.hyeongjeNo || scheduleItem?.hyeongjeNo || `${year}형제0000호`;

  // FORM_01 서식 가져오기
  const form01 = HWP_TEMPLATES.find((t) => t.id === "FORM_01") || null;

  // isOpen 가드: 모든 훅 이후에 배치 (React 훅 규칙 준수)
  if (!isOpen || !scheduleItem) return null;

  // 포맷팅된 조사일시
  const formattedScheduledAt = (() => {
    if (!scheduledAt) return "       .  .      (  )   시";
    try {
      const d = new Date(scheduledAt);
      if (isNaN(d)) return scheduledAt;
      const ampm = d.getHours() < 12 ? "오전" : "오후";
      const hour = d.getHours() % 12 || 12;
      return `${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}. ${ampm} ${hour}시 ${String(d.getMinutes()).padStart(2, "0")}분`;
    } catch {
      return scheduledAt;
    }
  })();

  // HWP 공식 별지 제1호서식 기반 출석요구서 HTML 생성
  const summonsHtml = (() => {
    if (!form01) {
      // 폴백: 기존 스타일 HTML
      return `<div style="font-family:'한컴바탕','Batang',serif;max-width:720px;margin:0 auto;padding:30px;background:#fff;color:#000;border:1px solid #ccc;">
        <div style="text-align:center;font-size:20pt;font-weight:900;letter-spacing:10px;margin:20px 0;">출 석 요 구 서</div>
        <p>사건번호: ${displayCaseNo} / 죄명: ${chargeName} / 대상: ${targetName} / 출석일시: ${formattedScheduledAt}</p>
      </div>`;
    }

    let html = form01.html;

    // 1. 사건번호 치환: "2025형제0000호" 패턴
    html = html.replace(
      /\u00a0?2025<\/span><span[^>]*>형제0000호/,
      `\u00a0${displayCaseNo}</span><span style='position:relative;font-size:11.0pt;font-family:"돋움체";line-height:230%'>`,
    );
    // 더 간단한 패턴으로 추가 시도
    html = html.replace(/2025<\/span><span[^>]*>형제0000호<\/span>/, `${displayCaseNo}</span>`);

    // 2. 제목 치환: 피의자/참고인에 따라
    if (!isSuspect) {
      html = html.replace(
        /출\&nbsp;\s*석\&nbsp;\s*요\&nbsp;\s*구\s*서/,
        "참고인 출석요구서",
      );
    }

    // 3. 출석일시 치환: 본문 내 "    .    .    . 오전(후)   시에 우리청   호 검사실로" 부분
    // 원문: "문의할 일이 있으니      .   .   . 오전(후)  시에 우리청   호 검사실로 출석하여"
    html = html.replace(
      /문의할 일이 있으니[\s\S]*?오전\(후\)&nbsp;\s*시에 우리청&nbsp;\s*호 검사실로 출석하여 주시기/,
      `문의할 일이 있으니 <strong>${formattedScheduledAt}</strong>에 <strong>${location}</strong>으로 출석하여 주시기`,
    );

    // 4. 피의사실 요지 박스 (border solid td, height:108px) 치환
    html = html.replace(
      /(<td colspan="4" valign="top"[^>]*border[^>]*solid[^>]*height:108px[^>]*>)([\s\S]*?)(<\/td>)/,
      `$1<div style="padding:8px;font-family:'돋움체';font-size:11pt;line-height:200%;">
        <div style="margin-bottom:6px;"><strong>죄명:</strong> ${chargeName}</div>
        <div><strong>피의사실 요지:</strong><br/>${crimeFactsSummary.replace(/\n/g, "<br/>")}</div>
      </div>$3`,
    );

    // 5. 하단 날짜 "." 3개 패턴 → 실제 날짜
    html = html.replace(
      /\.<\/span><\/p>\s*<\/td>\s*<\/tr>\s*<tr>\s*<td valign="middle"[^>]*>\s*<p class=HStyle0 style='text-align:right/,
      (match) => match, // 이 패턴은 유지
    );
    // 서명란 날짜 ("    .    .    ." 패턴)
    html = html.replace(
      /style='text-align:center;line-height:280%;'><span[^>]*>\.<\/span><\/p>/,
      `style='text-align:center;line-height:280%;'><span style='position:relative;font-size:12.0pt;font-family:"한컴바탕";line-height:280%'>${year}. ${month}. ${day}.</span></p>`,
    );

    // 6. "검사이름" → 실제 검사 이름
    html = html.replace(/검사이름/g, prosecutorName);

    // 7. 담당검사/담당검찰사무관 연락처 치환
    html = html.replace(
      /담당 검사 discord@, 담당 검찰사무관 discord@/g,
      `담당 검사 ${prosecutorName}${targetContact ? `, 연락처 ${targetContact}` : ""}`,
    );

    // 8. 문서번호 추가 (서식 최상단에 주입)
    html = html.replace(
      /■ 검찰사건사무규칙 \[별지 제1호서식\] 출석요구서/,
      `■ 검찰사건사무규칙 [별지 제1호서식] 출석요구서 &nbsp;&nbsp;&nbsp; 문서번호: ${docNo}`,
    );

    return `<style>${form01.style}</style>
      <div style="font-family:'한컴바탕','Batang',serif;max-width:760px;margin:0 auto;background:#fff;padding:20px;box-sizing:border-box;color:#000;">
        ${html}
      </div>`.trim();
  })();


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
        purpose: crimeFactsSummary,
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
                피의사실 요지 <span style={{ color: "var(--primary-amber)" }}>(서식 내 삽입)</span>
              </label>
              <textarea
                className="input-field"
                style={{ width: "100%", minHeight: 90, fontSize: "0.8rem" }}
                placeholder="피의사실 요지를 입력하세요. 서식 내 피의사실 요지 박스에 자동 삽입됩니다."
                value={crimeFactsSummary}
                onChange={(e) => setCrimeFactsSummary(e.target.value)}
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
