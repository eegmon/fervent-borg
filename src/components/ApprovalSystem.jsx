import React, { useState, useMemo, useEffect } from "react";
import {
  FileCheck,
  CheckCircle,
  XCircle,
  Clock,
  Printer,
  Plus,
  Trash2,
  Users,
  CheckCircle2,
  ArrowRight,
  AlertCircle,
  UserCheck,
} from "lucide-react";
import confetti from "canvas-confetti";
import {
  DOCUMENT_TYPES,
  NON_INDICTMENT_REASONS,
} from "../data/prosecutionData";
import { HWP_TEMPLATES } from "../data/hwpTemplates";
import { fetchEvidence } from "../services/api";

const NAVER_CAFE_MENU_URL =
  "https://cafe.naver.com/f-e/cafes/29669442/menus/262";

function getHwpTemplateForDoc(doc) {
  if (!doc) return null;
  const dt = DOCUMENT_TYPES.find((d) => d.id === doc.docType);
  const formId =
    doc.hwpFormId ||
    dt?.hwpFormId ||
    (doc.docType === "GIAN" ? "FORM_34" : "FORM_14");
  return (
    HWP_TEMPLATES.find((t) => t.id === formId) ||
    HWP_TEMPLATES.find((t) => t.id === "FORM_34")
  );
}

const DEFAULT_ATTACHMENTS = [
  "사건기록 사본 1부",
  "증거자료 목록 1부",
  "관련 수사보고서 1부",
];

function DispositionResolutionForm({ document }) {
  const approvalSteps = document?.approvals || [];
  const attachments = document?.attachments?.length
    ? document.attachments
    : DEFAULT_ATTACHMENTS;
  const cell = {
    border: "1px solid #374151",
    padding: "9px 10px",
    verticalAlign: "top",
  };
  const label = {
    ...cell,
    width: 112,
    background: "#f3f4f6",
    fontWeight: 800,
    color: "#1f2937",
  };
  return (
    <div
      style={{
        background: "#fff",
        color: "#111827",
        padding: "34px 42px",
        minHeight: 760,
        fontFamily: "'Noto Sans KR', sans-serif",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          borderBottom: "3px double #111827",
          paddingBottom: 14,
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.82rem",
              fontWeight: 800,
              letterSpacing: "0.12em",
            }}
          >
            도스온라인 검찰청
          </div>
          <h1
            style={{
              margin: "18px 0 4px",
              fontFamily: "'Nanum Myeongjo', serif",
              fontSize: "1.85rem",
              letterSpacing: "0.22em",
              textAlign: "center",
            }}
          >
            처분결의서
          </h1>
        </div>
        <div style={{ border: "1px solid #111827", minWidth: 300 }}>
          <div
            style={{
              background: "#e5e7eb",
              textAlign: "center",
              fontWeight: 800,
              padding: 6,
              borderBottom: "1px solid #111827",
            }}
          >
            결 재
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${Math.max(approvalSteps.length, 1)}, 1fr)`,
            }}
          >
            {approvalSteps.length ? (
              approvalSteps.map((step, index) => (
                <div
                  key={`${step.role}-${index}`}
                  style={{
                    borderRight:
                      index === approvalSteps.length - 1
                        ? 0
                        : "1px solid #111827",
                    textAlign: "center",
                    minWidth: 72,
                  }}
                >
                  <div
                    style={{
                      padding: 5,
                      fontSize: "0.68rem",
                      fontWeight: 800,
                      borderBottom: "1px solid #111827",
                    }}
                  >
                    {step.role}
                  </div>
                  <div
                    style={{
                      height: 44,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "0.7rem",
                    }}
                  >
                    {step.status?.includes("승인") ? "승인" : "대기"}
                  </div>
                  <div
                    style={{
                      padding: 5,
                      fontSize: "0.68rem",
                      borderTop: "1px solid #111827",
                    }}
                  >
                    {step.name || "미지정"}
                  </div>
                </div>
              ))
            ) : (
              <div
                style={{
                  padding: 18,
                  textAlign: "center",
                  fontSize: "0.72rem",
                }}
              >
                결재선 미지정
              </div>
            )}
          </div>
        </div>
      </div>

      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: 26,
          fontSize: "0.82rem",
        }}
      >
        <tbody>
          <tr>
            <td style={label}>문서번호</td>
            <td style={cell}>{document?.docNo || "-"}</td>
            <td style={label}>작성일자</td>
            <td style={cell}>{document?.createdAt || "-"}</td>
          </tr>
          <tr>
            <td style={label}>사건번호</td>
            <td style={cell}>{document?.hyeongjeNo || "-"}</td>
            <td style={label}>담당검사</td>
            <td style={cell}>{document?.prosecutorName || "-"}</td>
          </tr>
          <tr>
            <td style={label}>피의자</td>
            <td style={cell}>{document?.suspectName || "-"}</td>
            <td style={label}>적용 죄명</td>
            <td style={cell}>{document?.chargeName || "-"}</td>
          </tr>
        </tbody>
      </table>

      <div
        style={{
          marginTop: 24,
          borderTop: "2px solid #111827",
          borderBottom: "1px solid #111827",
          padding: "10px 0",
          textAlign: "center",
          fontWeight: 900,
          letterSpacing: "0.16em",
        }}
      >
        처 분 결 정
      </div>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: 12,
          fontSize: "0.86rem",
        }}
      >
        <tbody>
          <tr>
            <td style={label}>처분 구분</td>
            <td style={{ ...cell, fontWeight: 900, color: "#b91c1c" }}>
              {document?.dispositionType || "-"}
            </td>
          </tr>
          <tr>
            <td style={label}>결정 주문</td>
            <td style={{ ...cell, minHeight: 76, lineHeight: 1.8 }}>
              위 사건에 대하여 수사기록과 제출된 증거자료를 검토한 결과, 위와
              같이 처분하기로 결의한다.
            </td>
          </tr>
          <tr>
            <td style={label}>결정 이유</td>
            <td style={{ ...cell, whiteSpace: "pre-wrap", lineHeight: 1.8 }}>
              {document?.summary || "결정 이유가 입력되지 않았습니다."}
            </td>
          </tr>
        </tbody>
      </table>

      <div
        style={{
          marginTop: 24,
          paddingTop: 12,
          borderTop: "1px solid #9ca3af",
          fontSize: "0.78rem",
          lineHeight: 1.8,
        }}
      >
        <strong>첨부서류</strong>
        {attachments.map((item, index) => (
          <div key={`${item}-${index}`}>
            {index + 1}. {item}
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "flex-end",
          marginTop: 38,
          gap: 18,
        }}
      >
        <div
          style={{ textAlign: "center", fontSize: "0.8rem", lineHeight: 1.8 }}
        >
          {document?.createdAt || "-"}
          <br />
          담당검사 {document?.prosecutorName || "-"}
        </div>
        <div
          style={{
            width: 64,
            height: 64,
            border: "2px solid #b91c1c",
            borderRadius: "50%",
            color: "#b91c1c",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            fontWeight: 900,
            fontSize: "0.72rem",
          }}
        >
          검찰청
          <br />
          관인
        </div>
      </div>
    </div>
  );
}

const S = {
  wrap: { display: "flex", gap: 20 },
  left: {
    width: 320,
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  docCard: (selected) => ({
    padding: "14px 16px",
    borderRadius: 10,
    cursor: "pointer",
    transition: "all 0.15s",
    border: selected
      ? "1px solid var(--primary-amber)"
      : "1px solid var(--border-subtle)",
    background: selected ? "rgba(245,158,11,0.06)" : "var(--bg-card)",
  }),
  right: { flex: 1, minWidth: 0 },
  paper: {
    background: "#fff",
    color: "#000",
    borderRadius: 4,
    boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
    position: "relative",
    overflow: "hidden",
    fontFamily: "'Noto Sans KR', sans-serif",
  },
  paperTopBar: { height: 5, background: "#0f172a", width: "100%" },
  paperInner: { padding: "48px 60px 40px" },
  titleRow: {
    textAlign: "center",
    borderBottom: "2px solid #000",
    paddingBottom: 20,
    marginBottom: 28,
  },
  docTitle: {
    fontSize: "2rem",
    fontFamily: "'Nanum Myeongjo', serif",
    fontWeight: 800,
    letterSpacing: "0.4em",
    color: "#000",
    marginLeft: "0.4em",
  },
  docNo: { fontSize: "0.82rem", color: "#475569", marginTop: 6 },
  metaRow: {
    display: "grid",
    gridTemplateColumns: "80px 1fr",
    rowGap: 10,
    columnGap: 16,
    fontSize: "1rem",
    marginBottom: 24,
  },
  metaLabel: {
    fontWeight: 700,
    color: "#374151",
    borderRight: "1px solid #d1d5db",
    paddingRight: 12,
  },
  metaValue: { color: "#111827" },
  divider: { border: "none", borderTop: "1px solid #e5e7eb", margin: "20px 0" },
  bodySection: { fontSize: "1rem", lineHeight: 2, marginBottom: 40 },
  bodyIndent: { paddingLeft: 28 },
  signSection: { marginTop: 32 },
  signTitle: {
    fontSize: "0.8rem",
    fontWeight: 800,
    color: "#374151",
    textAlign: "center",
    letterSpacing: "0.12em",
    marginBottom: 16,
  },
  signGrid: { display: "flex", gap: 0, border: "1px solid #000" },
  signCell: {
    flex: 1,
    borderRight: "1px solid #000",
    textAlign: "center",
    position: "relative",
  },
  signCellLast: { flex: 1, textAlign: "center", position: "relative" },
  signRoleRow: {
    background: "#f1f5f9",
    padding: "8px 4px",
    fontWeight: 700,
    fontSize: "0.82rem",
    borderBottom: "1px solid #000",
  },
  signBox: {
    height: 90,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderBottom: "1px solid #000",
    position: "relative",
  },
  signName: {
    padding: "6px 4px",
    fontSize: "0.82rem",
    fontWeight: 700,
    borderBottom: "1px solid #000",
  },
  signDate: { padding: "6px 4px", fontSize: "0.72rem", color: "#6b7280" },
  seal: {
    width: 66,
    height: 66,
    borderRadius: "50%",
    border: "3px solid #dc2626",
    color: "#dc2626",
    fontWeight: 900,
    fontSize: "0.72rem",
    lineHeight: 1.2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    animation: "sealIn 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275)",
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    borderTop: "2px solid #000",
    paddingTop: 14,
    marginTop: 36,
  },
  footerOrg: { fontSize: "1.05rem", fontWeight: 800 },
  footerNo: { fontSize: "0.82rem", color: "#6b7280" },
};

export default function ApprovalSystem({
  approvals,
  onApproveDoc,
  onRejectDoc,
  currentUser,
  onSaveNewApproval,
  onUpdateApprovalDoc,
  ledgerData,
  nextDocNo,
  onToast,
  prosecutorsList = [],
}) {
  const approvalList = (Array.isArray(approvals) ? approvals : []).map(
    (doc) => ({
      ...doc,
      status: String(doc.status || "결재대기"),
      approvals: (Array.isArray(doc.approvals) ? doc.approvals : []).map(
        (step) => ({
          ...step,
          role: String(step.role || "결재자"),
          name: String(step.name || "미지정"),
          status: String(step.status || "결재대기"),
        }),
      ),
    }),
  );
  const [selectedDoc, setSelectedDoc] = useState(approvalList[0] || null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [isEditingDoc, setIsEditingDoc] = useState(false);
  const [isEditingHwp, setIsEditingHwp] = useState(false);
  const [editedHwpHtml, setEditedHwpHtml] = useState("");
  const [editDocForm, setEditDocForm] = useState({
    dispositionType: "",
    summary: "",
    attachments: DEFAULT_ATTACHMENTS,
  });
  const [newDocData, setNewDocData] = useState({
    docType: "GIAN",
    hyeongjeNo: ledgerData[0]?.hyeongjeNo || "",
    suspectName: ledgerData[0]?.suspectName || "",
    chargeName: ledgerData[0]?.chargeName || "",
    dispositionType: "기안 및 청구",
    summary:
      "피의자의 범죄 혐의 및 수사 건과 관련하여 기안문(별지 제34호서식) 및 첨부 서류를 작성하여 상신합니다.",
    attachments: [...DEFAULT_ATTACHMENTS],
  });

  useEffect(() => {
    const template = getHwpTemplateForDoc(selectedDoc);
    setEditedHwpHtml(selectedDoc?.hwpHtml || template?.html || "");
    setIsEditingHwp(false);
  }, [selectedDoc]);

  const [selectedPersonFilter, setSelectedPersonFilter] = useState("ALL");
  const [caseEvidence, setCaseEvidence] = useState([]);

  useEffect(() => {
    const caseNo = selectedDoc?.hyeongjeNo || newDocData.hyeongjeNo;
    if (!caseNo) {
      setCaseEvidence([]);
      return;
    }

    let cancelled = false;
    fetchEvidence(caseNo)
      .then((data) => {
        if (!cancelled) {
          setCaseEvidence(Array.isArray(data) ? data : []);
        }
      })
      .catch(() => {
        if (!cancelled) setCaseEvidence([]);
      });

    return () => {
      cancelled = true;
    };
  }, [newDocData.hyeongjeNo, selectedDoc?.hyeongjeNo]);

  const personFilters = useMemo(() => {
    const names = new Set(
      prosecutorsList.map((prosecutor) => prosecutor.name).filter(Boolean),
    );
    approvalList.forEach((doc) => {
      if (doc.prosecutorName) names.add(doc.prosecutorName);
      (doc.approvals || []).forEach(
        (approver) => approver.name && names.add(approver.name),
      );
    });
    return ["ALL", ...names];
  }, [prosecutorsList, approvalList]);

  const filteredApprovals = useMemo(() => {
    if (!selectedPersonFilter || selectedPersonFilter === "ALL")
      return approvalList;
    return approvalList.filter((doc) => {
      const isAuthor = doc.prosecutorName?.includes(selectedPersonFilter);
      const isInLine = doc.approvals?.some((app) =>
        app.name?.includes(selectedPersonFilter),
      );
      return isAuthor || isInLine;
    });
  }, [approvalList, selectedPersonFilter]);

  const handleSelectApproverFromGrid = (personName) => {
    if (!personName) return;
    const cleanName = personName
      .replace(" [전결]", "")
      .replace(" (대결)", "")
      .trim();
    setSelectedPersonFilter(cleanName);

    const matchingDoc = approvalList.find(
      (doc) =>
        doc.prosecutorName?.includes(cleanName) ||
        doc.approvals?.some((app) => app.name?.includes(cleanName)),
    );
    if (matchingDoc) {
      setSelectedDoc(matchingDoc);
      setIsCreatingNew(false);
    }
  };

  const handleOpenEditDocModal = () => {
    if (!selectedDoc) return;
    setEditDocForm({
      dispositionType: selectedDoc.dispositionType || "구속기소",
      summary: selectedDoc.summary || "",
      attachments:
        selectedDoc.attachments?.length > 0
          ? [...selectedDoc.attachments]
          : [...DEFAULT_ATTACHMENTS],
    });
    setIsEditingDoc(true);
  };

  const handleSaveDocEdit = (e) => {
    e.preventDefault();
    if (!selectedDoc) return;
    const updatedDoc = {
      ...selectedDoc,
      dispositionType: editDocForm.dispositionType,
      summary: editDocForm.summary,
      attachments: editDocForm.attachments.filter(Boolean),
    };
    setSelectedDoc(updatedDoc);
    if (onUpdateApprovalDoc) {
      onUpdateApprovalDoc(updatedDoc);
    }
    setIsEditingDoc(false);
    alert(
      `[결재 내용 수정 완료] 문서번호 ${selectedDoc.docNo} 청구 내용이 정상적으로 업데이트되었습니다.`,
    );
  };

  const handleSaveHwpEdit = () => {
    if (!selectedDoc) return;
    const updatedDoc = { ...selectedDoc, hwpHtml: editedHwpHtml };
    setSelectedDoc(updatedDoc);
    onUpdateApprovalDoc?.(updatedDoc);
    setIsEditingHwp(false);
    onToast?.("수정한 HWP 본문을 저장했습니다.", "success");
  };

  const handleCopyHwpForCafe = async () => {
    if (!selectedDoc) return;
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/html": new Blob([`<meta charset="utf-8">${editedHwpHtml}`], {
            type: "text/html",
          }),
          "text/plain": new Blob([selectedDoc.summary || ""], {
            type: "text/plain",
          }),
        }),
      ]);
      onToast?.(
        "수정한 문서를 복사했습니다. 네이버 카페에서 붙여넣으세요.",
        "success",
      );
    } catch (error) {
      onToast?.(`카페용 복사에 실패했습니다: ${error.message}`, "error");
    }
  };
  const [viewMode, setViewMode] = useState("HWP"); // 'HWP' | 'GOV_PAPER'

  const [approvalLine, setApprovalLine] = useState([
    {
      role: "담당검사",
      name: currentUser?.name || prosecutorsList[0]?.name || "",
      status: "상신완료",
      date: new Date().toISOString().replace("T", " ").substring(0, 16),
    },
    {
      role: "부장검사",
      name:
        prosecutorsList.find((p) => p.roleLevel === "SENIOR_PROSECUTOR")
          ?.name || "",
      status: "결재대기",
      date: "-",
    },
    {
      role: "지검장",
      name:
        prosecutorsList.find((p) =>
          ["CHIEF_PROSECUTOR", "PROSECUTOR_GENERAL"].includes(p.roleLevel),
        )?.name || "",
      status: "결재대기",
      date: "-",
    },
  ]);

  const [showDelegationRulesModal, setShowDelegationRulesModal] =
    useState(false);

  // 반려 모달 상태
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("보완수사요구");

  const handleRejectConfirm = () => {
    if (!selectedDoc || !rejectReason.trim()) return;
    onRejectDoc(selectedDoc.id, currentUser?.id, rejectReason.trim());
    setRejectModalOpen(false);
    setRejectReason("보완수사요구");
  };

  const canArbitraryApprove = Boolean(currentUser?.canArbitraryApprove);
  const isApprovalRequired = Boolean(
    ledgerData?.some(
      (caseItem) =>
        caseItem.hyeongjeNo === selectedDoc?.hyeongjeNo &&
        caseItem.supervisorDesignated,
    ),
  );

  const handleApproveStandard = (docId) => {
    if (!selectedDoc) return;
    const now = new Date().toISOString().replace("T", " ").substring(0, 16);
    const isHighRank = [
      "SUPER_ADMIN",
      "PROSECUTOR_GENERAL",
      "CHIEF_PROSECUTOR",
      "DEPUTY_CHIEF",
    ].includes(currentUser?.roleLevel);

    const updatedLine = selectedDoc.approvals.map((app, idx) => {
      const isLast = idx === selectedDoc.approvals.length - 1;
      return {
        ...app,
        name: isLast
          ? currentUser?.name || app.name
          : app.status.includes("대기")
            ? `${app.name} [직권승인]`
            : app.name,
        status: isLast ? "최종결재(인장날인)" : "승인완료",
        date: app.date === "-" ? now : app.date,
      };
    });

    const updatedDoc = {
      ...selectedDoc,
      status: "최종승인",
      approvedBy: `${currentUser?.name || "검찰총장"} (${currentUser?.position || currentUser?.title || "최고결재권자"})`,
      approvals: updatedLine,
    };

    onApproveDoc(docId, currentUser?.id, "STANDARD", updatedDoc);
    setSelectedDoc(updatedDoc);
    try {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    } catch {}

    if (isHighRank) {
      if (onToast)
        onToast(
          `⚡ [직권 결재 승인] ${currentUser?.position || currentUser?.title || "검찰총장"} 권한으로 즉시 최종 승인 처리되었습니다.`,
          "success",
        );
      else
        alert(
          `⚡ [직권 결재 승인] ${currentUser?.position || currentUser?.title || "검찰총장"} 권한으로 이전 결재 단계와 상관없이 본 공문서가 즉시 최종 승인 및 관인 날인 처리되었습니다.`,
        );
    } else {
      if (onToast)
        onToast(
          `[전자 결재 승인] 본 공문서가 성공적으로 결재 승인 처리되었습니다.`,
          "success",
        );
      else
        alert(
          `[전자 결재 승인] 본 공문서가 성공적으로 결재 승인 및 관인 날인 처리되었습니다.`,
        );
    }
  };

  const handleApprove = handleApproveStandard;

  const handleApproveArbitrary = (docId) => {
    if (!selectedDoc || isApprovalRequired) {
      onToast?.("결재 필수 지정 사건은 전결 승인할 수 없습니다.", "error");
      return;
    }
    const now = new Date().toISOString().replace("T", " ").substring(0, 16);
    const approverTitle =
      currentUser?.position || currentUser?.title || "결재자";

    const updatedLine = selectedDoc.approvals.map((app) => {
      if (app.status.includes("대기")) {
        return {
          ...app,
          type: "전결",
          name: `${currentUser?.name} [전결]`,
          status: "전결승인",
          date: now,
        };
      }
      return app;
    });

    const updatedDoc = {
      ...selectedDoc,
      status: "최종승인 (전결)",
      approvedBy: `${currentUser?.name} (${approverTitle} 전결)`,
      approvals: updatedLine,
    };

    onApproveDoc(docId, currentUser?.id, "ARBITRARY", updatedDoc);
    setSelectedDoc(updatedDoc);
    try {
      confetti({ particleCount: 110, spread: 80, origin: { y: 0.6 } });
    } catch {}
    alert(
      `[사무전결 완료] ${approverTitle} 권한으로 본 공문서가 전결(專決) 처리되었습니다.`,
    );
  };

  const handleApproveSubstitute = (docId) => {
    if (!selectedDoc) return;
    const now = new Date().toISOString().replace("T", " ").substring(0, 16);
    const approverTitle =
      currentUser?.position || currentUser?.title || "대결자";

    const updatedLine = selectedDoc.approvals.map((app) => {
      if (app.status.includes("대기")) {
        return {
          ...app,
          type: "대결",
          name: `${currentUser?.name} (대결)`,
          status: "대결승인",
          date: now,
        };
      }
      return app;
    });

    const updatedDoc = {
      ...selectedDoc,
      status: "대결승인",
      approvedBy: `${currentUser?.name} (${approverTitle} 대결)`,
      approvals: updatedLine,
    };

    onApproveDoc(docId, currentUser?.id, "SUBSTITUTE", updatedDoc);
    setSelectedDoc(updatedDoc);
    try {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    } catch {}
    alert(
      `[대결 처리 완료] 상급자 부재에 따라 ${approverTitle} 권한으로 대결(代決) 승인되었습니다.`,
    );
  };

  const handleCreateSubmit = (e) => {
    e.preventDefault();
    const dt =
      DOCUMENT_TYPES.find((d) => d.id === newDocData.docType) ||
      DOCUMENT_TYPES[0];
    const seqDocNo = nextDocNo
      ? nextDocNo()
      : `2026-결재-${Math.floor(100 + Math.random() * 900)}`;
    const seqId = `APP-${seqDocNo.replace("2026-결재-", "2026-")}`;
    const doc = {
      id: seqId,
      docNo: seqDocNo,
      docType: newDocData.docType,
      docTypeName: dt.label,
      title: `${newDocData.hyeongjeNo}호 피의자 ${newDocData.suspectName} ${dt.label}`,
      hyeongjeNo: newDocData.hyeongjeNo,
      prosecutorId: currentUser?.id || "",
      prosecutorName: currentUser?.name || "",
      suspectName: newDocData.suspectName,
      dispositionType: newDocData.dispositionType,
      chargeName: newDocData.chargeName,
      summary: newDocData.summary,
      attachments: newDocData.attachments.filter(Boolean),
      status: `${approvalLine[1]?.role || "부장검사"}결재대기`,
      createdAt: new Date().toISOString().split("T")[0],
      approvals: approvalLine,
    };
    onSaveNewApproval(doc);
    setSelectedDoc(doc);
    setIsCreatingNew(false);
    alert(`[상신 완료] ${dt.label} 결재 문서가 상신되었습니다.`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Header */}
      <div
        className="glass-panel gold-border"
        style={{
          padding: "16px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <div
            style={{
              fontWeight: 800,
              fontSize: "1rem",
              color: "var(--text-main)",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <FileCheck size={18} color="var(--primary-amber)" />
            전자 결재함
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              marginTop: 2,
            }}
          >
            공문서 형식의 전자 결재 시스템
          </div>
        </div>
        <button
          onClick={() => setIsCreatingNew(true)}
          className="btn btn-gold"
          style={{ fontSize: "0.82rem" }}
        >
          <Plus size={15} /> 신규 결재 서식 작성
        </button>
      </div>

      {/* Body */}
      <div style={S.wrap}>
        {/* Left: Document List */}
        <div style={S.left}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 6,
            }}
          >
            <div
              style={{
                fontSize: "0.72rem",
                fontWeight: 700,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              결재 문서 목록 ({filteredApprovals.length}건)
            </div>
            {selectedPersonFilter !== "ALL" && (
              <button
                onClick={() => setSelectedPersonFilter("ALL")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--primary-amber)",
                  fontSize: "0.7rem",
                  cursor: "pointer",
                }}
              >
                전체보기 ✕
              </button>
            )}
          </div>

          {/* Filter Chips */}
          <div
            style={{
              display: "flex",
              gap: 4,
              flexWrap: "wrap",
              marginBottom: 8,
            }}
          >
            {personFilters.map((person) => {
              const active = selectedPersonFilter === person;
              return (
                <button
                  key={person}
                  onClick={() => {
                    setSelectedPersonFilter(person);
                    if (person !== "ALL") {
                      const match = approvalList.find(
                        (d) =>
                          d.prosecutorName?.includes(person) ||
                          d.approvals?.some((a) => a.name?.includes(person)),
                      );
                      if (match) {
                        setSelectedDoc(match);
                        setIsCreatingNew(false);
                      }
                    }
                  }}
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    padding: "3px 8px",
                    borderRadius: 12,
                    cursor: "pointer",
                    transition: "all 0.15s",
                    background: active
                      ? "var(--primary-amber)"
                      : "var(--bg-elevated)",
                    color: active ? "#000" : "var(--text-muted)",
                    border: active
                      ? "1px solid var(--primary-amber)"
                      : "1px solid var(--border-subtle)",
                  }}
                >
                  {person === "ALL" ? "전체" : person}
                </button>
              );
            })}
          </div>

          <div
            style={{
              maxHeight: 660,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {filteredApprovals.length === 0 ? (
              <div
                style={{
                  padding: "20px 10px",
                  textAlign: "center",
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  background: "var(--bg-elevated)",
                  borderRadius: 8,
                }}
              >
                해당 검사의 결재 문서가 없습니다.
              </div>
            ) : (
              filteredApprovals.map((doc) => {
                const sel = selectedDoc?.id === doc.id && !isCreatingNew;
                const approved = doc.status === "최종승인";
                const pending = doc.status.includes("대기");
                return (
                  <div
                    key={doc.id}
                    style={S.docCard(sel)}
                    onClick={() => {
                      setSelectedDoc(doc);
                      setIsCreatingNew(false);
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 6,
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: "0.72rem",
                          color: "var(--primary-amber)",
                          fontWeight: 700,
                        }}
                      >
                        {doc.docNo}
                      </span>
                      {approved ? (
                        <span className="badge badge-success">
                          <CheckCircle size={10} />
                          승인완료
                        </span>
                      ) : pending ? (
                        <span className="badge badge-warning">
                          <Clock size={10} />
                          {doc.status}
                        </span>
                      ) : (
                        <span className="badge badge-danger">
                          <XCircle size={10} />
                          {doc.status}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        color: "var(--text-main)",
                        lineHeight: 1.4,
                        marginBottom: 8,
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                      }}
                    >
                      {doc.title}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "0.7rem",
                        color: "var(--text-muted)",
                        paddingTop: 8,
                        borderTop: "1px solid var(--border-subtle)",
                      }}
                    >
                      <span>{doc.prosecutorName}</span>
                      <span style={{ fontFamily: "monospace" }}>
                        {doc.createdAt}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Official Document or Create Form */}
        <div style={S.right}>
          {isCreatingNew ? (
            /* Create Form */
            <div className="glass-panel" style={{ padding: 24 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 20,
                  paddingBottom: 16,
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                <span
                  style={{
                    fontWeight: 800,
                    fontSize: "0.95rem",
                    color: "var(--text-main)",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Plus size={16} color="var(--primary-amber)" /> 신규 결재 서식
                  작성
                </span>
                <button
                  onClick={() => setIsCreatingNew(false)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--text-muted)",
                    fontSize: "1.2rem",
                  }}
                >
                  ✕
                </button>
              </div>
              <form
                onSubmit={handleCreateSubmit}
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {/* Doc Type */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      marginBottom: 8,
                    }}
                  >
                    서식 양식 선택
                  </label>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: 8,
                    }}
                  >
                    {DOCUMENT_TYPES.map((dt) => (
                      <div
                        key={dt.id}
                        onClick={() =>
                          setNewDocData({ ...newDocData, docType: dt.id })
                        }
                        style={{
                          padding: "10px 14px",
                          borderRadius: 8,
                          cursor: "pointer",
                          transition: "all 0.15s",
                          border:
                            newDocData.docType === dt.id
                              ? "1px solid var(--primary-amber)"
                              : "1px solid var(--border-subtle)",
                          background:
                            newDocData.docType === dt.id
                              ? "rgba(245,158,11,0.08)"
                              : "var(--bg-elevated)",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            fontSize: "0.8rem",
                            color:
                              newDocData.docType === dt.id
                                ? "var(--primary-amber)"
                                : "var(--text-main)",
                          }}
                        >
                          {dt.label}
                        </div>
                        <div
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--text-muted)",
                            marginTop: 2,
                          }}
                        >
                          {dt.desc}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Case + Disposition */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        color: "var(--text-muted)",
                        marginBottom: 6,
                      }}
                    >
                      관련 사건
                    </label>
                    <select
                      className="select-field"
                      value={newDocData.hyeongjeNo}
                      onChange={(e) => {
                        const m = ledgerData.find(
                          (l) => l.hyeongjeNo === e.target.value,
                        );
                        setNewDocData({
                          ...newDocData,
                          hyeongjeNo: e.target.value,
                          suspectName: m?.suspectName || newDocData.suspectName,
                          chargeName: m?.chargeName || newDocData.chargeName,
                        });
                      }}
                    >
                      {ledgerData.map((l) => (
                        <option key={l.id} value={l.hyeongjeNo}>
                          {l.hyeongjeNo} ({l.suspectName})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        color: "var(--text-muted)",
                        marginBottom: 6,
                      }}
                    >
                      처분 구분
                    </label>
                    <input
                      className="input-field"
                      value={newDocData.dispositionType}
                      onChange={(e) =>
                        setNewDocData({
                          ...newDocData,
                          dispositionType: e.target.value,
                        })
                      }
                      placeholder="예: 구속기소 / 불기소"
                    />
                  </div>
                </div>

                {/* 검찰사무규칙 불기소 사유 선택 */}
                {(newDocData.docType === "NON_INDICTMENT" ||
                  newDocData.docType === "SUSPENSION" ||
                  (newDocData.dispositionType &&
                    newDocData.dispositionType.includes("불기소"))) && (
                  <div
                    style={{
                      background: "rgba(239,68,68,0.06)",
                      padding: 12,
                      borderRadius: 8,
                      border: "1px solid rgba(239,68,68,0.2)",
                    }}
                  >
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.78rem",
                        fontWeight: 800,
                        color: "#f87171",
                        marginBottom: 4,
                      }}
                    >
                      ⚖️ 검찰사무규칙 제115조(불기소 결정의 종류) 사유 선택
                    </label>
                    <select
                      className="select-field"
                      onChange={(e) => {
                        const reason = NON_INDICTMENT_REASONS.find(
                          (r) => r.id === e.target.value,
                        );
                        if (reason) {
                          setNewDocData((prev) => ({
                            ...prev,
                            dispositionType: `불기소 (${reason.label})`,
                            summary: `[검찰사무규칙 제115조 불기소 결정 - ${reason.label}]\n1. 피의사실: ${prev.chargeName || "관련 사건"} 혐의\n2. 불기소 사유: ${reason.desc}\n3. 처분 의견: 피의자에 대한 피의사실은 ${reason.desc}. 이에 따라 검찰사무규칙 제115조에 의거 불기소(${reason.category}) 결정함이 타당함.`,
                          }));
                        }
                      }}
                    >
                      <option value="">
                        불기소 표준 사유 선택 (검찰사무규칙)...
                      </option>
                      {NON_INDICTMENT_REASONS.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.label} — {r.desc}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Summary */}
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      color: "var(--text-muted)",
                      marginBottom: 6,
                    }}
                  >
                    결재 청구 내용
                  </label>
                  <textarea
                    className="textarea-field"
                    rows={3}
                    value={newDocData.summary}
                    onChange={(e) =>
                      setNewDocData({ ...newDocData, summary: e.target.value })
                    }
                  />
                </div>

                <div
                  style={{
                    background: "var(--bg-elevated)",
                    borderRadius: 10,
                    padding: 14,
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        color: "var(--primary-amber)",
                      }}
                    >
                      첨부서류 목록
                    </span>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {caseEvidence.length > 0 && (
                        <button
                          type="button"
                          className="btn btn-outline"
                          style={{
                            fontSize: "0.72rem",
                            padding: "4px 10px",
                            color: "#60a5fa",
                            borderColor: "rgba(96,165,250,0.4)",
                          }}
                          onClick={() =>
                            setNewDocData((prev) => ({
                              ...prev,
                              attachments: [
                                ...prev.attachments,
                                `${caseEvidence[0].title} (${caseEvidence[0].url})`,
                              ],
                            }))
                          }
                        >
                          증거자료 연결
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{ fontSize: "0.72rem", padding: "4px 10px" }}
                        onClick={() =>
                          setNewDocData((prev) => ({
                            ...prev,
                            attachments: [...prev.attachments, ""],
                          }))
                        }
                      >
                        + 추가
                      </button>
                    </div>
                  </div>
                  {caseEvidence.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        marginBottom: 10,
                      }}
                    >
                      {caseEvidence.slice(0, 5).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setNewDocData((prev) => ({
                              ...prev,
                              attachments: [
                                ...prev.attachments.filter(Boolean),
                                `${item.title} (${item.url})`,
                              ],
                            }))
                          }
                          style={{
                            border: "1px solid rgba(96,165,250,0.4)",
                            background: "rgba(96,165,250,0.08)",
                            color: "#dbeafe",
                            borderRadius: 999,
                            padding: "4px 8px",
                            cursor: "pointer",
                            fontSize: "0.68rem",
                          }}
                        >
                          {item.title}
                        </button>
                      ))}
                    </div>
                  )}
                  {newDocData.attachments.map((item, index) => (
                    <div
                      key={`new-attachment-${index}`}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          width: 24,
                          textAlign: "center",
                          color: "var(--text-muted)",
                          fontWeight: 700,
                        }}
                      >
                        {index + 1}.
                      </span>
                      <input
                        className="input-field"
                        value={item}
                        onChange={(e) => {
                          const next = [...newDocData.attachments];
                          next[index] = e.target.value;
                          setNewDocData({ ...newDocData, attachments: next });
                        }}
                        placeholder="예: 사건기록 사본 1부"
                        style={{ flex: 1 }}
                      />
                      {newDocData.attachments.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setNewDocData((prev) => ({
                              ...prev,
                              attachments: prev.attachments.filter(
                                (_, idx) => idx !== index,
                              ),
                            }))
                          }
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--text-muted)",
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Approval Line */}
                <div
                  style={{
                    background: "var(--bg-elevated)",
                    borderRadius: 10,
                    padding: 14,
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        fontSize: "0.8rem",
                        color: "var(--primary-amber)",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <Users size={14} />
                      결재라인 편집
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setApprovalLine([
                          ...approvalLine,
                          {
                            role: "차장검사",
                            name:
                              prosecutorsList.find(
                                (p) => p.roleLevel === "DEPUTY_CHIEF",
                              )?.name ||
                              prosecutorsList[0]?.name ||
                              "",
                            status: "결재대기",
                            date: "-",
                          },
                        ])
                      }
                      className="btn btn-outline"
                      style={{ fontSize: "0.72rem", padding: "4px 10px" }}
                    >
                      + 단계 추가
                    </button>
                  </div>
                  {approvalLine.map((step, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        marginBottom: 6,
                      }}
                    >
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: "50%",
                          background: "rgba(245,158,11,0.2)",
                          color: "var(--primary-amber)",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <input
                        className="input-field"
                        value={step.role}
                        style={{ width: 110 }}
                        onChange={(e) => {
                          const u = [...approvalLine];
                          u[idx].role = e.target.value;
                          setApprovalLine(u);
                        }}
                      />
                      <select
                        className="select-field"
                        value={step.name}
                        onChange={(e) => {
                          const u = [...approvalLine];
                          u[idx].name = e.target.value;
                          setApprovalLine(u);
                        }}
                      >
                        {prosecutorsList.map((p) => (
                          <option key={p.id} value={p.name}>
                            {p.name} ({p.title})
                          </option>
                        ))}
                      </select>
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            setApprovalLine(
                              approvalLine.filter((_, i) => i !== idx),
                            )
                          }
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--text-muted)",
                            flexShrink: 0,
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  className="btn btn-gold"
                  style={{ fontSize: "0.85rem", padding: "10px" }}
                >
                  <CheckCircle2 size={15} /> 전자 결재 상신 완료
                </button>
              </form>
            </div>
          ) : selectedDoc ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* Action Bar */}
              <div
                className="glass-panel"
                style={{
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <div
                  style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}
                >
                  결재 권한:{" "}
                  <span
                    style={{ color: "var(--primary-amber)", fontWeight: 700 }}
                  >
                    {currentUser
                      ? `${currentUser.name} · ${currentUser.title}`
                      : "로그인 필요"}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    flexWrap: "wrap",
                    alignItems: "center",
                  }}
                >
                  {selectedDoc.status !== "최종승인" &&
                    !selectedDoc.status?.includes("전결") &&
                    !selectedDoc.status?.includes("대결") && (
                      <>
                        <button
                          onClick={() => handleApprove(selectedDoc.id)}
                          className="btn btn-gold"
                          style={{ fontSize: "0.78rem", padding: "6px 12px" }}
                          title="본인 결재 권한으로 결재 승인"
                        >
                          <CheckCircle size={14} /> 일반 결재 승인
                        </button>
                        {canArbitraryApprove && !isApprovalRequired && (
                          <button
                            onClick={() =>
                              handleApproveArbitrary(selectedDoc.id)
                            }
                            className="btn btn-secondary"
                            style={{
                              fontSize: "0.78rem",
                              padding: "6px 12px",
                              color: "#f59e0b",
                              borderColor: "rgba(245,158,11,0.4)",
                            }}
                            title="사무관리규정 제10조 전결(專決) 승인"
                          >
                            ⚡ 전결 (專決) 승인
                          </button>
                        )}
                        <button
                          onClick={() =>
                            handleApproveSubstitute(selectedDoc.id)
                          }
                          className="btn btn-secondary"
                          style={{
                            fontSize: "0.78rem",
                            padding: "6px 12px",
                            color: "#38bdf8",
                            borderColor: "rgba(56,189,248,0.4)",
                          }}
                          title="사무대리규정 제7조 대결(代決) 승인"
                        >
                          🤝 대결 (代決) 승인
                        </button>
                        <button
                          onClick={() => setRejectModalOpen(true)}
                          className="btn btn-secondary"
                          style={{
                            fontSize: "0.78rem",
                            padding: "6px 12px",
                            color: "#f87171",
                            borderColor: "rgba(239,68,68,0.4)",
                          }}
                        >
                          <XCircle size={14} /> 반려
                        </button>
                      </>
                    )}
                  <button
                    onClick={() =>
                      setViewMode(viewMode === "HWP" ? "GOV_PAPER" : "HWP")
                    }
                    className="btn btn-outline"
                    style={{
                      fontSize: "0.78rem",
                      padding: "6px 12px",
                      color: "#f59e0b",
                      border: "1px solid rgba(245,158,11,0.4)",
                    }}
                  >
                    {viewMode === "HWP"
                      ? "📜 표준 공문서 뷰"
                      : "📄 HWP 원본 양식 뷰 (34종)"}
                  </button>
                  <button
                    onClick={() => setShowDelegationRulesModal(true)}
                    className="btn btn-outline"
                    style={{
                      fontSize: "0.78rem",
                      padding: "6px 12px",
                      color: "#a7f3d0",
                      border: "1px solid rgba(167,243,208,0.3)",
                    }}
                  >
                    ⚖️ 위임/대결 규정
                  </button>
                  <button
                    onClick={handleOpenEditDocModal}
                    className="btn btn-outline"
                    style={{
                      fontSize: "0.78rem",
                      padding: "6px 12px",
                      color: "#93c5fd",
                      border: "1px solid rgba(147,197,253,0.3)",
                    }}
                  >
                    ✏️ 내용 수정
                  </button>
                  {viewMode === "HWP" && (
                    <>
                      <button
                        onClick={() => setIsEditingHwp((value) => !value)}
                        className="btn btn-outline"
                        style={{
                          fontSize: "0.78rem",
                          padding: "6px 12px",
                          color: "#fbbf24",
                        }}
                      >
                        ✍️ {isEditingHwp ? "본문 편집 닫기" : "HWP 본문 수정"}
                      </button>
                      <button
                        onClick={handleCopyHwpForCafe}
                        className="btn btn-gold"
                        style={{ fontSize: "0.78rem", padding: "6px 12px" }}
                      >
                        📋 카페용 복사
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
                          fontSize: "0.78rem",
                          padding: "6px 12px",
                          color: "#86efac",
                        }}
                      >
                        ↗ 카페 메뉴 열기
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => window.print()}
                    className="btn btn-outline"
                    style={{ fontSize: "0.78rem", padding: "6px 12px" }}
                  >
                    <Printer size={14} /> 인쇄
                  </button>
                </div>
              </div>

              {/* === HWP ORIGINAL TEMPLATE BINDING VIEW vs STANDARD GOV PAPER === */}
              {(() => {
                const hwpTemplate = getHwpTemplateForDoc(selectedDoc);

                if (viewMode === "HWP" && hwpTemplate) {
                  return (
                    <div
                      style={{
                        background: "#fff",
                        color: "#000",
                        borderRadius: 6,
                        padding: "36px 48px",
                        boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
                        fontFamily: "'Noto Sans KR', sans-serif",
                      }}
                    >
                      {/* Top Info Bar */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 20,
                          paddingBottom: 12,
                          borderBottom: "2px solid #000",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                          }}
                        >
                          <span
                            style={{
                              background: "#1e3a8a",
                              color: "#fff",
                              padding: "3px 10px",
                              borderRadius: 12,
                              fontSize: "0.75rem",
                              fontWeight: 800,
                            }}
                          >
                            HWP 공식 서식
                          </span>
                          <span
                            style={{
                              fontSize: "1rem",
                              fontWeight: 800,
                              color: "#0f172a",
                            }}
                          >
                            {hwpTemplate.label}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: "0.8rem",
                            color: "#475569",
                            fontWeight: 700,
                          }}
                        >
                          문서번호:{" "}
                          <span
                            style={{
                              fontFamily: "monospace",
                              color: "#1e3a8a",
                            }}
                          >
                            {selectedDoc.docNo}
                          </span>
                        </div>
                      </div>

                      {/* HWP HTML / CSS Render Area */}
                      <div
                        style={{
                          position: "relative",
                          overflowX: "auto",
                          marginBottom: 30,
                        }}
                      >
                        <style>{hwpTemplate.style}</style>
                        <div
                          contentEditable={isEditingHwp}
                          suppressContentEditableWarning
                          onInput={(e) =>
                            setEditedHwpHtml(e.currentTarget.innerHTML)
                          }
                          dangerouslySetInnerHTML={{
                            __html: editedHwpHtml || hwpTemplate.html,
                          }}
                          style={
                            isEditingHwp
                              ? {
                                  outline: "2px solid #f59e0b",
                                  outlineOffset: 4,
                                  minHeight: 300,
                                }
                              : undefined
                          }
                        />
                        {isEditingHwp && (
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              marginTop: 12,
                              alignItems: "center",
                            }}
                          >
                            <button
                              onClick={handleSaveHwpEdit}
                              className="btn btn-gold"
                              style={{ padding: "7px 12px" }}
                            >
                              <CheckCircle size={14} /> 수정 내용 저장
                            </button>
                            <span
                              style={{ fontSize: "0.75rem", color: "#64748b" }}
                            >
                              본문을 직접 수정한 뒤 저장하세요.
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Integrated Approval Line (결재란 날인) */}
                      <div
                        style={{
                          borderTop: "2px solid #000",
                          paddingTop: 20,
                          marginTop: 30,
                        }}
                      >
                        <div style={{ ...S.signTitle, marginBottom: 12 }}>
                          도스온라인 검찰청 전자 결재란 (관인 및 서명 날인)
                        </div>
                        <div style={S.signGrid}>
                          {selectedDoc.approvals.map((app, idx) => {
                            const isLast =
                              idx === selectedDoc.approvals.length - 1;
                            const isApproved =
                              selectedDoc.status === "최종승인";
                            const isSelectedPerson =
                              selectedPersonFilter !== "ALL" &&
                              app.name?.includes(selectedPersonFilter);
                            return (
                              <div
                                key={idx}
                                onClick={() =>
                                  handleSelectApproverFromGrid(app.name)
                                }
                                style={{
                                  flex: 1,
                                  borderRight: isLast
                                    ? "none"
                                    : "1px solid #000",
                                  textAlign: "center",
                                  cursor: "pointer",
                                  background: isSelectedPerson
                                    ? "rgba(245, 158, 11, 0.15)"
                                    : "transparent",
                                }}
                              >
                                <div
                                  style={{
                                    ...S.signRoleRow,
                                    background: isSelectedPerson
                                      ? "#f59e0b"
                                      : "#f1f5f9",
                                    color: isSelectedPerson
                                      ? "#000"
                                      : "#334155",
                                  }}
                                >
                                  {app.role}
                                </div>
                                <div style={S.signBox}>
                                  {app.status !== "결재대기" ? (
                                    <div
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        height: "100%",
                                        gap: 4,
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize:
                                            isLast && isApproved
                                              ? "1.1rem"
                                              : "0.9rem",
                                          fontWeight: 900,
                                          color:
                                            isLast && isApproved
                                              ? "#dc2626"
                                              : "#16a34a",
                                          fontFamily: "'Noto Serif KR', serif",
                                          border:
                                            isLast && isApproved
                                              ? "2px solid #dc2626"
                                              : "none",
                                          borderRadius:
                                            isLast && isApproved ? "50%" : "0",
                                          padding:
                                            isLast && isApproved
                                              ? "8px 10px"
                                              : "0",
                                        }}
                                      >
                                        {app.name
                                          .replace(" [전결]", "")
                                          .replace(" [직권승인]", "")
                                          .replace(" (대결)", "")}
                                      </span>
                                      {app.type === "전결" && (
                                        <span
                                          style={{
                                            fontSize: "0.6rem",
                                            color: "#b91c1c",
                                            fontWeight: 800,
                                          }}
                                        >
                                          전결
                                        </span>
                                      )}
                                      {app.type === "대결" && (
                                        <span
                                          style={{
                                            fontSize: "0.6rem",
                                            color: "#0369a1",
                                            fontWeight: 800,
                                          }}
                                        >
                                          대결
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span
                                      style={{
                                        fontSize: "0.7rem",
                                        color: "#94a3b8",
                                      }}
                                    >
                                      대기중
                                    </span>
                                  )}
                                </div>
                                <div
                                  style={{
                                    ...S.signName,
                                    fontWeight: isSelectedPerson ? 900 : 700,
                                  }}
                                >
                                  {app.name}
                                </div>
                                <div style={S.signDate}>{app.date}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Footer */}
                      <div style={S.footer}>
                        <div style={S.footerOrg}>도 스 온 라 인 검 찰 청</div>
                        <div style={S.footerNo}>
                          시행일자: {selectedDoc.createdAt} ·{" "}
                          {selectedDoc.docNo}
                        </div>
                      </div>
                    </div>
                  );
                }

                if (
                  selectedDoc?.docType === "DISPOSITION" ||
                  selectedDoc?.docType === "NON_INDICTMENT"
                ) {
                  return <DispositionResolutionForm document={selectedDoc} />;
                }

                return (
                  /* Standard Government Paper View */
                  <div style={S.paper}>
                    <div style={S.paperTopBar} />
                    <div style={S.paperInner}>
                      {/* Document Title */}
                      <div style={S.titleRow}>
                        <div style={S.docTitle}>
                          {selectedDoc.docTypeName || "검 찰 처 분 결 의 서"}
                        </div>
                        <div style={S.docNo}>문서번호: {selectedDoc.docNo}</div>
                      </div>

                      {/* 수신 / 발신 / 제목 */}
                      <div style={S.metaRow}>
                        <div style={S.metaLabel}>수 신</div>
                        <div style={S.metaValue}>도스온라인 검찰청장</div>
                        <div style={S.metaLabel}>발 신</div>
                        <div style={S.metaValue}>
                          {selectedDoc.prosecutorName} (
                          {selectedDoc.prosecutorId})
                        </div>
                        <div style={S.metaLabel}>제 목</div>
                        <div style={{ ...S.metaValue, fontWeight: 700 }}>
                          {selectedDoc.suspectName} 피의자에 대한{" "}
                          {selectedDoc.docTypeName || "처분 결의"} 건
                        </div>
                      </div>

                      <hr style={S.divider} />

                      {/* Body */}
                      <div style={S.bodySection}>
                        <div>
                          아래와 같이{" "}
                          <strong>
                            {selectedDoc.docTypeName || "검찰 처분 결의서"}
                          </strong>
                          를 첨부하여 결재를 요청합니다.
                        </div>
                        <br />
                        <div style={{ fontWeight: 700, marginBottom: 12 }}>
                          - 아 래 -
                        </div>
                        <div style={S.bodyIndent}>
                          <div style={{ marginBottom: 10 }}>
                            <strong>1. 사건 번호:</strong>{" "}
                            {selectedDoc.hyeongjeNo}
                          </div>
                          <div style={{ marginBottom: 10 }}>
                            <strong>2. 피의자 성명:</strong>{" "}
                            {selectedDoc.suspectName}
                          </div>
                          <div style={{ marginBottom: 10 }}>
                            <strong>3. 적용 죄명:</strong>{" "}
                            {selectedDoc.chargeName}
                          </div>
                          <div style={{ marginBottom: 10 }}>
                            <strong>4. 처분 구분:</strong>{" "}
                            <span style={{ fontWeight: 800, color: "#dc2626" }}>
                              {selectedDoc.dispositionType}
                            </span>
                          </div>
                          <div>
                            <strong>5. 결재 청구 요지:</strong>
                            <div
                              style={{
                                marginTop: 8,
                                paddingLeft: 16,
                                lineHeight: 1.9,
                                color: "#1e293b",
                              }}
                            >
                              {selectedDoc.summary}
                            </div>
                          </div>
                        </div>
                        <br />
                        <br />
                        <div>
                          {selectedDoc.attachments?.length ? (
                            <>
                              붙 임:{" "}
                              {selectedDoc.attachments.map((item, index) => (
                                <React.Fragment key={`${item}-${index}`}>
                                  {index > 0 && <br />}
                                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                                  {index + 1}. {item}
                                </React.Fragment>
                              ))}
                              <br />
                              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;끝.
                            </>
                          ) : (
                            <>
                              붙 임: 1. 관련 사건 원부 사본 1부.
                              <br />
                              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;2.
                              카페 게시글 증거 자료 1부.
                              <br />
                              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;끝.
                            </>
                          )}
                        </div>
                      </div>

                      {/* Signature Table (결재란) */}
                      <div style={S.signSection}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 6,
                          }}
                        >
                          <div style={S.signTitle}>
                            결 재 란 (클릭 시 검사별 좌측 결재 목록 자동 전환)
                          </div>
                          {selectedPersonFilter !== "ALL" && (
                            <span
                              style={{
                                fontSize: "0.75rem",
                                fontWeight: 800,
                                color: "var(--primary-amber)",
                              }}
                            >
                              🔍 선택된 검사: {selectedPersonFilter}
                            </span>
                          )}
                        </div>
                        <div style={S.signGrid}>
                          {selectedDoc.approvals.map((app, idx) => {
                            const isLast =
                              idx === selectedDoc.approvals.length - 1;
                            const isApproved =
                              selectedDoc.status === "최종승인";
                            const isSelectedPerson =
                              selectedPersonFilter !== "ALL" &&
                              app.name?.includes(selectedPersonFilter);
                            return (
                              <div
                                key={idx}
                                onClick={() =>
                                  handleSelectApproverFromGrid(app.name)
                                }
                                title={`클릭 시 ${app.name} (${app.role})의 결재 문서로 좌측 목록 자동 전환`}
                                style={{
                                  flex: 1,
                                  borderRight: isLast
                                    ? "none"
                                    : "1px solid #000",
                                  textAlign: "center",
                                  cursor: "pointer",
                                  transition: "background 0.2s",
                                  background: isSelectedPerson
                                    ? "rgba(245, 158, 11, 0.15)"
                                    : "transparent",
                                }}
                              >
                                <div
                                  style={{
                                    ...S.signRoleRow,
                                    background: isSelectedPerson
                                      ? "#f59e0b"
                                      : "#f1f5f9",
                                    color: isSelectedPerson
                                      ? "#000"
                                      : "#334155",
                                  }}
                                >
                                  {app.role}
                                </div>
                                <div style={S.signBox}>
                                  {app.status !== "결재대기" ? (
                                    <div
                                      style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        height: "100%",
                                        gap: 4,
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize:
                                            isLast && isApproved
                                              ? "1.1rem"
                                              : "0.9rem",
                                          fontWeight: 900,
                                          color:
                                            isLast && isApproved
                                              ? "#dc2626"
                                              : "#16a34a",
                                          fontFamily: "'Noto Serif KR', serif",
                                          letterSpacing: "0.02em",
                                          border:
                                            isLast && isApproved
                                              ? "2px solid #dc2626"
                                              : "none",
                                          borderRadius:
                                            isLast && isApproved ? "50%" : "0",
                                          padding:
                                            isLast && isApproved
                                              ? "8px 10px"
                                              : "0",
                                          lineHeight: 1.3,
                                        }}
                                      >
                                        {app.name
                                          .replace(" [전결]", "")
                                          .replace(" [직권승인]", "")
                                          .replace(" (대결)", "")}
                                      </span>
                                      {app.type === "전결" && (
                                        <span
                                          style={{
                                            fontSize: "0.6rem",
                                            color: "#b91c1c",
                                            fontWeight: 800,
                                          }}
                                        >
                                          전결
                                        </span>
                                      )}
                                      {app.type === "대결" && (
                                        <span
                                          style={{
                                            fontSize: "0.6rem",
                                            color: "#0369a1",
                                            fontWeight: 800,
                                          }}
                                        >
                                          대결
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span
                                      style={{
                                        fontSize: "0.7rem",
                                        color: "#94a3b8",
                                      }}
                                    >
                                      대기중
                                    </span>
                                  )}
                                </div>
                                <div
                                  style={{
                                    ...S.signName,
                                    fontWeight: isSelectedPerson ? 900 : 700,
                                    color: isSelectedPerson
                                      ? "#b45309"
                                      : "#1e293b",
                                  }}
                                >
                                  {app.name}
                                </div>
                                <div style={S.signDate}>{app.date}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Footer */}
                      <div style={S.footer}>
                        <div style={S.footerOrg}>도 스 온 라 인 검 찰 청</div>
                        <div style={S.footerNo}>
                          시행일자: {selectedDoc.createdAt} ·{" "}
                          {selectedDoc.docNo}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div
              className="glass-panel"
              style={{
                padding: 48,
                textAlign: "center",
                color: "var(--text-muted)",
                fontSize: "0.85rem",
              }}
            >
              좌측 목록에서 결재할 문서를 선택하세요.
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes sealIn { from { transform: scale(0) rotate(-30deg); opacity:0; } to { transform: scale(1) rotate(0); opacity:1; } }
      `}</style>

      {/* Edit Approval Doc Modal */}
      {isEditingDoc && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
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
              maxWidth: 540,
              padding: "24px 28px",
              boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <span
                style={{
                  fontWeight: 800,
                  fontSize: "1rem",
                  color: "var(--text-main)",
                }}
              >
                ✏️ 결재 문서 청구 내용 수정
              </span>
              <button
                onClick={() => setIsEditingDoc(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  fontSize: "1.2rem",
                }}
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={handleSaveDocEdit}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
            >
              <div>
                <label className="input-label">처분 구분</label>
                <input
                  className="input-field"
                  value={editDocForm.dispositionType}
                  onChange={(e) =>
                    setEditDocForm({
                      ...editDocForm,
                      dispositionType: e.target.value,
                    })
                  }
                  required
                />
              </div>
              <div>
                <label className="input-label">
                  결재 청구 요지 (공문서 본문 기재 내용)
                </label>
                <textarea
                  className="textarea-field"
                  rows={5}
                  value={editDocForm.summary}
                  onChange={(e) =>
                    setEditDocForm({ ...editDocForm, summary: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <label className="input-label">첨부서류 목록</label>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    marginTop: 8,
                  }}
                >
                  {caseEvidence.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        marginBottom: 6,
                      }}
                    >
                      {caseEvidence.slice(0, 5).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            setEditDocForm((prev) => ({
                              ...prev,
                              attachments: [
                                ...prev.attachments.filter(Boolean),
                                `${item.title} (${item.url})`,
                              ],
                            }))
                          }
                          style={{
                            border: "1px solid rgba(96,165,250,0.4)",
                            background: "rgba(96,165,250,0.08)",
                            color: "#dbeafe",
                            borderRadius: 999,
                            padding: "4px 8px",
                            cursor: "pointer",
                            fontSize: "0.68rem",
                          }}
                        >
                          {item.title}
                        </button>
                      ))}
                    </div>
                  )}
                  {editDocForm.attachments.map((item, index) => (
                    <div
                      key={`edit-attachment-${index}`}
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      <span
                        style={{
                          width: 22,
                          textAlign: "center",
                          color: "var(--text-muted)",
                          fontWeight: 700,
                        }}
                      >
                        {index + 1}.
                      </span>
                      <input
                        className="input-field"
                        value={item}
                        onChange={(e) => {
                          const next = [...editDocForm.attachments];
                          next[index] = e.target.value;
                          setEditDocForm({ ...editDocForm, attachments: next });
                        }}
                        placeholder="첨부서류를 입력하세요"
                        style={{ flex: 1 }}
                      />
                      {editDocForm.attachments.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setEditDocForm((prev) => ({
                              ...prev,
                              attachments: prev.attachments.filter(
                                (_, idx) => idx !== index,
                              ),
                            }))
                          }
                          style={{
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                            color: "var(--text-muted)",
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {caseEvidence.length > 0 && (
                      <button
                        type="button"
                        className="btn btn-outline"
                        style={{
                          fontSize: "0.72rem",
                          padding: "6px 10px",
                          color: "#60a5fa",
                          borderColor: "rgba(96,165,250,0.4)",
                        }}
                        onClick={() =>
                          setEditDocForm((prev) => ({
                            ...prev,
                            attachments: [
                              ...prev.attachments.filter(Boolean),
                              `${caseEvidence[0].title} (${caseEvidence[0].url})`,
                            ],
                          }))
                        }
                      >
                        증거자료 연결
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ fontSize: "0.72rem", padding: "6px 10px" }}
                      onClick={() =>
                        setEditDocForm((prev) => ({
                          ...prev,
                          attachments: [...prev.attachments, ""],
                        }))
                      }
                    >
                      + 첨부서류 추가
                    </button>
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 10,
                  justifyContent: "flex-end",
                  marginTop: 10,
                }}
              >
                <button
                  type="button"
                  onClick={() => setIsEditingDoc(false)}
                  className="btn btn-secondary"
                  style={{ padding: "8px 16px" }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-gold"
                  style={{ padding: "8px 20px", fontWeight: 800 }}
                >
                  저장 및 즉시 반영
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delegation & Substitute Rules Modal (위임/전결/대결 규정 안내) */}
      {showDelegationRulesModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
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
              maxWidth: 620,
              padding: "24px 28px",
              boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
                paddingBottom: 12,
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <span
                style={{
                  fontWeight: 800,
                  fontSize: "1rem",
                  color: "var(--primary-amber)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                ⚖️ 검찰 사무관리 및 대결·전결 규정 안내 (제10조, 제15조)
              </span>
              <button
                onClick={() => setShowDelegationRulesModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  fontSize: "1.2rem",
                }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 14,
                fontSize: "0.82rem",
                color: "var(--text-main)",
                lineHeight: 1.6,
              }}
            >
              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <strong style={{ color: "#f59e0b" }}>
                  1. 전결 (專決) 규정
                </strong>
                <br />
                검찰청 위임전결규정에 따라 결재권자가 미리 지정한 범위 안에서
                하급 결재권자(부장검사, 차장검사)가 기관장의 명을 받아 결재권을
                위임받아 최종 확정 승인하는 제도입니다.
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <strong style={{ color: "#38bdf8" }}>
                  2. 대결 (代決) 및 사무대리 규정
                </strong>
                <br />
                결재권자가 휴직, 출장, 연가 등 부득이한 사유로 결재할 수 없는
                경우 직무대리자 또는 지정된 대결자가 본인 직인과 함께 대리
                결재하는 결재 처리 방식입니다.
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 8,
                  background: "var(--bg-elevated)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <strong style={{ color: "#34d399" }}>
                  3. 휴직 및 결재권한 위임 설정 방법
                </strong>
                <br />
                <strong>검찰사무국 탭 → 검사 계정 관리</strong>에서 계정별 [⚙️
                위임/휴직] 버튼을 눌러 휴직(ON_LEAVE) 설정 및 대결자(대리 결재
                검사)를 언제든지 지정 및 변경할 수 있습니다.
              </div>
            </div>

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 20,
              }}
            >
              <button
                onClick={() => setShowDelegationRulesModal(false)}
                className="btn btn-gold"
                style={{ padding: "8px 24px", fontWeight: 800 }}
              >
                확인 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 반려 이유 입력 모달 ── */}
      {rejectModalOpen && (
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
            className="glass-panel gold-border"
            style={{
              width: 420,
              padding: 28,
              borderRadius: 14,
              display: "flex",
              flexDirection: "column",
              gap: 18,
            }}
          >
            <div
              style={{
                fontWeight: 800,
                fontSize: "1rem",
                color: "var(--text-main)",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <XCircle size={18} color="#f87171" /> 결재 반려 처리
            </div>
            <div style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}>
              문서번호{" "}
              <span style={{ color: "var(--primary-amber)", fontWeight: 700 }}>
                {selectedDoc?.docNo}
              </span>{" "}
              를 반려 처리합니다. 반려 사유를 입력하세요.
            </div>
            <div>
              <label
                style={{
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  display: "block",
                  marginBottom: 6,
                }}
              >
                반려 사유
              </label>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  marginBottom: 10,
                }}
              >
                {[
                  "보완수사요구",
                  "증거 불충분",
                  "법리 검토 필요",
                  "서식 오류",
                ].map((opt) => (
                  <label
                    key={opt}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      cursor: "pointer",
                      fontSize: "0.82rem",
                      color: "var(--text-main)",
                    }}
                  >
                    <input
                      type="radio"
                      name="rejectReason"
                      value={opt}
                      checked={rejectReason === opt}
                      onChange={() => setRejectReason(opt)}
                    />
                    {opt}
                  </label>
                ))}
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    cursor: "pointer",
                    fontSize: "0.82rem",
                    color: "var(--text-main)",
                  }}
                >
                  <input
                    type="radio"
                    name="rejectReason"
                    value="custom"
                    checked={
                      ![
                        "보완수사요구",
                        "증거 불충분",
                        "법리 검토 필요",
                        "서식 오류",
                      ].includes(rejectReason)
                    }
                    onChange={() => setRejectReason("")}
                  />
                  직접 입력
                </label>
              </div>
              {![
                "보완수사요구",
                "증거 불충분",
                "법리 검토 필요",
                "서식 오류",
              ].includes(rejectReason) && (
                <input
                  className="input-field"
                  type="text"
                  placeholder="반려 사유를 입력하세요"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  autoFocus
                />
              )}
            </div>
            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button
                onClick={() => {
                  setRejectModalOpen(false);
                  setRejectReason("보완수사요구");
                }}
                className="btn btn-secondary"
                style={{ fontSize: "0.82rem" }}
              >
                취소
              </button>
              <button
                onClick={handleRejectConfirm}
                className="btn"
                style={{
                  fontSize: "0.82rem",
                  background: "#ef4444",
                  color: "#fff",
                  border: "none",
                }}
                disabled={!rejectReason.trim()}
              >
                <XCircle size={14} /> 반려 확정
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
