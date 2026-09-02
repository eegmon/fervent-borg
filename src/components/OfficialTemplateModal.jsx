import React, { useState, useMemo, useRef } from "react";
import {
  X,
  Copy,
  Check,
  Search,
  FileText,
  ChevronRight,
  Wand2,
  AlertCircle,
} from "lucide-react";
import { HWP_TEMPLATES } from "../data/hwpTemplates";

const NAVER_CAFE_MENU_URL =
  "https://cafe.naver.com/f-e/cafes/29669442/menus/262";

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeScriptJson(value) {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

// ─────────────────────────────────────────────
// 카테고리
// ─────────────────────────────────────────────
const CATEGORIES = [
  { id: "ALL", label: "전체" },
  { id: "WARRANT", label: "영장·체포" },
  { id: "INDICTMENT", label: "기소·공소" },
  { id: "NOTICE", label: "통보·통지" },
  { id: "APPLICATION", label: "신청·청구" },
];

// ─────────────────────────────────────────────
// 사건 데이터를 HTML에 자동 치환하는 함수
// HWP가 변환된 HTML에서 빈칸/공백 셀에 해당하는
// 패턴들을 찾아 실제 데이터로 교체한다.
// ─────────────────────────────────────────────
function injectCaseData(html, caseItem, currentUser, today) {
  if (!caseItem) return html;

  const caseNo = caseItem.sujeNo || caseItem.hyeongjeNo || "";
  const suspectName = caseItem.suspectName || "";
  const chargeName = caseItem.chargeName || "";
  const prosName = caseItem.prosecutorName || currentUser?.name || "";
  const dateStr = today; // YYYY.MM.DD
  const dateHan = today.replace(/-/g, ". ") + "."; // 2026. 08. 25.
  const year = today.slice(0, 4);

  let out = html;

  // 1. "2025  0000호" 형태의 사건번호 플레이스홀더 치환
  out = out.replace(/2025\s{1,10}0+\s*호/g, `${year}${caseNo}호`);
  out = out.replace(/20\d{2}\s{1,10}0+\s*호/g, `${year}${caseNo}호`);

  // 2. 연·월·일 빈칸 (nbsp; 연속) – 날짜 패턴
  // "  .   .   ." 또는 "&nbsp;&nbsp;.&nbsp;&nbsp;&nbsp;.&nbsp;" 형태
  out = out.replace(
    /(&nbsp;){2,}\.\s*(&nbsp;){2,}\.\s*(&nbsp;){2,}\./g,
    dateHan,
  );

  // 3. 한글 검색 패턴 – 피의자 이름 자리
  // HWP HTML에서 빈 입력칸은 주로 nbsp 연속 + 특정 클래스
  // 가장 간단한 방법: 텍스트 "성 명" 바로 다음 셀 내용 치환
  // → iframe 내부에서 JS로 동적 치환하는 방식 사용

  return out;
}

// ─────────────────────────────────────────────
// 실제 iframe에 데이터를 주입하는 완성 HTML 생성
// 사건 필드는 <span data-field="xxx"> 마킹 후
// inline JS로 채운다.
// ─────────────────────────────────────────────
function buildIframeDoc(template, caseItem, currentUser, today) {
  if (!template) return "";

  const caseNo = caseItem?.sujeNo || caseItem?.hyeongjeNo || "";
  const suspectName = caseItem?.suspectName || "";
  const chargeName = caseItem?.chargeName || "";
  const prosName = caseItem?.prosecutorName || currentUser?.name || "";
  const year = today.slice(0, 4);
  const dateHan = today.replace(/-/g, ". ") + ".";

  const safeCaseNo = escapeHtml(caseNo);
  const safeSuspectName = escapeHtml(suspectName);
  const safeChargeName = escapeHtml(chargeName);
  const safeProsName = escapeHtml(prosName);
  const safeDateHan = escapeHtml(dateHan);

  // HTML 치환 (정규식 기반 – 가능한 패턴 최대한 커버)
  let body = template.html;

  // 사건번호: "2025  0000호" 패턴
  body = body.replace(
    /20\d{2}(\s|&nbsp;){1,12}0+(\s|&nbsp;)*호/gi,
    `<strong style="color:#1e3a8a">${escapeHtml(year)}${safeCaseNo}호</strong>`,
  );

  // 날짜: ". . ." 패턴 (nbsp 사이에 점)
  body = body.replace(
    /((&nbsp;|\s){2,}\.\s*){3}/g,
    `<strong style="color:#1e3a8a">${safeDateHan}</strong>`,
  );

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { margin: 20px; background: #fff; }
  .auto-fill-bar {
    position: sticky; top: 0; z-index: 100;
    background: #fefce8; border: 1px solid #fde68a;
    border-radius: 8px; padding: 8px 14px; margin-bottom: 16px;
    font-family: 'Noto Sans KR', sans-serif; font-size: 12px; color: #92400e;
    display: flex; align-items: center; gap: 8px;
  }
  .fill-chip {
    background: #1e3a8a; color: #fff;
    padding: 2px 8px; border-radius: 10px;
    font-size: 11px; font-weight: 700;
  }
</style>
<style>${template.style}</style>
</head>
<body contenteditable="true" spellcheck="false">
${
  caseItem
    ? `
<div class="auto-fill-bar" contenteditable="false">
  ✨ 자동입력 적용됨:
  <span class="fill-chip">사건번호: ${safeCaseNo || "(미지정)"}</span>
  <span class="fill-chip">피의자: ${safeSuspectName || "(미지정)"}</span>
  <span class="fill-chip">죄명: ${safeChargeName || "(미지정)"}</span>
  <span class="fill-chip">담당검사: ${safeProsName || "(미지정)"}</span>
  <span class="fill-chip">날짜: ${safeDateHan}</span>
</div>`
    : ""
}
${body}
<script>
// 추가 DOM 기반 자동입력
(function() {
  const caseNo = ${escapeScriptJson(caseNo)};
  const suspectName = ${escapeScriptJson(suspectName)};
  const chargeName = ${escapeScriptJson(chargeName)};
  const prosName = ${escapeScriptJson(prosName)};
  const dateHan = ${escapeScriptJson(dateHan)};
  const year = ${escapeScriptJson(year)};

  // 모든 텍스트 노드 순회하여 패턴 치환
  function replaceTextNode(node) {
    if (node.nodeType === 3) { // TEXT_NODE
      let t = node.textContent;
      let changed = false;

      // 사건번호 패턴
      if (/20\d{2}\s{1,8}0+/.test(t)) {
        t = t.replace(/20\d{2}\s{1,8}0+\s*호?/g, year + caseNo + '호');
        changed = true;
      }
      if (changed && node.parentNode) {
        const span = document.createElement('span');
        span.style.color = '#1e3a8a';
        span.style.fontWeight = 'bold';
        span.textContent = t;
        node.parentNode.replaceChild(span, node);
      }
    } else if (node.nodeType === 1 && node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE') {
      Array.from(node.childNodes).forEach(replaceTextNode);
    }
  }
  replaceTextNode(document.body);
})();
</script>
</body>
</html>`;
}

// ─────────────────────────────────────────────
// 복사할 때 쓸 클린 HTML (자동입력 적용됨)
// ─────────────────────────────────────────────
function buildCopyHtml(template, caseItem, currentUser, today) {
  if (!template) return "";
  const caseNo = caseItem?.sujeNo || caseItem?.hyeongjeNo || "";
  const suspectName = caseItem?.suspectName || "";
  const chargeName = caseItem?.chargeName || "";
  const prosName = caseItem?.prosecutorName || currentUser?.name || "";
  const year = today.slice(0, 4);
  const dateHan = today.replace(/-/g, ". ") + ".";

  let body = template.html;
  body = body.replace(
    /20\d{2}(\s|&nbsp;){1,12}0+(\s|&nbsp;)*호/gi,
    `${escapeHtml(year)}${escapeHtml(caseNo)}호`,
  );
  body = body.replace(/((&nbsp;|\s){2,}\.\s*){3}/g, escapeHtml(dateHan));

  return `<style>${template.style}</style>${body}`;
}

// ─────────────────────────────────────────────
// 메인 모달
// ─────────────────────────────────────────────
export default function OfficialTemplateModal({
  isOpen,
  onClose,
  showToast,
  ledgerData = [],
  currentUser,
  // 결재 시스템 연동 (기안문용)
  onCreateApprovalFromDoc,
}) {
  const [category, setCategory] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(HWP_TEMPLATES[0]?.id || "");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [copied, setCopied] = useState(false);
  const iframeRef = useRef(null);

  const today = new Date().toISOString().slice(0, 10);

  const filtered = HWP_TEMPLATES.filter(
    (t) =>
      (category === "ALL" || t.category === category) &&
      (!search || t.label.includes(search)),
  );

  const selected =
    HWP_TEMPLATES.find((t) => t.id === selectedId) || HWP_TEMPLATES[0];
  const selectedCase =
    ledgerData.find((c) => String(c.id) === String(selectedCaseId)) || null;
  const isGian = selected?.no === 34; // 기안문

  const iframeDoc = useMemo(
    () => buildIframeDoc(selected, selectedCase, currentUser, today),
    [selected, selectedCase, currentUser, today],
  );

  if (!isOpen) return null;

  const handleCopy = async () => {
    if (!selected) return;
    const liveBody = iframeRef.current?.contentDocument?.body;
    const editedBody = liveBody
      ? Array.from(liveBody.children)
          .filter(
            (element) =>
              !element.classList.contains("auto-fill-bar") &&
              element.tagName !== "SCRIPT",
          )
          .map((element) => element.outerHTML)
          .join("")
      : "";
    const html = editedBody
      ? `<style>${selected.style}</style>${editedBody}`
      : buildCopyHtml(selected, selectedCase, currentUser, today);
    try {
      const blob = new Blob([html], { type: "text/html" });
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      if (showToast)
        showToast(
          "✅ 서식 복사 완료! 카페 스마트에디터에 Ctrl+V로 붙여넣기 하세요.",
          "success",
        );
    } catch (e) {
      if (showToast) showToast("❌ 클립보드 복사 실패: " + e.message, "error");
    }
  };

  const handleUseAsApproval = () => {
    if (!onCreateApprovalFromDoc) {
      if (showToast) showToast("결재 시스템에 연결되지 않았습니다.", "error");
      return;
    }
    onCreateApprovalFromDoc({
      templateHtml: buildCopyHtml(selected, selectedCase, currentUser, today),
      caseItem: selectedCase,
    });
    onClose();
    if (showToast)
      showToast(
        "📋 기안문이 결재 시스템에 전달되었습니다. 전자결재함에서 확인하세요.",
        "success",
      );
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.82)",
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
          maxWidth: 1280,
          height: "92vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          boxShadow: "0 32px 80px rgba(0,0,0,0.7)",
        }}
      >
        {/* ── 헤더 ── */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            background:
              "linear-gradient(135deg, rgba(30,58,138,0.15), rgba(245,158,11,0.08))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <FileText size={20} color="var(--primary-amber)" />
            <div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: "1rem",
                  color: "var(--text-main)",
                }}
              >
                공식 서식 카페 복사
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                HWP 원본 양식 {HWP_TEMPLATES.length}종 · 사건 선택 시 자동입력 ·
                카페 Ctrl+V 붙여넣기
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 6,
              borderRadius: 8,
              color: "var(--text-muted)",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* ── 바디 ── */}
        <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
          {/* ── 좌측: 서식 목록 ── */}
          <div
            style={{
              width: 270,
              flexShrink: 0,
              borderRight: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "10px 12px 8px",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ position: "relative" }}>
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
                  style={{
                    paddingLeft: 30,
                    fontSize: "0.77rem",
                    padding: "7px 10px 7px 30px",
                    width: "100%",
                  }}
                  placeholder="서식 검색..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 4,
                  marginTop: 8,
                }}
              >
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    style={{
                      fontSize: "0.68rem",
                      padding: "3px 9px",
                      borderRadius: 10,
                      cursor: "pointer",
                      fontWeight: 700,
                      background:
                        category === c.id
                          ? "var(--primary-amber)"
                          : "var(--bg-elevated)",
                      color: category === c.id ? "#000" : "var(--text-muted)",
                      border:
                        category === c.id
                          ? "none"
                          : "1px solid var(--border-subtle)",
                    }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto" }}>
              {filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedId(t.id)}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "9px 14px",
                    border: "none",
                    cursor: "pointer",
                    background:
                      selectedId === t.id
                        ? "rgba(245,158,11,0.1)"
                        : "transparent",
                    borderLeft:
                      selectedId === t.id
                        ? "3px solid var(--primary-amber)"
                        : "3px solid transparent",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    if (selectedId !== t.id)
                      e.currentTarget.style.background =
                        "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    if (selectedId !== t.id)
                      e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.76rem",
                      fontWeight: selectedId === t.id ? 700 : 500,
                      color:
                        selectedId === t.id
                          ? "var(--primary-amber)"
                          : "var(--text-main)",
                      lineHeight: 1.4,
                    }}
                  >
                    {t.no === 34 && (
                      <span
                        style={{
                          fontSize: "0.65rem",
                          background: "rgba(59,130,246,0.2)",
                          color: "#60a5fa",
                          padding: "1px 6px",
                          borderRadius: 8,
                          marginRight: 4,
                          fontWeight: 800,
                        }}
                      >
                        결재
                      </span>
                    )}
                    {t.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── 우측: 컨트롤 + 미리보기 ── */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {/* 컨트롤 바 */}
            <div
              style={{
                padding: "10px 16px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexShrink: 0,
                flexWrap: "wrap",
                background: "var(--bg-elevated)",
              }}
            >
              {/* 사건 선택 (기안문이 아닐 때만) */}
              {!isGian && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Wand2 size={14} color="var(--primary-amber)" />
                  <span
                    style={{
                      fontSize: "0.76rem",
                      color: "var(--text-muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    사건 선택 →
                  </span>
                  <select
                    className="select-field"
                    style={{
                      fontSize: "0.76rem",
                      padding: "5px 10px",
                      minWidth: 200,
                      maxWidth: 320,
                    }}
                    value={selectedCaseId}
                    onChange={(e) => setSelectedCaseId(e.target.value)}
                  >
                    <option value="">사건 미선택 (원본 표시)</option>
                    {ledgerData.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.sujeNo || c.hyeongjeNo} · {c.suspectName} ·{" "}
                        {c.chargeName}
                      </option>
                    ))}
                  </select>
                  {selectedCase && (
                    <span
                      style={{
                        fontSize: "0.7rem",
                        background: "rgba(52,211,153,0.15)",
                        color: "#34d399",
                        padding: "2px 8px",
                        borderRadius: 10,
                        fontWeight: 700,
                      }}
                    >
                      ✨ 자동입력 적용
                    </span>
                  )}
                </div>
              )}

              {/* 기안문 - 결재 연동 안내 */}
              {isGian && (
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <AlertCircle size={14} color="#60a5fa" />
                  <span style={{ fontSize: "0.76rem", color: "#60a5fa" }}>
                    기안문은 전자결재함에서 작성·상신하세요
                  </span>
                  {onCreateApprovalFromDoc && (
                    <button
                      onClick={handleUseAsApproval}
                      style={{
                        fontSize: "0.74rem",
                        padding: "4px 12px",
                        borderRadius: 8,
                        cursor: "pointer",
                        background: "rgba(59,130,246,0.2)",
                        border: "1px solid rgba(59,130,246,0.4)",
                        color: "#93c5fd",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                      }}
                    >
                      <ChevronRight size={13} /> 결재 시스템으로 이동
                    </button>
                  )}
                </div>
              )}

              <div
                style={{
                  marginLeft: "auto",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span
                  style={{
                    fontSize: "0.74rem",
                    fontWeight: 700,
                    color: "var(--text-main)",
                  }}
                >
                  {selected?.label}
                </span>
                <button
                  onClick={handleCopy}
                  className="btn btn-gold"
                  style={{
                    fontSize: "0.8rem",
                    padding: "7px 16px",
                    gap: 6,
                    whiteSpace: "nowrap",
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? "복사 완료!" : "📋 카페에 복사"}
                </button>
                <button
                  onClick={() =>
                    window.open(
                      NAVER_CAFE_MENU_URL,
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                  className="btn btn-outline"
                  style={{
                    fontSize: "0.8rem",
                    padding: "7px 12px",
                    gap: 6,
                    whiteSpace: "nowrap",
                    color: "#86efac",
                  }}
                  title="지정된 네이버 카페 메뉴 열기"
                >
                  ↗ 카페 메뉴 열기
                </button>
              </div>
            </div>

            {/* 양식 미리보기 */}
            <div
              style={{
                flex: 1,
                overflow: "hidden",
                background: "#e2e8f0",
                padding: 12,
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: "#fff",
                  borderRadius: 8,
                  overflow: "hidden",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                }}
              >
                {iframeDoc ? (
                  <iframe
                    key={`${selectedId}-${selectedCaseId}`}
                    ref={iframeRef}
                    srcDoc={iframeDoc}
                    style={{ width: "100%", height: "100%", border: "none" }}
                    title="서식 미리보기"
                  />
                ) : (
                  <div
                    style={{
                      height: "100%",
                      display: "grid",
                      placeItems: "center",
                      color: "#64748b",
                      fontSize: "0.85rem",
                    }}
                  >
                    선택한 서식의 미리보기를 준비하지 못했습니다.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
