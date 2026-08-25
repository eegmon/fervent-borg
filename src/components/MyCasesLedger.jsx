import React, { useState } from "react";
import {
  UserCheck,
  Search,
  ExternalLink,
  FileText,
  CheckCircle2,
  Edit,
  RefreshCw,
  FolderCheck,
  Lock,
  X,
  Scale,
  Users,
  Trash2,
  ChevronRight,
  ClipboardList,
} from "lucide-react";
import EditCaseModal from "./EditCaseModal";
import {
  NON_INDICTMENT_REASONS,
  PROSECUTORS,
  calculateStatuteOfLimitations,
} from "../data/prosecutionData";

const STATUS_COLOR = (s) => {
  if (!s) return "#94a3b8";
  if (s.includes("구속")) return "#f87171";
  if (s.includes("기소") && !s.includes("불기소")) return "#fb923c";
  if (s.includes("불기소") || s.includes("무혐의")) return "#34d399";
  return "#93c5fd";
};

const DISPOSITION_OPTIONS = [
  "입건 : 수사 진행 중",
  "구속영장 청구 중",
  "구속 기소",
  "불구속 기소",
  "기소유예 (불기소)",
  "혐의없음 - 범죄인정안됨 (불기소)",
  "혐의없음 - 증거불충분 (불기소)",
  "공소권없음 (불기소)",
  "기소중지 / 참고인중지",
  "타관 이송",
];

const INDICTMENT_TYPES = [
  { id: "INDICT_CUSTODY", label: "구속 기소", color: "#f87171" },
  { id: "INDICT_NONCUSTODY", label: "불구속 기소", color: "#fb923c" },
  { id: "INDICT_SUMMARY", label: "약식 명령 청구", color: "#fbbf24" },
];

/* ─────────────────────────────────────────
   전자 결재 상신 모달 (기소 / 불기소)
───────────────────────────────────────── */
function ApprovalModal({
  caseItem,
  currentUser,
  prosecutorsList,
  onSubmit,
  onClose,
}) {
  const [mode, setMode] = useState(""); // 'indict' | 'nonindict'
  const [indictType, setIndictType] = useState("INDICT_NONCUSTODY");
  const [nonIndictReasonId, setNonIndictReasonId] = useState("");
  const [dispositionReason, setDispositionReason] = useState("");
  const [approvalLine, setApprovalLine] = useState([
    {
      role: "담당검사",
      name: currentUser?.name || "",
      status: "결재대기",
      date: "-",
    },
    { role: "부장검사", name: "", status: "결재대기", date: "-" },
    { role: "지검장", name: "", status: "결재대기", date: "-" },
  ]);

  const selectedNonIndict = NON_INDICTMENT_REASONS.find(
    (r) => r.id === nonIndictReasonId,
  );

  const handleSelectNonIndict = (id) => {
    setNonIndictReasonId(id);
    const reason = NON_INDICTMENT_REASONS.find((r) => r.id === id);
    if (reason) {
      setDispositionReason(
        `[검찰사무규칙 제115조 불기소 결정 - ${reason.label}]\n` +
          `1. 피의사실: ${caseItem.chargeName || "관련 사건"} 혐의\n` +
          `2. 불기소 사유: ${reason.desc}\n` +
          `3. 처분 의견: 피의자에 대한 피의사실은 ${reason.desc}에 해당함. ` +
          `이에 따라 검찰사무규칙 제115조에 의거 불기소(${reason.category}) 결정함이 타당함.\n` +
          `4. 담당검사 의견: `,
      );
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!mode) {
      alert("기소 또는 불기소를 선택해주세요.");
      return;
    }
    if (mode === "nonindict" && !nonIndictReasonId) {
      alert("불기소 사유를 선택해주세요.");
      return;
    }
    if (!dispositionReason.trim()) {
      alert("처분 이유를 작성해주세요.");
      return;
    }

    const label =
      mode === "indict"
        ? INDICTMENT_TYPES.find((t) => t.id === indictType)?.label || "기소"
        : selectedNonIndict
          ? `불기소 (${selectedNonIndict.label})`
          : "불기소";

    onSubmit({
      caseItem,
      mode,
      dispositionType: label,
      nonIndictReasonId,
      dispositionReason,
      approvalLine,
    });
    onClose();
  };

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
          maxWidth: 640,
          maxHeight: "92vh",
          overflowY: "auto",
          padding: 28,
          borderRadius: 16,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
            paddingBottom: 14,
            borderBottom: "1px solid var(--border-subtle)",
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
              <ClipboardList size={20} color="var(--primary-amber)" />
              전자 결재 상신
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--primary-amber)",
                fontFamily: "monospace",
                marginTop: 4,
              }}
            >
              {caseItem.hyeongjeNo} | 피의자: {caseItem.suspectName} | 죄명:{" "}
              {caseItem.chargeName || "-"}
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

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 20 }}
        >
          {/* STEP 1: 기소 / 불기소 선택 */}
          <div>
            <div
              style={{
                fontSize: "0.8rem",
                fontWeight: 800,
                color: "var(--text-muted)",
                marginBottom: 10,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "var(--primary-amber)",
                  color: "#000",
                  fontSize: "0.7rem",
                  fontWeight: 900,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                1
              </span>
              처분 유형 선택 *
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <div
                onClick={() => setMode("indict")}
                style={{
                  padding: "16px",
                  borderRadius: 10,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  border:
                    mode === "indict"
                      ? "2px solid #fb923c"
                      : "1px solid var(--border-subtle)",
                  background:
                    mode === "indict"
                      ? "rgba(251,146,60,0.1)"
                      : "var(--bg-elevated)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "1.4rem", marginBottom: 4 }}>⚖️</div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: "0.9rem",
                    color: mode === "indict" ? "#fb923c" : "var(--text-main)",
                  }}
                >
                  기소
                </div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--text-muted)",
                    marginTop: 2,
                  }}
                >
                  구속기소 / 불구속기소 / 약식명령
                </div>
              </div>
              <div
                onClick={() => setMode("nonindict")}
                style={{
                  padding: "16px",
                  borderRadius: 10,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  border:
                    mode === "nonindict"
                      ? "2px solid #34d399"
                      : "1px solid var(--border-subtle)",
                  background:
                    mode === "nonindict"
                      ? "rgba(52,211,153,0.1)"
                      : "var(--bg-elevated)",
                  textAlign: "center",
                }}
              >
                <div style={{ fontSize: "1.4rem", marginBottom: 4 }}>🚫</div>
                <div
                  style={{
                    fontWeight: 800,
                    fontSize: "0.9rem",
                    color:
                      mode === "nonindict" ? "#34d399" : "var(--text-main)",
                  }}
                >
                  불기소
                </div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--text-muted)",
                    marginTop: 2,
                  }}
                >
                  혐의없음 / 기소유예 / 공소권없음 등
                </div>
              </div>
            </div>
          </div>

          {/* STEP 2A: 기소 세부 유형 */}
          {mode === "indict" && (
            <div>
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 800,
                  color: "var(--text-muted)",
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "var(--primary-amber)",
                    color: "#000",
                    fontSize: "0.7rem",
                    fontWeight: 900,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  2
                </span>
                기소 유형 선택 *
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {INDICTMENT_TYPES.map((t) => (
                  <div
                    key={t.id}
                    onClick={() => setIndictType(t.id)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: 8,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      textAlign: "center",
                      border:
                        indictType === t.id
                          ? `2px solid ${t.color}`
                          : "1px solid var(--border-subtle)",
                      background:
                        indictType === t.id
                          ? `${t.color}15`
                          : "var(--bg-elevated)",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 700,
                        fontSize: "0.82rem",
                        color:
                          indictType === t.id ? t.color : "var(--text-main)",
                      }}
                    >
                      {t.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 2B: 불기소 사유 */}
          {mode === "nonindict" && (
            <div>
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 800,
                  color: "var(--text-muted)",
                  marginBottom: 10,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "var(--primary-amber)",
                    color: "#000",
                    fontSize: "0.7rem",
                    fontWeight: 900,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  2
                </span>
                검찰사무규칙 제115조 불기소 사유 *
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {NON_INDICTMENT_REASONS.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => handleSelectNonIndict(r.id)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      cursor: "pointer",
                      transition: "all 0.15s",
                      border:
                        nonIndictReasonId === r.id
                          ? "2px solid #34d399"
                          : "1px solid var(--border-subtle)",
                      background:
                        nonIndictReasonId === r.id
                          ? "rgba(52,211,153,0.08)"
                          : "var(--bg-elevated)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontWeight: 700,
                          fontSize: "0.82rem",
                          color:
                            nonIndictReasonId === r.id
                              ? "#34d399"
                              : "var(--text-main)",
                        }}
                      >
                        {r.label}
                      </div>
                      <div
                        style={{
                          fontSize: "0.7rem",
                          color: "var(--text-muted)",
                          marginTop: 2,
                        }}
                      >
                        {r.desc}
                      </div>
                    </div>
                    {nonIndictReasonId === r.id && (
                      <CheckCircle2
                        size={16}
                        color="#34d399"
                        style={{ flexShrink: 0, marginLeft: 10 }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3: 처분 이유 작성 */}
          {mode && (
            <div>
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 800,
                  color: "var(--text-muted)",
                  marginBottom: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "var(--primary-amber)",
                    color: "#000",
                    fontSize: "0.7rem",
                    fontWeight: 900,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  3
                </span>
                처분 이유 / 결재 청구 내용 *
              </div>
              <textarea
                className="textarea-field"
                rows={6}
                value={dispositionReason}
                onChange={(e) => setDispositionReason(e.target.value)}
                placeholder={
                  mode === "indict"
                    ? "기소 이유를 작성해주세요.\n예) 피의자 ○○○에 대한 ○○ 혐의는 증거에 의해 충분히 인정되므로 기소 결정함..."
                    : "불기소 이유를 작성해주세요. (위에서 사유를 선택하면 자동 작성됩니다)"
                }
                style={{ resize: "vertical", lineHeight: 1.7 }}
                required
              />
            </div>
          )}

          {/* STEP 4: 결재라인 설정 */}
          {mode && (
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
                  marginBottom: 12,
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: "0.82rem",
                    color: "var(--primary-amber)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Users size={14} /> 결재라인 편집
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setApprovalLine((prev) => [
                      ...prev,
                      {
                        role: "차장검사",
                        name: "",
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
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {approvalLine.map((step, idx) => (
                  <div
                    key={idx}
                    style={{ display: "flex", gap: 8, alignItems: "center" }}
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
                        u[idx] = { ...u[idx], role: e.target.value };
                        setApprovalLine(u);
                      }}
                      placeholder="직책"
                    />
                    <select
                      className="select-field"
                      style={{ flex: 1 }}
                      value={step.name}
                      onChange={(e) => {
                        const u = [...approvalLine];
                        u[idx] = { ...u[idx], name: e.target.value };
                        setApprovalLine(u);
                      }}
                    >
                      <option value="">검사 선택...</option>
                      {PROSECUTORS.map((p) => (
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
                          color: "#f87171",
                          flexShrink: 0,
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Submit */}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              취소
            </button>
            <button
              type="submit"
              className="btn btn-gold"
              style={{ flex: 2, justifyContent: "center", gap: 6 }}
              disabled={!mode}
            >
              <CheckCircle2 size={15} />
              전자 결재 상신 완료
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────
   메인 컴포넌트
───────────────────────────────────────── */
export default function MyCasesLedger({
  ledgerData = [],
  currentUser,
  prosecutorsList = [],
  onSelectEvidence,
  onSelectSuspect,
  onOpenApprovalForCase,
  onUpdateCase,
  onOpenLoginModal,
  onAddApproval,
  approvalsData = [],
  onDesignateCase,
  onUndesignateCase,
}) {
  const [selectedProsecutorFilter, setSelectedProsecutorFilter] = useState(
    currentUser?.name || "",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [editingCase, setEditingCase] = useState(null);
  const [statusChangeCase, setStatusChangeCase] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [approvalCase, setApprovalCase] = useState(null); // 결재 상신 모달 대상 사건

  if (!currentUser) {
    return (
      <div
        className="glass-panel gold-border"
        style={{
          padding: "60px 24px",
          textAlign: "center",
          maxWidth: 520,
          margin: "40px auto",
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 20,
            background: "rgba(245,158,11,0.12)",
            border: "1px solid rgba(245,158,11,0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 18px",
          }}
        >
          <Lock size={32} color="var(--primary-amber)" />
        </div>
        <div
          style={{
            fontSize: "1.2rem",
            fontWeight: 800,
            color: "var(--text-main)",
            marginBottom: 8,
          }}
        >
          내 담당 사건 처리함 (로그인 필요)
        </div>
        <div
          style={{
            fontSize: "0.85rem",
            color: "var(--text-muted)",
            lineHeight: 1.6,
            marginBottom: 24,
          }}
        >
          담당 검사 및 수사관 개인 전담 사건을 관리하려면 검찰청 계정으로
          로그인해주세요.
        </div>
        {onOpenLoginModal && (
          <button
            onClick={onOpenLoginModal}
            className="btn btn-gold"
            style={{
              width: "100%",
              padding: "12px",
              fontWeight: 800,
              justifyContent: "center",
            }}
          >
            🔑 검찰청 계정 로그인하기
          </button>
        )}
      </div>
    );
  }

  const isHighAdmin =
    currentUser.isSuperAdmin ||
    [
      "SUPER_ADMIN",
      "PROSECUTOR_GENERAL",
      "CHIEF_PROSECUTOR",
      "DEPUTY_CHIEF",
      "CHIEF_ADMINISTRATOR",
    ].includes(currentUser.roleLevel);

  const targetProsecutorName =
    isHighAdmin && selectedProsecutorFilter
      ? selectedProsecutorFilter
      : currentUser.name;

  const myCases = ledgerData.filter((item) => {
    if (!item) return false;
    const pName = item.prosecutorName || "";
    return (
      pName.includes(targetProsecutorName) ||
      targetProsecutorName.includes(pName)
    );
  });

  const filteredMyCases = myCases.filter((item) => {
    const q = searchTerm.toLowerCase().trim();
    const matchQ =
      !q ||
      (item.hyeongjeNo || "").toLowerCase().includes(q) ||
      (item.suspectName || "").toLowerCase().includes(q) ||
      (item.chargeName || "").toLowerCase().includes(q) ||
      (item.suspectUuid || "").toLowerCase().includes(q);
    const matchStatus =
      statusFilter === "ALL" ||
      (item.disposition || item.bookingStatus || "")
        .toLowerCase()
        .includes(statusFilter.toLowerCase());
    return matchQ && matchStatus;
  });

  const activeCount = myCases.filter(
    (c) =>
      !(c.disposition || "").includes("불기소") &&
      !(c.disposition || "").includes("종국"),
  ).length;
  const indictmentCount = myCases.filter(
    (c) =>
      (c.disposition || "").includes("기소") &&
      !(c.disposition || "").includes("불기소"),
  ).length;
  const nonIndictmentCount = myCases.filter(
    (c) =>
      (c.disposition || "").includes("불기소") ||
      (c.disposition || "").includes("종국"),
  ).length;

  // 결재 완료 여부 확인: 해당 사건의 결재 문서 중 최종승인된 것이 있는지 체크
  const isCaseApprovalComplete = (caseItem) => {
    return approvalsData.some(
      (doc) =>
        doc.hyeongjeNo === caseItem.hyeongjeNo &&
        (doc.status === "최종승인" ||
          doc.status === "최종승인 (전결)" ||
          doc.status === "대결승인"),
    );
  };

  const handleSaveStatusChange = (e) => {
    e.preventDefault();
    if (!statusChangeCase) return;

    // 결재 필수 사건 차단
    if (
      statusChangeCase.supervisorDesignated &&
      !isCaseApprovalComplete(statusChangeCase)
    ) {
      alert(
        `🔒 [결재 필수 사건]\n\n이 사건은 직근상급자(${statusChangeCase.supervisorName || "상급자"})가 결재 필수로 지정하였습니다.\n\n` +
          `전자 결재함에서 결재를 완료한 후에만 처분을 변경할 수 있습니다.`,
      );
      return;
    }

    if (onUpdateCase)
      onUpdateCase({
        ...statusChangeCase,
        disposition: newStatus,
        bookingStatus: newStatus,
      });
    setStatusChangeCase(null);
  };

  const handleApprovalSubmit = ({
    caseItem,
    mode,
    dispositionType,
    nonIndictReasonId,
    dispositionReason,
    approvalLine,
  }) => {
    const docId = `DOC-${Date.now()}`;
    const now = new Date().toISOString().split("T")[0];
    const newDoc = {
      id: docId,
      title: `[${dispositionType}] ${caseItem.hyeongjeNo} 사건 결재`,
      docType: mode === "indict" ? "DISPOSITION" : "NON_INDICTMENT",
      hyeongjeNo: caseItem.hyeongjeNo,
      suspectName: caseItem.suspectName,
      chargeName: caseItem.chargeName,
      dispositionType,
      nonIndictReasonId,
      summary: dispositionReason,
      approvalLine,
      status: "결재진행",
      createdAt: now,
      createdBy: currentUser.name,
    };
    if (onAddApproval) onAddApproval(newDoc);

    // 결재 필수 사건은 상신만 하고, 처분 상태 즉시 반영은 결재 승인 후로 미룸
    if (caseItem.supervisorDesignated && !isCaseApprovalComplete(caseItem)) {
      alert(
        `📨 [결재 상신 완료]\n\n[${dispositionType}] 결재 문서가 전자결재함에 상신되었습니다.\n\n` +
          `⚠️ 이 사건은 직근상급자(${caseItem.supervisorName || "상급자"})가 결재 필수로 지정하였습니다.\n` +
          `처분 상태는 결재가 최종 승인된 후에 자동으로 반영됩니다.`,
      );
      return;
    }

    // 일반 사건: 상신과 동시에 처분 상태 업데이트
    if (onUpdateCase)
      onUpdateCase({
        ...caseItem,
        disposition: dispositionType,
        bookingStatus: dispositionType,
      });
    alert(
      `✅ [${dispositionType}] 결재 문서가 전자결재함에 상신되었습니다.\n담당자: ${approvalLine[0]?.name || currentUser.name}`,
    );
  };

  return (
    <div
      className="my-cases-view"
      style={{ display: "flex", flexDirection: "column", gap: 16 }}
    >
      {/* Top Banner */}
      <div
        className="glass-panel gold-border my-cases-banner"
        style={{ padding: "20px 24px" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 14,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "rgba(245,158,11,0.15)",
                border: "1px solid rgba(245,158,11,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <UserCheck size={24} color="var(--primary-amber)" />
            </div>
            <div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: "1.1rem",
                  color: "var(--text-main)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {targetProsecutorName} 검사 전담 사건 처리함
                <span
                  className="badge badge-gold"
                  style={{ fontSize: "0.72rem" }}
                >
                  PERSONAL DOCKET
                </span>
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  marginTop: 2,
                }}
              >
                {currentUser.dept || "검찰청"} ·{" "}
                {currentUser.position || currentUser.title} | 배당된 수사 및
                공판 사건 전담 처리
              </div>
            </div>
          </div>
          {isHighAdmin && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "var(--bg-elevated)",
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid var(--border-subtle)",
              }}
            >
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                조회 검사 선택:
              </span>
              <select
                className="select-field"
                style={{ width: 150, fontSize: "0.78rem" }}
                value={selectedProsecutorFilter}
                onChange={(e) => setSelectedProsecutorFilter(e.target.value)}
              >
                <option value={currentUser.name}>
                  {currentUser.name} (나)
                </option>
                {prosecutorsList
                  .filter((p) => p.name !== currentUser.name)
                  .map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name} ({p.title})
                    </option>
                  ))}
              </select>
            </div>
          )}
        </div>
        <div
          className="my-cases-stats"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 10,
            marginTop: 16,
          }}
        >
          {[
            {
              label: "전체 담당 사건",
              value: myCases.length,
              color: "var(--primary-amber)",
            },
            { label: "수사 진행 중", value: activeCount, color: "#60a5fa" },
            {
              label: "기소 / 공판 중",
              value: indictmentCount,
              color: "#fb923c",
            },
            {
              label: "불기소 / 종국",
              value: nonIndictmentCount,
              color: "#34d399",
            },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "var(--bg-elevated)",
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                {s.label}
              </div>
              <div
                style={{
                  fontSize: "1.3rem",
                  fontWeight: 900,
                  color: s.color,
                  marginTop: 2,
                }}
              >
                {s.value}건
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Bar */}
      <div
        className="glass-panel my-cases-filter"
        style={{
          padding: "12px 16px",
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div
          className="my-cases-search"
          style={{ position: "relative", flex: 1, minWidth: 220 }}
        >
          <Search
            size={14}
            color="var(--text-muted)"
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
            }}
          />
          <input
            className="input-field"
            style={{ paddingLeft: 30, fontSize: "0.8rem" }}
            placeholder="형제번호, 피의자명, 죄명, UUID 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="select-field"
          style={{ width: 160, fontSize: "0.8rem" }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">전체 사건 상태</option>
          <option value="수사">수사 진행 중</option>
          <option value="기소">기소 건</option>
          <option value="불기소">불기소 건</option>
        </select>
      </div>

      {/* Case List */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filteredMyCases.length === 0 ? (
          <div
            className="glass-panel"
            style={{
              padding: 48,
              textAlign: "center",
              color: "var(--text-muted)",
            }}
          >
            <FolderCheck
              size={36}
              color="var(--primary-amber)"
              style={{ margin: "0 auto 12px", opacity: 0.7 }}
            />
            <div
              style={{
                fontWeight: 700,
                fontSize: "0.95rem",
                color: "var(--text-main)",
                marginBottom: 4,
              }}
            >
              담당 처리할 사건이 없습니다.
            </div>
            <div style={{ fontSize: "0.78rem" }}>
              검색어나 필터 설정을 변경해보세요.
            </div>
          </div>
        ) : (
          filteredMyCases.map((item) => {
            const statusColor = STATUS_COLOR(
              item.disposition || item.bookingStatus,
            );
            return (
              <div
                key={item.id}
                className="glass-panel my-case-card"
                style={{
                  padding: "16px 20px",
                  borderRadius: 12,
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {/* Row 1 */}
                <div
                  className="my-case-heading"
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 8 }}
                  >
                    <span
                      className="badge badge-gold"
                      style={{
                        fontFamily: "monospace",
                        fontWeight: 800,
                        fontSize: "0.82rem",
                      }}
                    >
                      {item.sujeNo ||
                        (item.hyeongjeNo || "").replace("형제", "수제")}
                    </span>
                    {(item.disposition || "").includes("기소") &&
                      !(item.disposition || "").includes("불기소") &&
                      !(item.disposition || "").includes("유예") && (
                        <span
                          className="badge"
                          style={{
                            background: "rgba(59,130,246,0.2)",
                            color: "#60a5fa",
                            fontFamily: "monospace",
                            fontWeight: 800,
                            fontSize: "0.78rem",
                          }}
                        >
                          ⚖️{" "}
                          {item.hyeongjeNo && item.hyeongjeNo !== "-"
                            ? item.hyeongjeNo
                            : (item.sujeNo || item.hyeongjeNo).replace(
                                "수제",
                                "형제",
                              )}
                        </span>
                      )}
                    {item.supervisorDesignated &&
                      !isCaseApprovalComplete(item) && (
                        <span
                          className="badge"
                          style={{
                            background: "rgba(245,158,11,0.18)",
                            color: "var(--primary-amber)",
                            border: "1px solid rgba(245,158,11,0.4)",
                            fontSize: "0.72rem",
                            fontWeight: 800,
                            display: "flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          🔒 결재 필수
                        </span>
                      )}
                    {item.supervisorDesignated &&
                      isCaseApprovalComplete(item) && (
                        <span
                          className="badge"
                          style={{
                            background: "rgba(52,211,153,0.15)",
                            color: "#34d399",
                            border: "1px solid rgba(52,211,153,0.35)",
                            fontSize: "0.72rem",
                            fontWeight: 800,
                            display: "flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          ✅ 결재 완료
                        </span>
                      )}
                    <span
                      className="badge"
                      style={{
                        background: `${statusColor}20`,
                        color: statusColor,
                        fontSize: "0.75rem",
                      }}
                    >
                      {item.disposition || item.bookingStatus || "수사중"}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "0.72rem",
                      color: "var(--text-muted)",
                      display: "flex",
                      gap: 10,
                    }}
                  >
                    <span>
                      발생:{" "}
                      <strong style={{ color: "var(--text-main)" }}>
                        {item.incidentDate || item.bookingDate || "-"}
                      </strong>
                    </span>
                    <span>접수: {item.bookingDate || "-"}</span>
                  </div>
                </div>

                {/* Row 2 */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                    gap: 10,
                    background: "var(--bg-elevated)",
                    padding: 14,
                    borderRadius: 10,
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--text-muted)",
                        display: "block",
                        marginBottom: 2,
                      }}
                    >
                      피의자 성명 / UUID
                    </span>
                    <button
                      onClick={() =>
                        onSelectSuspect && onSelectSuspect(item.suspectName)
                      }
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        textAlign: "left",
                      }}
                    >
                      <strong
                        style={{
                          fontSize: "0.9rem",
                          color: "var(--text-main)",
                          textDecoration: "underline dotted",
                        }}
                      >
                        {item.suspectName}
                      </strong>
                    </button>
                    {item.suspectUuid && (
                      <div
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--text-muted)",
                          fontFamily: "monospace",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {item.suspectUuid}
                      </div>
                    )}
                  </div>
                  <div>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--text-muted)",
                        display: "block",
                        marginBottom: 2,
                      }}
                    >
                      적용 죄명
                    </span>
                    <strong
                      style={{
                        fontSize: "0.88rem",
                        color: "var(--primary-amber)",
                      }}
                    >
                      {item.chargeName || "-"}
                    </strong>
                  </div>
                  <div>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--text-muted)",
                        display: "block",
                        marginBottom: 2,
                      }}
                    >
                      재판 현황
                    </span>
                    <div style={{ fontSize: "0.75rem", color: "#93c5fd" }}>
                      {item.court1No
                        ? `1심 (${item.court1No}): ${item.court1Result || "진행중"}`
                        : "재판 미회부"}
                    </div>
                  </div>
                  <div>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--text-muted)",
                        display: "block",
                        marginBottom: 2,
                      }}
                    >
                      공소시효 (소송법 제21조의2/3)
                    </span>
                    {(() => {
                      const sol = calculateStatuteOfLimitations(
                        item.chargeName,
                        item.bookingDate,
                      );
                      return (
                        <div
                          style={{
                            fontSize: "0.73rem",
                            fontFamily: "monospace",
                          }}
                        >
                          <span
                            style={{
                              color:
                                sol.dDay <= 3
                                  ? "#ef4444"
                                  : "var(--primary-amber)",
                              fontWeight: 800,
                            }}
                          >
                            {sol.dDayText}
                          </span>
                          <span
                            style={{
                              color: "var(--text-muted)",
                              display: "block",
                              fontSize: "0.68rem",
                            }}
                          >
                            (
                            {sol.periodDays
                              ? `${sol.periodDays}일 시효`
                              : "특가법 시효무제한"}{" "}
                            · {sol.expireDateStr})
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Row 3: Actions */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                    borderTop: "1px solid var(--border-subtle)",
                    paddingTop: 10,
                  }}
                >
                  <div
                    className="my-case-actions"
                    style={{ display: "flex", gap: 6, flexWrap: "wrap" }}
                  >
                    <button
                      onClick={() => {
                        setStatusChangeCase(item);
                        setNewStatus(
                          item.disposition ||
                            item.bookingStatus ||
                            "입건 : 수사 진행 중",
                        );
                      }}
                      className="btn btn-gold"
                      style={{
                        fontSize: "0.78rem",
                        padding: "5px 12px",
                        gap: 5,
                        opacity:
                          item.supervisorDesignated &&
                          !isCaseApprovalComplete(item)
                            ? 0.7
                            : 1,
                      }}
                    >
                      {item.supervisorDesignated &&
                      !isCaseApprovalComplete(item) ? (
                        <>
                          <Lock size={13} /> 상태 변경 (결재 필수)
                        </>
                      ) : (
                        <>
                          <RefreshCw size={13} /> 상태 변경
                        </>
                      )}
                    </button>

                    {/* 전자 결재 상신 — 인라인 모달 오픈 */}
                    <button
                      onClick={() => setApprovalCase(item)}
                      className="btn btn-outline"
                      style={{
                        fontSize: "0.78rem",
                        padding: "5px 12px",
                        color: "var(--primary-amber)",
                        border: "1px solid rgba(245,158,11,0.4)",
                        gap: 5,
                      }}
                    >
                      <ClipboardList size={13} /> 전자 결재 상신
                    </button>

                    {item.bookingBasis?.includes("http") && (
                      <button
                        onClick={() =>
                          onSelectEvidence &&
                          onSelectEvidence(
                            item.bookingBasis,
                            item.hyeongjeNo,
                            item.suspectName,
                          )
                        }
                        className="btn btn-outline"
                        style={{
                          fontSize: "0.78rem",
                          padding: "5px 12px",
                          color: "#60a5fa",
                          border: "1px solid rgba(96,165,250,0.3)",
                          gap: 5,
                        }}
                      >
                        <ExternalLink size={13} /> 증거 보관함
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setEditingCase(item)}
                    className="btn btn-secondary"
                    style={{ fontSize: "0.78rem", padding: "5px 12px", gap: 5 }}
                  >
                    <Edit size={13} /> 사건 수정
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── 전자 결재 상신 모달 ── */}
      {approvalCase && (
        <ApprovalModal
          caseItem={approvalCase}
          currentUser={currentUser}
          prosecutorsList={prosecutorsList}
          onSubmit={handleApprovalSubmit}
          onClose={() => setApprovalCase(null)}
        />
      )}

      {/* ── 상태 변경 모달 ── */}
      {statusChangeCase && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
          }}
        >
          <div
            className="glass-panel gold-border"
            style={{
              width: "100%",
              maxWidth: 440,
              padding: 24,
              borderRadius: 14,
            }}
          >
            <div
              style={{
                fontWeight: 800,
                fontSize: "1rem",
                color: "var(--text-main)",
                marginBottom: 4,
              }}
            >
              ⚡ 사건 처분 / 수사 상태 변경
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--primary-amber)",
                fontFamily: "monospace",
                marginBottom: 16,
              }}
            >
              {statusChangeCase.hyeongjeNo}호 | 피의자:{" "}
              {statusChangeCase.suspectName}
            </div>
            {statusChangeCase.supervisorDesignated &&
              !isCaseApprovalComplete(statusChangeCase) && (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: 8,
                    background: "rgba(245,158,11,0.1)",
                    border: "1px solid rgba(245,158,11,0.35)",
                    color: "var(--primary-amber)",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    lineHeight: 1.6,
                    marginBottom: 16,
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                  }}
                >
                  <Lock size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 800, marginBottom: 2 }}>
                      🔒 결재 필수 사건
                    </div>
                    <div>
                      지정자: {statusChangeCase.supervisorName || "상급자"} ·
                      전자결재 최종 승인 후에만 처분 변경이 가능합니다.
                    </div>
                  </div>
                </div>
              )}
            <form
              onSubmit={handleSaveStatusChange}
              style={{ display: "flex", flexDirection: "column", gap: 14 }}
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
                  변경할 처분 상태 *
                </label>
                <select
                  className="select-field"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  required
                >
                  {DISPOSITION_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setStatusChangeCase(null)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-gold"
                  style={{ flex: 1, gap: 6, justifyContent: "center" }}
                >
                  <CheckCircle2 size={15} /> 변경 완료
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 사건 수정 모달 ── */}
      {editingCase && (
        <EditCaseModal
          isOpen={!!editingCase}
          onClose={() => setEditingCase(null)}
          caseItem={editingCase}
          onSave={(updated) => {
            if (onUpdateCase) onUpdateCase(updated);
            setEditingCase(null);
          }}
          prosecutorsList={prosecutorsList}
        />
      )}
    </div>
  );
}
