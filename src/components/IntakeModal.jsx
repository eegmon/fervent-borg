import React, { useState, useEffect } from "react";
import {
  Scale,
  Link,
  CheckCircle2,
  User,
  Search,
  RefreshCw,
  Plus,
  Trash2,
  Users,
  Save,
} from "lucide-react";
import { fetchMojangUuid } from "../services/mojangApi";
import { useDraft } from "../services/useDraft";
import ChargeSearchInput from "./ChargeSearchInput";

export default function IntakeModal({
  isOpen,
  onClose,
  onSubmitIntake,
  currentUser,
  prosecutorsList = [],
  ledgerData = [],
  caseNumberSettings = { hyeongjeStart: 280 },
  chargesData = [],
}) {
  const todayStr = new Date().toISOString().split("T")[0];
  const currentYear = new Date().getFullYear();
  const getNextNumber = (prefix, start) => {
    const regex = new RegExp(`^${currentYear}${prefix}(\\d+)$`);
    const maxExisting = ledgerData.reduce(
      (max, item) => {
        const match = (item.sujeNo || "").match(regex) || (item.hyeongjeNo || "").match(regex);
        return match ? Math.max(max, Number(match[1])) : max;
      },
      Number(start) - 1,
    );
    return `${currentYear}${prefix}${Math.max(Number(start), maxExisting + 1)}`;
  };
  const generateCaseNumber = () =>
    getNextNumber("수제", caseNumberSettings.hyeongjeStart);
  const generateInvestigationNumber = () =>
    getNextNumber("내사", caseNumberSettings.naesaStart || 1);
  const [formData, setFormData] = useState({
    hyeongjeNo: generateCaseNumber(),
    chargeName: "",
    bookingStatus: "입건:불구속",
    visibility: "PUBLIC",
    prosecutorId: "AUTO_ASSIGN",
    bookingBasis: "",
    content: "",
    confiscation: "",
    incidentDate: todayStr,
    bookingDate: todayStr,
  });
  const [chargeRows, setChargeRows] = useState([
    { id: 1, name: "", type: "주위적" },
  ]);
  // Reset case numbers each time the modal opens
  React.useEffect(() => {
    if (isOpen) {
      setFormData((prev) => ({
        ...prev,
        hyeongjeNo: generateCaseNumber(),
      }));
    }
  }, [isOpen, ledgerData, caseNumberSettings]);

  // Multiple Suspects State
  const [suspectsList, setSuspectsList] = useState([
    { id: 1, name: "", uuid: "", role: "주범", bookingStatus: "입건:불구속" },
  ]);
  const [evidenceAttachments, setEvidenceAttachments] = useState([]);
  const [privateViewerIds, setPrivateViewerIds] = useState([]);

  const [mojangLoadingMap, setMojangLoadingMap] = useState({});
  const [mojangStatusMsg, setMojangStatusMsg] = useState(null);
  const [showDraftBanner, setShowDraftBanner] = useState(false);

  // ── 임시저장 훅 ─────────────────────────────────────────────────
  const DRAFT_KEY = "dose_draft_intake";
  const { hasDraft, readDraft, saveDraft, clearDraft } = useDraft(DRAFT_KEY);

  // 모달 열릴 때 draft 존재 여부 배너 표시
  useEffect(() => {
    if (isOpen && hasDraft) setShowDraftBanner(true);
  }, [isOpen]);

  // 폼 변경 시 자동 임시저장
  useEffect(() => {
    if (!isOpen) return;
    saveDraft({ formData, chargeRows, suspectsList });
  }, [formData, chargeRows, suspectsList, isOpen]);

  const handleRestoreDraft = () => {
    const draft = readDraft();
    if (!draft) return;
    if (draft.formData) setFormData((prev) => ({ ...prev, ...draft.formData }));
    if (draft.chargeRows?.length) setChargeRows(draft.chargeRows);
    if (draft.suspectsList?.length) setSuspectsList(draft.suspectsList);
    setShowDraftBanner(false);
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setShowDraftBanner(false);
  };

  if (!isOpen) return null;

  const sortedP = [...prosecutorsList].sort(
    (a, b) => (a.activeCases || 0) - (b.activeCases || 0),
  );
  const isAssignableProsecutor = (prosecutor) =>
    prosecutor.status !== "RETIRED" &&
    !prosecutor.dept?.includes("사무국") &&
    prosecutor.roleLevel !== "CHIEF_ADMINISTRATOR";
  const set = (k, v) => setFormData((p) => ({ ...p, [k]: v }));
  const isPreBookingInvestigation = formData.bookingStatus === "입건 전 조사";
  const handleBookingStatusChange = (bookingStatus) => {
    setFormData((previous) => ({
      ...previous,
      bookingStatus,
      hyeongjeNo:
        bookingStatus === "입건 전 조사"
          ? generateInvestigationNumber()
          : (previous.hyeongjeNo || "").startsWith(`${currentYear}내사`)
            ? generateCaseNumber()
            : previous.hyeongjeNo,
    }));
  };

  const updateChargeRow = (id, field, value) => {
    setChargeRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
    );
  };

  const addChargeRow = () => {
    setChargeRows((prev) => [
      ...prev,
      { id: Date.now(), name: "", type: "예비적" },
    ]);
  };

  const removeChargeRow = (id) => {
    if (chargeRows.length <= 1) return;
    setChargeRows((prev) => prev.filter((row) => row.id !== id));
  };

  // Suspect Array Actions
  const handleAddSuspect = () => {
    setSuspectsList((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: "",
        uuid: "",
        role: prev.length === 0 ? "주범" : "공범",
        bookingStatus: "입건:불구속",
      },
    ]);
  };

  const handleRemoveSuspect = (id) => {
    if (suspectsList.length <= 1) {
      alert("최소 1명의 피의자가 필요합니다.");
      return;
    }
    setSuspectsList((prev) => prev.filter((s) => s.id !== id));
  };

  const handleUpdateSuspect = (id, field, value) => {
    setSuspectsList((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
    );
  };

  const handleEvidenceFiles = (e) => {
    const files = Array.from(e.target.files || []);
    const oversized = files.find((file) => file.size > 2 * 1024 * 1024);
    if (oversized) {
      alert("첨부 파일은 파일당 2MB 이하만 등록할 수 있습니다.");
      e.target.value = "";
      return;
    }
    Promise.all(
      files.map(
        (file) =>
          new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () =>
              resolve({
                title: file.name,
                url: reader.result,
                type: file.type.startsWith("image/") ? "IMAGE" : "DOCUMENT",
                record: "",
              });
            reader.onerror = reject;
            reader.readAsDataURL(file);
          }),
      ),
    )
      .then((attachments) => setEvidenceAttachments(attachments))
      .catch(() => alert("첨부 파일을 읽지 못했습니다."));
  };

  const handleLookupMojangForSuspect = async (suspectId, name) => {
    if (!name || !name.trim()) {
      setMojangStatusMsg({
        type: "error",
        text: "먼저 피의자 닉네임을 입력해주세요.",
      });
      return;
    }
    setMojangLoadingMap((prev) => ({ ...prev, [suspectId]: true }));
    setMojangStatusMsg({
      type: "info",
      text: `'${name}' 마인크래프트 계정 Mojang DB 조회 중...`,
    });

    const res = await fetchMojangUuid(name);
    setMojangLoadingMap((prev) => ({ ...prev, [suspectId]: false }));

    if (res.success) {
      handleUpdateSuspect(suspectId, "uuid", res.uuid);
      setMojangStatusMsg({
        type: "success",
        text: `✅ Mojang DB 연결 성공: ${res.name} (UUID: ${res.uuid})`,
      });
    } else {
      setMojangStatusMsg({
        type: "error",
        text: res.message || "Mojang API 조회 실패",
      });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validCharges = chargeRows.filter((row) => row.name.trim());
    if (validCharges.length === 0) {
      alert("죄명을 한 개 이상 입력해주세요.");
      return;
    }
    const formattedChargeName = validCharges
      .map((row) => `${row.type}: ${row.name.trim()}`)
      .join(" / ");
    const validSuspects = suspectsList.filter((s) => s.name.trim() !== "");
    if (validSuspects.length === 0) {
      alert("최소 1명 이상의 피의자 닉네임을 입력해주세요.");
      return;
    }

    const primarySuspect = validSuspects[0];
    const displaySuspectName =
      validSuspects.length > 1
        ? `${primarySuspect.name} 외 ${validSuspects.length - 1}명`
        : primarySuspect.name;

    // 자동배정 제외 대상(isAutoAssignExcluded) 및 휴직자(ON_LEAVE) 제외 후 사건 수 최저 검사 선정
    const validAssignees = sortedP
      .filter((p) => isAssignableProsecutor(p))
      .filter((p) => p.status !== "ON_LEAVE" && !p.isAutoAssignExcluded)
      .sort((a, b) => (a.activeCases || 0) - (b.activeCases || 0));

    let assignedProsecutor = null;
    if (formData.prosecutorId === "AUTO_ASSIGN") {
      assignedProsecutor = validAssignees[0];
    } else {
      assignedProsecutor = sortedP.find(
        (p) => p.id === formData.prosecutorId && isAssignableProsecutor(p),
      );
    }

    onSubmitIntake({
      id: Date.now(),
      ...formData,
      chargeName: formattedChargeName,
      prosecutorId: assignedProsecutor?.id || "",
      prosecutorName: assignedProsecutor?.name || "",
      prosecutorDiscordId: assignedProsecutor?.discordId || "",
      sujeNo: isPreBookingInvestigation ? "내사" : formData.hyeongjeNo,
      hyeongjeNo: "-", // 기소 결정 시 형제번호 부여
      suspectName: displaySuspectName,
      suspectUuid: primarySuspect.uuid || "",
      suspects: validSuspects,
      evidenceAttachments,
      privateViewerIds,
      latestHyeongjeNo: "-",
      bookingDate: new Date().toISOString().split("T")[0],
      disposition: "수사중",
      reAppeal: "-",
      court1No: "-",
      court1Result: "-",
      court1Doc: "-",
      court1Appealed: "-",
      court1Appellant: "-",
      court2No: "-",
      court2Dismissed: "-",
      court2Result: "-",
      court2Doc: "-",
      court3Appealed: "-",
      court3Appellant: "-",
      court3No: "-",
      court3Remanded: "-",
      court3Result: "-",
      court3Doc: "-",
      notes:
        validSuspects.length > 1
          ? `공동피의자 사건 (총 ${validSuspects.length}명: ${validSuspects.map((s) => `${s.name}[${s.role}]`).join(", ")})`
          : "신규 접수 및 담당검사 배당 완료",
    });
    clearDraft();
    onClose();
  };

  const Label = ({ children }) => (
    <label
      style={{
        display: "block",
        fontSize: "0.78rem",
        fontWeight: 700,
        color: "var(--text-muted)",
        marginBottom: 6,
      }}
    >
      {children}
    </label>
  );

  return (
    <div className="modal-overlay">
      <div
        className="modal-content"
        style={{ maxWidth: 720, maxHeight: "90vh", overflowY: "auto" }}
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
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                background: "rgba(245,158,11,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Scale size={20} color="var(--primary-amber)" />
            </div>
            <div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: "1rem",
                  color: "var(--text-main)",
                }}
              >
                신규 사건 접수 & 다수 피의자 배당
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                공동피의자 / 공범 다수 사건 등록 포털
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
              fontSize: "1.2rem",
            }}
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          {/* 임시저장 복원 배너 */}
          {showDraftBanner && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                borderRadius: 8,
                background: "rgba(245,158,11,0.1)",
                border: "1px solid rgba(245,158,11,0.35)",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", color: "var(--primary-amber)", fontWeight: 700 }}>
                <Save size={14} />
                이전에 작성 중이던 내용이 있습니다. 이어서 작성하시겠습니까?
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={handleRestoreDraft}
                  className="btn btn-gold"
                  style={{ padding: "4px 12px", fontSize: "0.75rem" }}
                >
                  불러오기
                </button>
                <button
                  type="button"
                  onClick={handleDiscardDraft}
                  className="btn btn-secondary"
                  style={{ padding: "4px 12px", fontSize: "0.75rem" }}
                >
                  무시
                </button>
              </div>
            </div>
          )}
          {/* Case Numbers */}
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <Label>사건번호 (검찰사무규칙 제16조 기본: 수제, 자동계산)</Label>
            <input
              className="input-field"
              style={{
                fontFamily: "monospace",
                color: "var(--primary-amber)",
                fontWeight: 700,
              }}
              value={isPreBookingInvestigation ? "내사" : formData.hyeongjeNo}
              disabled={isPreBookingInvestigation}
              onChange={(e) => set("hyeongjeNo", e.target.value)}
            />
          </div>

          {/* Multiple Suspects Section */}
          <div
            style={{
              background: "var(--bg-elevated)",
              borderRadius: 10,
              padding: 16,
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
              <div
                style={{
                  fontWeight: 800,
                  fontSize: "0.88rem",
                  color: "var(--primary-amber)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Users size={16} /> 피의자 목록 (공동피의자/공범 등록)
                <span
                  className="badge badge-gold"
                  style={{ fontSize: "0.68rem" }}
                >
                  {suspectsList.length}명
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddSuspect}
                className="btn btn-gold"
                style={{ padding: "4px 10px", fontSize: "0.75rem" }}
              >
                <Plus size={13} /> + 피의자/공범 추가
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {suspectsList.map((s, idx) => (
                <div
                  key={s.id}
                  style={{
                    padding: 12,
                    borderRadius: 8,
                    background: "var(--bg-card)",
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
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        color: "var(--text-muted)",
                      }}
                    >
                      피의자 #{idx + 1} ({s.role || "주범"})
                    </span>
                    {suspectsList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSuspect(s.id)}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#f87171",
                          cursor: "pointer",
                        }}
                        title="삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.2fr 1fr 1fr 1fr",
                      gap: 8,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.7rem",
                            color: "var(--text-muted)",
                            fontWeight: 700,
                          }}
                        >
                          닉네임 *
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleLookupMojangForSuspect(s.id, s.name)
                          }
                          disabled={mojangLoadingMap[s.id]}
                          className="btn btn-outline"
                          style={{
                            padding: "1px 6px",
                            fontSize: "0.65rem",
                            color: "var(--primary-amber)",
                            border: "1px solid rgba(245,158,11,0.3)",
                          }}
                        >
                          {mojangLoadingMap[s.id] ? (
                            <RefreshCw size={9} className="animate-spin" />
                          ) : (
                            <Search size={9} />
                          )}
                          Mojang UUID
                        </button>
                      </div>
                      <input
                        className="input-field"
                        required
                        placeholder="피의자 닉네임"
                        value={s.name}
                        onChange={(e) =>
                          handleUpdateSuspect(s.id, "name", e.target.value)
                        }
                      />
                    </div>

                    <div>
                      <span
                        style={{
                          display: "block",
                          fontSize: "0.7rem",
                          color: "var(--text-muted)",
                          fontWeight: 700,
                          marginBottom: 4,
                        }}
                      >
                        UUID
                      </span>
                      <input
                        className="input-field"
                        style={{ fontFamily: "monospace", fontSize: "0.72rem" }}
                        placeholder="모장 UUID"
                        value={s.uuid}
                        onChange={(e) =>
                          handleUpdateSuspect(s.id, "uuid", e.target.value)
                        }
                      />
                    </div>

                    <div>
                      <span
                        style={{
                          display: "block",
                          fontSize: "0.7rem",
                          color: "var(--text-muted)",
                          fontWeight: 700,
                          marginBottom: 4,
                        }}
                      >
                        공범 구분
                      </span>
                      <select
                        className="select-field"
                        value={s.role}
                        onChange={(e) =>
                          handleUpdateSuspect(s.id, "role", e.target.value)
                        }
                      >
                        <option value="주범">주범</option>
                        <option value="공범">공범</option>
                        <option value="교사범">교사범</option>
                        <option value="방조범">방조범</option>
                        <option value="피의자">피의자</option>
                      </select>
                    </div>

                    <div>
                      <span
                        style={{
                          display: "block",
                          fontSize: "0.7rem",
                          color: "var(--text-muted)",
                          fontWeight: 700,
                          marginBottom: 4,
                        }}
                      >
                        입건 상태
                      </span>
                      <select
                        className="select-field"
                        value={s.bookingStatus}
                        onChange={(e) =>
                          handleUpdateSuspect(
                            s.id,
                            "bookingStatus",
                            e.target.value,
                          )
                        }
                      >
                        <option value="입건:불구속">입건:불구속</option>
                        <option value="입건:구속">입건:구속</option>
                        <option value="체포영장 발부">체포영장 발부</option>
                        <option value="지명수배">지명수배</option>
                        <option value="내사종결">내사종결</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {mojangStatusMsg && (
              <div
                style={{
                  marginTop: 10,
                  fontSize: "0.75rem",
                  padding: "6px 12px",
                  borderRadius: 6,
                  background:
                    mojangStatusMsg.type === "success"
                      ? "rgba(52,211,153,0.1)"
                      : mojangStatusMsg.type === "info"
                        ? "rgba(59,130,246,0.1)"
                        : "rgba(239,68,68,0.1)",
                  color:
                    mojangStatusMsg.type === "success"
                      ? "#34d399"
                      : mojangStatusMsg.type === "info"
                        ? "#60a5fa"
                        : "#f87171",
                  border: `1px solid ${mojangStatusMsg.type === "success" ? "#34d39940" : mojangStatusMsg.type === "info" ? "#60a5fa40" : "#f8717140"}`,
                }}
              >
                {mojangStatusMsg.text}
              </div>
            )}
          </div>

          {/* Incident Date & Booking Date */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <Label>
                📅 사건 발생일시 (범죄행위 종료일 - 공소시효 기산일) *
              </Label>
              <input
                type="date"
                className="input-field"
                value={formData.incidentDate}
                onChange={(e) => set("incidentDate", e.target.value)}
                required
              />
            </div>
            <div>
              <Label>📋 사건 접수일시 *</Label>
              <input
                type="date"
                className="input-field"
                value={formData.bookingDate}
                onChange={(e) => set("bookingDate", e.target.value)}
                required
              />
            </div>
          </div>

          {/* Charge + Prosecutor */}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}
          >
            <div>
              <Label>적용 죄명</Label>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {chargeRows.map((row, index) => (
                  <div
                    key={row.id}
                    style={{ display: "flex", gap: 6, alignItems: "center" }}
                  >
                    <div
                      style={{ display: "flex", gap: 3, flexShrink: 0 }}
                      role="group"
                      aria-label={`${index + 1}번째 죄명 구분`}
                    >
                      {["주위적", "예비적"].map((type) => (
                        <button
                          key={type}
                          type="button"
                          onClick={() => updateChargeRow(row.id, "type", type)}
                          className="btn"
                          style={{
                            minHeight: 38,
                            padding: "5px 7px",
                            fontSize: "0.7rem",
                            background:
                              row.type === type
                                ? type === "주위적"
                                  ? "var(--primary-amber)"
                                  : "#60a5fa"
                                : "var(--bg-elevated)",
                            color:
                              row.type === type ? "#000" : "var(--text-muted)",
                            border:
                              row.type === type
                                ? "1px solid transparent"
                                : "1px solid var(--border-subtle)",
                          }}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                    <ChargeSearchInput
                      value={row.name}
                      onChange={(v) => updateChargeRow(row.id, "name", v)}
                      chargesData={chargesData}
                      placeholder="죄명 직접 입력 또는 검색"
                    />
                    {chargeRows.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeChargeRow(row.id)}
                        className="btn btn-outline"
                        style={{ padding: "8px 9px", color: "#f87171" }}
                        aria-label="죄명 삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addChargeRow}
                  className="btn btn-outline"
                  style={{
                    alignSelf: "flex-start",
                    padding: "6px 10px",
                    fontSize: "0.75rem",
                    color: "var(--primary-amber)",
                  }}
                >
                  <Plus size={14} /> 죄명 추가
                </button>
              </div>
            </div>
            <div>
              <Label>담당 검사 배당</Label>
              <select
                className="select-field"
                value={formData.prosecutorId}
                onChange={(e) => set("prosecutorId", e.target.value)}
              >
                <option value="AUTO_ASSIGN">
                  🎲 검사 자동 배정 (사건 보유 최저 검사 우선)
                </option>
                {sortedP.filter(isAssignableProsecutor).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.position || p.title} / {p.dept})
                    {p.isAutoAssignExcluded ? " [🚫 자동배정 제외]" : ""}
                    {p.status === "ON_LEAVE" ? " [🟡 휴직중]" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label>사건 상태</Label>
            <select
              className="select-field"
              value={formData.bookingStatus}
              onChange={(e) => handleBookingStatusChange(e.target.value)}
            >
              <option value="입건:불구속">입건:불구속</option>
              <option value="입건:구속">입건:구속</option>
              <option value="입건 전 조사">입건 전 조사</option>
            </select>
          </div>

          <div>
            <Label>사건 공개 범위</Label>
            <select
              className="select-field"
              value={formData.visibility}
              onChange={(e) => set("visibility", e.target.value)}
            >
              <option value="PUBLIC">공개 사건</option>
              <option value="PRIVATE">
                비공개 사건 (담당자·생성자·검찰총장만 열람)
              </option>
            </select>
          </div>

          {formData.visibility === "PRIVATE" && (
            <div>
              <Label>비공개 공개대상 (검찰총장은 자동 공개)</Label>
              <select
                className="select-field"
                multiple
                value={privateViewerIds}
                onChange={(e) =>
                  setPrivateViewerIds(
                    Array.from(
                      e.target.selectedOptions,
                      (option) => option.value,
                    ),
                  )
                }
                style={{ minHeight: 100 }}
              >
                {sortedP.filter(isAssignableProsecutor).map((prosecutor) => (
                  <option key={prosecutor.id} value={prosecutor.id}>
                    {prosecutor.name} ({prosecutor.position || prosecutor.title}
                    )
                  </option>
                ))}
              </select>
              <div
                style={{
                  marginTop: 4,
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                }}
              >
                Ctrl 또는 Shift를 사용해 여러 명을 선택할 수 있습니다.
                담당검사와 사건 생성자는 자동으로 열람합니다.
              </div>
            </div>
          )}

          {/* Intake Basis Link */}
          <div>
            <Label>접수근거 (네이버 카페 게시글)</Label>
            <input
              className="input-field"
              value={formData.bookingBasis}
              onChange={(e) => set("bookingBasis", e.target.value)}
            />
          </div>

          <div>
            <Label>증거자료 첨부 (파일당 최대 2MB)</Label>
            <input
              className="input-field"
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.doc,.docx,.xls,.xlsx"
              onChange={handleEvidenceFiles}
            />
            {evidenceAttachments.length > 0 && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: "0.72rem",
                  color: "var(--text-muted)",
                }}
              >
                {evidenceAttachments.map((file) => file.title).join(", ")}
              </div>
            )}
          </div>

          {/* Submit buttons */}
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
              onClick={onClose}
              className="btn btn-secondary"
              style={{ padding: "10px 20px" }}
            >
              취소
            </button>
            <button
              type="submit"
              className="btn btn-gold"
              style={{ padding: "10px 24px", fontWeight: 800 }}
            >
              <CheckCircle2 size={16} /> 사건 접수 및 자동 배당 완료
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
