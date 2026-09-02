import React, { useEffect, useMemo, useState } from "react";
import {
  getDisplayCaseNumber,
  getMasterCaseNumber,
  matchesCaseNumber,
} from "../services/caseUtils";
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
  Clock,
  MessageSquare,
  UserMinus,
  ArrowRightLeft,
} from "lucide-react";
import EditCaseModal from "./EditCaseModal";
import {
  NON_INDICTMENT_REASONS,
  calculateStatuteOfLimitations,
  isCaseClosedOrIndicted,
} from "../data/prosecutionData";
import {
  fetchApprovalTemplates,
  createApprovalTemplateApi,
  deleteApprovalTemplateApi,
  updateProsecutorApi,
  updateCaseApi,
} from "../services/api";

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

  // 결재선 템플릿
  const [templates, setTemplates] = useState([]);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const [showSaveTemplateForm, setShowSaveTemplateForm] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateShared, setNewTemplateShared] = useState(false);

  useEffect(() => {
    fetchApprovalTemplates().then((data) => {
      if (Array.isArray(data)) setTemplates(data);
    });
  }, []);

  const handleApplyTemplate = (tpl) => {
    const now = new Date().toISOString().replace("T", " ").substring(0, 16);
    const newLine = tpl.steps.map((step, idx) => {
      const matched = prosecutorsList.find(
        (p) => p.roleLevel === step.roleLevel,
      );
      return {
        role: step.role,
        name:
          idx === 0
            ? currentUser?.name || matched?.name || step.name || ""
            : matched?.name || step.name || "",
        status: idx === 0 ? "상신완료" : "결재대기",
        date: idx === 0 ? now : "-",
      };
    });
    setApprovalLine(newLine);
    setShowTemplateDropdown(false);
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) return;
    const steps = approvalLine.map((step) => ({
      role: step.role,
      name: step.name,
      roleLevel:
        prosecutorsList.find((p) => p.name === step.name)?.roleLevel || "",
    }));
    const res = await createApprovalTemplateApi({
      name: newTemplateName.trim(),
      description: "",
      steps,
      isShared: newTemplateShared,
    });
    if (res?.success && res.template) {
      setTemplates((prev) => [res.template, ...prev]);
      setShowSaveTemplateForm(false);
      setNewTemplateName("");
      setNewTemplateShared(false);
    }
  };

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
                <div style={{ display: "flex", gap: 6 }}>
                  {/* 표준라인 불러오기 */}
                  <div style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => setShowTemplateDropdown((v) => !v)}
                      className="btn btn-outline"
                      style={{ fontSize: "0.72rem", padding: "4px 10px" }}
                    >
                      📋 표준라인
                    </button>
                    {showTemplateDropdown && (
                      <div
                        style={{
                          position: "absolute",
                          top: "100%",
                          right: 0,
                          zIndex: 100,
                          background: "var(--bg-elevated)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: 8,
                          minWidth: 220,
                          boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                          padding: "6px 0",
                        }}
                      >
                        {templates.length === 0 ? (
                          <div
                            style={{
                              padding: "10px 14px",
                              fontSize: "0.78rem",
                              color: "var(--text-muted)",
                            }}
                          >
                            저장된 표준라인 없음
                          </div>
                        ) : (
                          templates.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => handleApplyTemplate(t)}
                              style={{
                                display: "block",
                                width: "100%",
                                textAlign: "left",
                                padding: "8px 14px",
                                background: "none",
                                border: "none",
                                cursor: "pointer",
                                fontSize: "0.8rem",
                                color: "var(--text-main)",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.background =
                                  "var(--bg-card)")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.background = "none")
                              }
                            >
                              {t.isShared ? "🌐 " : "🔒 "}
                              {t.name}
                            </button>
                          ))
                        )}
                        <div
                          style={{
                            borderTop: "1px solid var(--border-subtle)",
                            marginTop: 4,
                            paddingTop: 4,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setShowSaveTemplateForm(true);
                              setShowTemplateDropdown(false);
                            }}
                            style={{
                              display: "block",
                              width: "100%",
                              textAlign: "left",
                              padding: "8px 14px",
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              fontSize: "0.78rem",
                              color: "var(--primary-amber)",
                              fontWeight: 700,
                            }}
                          >
                            + 현재 라인 저장
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
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
              </div>
              {/* 템플릿 저장 폼 */}
              {showSaveTemplateForm && (
                <div
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    marginBottom: 6,
                    flexWrap: "wrap",
                  }}
                >
                  <input
                    className="input-field"
                    placeholder="표준라인 이름"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    style={{ flex: 1, minWidth: 130 }}
                  />
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: "0.75rem",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={newTemplateShared}
                      onChange={(e) => setNewTemplateShared(e.target.checked)}
                    />
                    공유
                  </label>
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    className="btn btn-gold"
                    style={{ fontSize: "0.72rem", padding: "4px 10px" }}
                  >
                    저장
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSaveTemplateForm(false)}
                    className="btn btn-secondary"
                    style={{ fontSize: "0.72rem", padding: "4px 10px" }}
                  >
                    취소
                  </button>
                </div>
              )}
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
                      {prosecutorsList.map((p) => (
                        <option key={p.id} value={p.name}>
                          {p.name} ({p.position || p.title})
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
  chargesData = [],
  departmentsData = [],
  onSelectEvidence,
  onSelectSuspect,
  onOpenApprovalForCase,
  onUpdateCase,
  onArchiveCase,
  onOpenLoginModal,
  onAddApproval,
  approvalsData = [],
  onDesignateCase,
  onUndesignateCase,
  onOpenTimeline,
  onOpenMemo,
  onOpenIndictmentComposer,
  onUpdateProsecutorStatus,
  onBulkReassign,
  isReadOnly = false,
}) {
  const [selectedProsecutorFilter, setSelectedProsecutorFilter] = useState(
    currentUser?.name || "",
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [editingCase, setEditingCase] = useState(null);
  const [statusChangeCase, setStatusChangeCase] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [suspectsDispositions, setSupectsDispositions] = useState({}); // 피의자별 처분 { suspectId: disposition }
  const [approvalCase, setApprovalCase] = useState(null); // 결재 상신 모달 대상 사건

  const getSuspectKey = (suspect) =>
    suspect?.id || suspect?.uuid || suspect?.name || "unknown";

  const normalizeDispositionMap = (source) => {
    if (!source) return {};
    if (typeof source === "string") {
      try {
        const parsed = JSON.parse(source);
        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? parsed
          : {};
      } catch {
        return {};
      }
    }
    return typeof source === "object" ? source : {};
  };

  const buildDispositionSummary = (caseItem, dispositionMap, fallback) => {
    const suspectList =
      Array.isArray(caseItem?.suspects) && caseItem.suspects.length > 0
        ? caseItem.suspects
        : caseItem?.suspectName
          ? [
              {
                id: caseItem.suspectUuid || caseItem.suspectName,
                name: caseItem.suspectName,
                uuid: caseItem.suspectUuid || "",
                role: "주범",
              },
            ]
          : [];
    if (suspectList.length <= 1) {
      return (
        fallback ||
        caseItem?.disposition ||
        caseItem?.bookingStatus ||
        "입건 : 수사 진행 중"
      );
    }
    const entries = suspectList.map((suspect, idx) => {
      const key = getSuspectKey(suspect) || `suspect-${idx}`;
      const value =
        dispositionMap?.[key] ||
        fallback ||
        caseItem?.disposition ||
        caseItem?.bookingStatus ||
        "입건 : 수사 진행 중";
      return `${suspect?.name || "피의자"}: ${value}`;
    });
    return entries.join(" / ");
  };

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

  const isHighAdmin = Boolean(
    currentUser?.isSuperAdmin ||
    [
      "SUPER_ADMIN",
      "PROSECUTOR_GENERAL",
      "CHIEF_PROSECUTOR",
      "DEPUTY_CHIEF",
      "CHIEF_ADMINISTRATOR",
    ].includes(currentUser?.roleLevel),
  );

  // 결재 필수 지정/해제 권한 — 수사지휘 라인(부장검사 이상)만 허용.
  // 검찰관리관(CHIEF_ADMINISTRATOR) 등 행정 직급은 수사 지휘권이 없으므로 제외.
  const canDesignate = Boolean(
    currentUser?.isSuperAdmin ||
    [
      "SUPER_ADMIN",
      "PROSECUTOR_GENERAL",
      "CHIEF_PROSECUTOR",
      "DEPUTY_CHIEF",
      "SENIOR_PROSECUTOR",
    ].includes(currentUser?.roleLevel),
  );

  // 관장 부서 목록 (본인 소속 부서 + 겸직/직무대리로 부서장 지정된 부서)
  const managedDepts = useMemo(() => {
    if (!Array.isArray(departmentsData) || !currentUser) return [];
    const userId = currentUser.id || "";
    const userName = currentUser.name || "";
    return departmentsData.filter((dept) => {
      if (!dept) return false;
      const matchId = Boolean(userId && dept.headId && dept.headId === userId);
      const matchName = Boolean(
        userName &&
        dept.headName &&
        typeof dept.headName === "string" &&
        dept.headName.includes(userName),
      );
      return matchId || matchName;
    });
  }, [departmentsData, currentUser]);

  // 부서장 판정: 명시적 부서장 지정 외에도 부장급 역할/직책 타이틀이면 패널 표시
  const DEPT_HEAD_ROLE_LEVELS = new Set([
    "SENIOR_PROSECUTOR",
    "CHIEF_PROSECUTOR",
    "DEPUTY_CHIEF",
    "CHIEF_ADMINISTRATOR",
    "PROSECUTOR_GENERAL",
    "SUPER_ADMIN",
  ]);
  const isDeptHeadAssigned = managedDepts.length > 0;
  const isSeniorProsecutor =
    isDeptHeadAssigned ||
    DEPT_HEAD_ROLE_LEVELS.has(currentUser?.roleLevel) ||
    (currentUser?.position || "").includes("부장") ||
    (currentUser?.position || "").includes("부서장");

  const managedDeptNames = useMemo(
    () =>
      new Set(
        managedDepts
          .map((d) => d?.name)
          .filter(Boolean)
          .concat(currentUser?.dept ? [currentUser.dept] : []),
      ),
    [managedDepts, currentUser],
  );

  const [seniorTab, setSeniorTab] = useState("leave"); // "leave" | "reassign"
  const [leaveTarget, setLeaveTarget] = useState("");
  const [leaveStatus, setLeaveStatus] = useState("LEAVE");
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [reassignFromId, setReassignFromId] = useState("");
  const [reassignToId, setReassignToId] = useState("");
  const [reassignLoading, setReassignLoading] = useState(false);
  const [seniorMsg, setSeniorMsg] = useState(null);

  // 관장 부서 내 검사 목록 — 권한 레벨 비교 제거(부서 소속 여부만 판단)
  const deptMembers = useMemo(
    () =>
      (prosecutorsList || []).filter(
        (p) =>
          p &&
          p.id !== currentUser?.id &&
          (managedDeptNames.has(p.dept) ||
            (currentUser?.dept && p.dept === currentUser.dept)),
      ),
    [prosecutorsList, currentUser, managedDeptNames],
  );

  const handleLeaveChange = async () => {
    if (!leaveTarget) return;
    setLeaveLoading(true);
    setSeniorMsg(null);
    const res = await updateProsecutorApi(leaveTarget, { status: leaveStatus });
    setLeaveLoading(false);
    if (res?.success) {
      // 부모 App.jsx의 prosecutorsList 상태를 즉시 반영
      if (onUpdateProsecutorStatus) {
        onUpdateProsecutorStatus(leaveTarget, { status: leaveStatus });
      }
      const target =
        deptMembers.find((p) => p.id === leaveTarget) ||
        prosecutorsList.find((p) => p.id === leaveTarget);
      const statusLabel =
        leaveStatus === "LEAVE"
          ? "휴직"
          : leaveStatus === "INACTIVE"
            ? "비활성"
            : "복직";
      setSeniorMsg({
        type: "success",
        text: `✅ ${target?.name || leaveTarget} 검사를 ${statusLabel} 처리했습니다.`,
      });
      setLeaveTarget(""); // 적용 후 선택 초기화
    } else {
      setSeniorMsg({
        type: "error",
        text: `❌ 실패: ${res?.message || "서버 오류"}`,
      });
    }
  };

  const handleDeptReassign = async () => {
    if (!reassignFromId || !reassignToId) return;
    if (reassignFromId === reassignToId) {
      setSeniorMsg({
        type: "error",
        text: "같은 검사로는 재배당할 수 없습니다.",
      });
      return;
    }
    setReassignLoading(true);
    setSeniorMsg(null);
    // 해당 검사의 부서 내 활성 사건 목록 조회
    const fromCases = ledgerData.filter(
      (c) => c.prosecutorId === reassignFromId && !c.isArchived,
    );
    if (fromCases.length === 0) {
      setReassignLoading(false);
      setSeniorMsg({ type: "error", text: "재배당할 활성 사건이 없습니다." });
      return;
    }
    const toP =
      deptMembers.find((p) => p.id === reassignToId) ||
      prosecutorsList.find((p) => p.id === reassignToId);
    let successCount = 0;
    for (const c of fromCases) {
      const res = await updateCaseApi(c.id, {
        ...c,
        prosecutorId: reassignToId,
        prosecutorName: toP?.name || reassignToId,
        forceReassign: true,
      });
      if (res?.success) successCount++;
    }
    setReassignLoading(false);
    setSeniorMsg({
      type: successCount > 0 ? "success" : "error",
      text:
        successCount > 0
          ? `✅ ${successCount}건 재배당 완료 → ${toP?.name || reassignToId}`
          : "❌ 재배당에 실패했습니다.",
    });
  };

  const canSelectProsecutor = Boolean(
    isHighAdmin || isDeptHeadAssigned || isSeniorProsecutor,
  );

  const targetProsecutorName =
    canSelectProsecutor && selectedProsecutorFilter
      ? selectedProsecutorFilter
      : currentUser?.name || "";

  // 담당자 필터 적용 (본인이 명의인 사건만 엄격 매칭)
  const myCases = useMemo(() => {
    if (!Array.isArray(ledgerData) || !currentUser) return [];

    const target = targetProsecutorName || currentUser?.name || "";
    const userId = currentUser?.id || "";

    return ledgerData.filter((item) => {
      if (!item) return false;
      const pName = item.prosecutorName || "";
      const pId = item.prosecutorId || "";

      const matchId = Boolean(
        (userId && pId === userId) || (target && pId === target),
      );
      const matchName = Boolean(
        target && (pName.includes(target) || target.includes(pName)),
      );

      return matchId || matchName;
    });
  }, [ledgerData, currentUser, targetProsecutorName]);

  const prosecutorOptions = useMemo(() => {
    if (!canSelectProsecutor) return [];
    const sourceList = isHighAdmin ? prosecutorsList : deptMembers;
    return (sourceList || []).filter(
      (p) => p && p.name && p.name !== currentUser?.name,
    );
  }, [
    canSelectProsecutor,
    isHighAdmin,
    prosecutorsList,
    deptMembers,
    currentUser,
  ]);

  // 현재 처리중 사건 = 보존 제외
  const myActiveCases = myCases.filter((c) => !c?.isArchived);

  const filteredMyCases = myCases.filter((item) => {
    const q = searchTerm.toLowerCase().trim();
    const matchQ =
      !q ||
      matchesCaseNumber(item, q) ||
      (item.suspectName || "").toLowerCase().includes(q) ||
      (item.chargeName || "").toLowerCase().includes(q) ||
      (item.suspectUuid || "").toLowerCase().includes(q);
    const matchStatus =
      statusFilter === "ALL" ||
      (item.disposition || item.bookingStatus || "")
        .toLowerCase()
        .includes(statusFilter.toLowerCase());

    // 개인보관함에서는 보존사건 항상 제외
    return matchQ && matchStatus && !item.isArchived;
  });

  const activeCount = myActiveCases.filter(
    (c) =>
      !(c.disposition || "").includes("불기소") &&
      !(c.disposition || "").includes("종국"),
  ).length;
  const indictmentCount = myActiveCases.filter(
    (c) =>
      (c.disposition || "").includes("기소") &&
      !(c.disposition || "").includes("불기소"),
  ).length;
  const nonIndictmentCount = myActiveCases.filter(
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

    const finalDisposition = buildDispositionSummary(
      statusChangeCase,
      suspectsDispositions,
      newStatus ||
        statusChangeCase.disposition ||
        statusChangeCase.bookingStatus,
    );

    if (onUpdateCase)
      onUpdateCase({
        ...statusChangeCase,
        disposition: finalDisposition,
        bookingStatus: finalDisposition,
        suspectsDispositions: suspectsDispositions,
      });
    setStatusChangeCase(null);
    setSupectsDispositions({});
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
          {canSelectProsecutor && (
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
                style={{ width: 160, fontSize: "0.78rem" }}
                value={selectedProsecutorFilter}
                onChange={(e) => setSelectedProsecutorFilter(e.target.value)}
              >
                <option value={currentUser?.name}>
                  {currentUser?.name} (나)
                </option>
                {prosecutorOptions.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name} ({p.position || p.title || "검사"})
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
              value: myActiveCases.length,
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

      {/* ── 부서장 관리 패널 (부장검사 전용) ── */}
      {isSeniorProsecutor && deptMembers.length > 0 && (
        <div
          className="glass-panel"
          style={{
            padding: "16px 20px",
            border: "1px solid rgba(245,158,11,0.25)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 14,
            }}
          >
            <Users size={16} color="var(--primary-amber)" />
            <span
              style={{
                fontWeight: 800,
                fontSize: "0.9rem",
                color: "var(--text-main)",
              }}
            >
              부서장 관리 패널
            </span>
            <span className="badge badge-gold" style={{ fontSize: "0.68rem" }}>
              {currentUser.dept} 부서장
            </span>
          </div>

          {/* 탭 */}
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            {[
              {
                id: "leave",
                label: "휴직 / 복직 처리",
                icon: <UserMinus size={13} />,
              },
              {
                id: "reassign",
                label: "부서 내 사건 재배당",
                icon: <ArrowRightLeft size={13} />,
              },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setSeniorTab(t.id);
                  setSeniorMsg(null);
                }}
                className="btn"
                style={{
                  padding: "5px 14px",
                  fontSize: "0.78rem",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  background:
                    seniorTab === t.id
                      ? "var(--primary-amber)"
                      : "rgba(255,255,255,0.05)",
                  color: seniorTab === t.id ? "#000" : "var(--text-main)",
                  fontWeight: seniorTab === t.id ? 800 : 500,
                  border:
                    seniorTab === t.id
                      ? "none"
                      : "1px solid var(--border-subtle)",
                  borderRadius: 6,
                }}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* 휴직 / 복직 처리 탭 */}
          {seniorTab === "leave" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* 부서원 카드 목록 */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {deptMembers.map((p) => {
                  const statusLabel =
                    p.status === "LEAVE"
                      ? "휴직중"
                      : p.status === "INACTIVE"
                        ? "비활성"
                        : "재직중";
                  const statusColor =
                    p.status === "LEAVE"
                      ? "#fbbf24"
                      : p.status === "INACTIVE"
                        ? "#6b7280"
                        : "#34d399";
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        flexWrap: "wrap",
                        background: "var(--bg-elevated)",
                        border:
                          leaveTarget === p.id
                            ? "1px solid rgba(245,158,11,0.5)"
                            : "1px solid var(--border-subtle)",
                        borderRadius: 8,
                        padding: "9px 14px",
                      }}
                    >
                      {/* 이름 + 직책 + 현재 상태 */}
                      <div style={{ flex: 1, minWidth: 160 }}>
                        <span
                          style={{
                            fontWeight: 700,
                            fontSize: "0.85rem",
                            color: "var(--text-main)",
                          }}
                        >
                          {p.name}
                        </span>
                        <span
                          style={{
                            fontSize: "0.72rem",
                            color: "var(--text-muted)",
                            marginLeft: 6,
                          }}
                        >
                          {p.position || p.title || p.rank || ""}
                        </span>
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: "0.7rem",
                            fontWeight: 800,
                            color: statusColor,
                            background: `${statusColor}20`,
                            padding: "1px 6px",
                            borderRadius: 4,
                          }}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      {/* 처리 구분 선택 */}
                      <select
                        className="select-field"
                        style={{ fontSize: "0.76rem", padding: "5px 8px", width: 130 }}
                        value={leaveTarget === p.id ? leaveStatus : ""}
                        onChange={(e) => {
                          setLeaveTarget(p.id);
                          setLeaveStatus(e.target.value);
                        }}
                        onClick={() => setLeaveTarget(p.id)}
                      >
                        <option value="">-- 처리 선택 --</option>
                        <option value="ACTIVE">🟢 복직 (재직)</option>
                        <option value="LEAVE">🟡 휴직 처리</option>
                        <option value="INACTIVE">⚫ 비활성 처리</option>
                      </select>

                      {/* 적용 버튼 */}
                      <button
                        onClick={() => {
                          if (leaveTarget !== p.id) {
                            setLeaveTarget(p.id);
                            return;
                          }
                          handleLeaveChange();
                        }}
                        disabled={leaveTarget !== p.id || !leaveStatus || leaveLoading}
                        className="btn btn-gold"
                        style={{
                          padding: "5px 14px",
                          fontSize: "0.76rem",
                          fontWeight: 700,
                          opacity: leaveTarget !== p.id || leaveLoading ? 0.45 : 1,
                        }}
                      >
                        <UserMinus size={13} />
                        {leaveLoading && leaveTarget === p.id ? "처리 중..." : "적용"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 사건 재배당 탭 */}
          {seniorTab === "reassign" && (
            <div
              style={{
                display: "flex",
                gap: 10,
                alignItems: "flex-end",
                flexWrap: "wrap",
              }}
            >
              <div>
                <label className="input-label">
                  현재 담당 검사 (이관 출발)
                </label>
                <select
                  className="select-field"
                  style={{ width: 200 }}
                  value={reassignFromId}
                  onChange={(e) => setReassignFromId(e.target.value)}
                >
                  <option value="">-- 선택 --</option>
                  {deptMembers.map((p) => {
                    const cases = ledgerData.filter(
                      (c) => c.prosecutorId === p.id && !c.isArchived,
                    );
                    const caseNos = cases
                      .slice(0, 3)
                      .map(
                        (c) =>
                          (c.hyeongjeNo && c.hyeongjeNo !== "-"
                            ? c.hyeongjeNo
                            : c.sujeNo) || "번호미부여",
                      )
                      .join(", ");
                    const more =
                      cases.length > 3 ? ` 외 ${cases.length - 3}건` : "";
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.position || p.title}) · {cases.length}건
                        {cases.length > 0 ? ` [${caseNos}${more}]` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div style={{ color: "var(--text-muted)", paddingBottom: 8 }}>
                →
              </div>
              <div>
                <label className="input-label">새 담당 검사 (이관 도착)</label>
                <select
                  className="select-field"
                  style={{ width: 200 }}
                  value={reassignToId}
                  onChange={(e) => setReassignToId(e.target.value)}
                >
                  <option value="">-- 선택 --</option>
                  {deptMembers
                    .filter(
                      (p) => p.id !== reassignFromId && p.status === "ACTIVE",
                    )
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.position || p.title})
                      </option>
                    ))}
                </select>
              </div>
              <button
                onClick={handleDeptReassign}
                disabled={!reassignFromId || !reassignToId || reassignLoading}
                className="btn btn-gold"
                style={{
                  padding: "8px 18px",
                  fontWeight: 700,
                  opacity: reassignLoading ? 0.6 : 1,
                }}
              >
                <ArrowRightLeft size={14} />{" "}
                {reassignLoading ? "재배당 중..." : "전체 재배당"}
              </button>
            </div>
          )}

          {/* 결과 메시지 */}
          {seniorMsg && (
            <div
              style={{
                marginTop: 12,
                padding: "7px 14px",
                borderRadius: 8,
                fontSize: "0.8rem",
                background:
                  seniorMsg.type === "success"
                    ? "rgba(52,211,153,0.1)"
                    : "rgba(239,68,68,0.1)",
                color: seniorMsg.type === "success" ? "#34d399" : "#f87171",
                border: `1px solid ${seniorMsg.type === "success" ? "#34d39940" : "#f8717140"}`,
              }}
            >
              {seniorMsg.text}
            </div>
          )}
        </div>
      )}

      {/* 현재 처리중 사건만 표시 — 보존기록은 검찰사무국에서 관리 */}
      <div
        style={{
          fontSize: "0.75rem",
          color: "var(--text-muted)",
          padding: "2px 0 6px 0",
        }}
      >
        📂 현재 처리중 {myActiveCases.length}건 (보존사건 제외)
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
                      {getDisplayCaseNumber(item)}
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
                          ⚖️ 기소
                        </span>
                      )}
                    {!!item.supervisorDesignated &&
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
                    {!!item.supervisorDesignated &&
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
                    {item._privateMasked ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "3px 9px",
                          borderRadius: 6,
                          background: "rgba(239,68,68,0.12)",
                          border: "1px solid rgba(239,68,68,0.35)",
                          color: "#f87171",
                          fontSize: "0.78rem",
                          fontWeight: 800,
                        }}
                      >
                        🔐 보안사건 (신원 비공개)
                      </span>
                    ) : (
                      <>
                        <button
                          onClick={() =>
                            onSelectSuspect &&
                            onSelectSuspect({
                              name: item.suspectName,
                              uuid: item.suspectUuid || null,
                            })
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
                        {item.suspectUuid &&
                          item.suspectUuid !== "-" &&
                          item.suspectUuid !== "00" && (
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
                      </>
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
                      if (isCaseClosedOrIndicted(item)) {
                        const disp = (item.disposition || "").trim();
                        const isIndicted =
                          (disp.includes("기소") || disp.includes("구공판")) &&
                          !disp.includes("불기소") &&
                          !disp.includes("미기소") &&
                          !disp.includes("기소유예") &&
                          !disp.includes("기소중지");
                        return (
                          <div
                            style={{
                              fontSize: "0.73rem",
                              fontFamily: "monospace",
                            }}
                          >
                            <span
                              style={{
                                color: "#34d399",
                                fontWeight: 800,
                              }}
                            >
                              {isIndicted
                                ? "기소 완료 (시효 정지)"
                                : "종국 처분 (시효 종료)"}
                            </span>
                            <span
                              style={{
                                color: "var(--text-muted)",
                                display: "block",
                                fontSize: "0.68rem",
                              }}
                            >
                              ({disp || "처분 완료"})
                            </span>
                          </div>
                        );
                      }
                      const sol = calculateStatuteOfLimitations(
                        item.chargeName,
                        item.incidentDate || item.bookingDate,
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
                        // 피의자별 처분 초기화
                        const suspectsArray =
                          item.suspects && Array.isArray(item.suspects)
                            ? item.suspects
                            : item.suspectName
                              ? [
                                  {
                                    id: 1,
                                    name: item.suspectName,
                                    uuid: item.suspectUuid,
                                  },
                                ]
                              : [];
                        const dispositions = item.suspectsDispositions || {};
                        // 피의자가 없으면 기본 처분을 모두 같게 설정
                        if (
                          !item.suspectsDispositions &&
                          item.suspects &&
                          item.suspects.length > 0
                        ) {
                          const newDisps = {};
                          item.suspects.forEach((s) => {
                            newDisps[s.id || s.uuid || s.name] =
                              item.disposition ||
                              item.bookingStatus ||
                              "입건 : 수사 진행 중";
                          });
                          setSupectsDispositions(newDisps);
                        } else {
                          setSupectsDispositions(dispositions || {});
                        }
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

                    {/* HWP 공소장 자동작성 */}
                    {onOpenIndictmentComposer && (
                      <button
                        onClick={() => onOpenIndictmentComposer(item)}
                        className="btn btn-outline"
                        style={{
                          fontSize: "0.78rem",
                          padding: "5px 12px",
                          color: "#93c5fd",
                          border: "1px solid rgba(147,197,253,0.4)",
                          gap: 5,
                        }}
                        title="대한민국 검찰 표준 HWP 공소장 자동 작성"
                      >
                        <Scale size={13} /> 공소장 작성
                      </button>
                    )}

                    {/* 사건 보존 / 보존 해제 버튼 */}
                    {onArchiveCase && (
                      <button
                        onClick={() => onArchiveCase(item.id, !item.isArchived)}
                        className="btn btn-outline"
                        style={{
                          fontSize: "0.78rem",
                          padding: "5px 12px",
                          color: item.isArchived ? "#34d399" : "#f59e0b",
                          border: `1px solid ${item.isArchived ? "rgba(52,211,153,0.4)" : "rgba(245,158,11,0.3)"}`,
                          gap: 5,
                        }}
                        title={
                          item.isArchived
                            ? "보존 해제하여 사건 원부 기본 목록으로 복원"
                            : "사건을 보존 처리하여 보존기록 서고로 이동"
                        }
                      >
                        {item.isArchived ? "🔄 보존 해제" : "📦 사건 보존"}
                      </button>
                    )}

                    <button
                      onClick={() => onOpenTimeline && onOpenTimeline(item)}
                      className="btn btn-outline"
                      style={{
                        fontSize: "0.78rem",
                        padding: "5px 12px",
                        color: "#a78bfa",
                        border: "1px solid rgba(167,139,250,0.4)",
                        gap: 5,
                      }}
                    >
                      <Clock size={13} /> 사건 타임라인
                    </button>

                    <button
                      onClick={() => onOpenMemo && onOpenMemo(item)}
                      className="btn btn-outline"
                      style={{
                        fontSize: "0.78rem",
                        padding: "5px 12px",
                        color: "#34d399",
                        border: "1px solid rgba(52,211,153,0.35)",
                        gap: 5,
                      }}
                    >
                      <MessageSquare size={13} /> 수사 메모
                    </button>

                    <button
                      onClick={() =>
                        onSelectEvidence &&
                        onSelectEvidence(
                          item.bookingBasis || "",
                          getMasterCaseNumber(item),
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

                    {/* 결재 필수 지정/해제 — 수사지휘 라인(부장검사 이상)만 표시 */}
                    {canDesignate &&
                      (item.supervisorDesignated ? (
                        <button
                          onClick={() =>
                            onUndesignateCase && onUndesignateCase(item.id)
                          }
                          className="btn btn-outline"
                          style={{
                            fontSize: "0.78rem",
                            padding: "5px 12px",
                            color: "#94a3b8",
                            border: "1px solid rgba(100,116,139,0.3)",
                            gap: 5,
                          }}
                        >
                          🔓 결재지정 해제
                        </button>
                      ) : (
                        <button
                          onClick={() =>
                            onDesignateCase && onDesignateCase(item.id)
                          }
                          className="btn btn-outline"
                          style={{
                            fontSize: "0.78rem",
                            padding: "5px 12px",
                            color: "var(--primary-amber)",
                            border: "1px solid rgba(245,158,11,0.3)",
                            gap: 5,
                          }}
                        >
                          🔒 결재 필수 지정
                        </button>
                      ))}
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
              {getDisplayCaseNumber(statusChangeCase) ||
                getMasterCaseNumber(statusChangeCase) ||
                "번호미부여"}{" "}
              | 피의자: {statusChangeCase.suspectName}
            </div>
            {!!statusChangeCase.supervisorDesignated &&
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
                  onChange={(e) => {
                    const nextValue = e.target.value;
                    setNewStatus(nextValue);
                    const suspects =
                      Array.isArray(statusChangeCase?.suspects) &&
                      statusChangeCase.suspects.length > 0
                        ? statusChangeCase.suspects
                        : statusChangeCase?.suspectName
                          ? [
                              {
                                id:
                                  statusChangeCase.suspectUuid ||
                                  statusChangeCase.suspectName,
                                name: statusChangeCase.suspectName,
                                uuid: statusChangeCase.suspectUuid || "",
                                role: "주범",
                              },
                            ]
                          : [];
                    setSupectsDispositions((prev) => {
                      const nextMap = { ...prev };
                      suspects.forEach((suspect, idx) => {
                        const key = getSuspectKey(suspect) || `suspect-${idx}`;
                        nextMap[key] = nextValue;
                      });
                      return nextMap;
                    });
                  }}
                  required
                >
                  {DISPOSITION_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>

              {(() => {
                const suspects =
                  Array.isArray(statusChangeCase?.suspects) &&
                  statusChangeCase.suspects.length > 0
                    ? statusChangeCase.suspects
                    : statusChangeCase?.suspectName
                      ? [
                          {
                            id:
                              statusChangeCase.suspectUuid ||
                              statusChangeCase.suspectName,
                            name: statusChangeCase.suspectName,
                            uuid: statusChangeCase.suspectUuid || "",
                            role: "주범",
                          },
                        ]
                      : [];
                if (suspects.length <= 1) return null;
                return (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {suspects.map((suspect, idx) => {
                      const key = getSuspectKey(suspect) || `suspect-${idx}`;
                      return (
                        <div
                          key={key}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          <label
                            style={{
                              display: "block",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              color: "var(--text-muted)",
                            }}
                          >
                            피의자별 처분 · {suspect?.name || "피의자"}
                          </label>
                          <select
                            className="select-field"
                            value={
                              suspectsDispositions[key] ||
                              newStatus ||
                              "입건 : 수사 진행 중"
                            }
                            onChange={(e) =>
                              setSupectsDispositions((prev) => ({
                                ...prev,
                                [key]: e.target.value,
                              }))
                            }
                          >
                            {DISPOSITION_OPTIONS.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

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
          onSave={async (updated) => {
            if (onUpdateCase) return await onUpdateCase(updated);
            return false;
          }}
          prosecutorsList={prosecutorsList}
          chargesData={chargesData}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}
