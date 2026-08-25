import React, { useEffect, useState } from "react";
import {
  ShieldAlert,
  Search,
  Plus,
  Filter,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Scale,
  Home,
  Database,
  UserCheck,
} from "lucide-react";
import { createWarrantApi, fetchWarrants, updateWarrantApi } from "../services/api";
export const INITIAL_WARRANTS = [];

const WARRANT_TYPES = [
  {
    id: "ARREST",
    label: "구속영장 (제12조)",
    icon: ShieldAlert,
    color: "#f87171",
  },
  {
    id: "SEARCH",
    label: "압수·수색·검증영장 (제13조)",
    icon: Search,
    color: "#fb923c",
  },
  { id: "LOG", label: "로그영장 (제26조)", icon: Database, color: "#60a5fa" },
  {
    id: "DEMOLITION",
    label: "건축물철거영장 (제23조)",
    icon: Home,
    color: "#f59e0b",
  },
  {
    id: "APPREHENSION",
    label: "체포영장 (제9조)",
    icon: Scale,
    color: "#e879f9",
  },
];

const STATUS_OPTIONS = [
  "청구중",
  "발부 (집행대기)",
  "집행완료",
  "기각",
  "영장반환 (집행불가)",
];

export default function WarrantLedger({
  currentUser,
  prosecutorsList = [],
  onSelectEvidence,
  onSelectSuspect,
}) {
  const [warrantsList, setWarrantsList] = useState(INITIAL_WARRANTS);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Modal State
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [editingWarrantStatus, setEditingWarrantStatus] = useState(null);
  const [newWarrantStatus, setNewWarrantStatus] = useState("");

  // New Warrant Form State
  const todayStr = new Date().toISOString().split("T")[0];
  const nextWeekStr = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];
  const [newForm, setNewForm] = useState({
    warrantType: "SEARCH",
    caseNo: "",
    suspectName: "",
    suspectUuid: "",
    chargeName: "",
    prosecutorName: currentUser?.name || "",
    targetPlace: "",
    validUntil: nextWeekStr,
    notes: "",
  });

  useEffect(() => {
    let cancelled = false;
    fetchWarrants().then(data => {
      if (cancelled) return;
      if (Array.isArray(data)) setWarrantsList(data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const handleCreateWarrant = async (e) => {
    e.preventDefault();
    if (!newForm.suspectName || !newForm.targetPlace) {
      alert("피의자 닉네임과 영장 집행 장소/인벤토리를 입력해주세요.");
      return;
    }

    const typeObj = WARRANT_TYPES.find((t) => t.id === newForm.warrantType);
    const prefix =
      newForm.warrantType === "ARREST"
        ? "구제"
        : newForm.warrantType === "SEARCH"
          ? "압제"
          : newForm.warrantType === "LOG"
            ? "로그"
            : "철제";
    const seq = String(warrantsList.length + 1).padStart(3, "0");

    const created = {
      id: `WAR-${Date.now()}`,
      warrantNo: `2026${prefix}${seq}`,
      warrantType: newForm.warrantType,
      warrantTypeName: `${typeObj?.label || "영장"} (청구서)`,
      caseNo: newForm.caseNo,
      suspectName: newForm.suspectName,
      suspectUuid: newForm.suspectUuid,
      chargeName: newForm.chargeName,
      prosecutorName: newForm.prosecutorName,
      targetPlace: newForm.targetPlace,
      status: "청구중",
      requestedAt: todayStr,
      validUntil: newForm.validUntil,
      judgeName: "법관 심리중",
      notes: newForm.notes,
    };

    const saved = await createWarrantApi(created);
    if (!saved?.success) {
      alert(saved?.message || "영장 저장에 실패했습니다.");
      return;
    }
    setWarrantsList((prev) => [saved.warrant || created, ...prev]);
    setIsRequestModalOpen(false);
    alert(
      `✅ [${created.warrantNo}] ${typeObj?.label} 청구가 법원에 상신되었습니다.`,
    );
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!editingWarrantStatus) return;
    const saved = await updateWarrantApi(editingWarrantStatus.id, { status: newWarrantStatus });
    if (!saved?.success) {
      alert(saved?.message || "영장 상태 저장에 실패했습니다.");
      return;
    }
    setWarrantsList((prev) =>
      prev.map((w) =>
        w.id === editingWarrantStatus.id
          ? { ...w, status: newWarrantStatus }
          : w,
      ),
    );
    setEditingWarrantStatus(null);
  };

  const filtered = warrantsList.filter((w) => {
    const q = searchTerm.toLowerCase().trim();
    const matchQ =
      !q ||
      (w.warrantNo || "").toLowerCase().includes(q) ||
      (w.caseNo || "").toLowerCase().includes(q) ||
      (w.suspectName || "").toLowerCase().includes(q) ||
      (w.chargeName || "").toLowerCase().includes(q) ||
      (w.targetPlace || "").toLowerCase().includes(q);
    const matchType = typeFilter === "ALL" || w.warrantType === typeFilter;
    const matchStatus =
      statusFilter === "ALL" || w.status.includes(statusFilter);
    return matchQ && matchType && matchStatus;
  });

  const requestedCount = warrantsList.filter((w) =>
    w.status.includes("청구"),
  ).length;
  const issuedCount = warrantsList.filter((w) =>
    w.status.includes("발부"),
  ).length;
  const executedCount = warrantsList.filter((w) =>
    w.status.includes("집행"),
  ).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Banner */}
      <div className="glass-panel gold-border" style={{ padding: "20px 24px" }}>
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
              <ShieldAlert size={24} color="var(--primary-amber)" />
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
                검찰 영장 관리 대장 (WARRANT MANAGEMENT)
                <span
                  className="badge badge-gold"
                  style={{ fontSize: "0.72rem" }}
                >
                  검찰사무규칙 제9조~제26조
                </span>
              </div>
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "var(--text-muted)",
                  marginTop: 2,
                }}
              >
                구속 · 압수수색 · 건축물철거 · 로그 · 체포 영장 청구 및 집행
                현황 관리
              </div>
            </div>
          </div>

          <button
            onClick={() => setIsRequestModalOpen(true)}
            className="btn btn-gold"
            style={{ padding: "10px 18px", fontWeight: 800, gap: 6 }}
          >
            <Plus size={16} /> 신규 영장 청구 상신
          </button>
        </div>

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
            gap: 10,
            marginTop: 16,
          }}
        >
          {[
            {
              label: "전체 청구 영장",
              value: warrantsList.length,
              color: "var(--primary-amber)",
            },
            {
              label: "법원 심리중 (청구)",
              value: requestedCount,
              color: "#f59e0b",
            },
            {
              label: "영장 발부 (집행대기)",
              value: issuedCount,
              color: "#60a5fa",
            },
            { label: "영장 집행 완료", value: executedCount, color: "#34d399" },
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
        className="glass-panel"
        style={{
          padding: "12px 16px",
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
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
            placeholder="영장번호, 사건번호, 피의자명, 죄명, 장소 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="select-field"
          style={{ width: 180, fontSize: "0.8rem" }}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="ALL">전체 영장 종류</option>
          {WARRANT_TYPES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          className="select-field"
          style={{ width: 160, fontSize: "0.8rem" }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="ALL">전체 진행 상태</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {/* Warrant List Cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.length === 0 ? (
          <div
            className="glass-panel"
            style={{
              padding: 48,
              textAlign: "center",
              color: "var(--text-muted)",
            }}
          >
            <ShieldAlert
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
              등록된 영장이 없습니다.
            </div>
            <div style={{ fontSize: "0.78rem" }}>검색 조건을 변경해보세요.</div>
          </div>
        ) : (
          filtered.map((item) => {
            const typeObj = WARRANT_TYPES.find(
              (t) => t.id === item.warrantType,
            );
            const Icon = typeObj?.icon || ShieldAlert;
            const statusColor = item.status.includes("발부")
              ? "#60a5fa"
              : item.status.includes("집행")
                ? "#34d399"
                : item.status.includes("기각")
                  ? "#ef4444"
                  : "#f59e0b";

            return (
              <div
                key={item.id}
                className="glass-panel"
                style={{
                  padding: "16px 20px",
                  borderRadius: 12,
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                {/* Header Row */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 10 }}
                  >
                    <span
                      className="badge badge-gold"
                      style={{
                        fontFamily: "monospace",
                        fontWeight: 800,
                        fontSize: "0.82rem",
                      }}
                    >
                      {item.warrantNo}
                    </span>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        color: typeObj?.color || "var(--primary-amber)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Icon size={14} /> {item.warrantTypeName}
                    </span>
                    <span
                      className="badge"
                      style={{
                        background: `${statusColor}20`,
                        color: statusColor,
                        fontSize: "0.75rem",
                      }}
                    >
                      {item.status}
                    </span>
                  </div>
                  <div
                    style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                  >
                    청구일: {item.requestedAt} · 유효기간:{" "}
                    <strong style={{ color: "var(--primary-amber)" }}>
                      {item.validUntil}
                    </strong>
                  </div>
                </div>

                {/* Details Grid */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
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
                      사건번호 / 피의자
                    </span>
                    <div
                      style={{
                        fontSize: "0.85rem",
                        fontWeight: 800,
                        color: "var(--text-main)",
                      }}
                    >
                      {item.caseNo} | {item.suspectName}
                    </div>
                    {item.suspectUuid && (
                      <div
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--text-muted)",
                          fontFamily: "monospace",
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
                      적용 죄명 / 주임검사
                    </span>
                    <strong
                      style={{
                        fontSize: "0.85rem",
                        color: "var(--primary-amber)",
                      }}
                    >
                      {item.chargeName}
                    </strong>
                    <div
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      담당: {item.prosecutorName} 검사
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
                      집행 장소 / 인벤토리
                    </span>
                    <div
                      style={{
                        fontSize: "0.78rem",
                        color: "var(--text-main)",
                        fontWeight: 600,
                      }}
                    >
                      {item.targetPlace}
                    </div>
                  </div>
                </div>

                {/* Footer Toolbar */}
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
                    style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}
                  >
                    💡 비고: {item.notes}
                  </div>
                  <button
                    onClick={() => {
                      setEditingWarrantStatus(item);
                      setNewWarrantStatus(item.status);
                    }}
                    className="btn btn-outline"
                    style={{ fontSize: "0.75rem", padding: "4px 10px", gap: 4 }}
                  >
                    <RefreshCw size={13} /> 영장 상태 변경
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── 영장 상태 변경 모달 ── */}
      {editingWarrantStatus && (
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
              maxWidth: 420,
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
              ⚡ 영장 재판/집행 상태 변경
            </div>
            <div
              style={{
                fontSize: "0.75rem",
                color: "var(--primary-amber)",
                fontFamily: "monospace",
                marginBottom: 16,
              }}
            >
              {editingWarrantStatus.warrantNo} (
              {editingWarrantStatus.suspectName})
            </div>
            <form
              onSubmit={handleUpdateStatus}
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
                  변경할 영장 상태 *
                </label>
                <select
                  className="select-field"
                  value={newWarrantStatus}
                  onChange={(e) => setNewWarrantStatus(e.target.value)}
                  required
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button
                  type="button"
                  onClick={() => setEditingWarrantStatus(null)}
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
                  <CheckCircle2 size={15} /> 상태 변경
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 신규 영장 청구 모달 ── */}
      {isRequestModalOpen && (
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
              maxWidth: 580,
              padding: 24,
              borderRadius: 16,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                fontWeight: 800,
                fontSize: "1.05rem",
                color: "var(--text-main)",
                marginBottom: 16,
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <ShieldAlert size={20} color="var(--primary-amber)" />
              신규 법원 영장 청구서 작성 (검찰사무규칙)
            </div>

            <form
              onSubmit={handleCreateWarrant}
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
                  영장 종류 선택 *
                </label>
                <select
                  className="select-field"
                  value={newForm.warrantType}
                  onChange={(e) =>
                    setNewForm({ ...newForm, warrantType: e.target.value })
                  }
                >
                  {WARRANT_TYPES.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
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
                    관련 사건번호 *
                  </label>
                  <input
                    className="input-field"
                    value={newForm.caseNo}
                    onChange={(e) =>
                      setNewForm({ ...newForm, caseNo: e.target.value })
                    }
                    required
                  />
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
                    피의자 닉네임 *
                  </label>
                  <input
                    className="input-field"
                    value={newForm.suspectName}
                    onChange={(e) =>
                      setNewForm({ ...newForm, suspectName: e.target.value })
                    }
                    required
                  />
                </div>
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
                  적용 죄명 *
                </label>
                <input
                  className="input-field"
                  value={newForm.chargeName}
                  onChange={(e) =>
                    setNewForm({ ...newForm, chargeName: e.target.value })
                  }
                  required
                />
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
                  영장 집행 대상 장소 / 인벤토리 / 수색 구역 *
                </label>
                <input
                  className="input-field"
                  placeholder="예: 피의자 개인 상자, 도스시티 불법 건축물 구역..."
                  value={newForm.targetPlace}
                  onChange={(e) =>
                    setNewForm({ ...newForm, targetPlace: e.target.value })
                  }
                  required
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 10,
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
                    주임검사
                  </label>
                  <input
                    className="input-field"
                    value={newForm.prosecutorName}
                    onChange={(e) =>
                      setNewForm({ ...newForm, prosecutorName: e.target.value })
                    }
                  />
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
                    영장 유효기간
                  </label>
                  <input
                    type="date"
                    className="input-field"
                    value={newForm.validUntil}
                    onChange={(e) =>
                      setNewForm({ ...newForm, validUntil: e.target.value })
                    }
                  />
                </div>
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
                  청구 사유 및 소명 내용
                </label>
                <textarea
                  className="textarea-field"
                  rows={3}
                  placeholder="증거인멸 우려, 범죄혐의 소명 내용 작성..."
                  value={newForm.notes}
                  onChange={(e) =>
                    setNewForm({ ...newForm, notes: e.target.value })
                  }
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="btn btn-gold"
                  style={{ flex: 2, justifyContent: "center" }}
                >
                  법원 영장 청구 상신
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
