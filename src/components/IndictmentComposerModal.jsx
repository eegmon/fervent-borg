import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Copy,
  Check,
  Printer,
  Download,
  Wand2,
  Plus,
  Trash2,
  Scale,
  Send,
  Sparkles,
  Loader2,
  Save,
  RotateCcw,
} from "lucide-react";
import { fetchEvidence, getToken } from "../services/api";
import { HWP_TEMPLATES } from "../data/hwpTemplates";
import ChargeSearchInput from "./ChargeSearchInput";

const getDetentionStatus = (status) => {
  const value = String(status || "");
  if (value.includes("구속") && !value.includes("불구속")) return "구속";
  if (value.includes("불구속")) return "불구속";
  return "";
};

export default function IndictmentComposerModal({
  isOpen,
  onClose,
  initialCase = null,
  ledgerData = [],
  chargesData = [],
  prosecutorsList = [],
  currentUser,
  showToast,
  onCreateApprovalFromIndictment,
}) {
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
  const [prosecutorName, setProsecutorName] = useState(
    currentUser?.name || "담당검사",
  );
  const [prosecutorRank, setProsecutorRank] = useState(
    currentUser?.rank || "검사",
  );

  const [copied, setCopied] = useState(false);
  const [aiLoading, setAiLoading] = useState(false); // 'draft' | 'refine' | false
  const [aiError, setAiError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [hasSavedDraft, setHasSavedDraft] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);
  const year = todayStr.slice(0, 4);
  const month = todayStr.slice(5, 7);
  const day = todayStr.slice(8, 10);

  const getStorageKey = (cId, cNo) => {
    const keyId = cId || cNo || "current";
    return `dose_indictment_draft_${keyId}`;
  };

  // 사건 선택 시 데이터 자동 로드 및 바인딩 (저장된 초안이 있으면 복원)
  useEffect(() => {
    const caseItem =
      ledgerData.find((c) => String(c.id) === String(selectedCaseId)) ||
      initialCase;

    if (caseItem) {
      const caseNo = caseItem.sujeNo || caseItem.hyeongjeNo || "";
      const storageKey = getStorageKey(caseItem.id, caseNo);
      let loadedFromDraft = false;

      // 1. 기존에 저장된 공소장 초안 확인
      try {
        const savedJson = localStorage.getItem(storageKey);
        if (savedJson) {
          const draft = JSON.parse(savedJson);
          if (draft && typeof draft === "object") {
            setCourtName(draft.courtName || "도스온라인 지방법원 형사부 귀중");
            setDocNo(draft.docNo || caseNo);
            if (Array.isArray(draft.defendants) && draft.defendants.length > 0) {
              setDefendants(draft.defendants);
            }
            if (Array.isArray(draft.chargesList) && draft.chargesList.length > 0) {
              setChargesList(draft.chargesList);
            }
            if (draft.crimeFacts !== undefined) {
              setCrimeFacts(draft.crimeFacts);
            }
            if (draft.customEvidenceText !== undefined) {
              setCustomEvidenceText(draft.customEvidenceText);
            }
            if (draft.confiscationText !== undefined) {
              setConfiscationText(draft.confiscationText);
            }
            if (Array.isArray(draft.selectedEvidenceIds)) {
              setSelectedEvidenceIds(new Set(draft.selectedEvidenceIds));
            }
            if (draft.prosecutorName) setProsecutorName(draft.prosecutorName);
            if (draft.prosecutorRank) setProsecutorRank(draft.prosecutorRank);
            if (draft.savedAt) {
              setLastSavedAt(new Date(draft.savedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
            }
            setHasSavedDraft(true);
            loadedFromDraft = true;
          }
        }
      } catch (err) {
        console.warn("[IndictmentComposer] 저장된 초안 로드 실패:", err);
      }

      // 2. 저장된 초안이 없는 경우 기본 초기화
      if (!loadedFromDraft) {
        setHasSavedDraft(false);
        setLastSavedAt("");
        setDocNo(caseNo);
        setProsecutorName(
          caseItem.prosecutorName || currentUser?.name || "담당검사",
        );

        // 피고인 목록 초기화
        let defs = [];
        if (Array.isArray(caseItem.suspects) && caseItem.suspects.length > 0) {
          defs = caseItem.suspects.map((s, idx) => ({
            id: s.id || `def-${idx}`,
            name: s.name || caseItem.suspectName || "",
            uuid: s.uuid || caseItem.suspectUuid || "",
            address:
              s.address ||
              s.residence ||
              s.residentialAddress ||
              caseItem.address ||
              caseItem.residence ||
              "",
            job:
              s.job || s.occupation || caseItem.job || caseItem.occupation || "",
            detentionStatus: getDetentionStatus(
              s.detentionStatus || s.bookingStatus || caseItem.bookingStatus,
            ),
          }));
        } else {
          defs = [
            {
              id: "def-0",
              name: caseItem.suspectName || "",
              uuid: caseItem.suspectUuid || "",
              address: caseItem.address || caseItem.residence || "",
              job: caseItem.job || caseItem.occupation || "",
              detentionStatus: getDetentionStatus(caseItem.bookingStatus),
            },
          ];
        }
        setDefendants(defs);

        // 죄명 및 적용법조 초기화
        const foundCharge = chargesData.find(
          (ch) => ch.name === caseItem.chargeName,
        );
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
        } else {
          setConfiscationText("");
        }
      }

      // 증거자료 로드
      if (caseNo) {
        fetchEvidence(caseNo)
          .then((res) => {
            const list = Array.isArray(res) ? res : res?.evidence || [];
            setEvidenceList(list);
            if (!loadedFromDraft) {
              setSelectedEvidenceIds(new Set(list.map((e) => e.id)));
            }
          })
          .catch(() => {});
      }
    }
  }, [
    selectedCaseId,
    initialCase,
    ledgerData,
    chargesData,
    currentUser?.name,
    todayStr,
  ]);

  // 피고인 추가/삭제
  const handleAddDefendant = () => {
    setDefendants((prev) => [
      ...prev,
      {
        id: `def-${Date.now()}`,
        name: "",
        uuid: "",
        address: "",
        job: "",
        detentionStatus: "",
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

  // HWP 공소장 서식 (별지 제14호서식)
  const form14 = HWP_TEMPLATES.find((t) => t.id === "FORM_14") || null;

  // 공소장 HWP 규격 HTML 생성
  const indictmentHtml = useMemo(() => {
    const selectedEvidences = evidenceList.filter((e) =>
      selectedEvidenceIds.has(e.id),
    );

    const chargeNamesStr = chargesList
      .map((c) => c.name)
      .filter(Boolean)
      .join(", ");
    const lawArticlesStr = chargesList
      .map((c) => c.lawArticle)
      .filter(Boolean)
      .join(", ");

    let evidenceRows = "";
    if (selectedEvidences.length > 0) {
      evidenceRows = selectedEvidences
        .map(
          (e, idx) =>
            `${idx + 1}. ${e.title} (${e.evidenceType || "증거기록"})`,
        )
        .join("<br/>");
    }
    if (customEvidenceText) {
      evidenceRows +=
        (evidenceRows ? "<br/>" : "") +
        customEvidenceText.replace(/\n/g, "<br/>");
    }
    if (!evidenceRows) {
      evidenceRows =
        "1. 피고인의 일부 법정진술<br/>2. 사법경찰관 작성의 수사보고서 및 관련 증거";
    }

    if (!form14) {
      return `<div>서식을 불러올 수 없습니다.</div>`;
    }

    let html = form14.html;

    // 1. 사건번호 및 일자
    html = html.replace(/2025년 형제0000호/g, docNo || `${year}년 형제0000호`);
    html = html.replace(/2025\. 00\. 00\./g, `${year}. ${month}. ${day}.`);
    html = html.replace(/도스온라인 법원/g, courtName);
    html = html.replace(/검사 ○○○은\(는\)/g, `검사 ${prosecutorName}은(는)`);

    // 2. 피고인 인적사항 — 서식의 원본 행에 첫 피고인 정보를 반영
    const primaryDefendant = defendants[0] || {};
    const defendantName = primaryDefendant.name || "(성명 미상)";
    const defendantUuid = primaryDefendant.uuid
      ? ` (${primaryDefendant.uuid})`
      : "";
    const defendantJob = primaryDefendant.job || "미입력";
    const defendantAddress = primaryDefendant.address || "미입력";
    const detentionText = primaryDefendant.detentionStatus || "미입력";

    // 서식 내 피고인 원본 플레이스홀더 → 전체 피고인 블록으로 치환
    html = html.replace(
      /○○○\(UUID\)/g,
      `<strong>${defendantName}</strong>${defendantUuid}`,
    );

    html = html.replace(
      /직업&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; , 연락처 discord@/i,
      `직업&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; ${defendantJob}`,
    );
    html = html.replace(
      /(>주거)(<\/span>)/i,
      `$1&nbsp;&nbsp;${defendantAddress}$2`,
    );

    const replaceRowValue = (labelPattern, value) => {
      const rowPattern = new RegExp(
        `(<tr>\\s*<td[^>]*>[\\s\\S]*?${labelPattern}[\\s\\S]*?<\\/td>\\s*<td[^>]*>)[\\s\\S]*?(<\\/td>\\s*<\\/tr>)`,
        "i",
      );
      html = html.replace(rowPattern, `$1${value}$2`);
    };

    // 3. 죄명 & 적용법조 (테이블 내 빈 <td> 영역 치환)
    replaceRowValue("죄(?:&nbsp;|\\s)+명", chargeNamesStr || "");
    replaceRowValue("적용법조", lawArticlesStr || "");
    replaceRowValue("구속여부", detentionText);

    // 4. Ⅱ. 공소사실 영역
    const crimeFactsContent = crimeFacts
      ? crimeFacts.replace(/\n/g, "<br/>")
      : "공소사실을 입력해주세요.";
    html = html.replace(
      /(Ⅱ\. 공소사실[\s\S]*?<td[^>]*>)([\s\S]*?)(<\/td>)/i,
      `$1<div style="font-size:11pt;font-family:'한컴바탕';line-height:200%;padding:10px;">${crimeFactsContent}</div>$3`,
    );

    // 5. Ⅲ. 첨부서류 (증거의 요지 & 압수물) 영역
    const attachedDocsContent =
      `<div style="font-weight:bold;margin-bottom:6px;">[ 증 거 의  요 지 ]</div>` +
      `<div style="line-height:180%;margin-bottom:12px;">${evidenceRows}</div>` +
      (confiscationText
        ? `<div style="font-weight:bold;margin-bottom:6px;">[ 압 수 물 ]</div><div style="line-height:180%;">${confiscationText.replace(/\n/g, "<br/>")}</div>`
        : "");

    html = html.replace(
      /(Ⅲ\. 첨부서류[\s\S]*?<td[^>]*>)([\s\S]*?)(<\/td>)/i,
      `$1<div style="font-size:10.5pt;font-family:'한컴바탕';line-height:180%;padding:10px;">${attachedDocsContent}</div>$3`,
    );

    // 6. 검사 서명란
    html = html.replace(/○&nbsp; ○&nbsp; ○/g, `${prosecutorName}`);

    return `
      <style>${form14.style}</style>
      <div style="font-family:'한컴바탕', 'Batang', serif; max-width: 780px; margin: 0 auto; background: #fff; padding: 25px; border: 1px solid #cbd5e1; box-sizing: border-box; color: #000;">
        ${html}
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
    prosecutorName,
    courtName,
    form14,
  ]);

  // isOpen 가드: 모든 훅(useState, useEffect, useMemo) 이후 배치 (React 훅 규칙 준수)
  if (!isOpen) return null;

  // 클립보드 복사
  const handleCopy = async () => {
    try {
      const blob = new Blob([indictmentHtml], { type: "text/html" });
      await navigator.clipboard.write([
        new ClipboardItem({ "text/html": blob }),
      ]);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      showToast?.(
        "📋 공소장 서식 복사 완료! 카페 스마트에디터에 Ctrl+V로 붙여넣기 하세요.",
        "success",
      );
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
    const blob = new Blob([fullDoc], {
      type: "application/haansofthwp;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `공소장_${defendants[0]?.name || "피고인"}_${docNo || todayStr}.hwp`;
    a.click();
    URL.revokeObjectURL(url);
    showToast?.("💾 HWP 호환 공소장 파일이 다운로드되었습니다.", "success");
  };

  // ── AI 공소사실 초안 생성 ────────────────────────────────────────
  const callAiApi = async (mode) => {
    setAiLoading(mode);
    setAiError("");
    try {
      const selectedCase =
        ledgerData.find((c) => String(c.id) === String(selectedCaseId)) ||
        initialCase;

      const res = await fetch(
        `${import.meta.env.VITE_API_BASE_URL || "/api"}/ai/indictment-draft`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            mode,
            defendants,
            charges: chargesList,
            incidentDate:
              selectedCase?.incidentDate || selectedCase?.bookingDate || "",
            caseNo: docNo,
            evidenceList: evidenceList.filter((e) =>
              selectedEvidenceIds.has(e.id),
            ),
            currentText: crimeFacts,
          }),
        },
      );

      const data = await res.json();
      if (data.success) {
        setCrimeFacts(data.result);
        showToast?.(
          mode === "draft"
            ? "✨ AI 공소사실 초안이 생성되었습니다. 내용을 검토 후 수정하세요."
            : "✅ AI 교정이 완료되었습니다.",
          "success",
        );
      } else {
        const message = `AI 오류: ${data.message || "AI 요청에 실패했습니다."}`;
        setAiError(message);
        showToast?.(message, "error");
      }
    } catch (e) {
      const message = `AI 연결 오류: ${e.message}`;
      setAiError(message);
      showToast?.(message, "error");
    } finally {
      setAiLoading(false);
    }
  };

  const handleAiDraft = () => callAiApi("draft");
  const handleAiRefine = () => callAiApi("refine");

  // 전자결재 연동
  const handleSendToApprovals = () => {
    if (!onCreateApprovalFromIndictment) {
      showToast?.("전자결재함에 바로 연결할 수 없습니다.", "error");
      return;
    }

    // prosecutorsList에서 결재선 실제 인물 조회
    const supervisor = prosecutorsList.find((p) =>
      ["SENIOR_PROSECUTOR", "DEPUTY_CHIEF"].includes(p.roleLevel),
    );
    const chief = prosecutorsList.find((p) =>
      ["CHIEF_PROSECUTOR", "PROSECUTOR_GENERAL"].includes(p.roleLevel),
    );

    const now = new Date().toISOString().replace("T", " ").substring(0, 16);

    const approvalLine = [
      {
        role: "주임검사",
        name: prosecutorName || currentUser?.name || "",
        status: "상신완료",
        date: now,
      },
      {
        role: "부장검사",
        name: supervisor?.name || "",
        status: supervisor ? "결재대기" : "결재대기",
        date: "-",
      },
      {
        role: "지검장",
        name: chief?.name || "",
        status: "결재대기",
        date: "-",
      },
    ];

    const defNamesStr =
      defendants
        .map((d) => d.name)
        .filter(Boolean)
        .join(", ") || "미상";

    const selectedCase =
      ledgerData.find((c) => String(c.id) === String(selectedCaseId)) ||
      initialCase;

    onCreateApprovalFromIndictment({
      templateHtml: indictmentHtml,
      caseItem: selectedCase,
      docTitle: `[공소장 기안] ${docNo} 피고인 ${defNamesStr} (${chargesList.map((c) => c.name).join(", ")})`,
      dispositionType: "구공판(기소)",
      approvalLine,
    });
    onClose();
    showToast?.(
      "🚀 공소장 결재 기안문이 전자결재함에 등록되었습니다.",
      "success",
    );
  };

  // 공소장 저장 (로컬스토리지 영구 보존)
  const handleSaveIndictment = (silent = false) => {
    const caseItem =
      ledgerData.find((c) => String(c.id) === String(selectedCaseId)) ||
      initialCase;
    const caseNo = docNo || caseItem?.sujeNo || caseItem?.hyeongjeNo || "";
    const storageKey = getStorageKey(caseItem?.id, caseNo);

    const draftData = {
      caseId: selectedCaseId,
      docNo,
      courtName,
      defendants,
      chargesList,
      crimeFacts,
      customEvidenceText,
      confiscationText,
      selectedEvidenceIds: Array.from(selectedEvidenceIds),
      prosecutorName,
      prosecutorRank,
      savedAt: new Date().toISOString(),
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(draftData));
      const nowStr = new Date().toLocaleTimeString("ko-KR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setLastSavedAt(nowStr);
      setHasSavedDraft(true);
      if (!silent) {
        showToast?.("💾 공소장 작성 내용이 저장되었습니다.", "success");
      }
    } catch (err) {
      console.error("[IndictmentComposer] 저장 실패:", err);
      if (!silent) {
        showToast?.("저장에 실패했습니다.", "error");
      }
    }
  };

  // 기본 서식으로 초기화 (저장된 초안 삭제 후 초기 상태 복원)
  const handleResetIndictment = () => {
    if (
      !window.confirm(
        "작성 중인 공소장 내용을 초기화하고 사건 기본 서식으로 되돌리시겠습니까?",
      )
    ) {
      return;
    }

    const caseItem =
      ledgerData.find((c) => String(c.id) === String(selectedCaseId)) ||
      initialCase;
    const caseNo = caseItem?.sujeNo || caseItem?.hyeongjeNo || "";
    const storageKey = getStorageKey(caseItem?.id, caseNo);

    try {
      localStorage.removeItem(storageKey);
    } catch {}

    setHasSavedDraft(false);
    setLastSavedAt("");

    if (caseItem) {
      setDocNo(caseNo);
      setCourtName("도스온라인 지방법원 형사부 귀중");
      setProsecutorName(
        caseItem.prosecutorName || currentUser?.name || "담당검사",
      );

      let defs = [];
      if (Array.isArray(caseItem.suspects) && caseItem.suspects.length > 0) {
        defs = caseItem.suspects.map((s, idx) => ({
          id: s.id || `def-${idx}`,
          name: s.name || caseItem.suspectName || "",
          uuid: s.uuid || caseItem.suspectUuid || "",
          address:
            s.address ||
            s.residence ||
            s.residentialAddress ||
            caseItem.address ||
            caseItem.residence ||
            "",
          job:
            s.job || s.occupation || caseItem.job || caseItem.occupation || "",
          detentionStatus: getDetentionStatus(
            s.detentionStatus || s.bookingStatus || caseItem.bookingStatus,
          ),
        }));
      } else {
        defs = [
          {
            id: "def-0",
            name: caseItem.suspectName || "",
            uuid: caseItem.suspectUuid || "",
            address: caseItem.address || caseItem.residence || "",
            job: caseItem.job || caseItem.occupation || "",
            detentionStatus: getDetentionStatus(caseItem.bookingStatus),
          },
        ];
      }
      setDefendants(defs);

      const foundCharge = chargesData.find(
        (ch) => ch.name === caseItem.chargeName,
      );
      setChargesList([
        {
          id: "ch-0",
          name: caseItem.chargeName || "형법 위반",
          lawArticle: foundCharge?.lawArticle || "형법 제347조 (사기) 등",
        },
      ]);

      const defName = defs[0]?.name || "피고인";
      const incDate = caseItem.incidentDate || caseItem.bookingDate || todayStr;
      setCrimeFacts(
        `피고인 ${defName}은(는) ${incDate}경 도스온라인 관할 구역 내에서,\n\n피해자에게 부정한 방법으로 손해를 가할 목적으로 고의로 위법 행위를 감행하여,\n\n이로써 피고인은 ${caseItem.chargeName || "해당 범죄"}의 죄책을 면할 수 없다.`,
      );

      setCustomEvidenceText("");
      setConfiscationText(caseItem.confiscation || "");
      if (evidenceList.length > 0) {
        setSelectedEvidenceIds(new Set(evidenceList.map((e) => e.id)));
      }
    }
    showToast?.("🔄 공소장이 기본 서식으로 초기화되었습니다.", "info");
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
            background:
              "linear-gradient(135deg, rgba(30,58,138,0.25), rgba(245,158,11,0.1))",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Scale size={22} color="var(--primary-amber)" />
            <div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: "1.08rem",
                  color: "var(--text-main)",
                }}
              >
                HWP 공소장 자동작성기 (Indictment Composer)
              </div>
              <div style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                대한민국 검찰 표준 공소장 서식 · 사건/피고인/죄명/증거 연동 빌더
                · 카페 복사 & HWP 다운로드
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
            <div
              style={{
                background: "rgba(0,0,0,0.2)",
                padding: 12,
                borderRadius: 10,
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Wand2 size={15} color="var(--primary-amber)" />
                  <span
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: 800,
                      color: "var(--text-main)",
                    }}
                  >
                    1. 사건 연동 및 법원 지정
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => handleSaveIndictment(false)}
                    className="btn btn-outline"
                    style={{
                      fontSize: "0.72rem",
                      padding: "3px 8px",
                      gap: 4,
                      background: "rgba(16, 185, 129, 0.15)",
                      color: "#34d399",
                      borderColor: "rgba(16, 185, 129, 0.3)",
                    }}
                    title="현재 작성 중인 공소장 내용을 저장합니다."
                  >
                    <Save size={12} /> 저장
                  </button>
                  <button
                    type="button"
                    onClick={handleResetIndictment}
                    className="btn btn-outline"
                    style={{
                      fontSize: "0.72rem",
                      padding: "3px 8px",
                      gap: 4,
                      color: "var(--text-muted)",
                    }}
                    title="저장된 내용을 비우고 사건 기본값으로 초기화합니다."
                  >
                    <RotateCcw size={12} /> 초기화
                  </button>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <label
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--text-muted)",
                      display: "block",
                      marginBottom: 3,
                    }}
                  >
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
                        {c.sujeNo || c.hyeongjeNo} · {c.suspectName} ·{" "}
                        {c.chargeName}
                      </option>
                    ))}
                  </select>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                  }}
                >
                  <div>
                    <label
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--text-muted)",
                        display: "block",
                        marginBottom: 3,
                      }}
                    >
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
                    <label
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--text-muted)",
                        display: "block",
                        marginBottom: 3,
                      }}
                    >
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
            <div
              style={{
                background: "rgba(0,0,0,0.2)",
                padding: 12,
                borderRadius: 10,
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    color: "var(--text-main)",
                  }}
                >
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
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.76rem",
                          fontWeight: 700,
                          color: "var(--primary-amber)",
                        }}
                      >
                        피고인 {idx + 1}
                      </span>
                      {defendants.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveDefendant(d.id)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#f87171",
                            cursor: "pointer",
                            padding: 2,
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 6,
                      }}
                    >
                      <input
                        className="input-field"
                        placeholder="성명"
                        style={{ fontSize: "0.76rem" }}
                        value={d.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDefendants((prev) =>
                            prev.map((item) =>
                              item.id === d.id ? { ...item, name: val } : item,
                            ),
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
                            prev.map((item) =>
                              item.id === d.id
                                ? { ...item, detentionStatus: val }
                                : item,
                            ),
                          );
                        }}
                      >
                        <option value="">구속 여부 선택</option>
                        <option value="불구속">불구속</option>
                        <option value="구속">구속</option>
                      </select>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 6,
                      }}
                    >
                      <input
                        className="input-field"
                        placeholder="주소 (예: 주거부정)"
                        style={{ fontSize: "0.74rem" }}
                        value={d.address}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDefendants((prev) =>
                            prev.map((item) =>
                              item.id === d.id
                                ? { ...item, address: val }
                                : item,
                            ),
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
                            prev.map((item) =>
                              item.id === d.id ? { ...item, job: val } : item,
                            ),
                          );
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 3. 죄명 및 적용법조 */}
            <div
              style={{
                background: "rgba(0,0,0,0.2)",
                padding: 12,
                borderRadius: 10,
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    color: "var(--text-main)",
                  }}
                >
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
                  <div
                    key={ch.id}
                    style={{ display: "flex", gap: 6, alignItems: "center" }}
                  >
                    <div style={{ width: "42%" }}>
                      <ChargeSearchInput
                        value={ch.name}
                        chargesData={chargesData}
                        placeholder="죄명 검색 또는 입력"
                        onChange={(val) => {
                          const match = chargesData.find((c) => c.name === val);
                          setChargesList((prev) =>
                            prev.map((item) =>
                              item.id === ch.id
                                ? {
                                    ...item,
                                    name: val,
                                    lawArticle:
                                      match?.lawArticle || item.lawArticle,
                                  }
                                : item,
                            ),
                          );
                        }}
                      />
                    </div>
                    <input
                      className="input-field"
                      placeholder="적용법조 (예: 형법 제347조제1항)"
                      style={{ flex: 1, fontSize: "0.76rem" }}
                      value={ch.lawArticle}
                      onChange={(e) => {
                        const val = e.target.value;
                        setChargesList((prev) =>
                          prev.map((item) =>
                            item.id === ch.id
                              ? { ...item, lawArticle: val }
                              : item,
                          ),
                        );
                      }}
                    />
                    {chargesList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveCharge(ch.id)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#f87171",
                          cursor: "pointer",
                          padding: 2,
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 4. 공소사실(범죄사실) */}
            <div
              style={{
                background: "rgba(0,0,0,0.2)",
                padding: 12,
                borderRadius: 10,
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <span
                  style={{
                    fontSize: "0.82rem",
                    fontWeight: 800,
                    color: "var(--text-main)",
                  }}
                >
                  4. 공소사실 (범죄사실 본문)
                </span>
                <div style={{ display: "flex", gap: 5 }}>
                  <button
                    type="button"
                    onClick={handleAiDraft}
                    disabled={!!aiLoading}
                    className="btn btn-outline"
                    style={{
                      fontSize: "0.7rem",
                      padding: "2px 9px",
                      gap: 4,
                      color: "#c4b5fd",
                      borderColor: "rgba(196,181,253,0.4)",
                      opacity: aiLoading ? 0.6 : 1,
                    }}
                    title="사건 정보를 바탕으로 AI가 공소사실 초안을 작성합니다"
                  >
                    {aiLoading === "draft" ? (
                      <Loader2
                        size={11}
                        style={{ animation: "spin 1s linear infinite" }}
                      />
                    ) : (
                      <Sparkles size={11} />
                    )}
                    {aiLoading === "draft" ? "생성 중..." : "AI 초안"}
                  </button>
                  <button
                    type="button"
                    onClick={handleAiRefine}
                    disabled={!!aiLoading || !crimeFacts.trim()}
                    className="btn btn-outline"
                    style={{
                      fontSize: "0.7rem",
                      padding: "2px 9px",
                      gap: 4,
                      color: "#86efac",
                      borderColor: "rgba(134,239,172,0.4)",
                      opacity: aiLoading || !crimeFacts.trim() ? 0.5 : 1,
                    }}
                    title="작성된 공소사실을 AI가 법률 문체로 교정합니다"
                  >
                    {aiLoading === "refine" ? (
                      <Loader2
                        size={11}
                        style={{ animation: "spin 1s linear infinite" }}
                      />
                    ) : (
                      <Wand2 size={11} />
                    )}
                    {aiLoading === "refine" ? "교정 중..." : "AI 교정"}
                  </button>
                </div>
              </div>
              {aiError && (
                <div
                  role="alert"
                  style={{
                    marginBottom: 6,
                    padding: "7px 10px",
                    borderRadius: 6,
                    color: "#fecaca",
                    background: "rgba(127,29,29,0.35)",
                    border: "1px solid rgba(248,113,113,0.45)",
                    fontSize: "0.72rem",
                    lineHeight: 1.5,
                  }}
                >
                  {aiError}
                </div>
              )}
              <textarea
                className="input-field"
                style={{
                  width: "100%",
                  minHeight: 120,
                  fontSize: "0.78rem",
                  lineHeight: 1.6,
                }}
                placeholder="일시, 장소, 범행 방법, 결과 등을 상세히 기술하세요. 또는 위 'AI 초안' 버튼을 눌러 자동 생성하세요."
                value={crimeFacts}
                onChange={(e) => setCrimeFacts(e.target.value)}
              />
            </div>

            {/* 5. 증거의 요지 */}
            <div
              style={{
                background: "rgba(0,0,0,0.2)",
                padding: 12,
                borderRadius: 10,
                border: "1px solid var(--border-subtle)",
              }}
            >
              <span
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 800,
                  color: "var(--text-main)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                5. 증거의 요지 (체크 시 자동 첨부)
              </span>

              {evidenceList.length > 0 ? (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    maxHeight: 100,
                    overflowY: "auto",
                    marginBottom: 6,
                  }}
                >
                  {evidenceList.map((e) => (
                    <label
                      key={e.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: "0.74rem",
                        color: "var(--text-main)",
                        cursor: "pointer",
                      }}
                    >
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
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--text-muted)",
                    marginBottom: 6,
                  }}
                >
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              <div>
                <label
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 2,
                  }}
                >
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
                <label
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--text-muted)",
                    display: "block",
                    marginBottom: 2,
                  }}
                >
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
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              background: "#334155",
            }}
          >
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
                <span
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 800,
                    color: "var(--primary-amber)",
                  }}
                >
                  표준 규격 HWP 공소장 미리보기
                </span>
                {lastSavedAt && (
                  <span
                    style={{
                      fontSize: "0.72rem",
                      color: "#34d399",
                      background: "rgba(16, 185, 129, 0.12)",
                      border: "1px solid rgba(16, 185, 129, 0.25)",
                      padding: "2px 7px",
                      borderRadius: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Check size={11} /> 저장됨 ({lastSavedAt})
                  </span>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => handleSaveIndictment(false)}
                  className="btn btn-outline"
                  style={{
                    fontSize: "0.8rem",
                    padding: "7px 14px",
                    gap: 5,
                    background: "rgba(16, 185, 129, 0.18)",
                    color: "#34d399",
                    borderColor: "rgba(16, 185, 129, 0.4)",
                  }}
                  title="현재 작성된 공소장 내용을 저장합니다."
                >
                  <Save size={14} /> 💾 공소장 저장
                </button>
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
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: "100%",
                  maxWidth: 800,
                  boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
                  borderRadius: 4,
                  overflow: "visible",
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
