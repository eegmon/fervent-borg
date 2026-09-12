import React, { useState, useEffect } from "react";
import { Award } from "lucide-react";
import { ROLE_LABELS } from "../../data/prosecutionData";
import {
  fetchOfficeDocuments,
  createOfficeDocumentApi,
  updateOfficeDocumentApi,
} from "../../services/api";

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

/**
 * [검찰사무국 전용] 직무대리명령 공식 발령 및 관리 패널
 */
export default function ActingOrderPanel({
  prosecutorsList: rawList = [],
  onUpdateProsecutorStatus,
  addLog,
}) {
  const prosecutorsList = rawList.filter((p) => !p.isSuperAdmin);
  const today = new Date().toISOString().slice(0, 10);
  const [orders, setOrders] = useState([]);
  useEffect(() => {
    fetchOfficeDocuments("order").then((data) => {
      if (Array.isArray(data)) setOrders(data);
    });
  }, []);

  // 공석 모드: 원 결재권자 계정이 없을 때 직위명을 직접 입력
  const [vacantMode, setVacantMode] = useState(false);

  const [form, setForm] = useState({
    originalUserId: prosecutorsList[0]?.id || "",
    originalVacantTitle: "", // 공석 모드 전용 — 피대리 직위 직접 입력
    vacantRoleLevel: "SENIOR_PROSECUTOR", // 공석 모드 전용 — 부여할 권한 등급
    actingUserId: prosecutorsList[1]?.id || "",
    actingTitle: "부장검사 직무대리",
    orderNo: `검찰사무국 직무대리명령 제2026-00${orders.length + 1}호`,
    reason: "검찰 사무대리 규정 제7조 직무대리 지시",
    actingStart: today,
    actingEnd: "2026-12-31",
  });

  const handleIssueOrder = async (e) => {
    e.preventDefault();
    const act = prosecutorsList.find((p) => p.id === form.actingUserId);
    if (!act) return;

    let origLabel, origId;
    if (vacantMode) {
      if (!form.originalVacantTitle.trim()) {
        alert("피대리 직위명을 입력해 주세요.");
        return;
      }
      origLabel = `${form.originalVacantTitle.trim()} (공석)`;
      origId = "";
    } else {
      const orig = prosecutorsList.find((p) => p.id === form.originalUserId);
      if (!orig) return;
      origLabel = `${orig.name} (${orig.position || orig.title})`;
      origId = orig.id;
    }

    const newOrder = {
      id: `ACT-${Date.now()}`,
      orderNo:
        form.orderNo || `검찰사무국 직무대리명령 제2026-${orders.length + 1}호`,
      originalUser: origLabel,
      originalUserId: origId,
      actingUser: `${act.name} (${act.position || act.title})`,
      actingUserId: act.id,
      actingTitle: form.actingTitle,
      reason: form.reason,
      actingStart: form.actingStart,
      actingEnd: form.actingEnd,
      period: `${form.actingStart} ~ ${form.actingEnd}`,
      status: "발령중",
      date: today,
    };

    const saved = await createOfficeDocumentApi("order", newOrder);
    if (!saved?.success) {
      alert(saved?.message || "직무대리명령 저장에 실패했습니다.");
      return;
    }
    setOrders((prev) => [saved.document || newOrder, ...prev]);

    if (onUpdateProsecutorStatus && origId) {
      onUpdateProsecutorStatus(origId, {
        status: "DELEGATED",
        delegateTo: `${act.name} (${form.actingTitle})`,
        delegateReason: `[직무대리명령] ${form.reason}`,
        actingUserId: act.id,
      });
    }

    const origRoleLevel = vacantMode
      ? form.vacantRoleLevel || ""
      : prosecutorsList.find((p) => p.id === form.originalUserId)?.roleLevel ||
        "";
    if (onUpdateProsecutorStatus) {
      onUpdateProsecutorStatus(act.id, {
        delegateTo: origLabel,
        delegateReason: `[직무대리명령 수임] ${form.orderNo}`,
        actingTitle: form.actingTitle,
        actingStart: form.actingStart,
        actingEnd: form.actingEnd,
        ...(origRoleLevel ? { dualRoleLevel: origRoleLevel } : {}),
      });
    }

    addLog?.(
      "직무대리명령 공식 발령",
      `${form.orderNo}: '${act.name}' 검사를 '${origLabel}' 직무대리로 발령`,
    );
    alert(
      `[검찰사무국 관인 날인] ${form.orderNo} 직무대리명령이 성공적으로 발령되었습니다.`,
    );
  };

  const handleRevokeOrder = async (orderId, origUserId, actingUserId) => {
    if (!window.confirm("해당 직무대리명령을 해제하시겠습니까?")) return;
    const saved = await updateOfficeDocumentApi(orderId, {
      status: "해제완료",
    });
    if (!saved?.success) {
      alert(saved?.message || "직무대리명령 저장에 실패했습니다.");
      return;
    }
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? saved.document : o)),
    );
    if (onUpdateProsecutorStatus && origUserId) {
      onUpdateProsecutorStatus(origUserId, {
        status: "ACTIVE",
        delegateTo: "",
        delegateReason: "",
      });
    }
    if (onUpdateProsecutorStatus && actingUserId) {
      onUpdateProsecutorStatus(actingUserId, {
        actingTitle: "",
        dualRoleLevel: "",
        actingStart: "",
        actingEnd: "",
        delegateTo: "",
        delegateReason: "",
      });
    }
    addLog?.("직무대리명령 해제", `명령 번호 ${orderId} 직무대리 해제 처리`);
    alert("[직권 해제] 직무대리명령이 해제되었습니다.");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        className="glass-panel gold-border"
        style={{ padding: "14px 20px", background: "rgba(245,158,11,0.06)" }}
      >
        <div
          style={{
            fontWeight: 800,
            fontSize: "0.95rem",
            color: "var(--primary-amber)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <Award size={18} /> 검찰 직무대리명령 공식 발령 대장 (검찰청법 제32조)
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          결재권자의 부재·휴직·출장 시 직무대리자를 공식 지정하여 결재권과 승인
          권한을 위임 발령합니다.
        </div>
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16 }}
      >
        <div
          className="glass-panel"
          style={{
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: "0.9rem",
              color: "var(--text-main)",
            }}
          >
            🏛️ 직무대리명령 신규 발령
          </div>

          <form
            onSubmit={handleIssueOrder}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <div>
              <Label>명령서 번호 *</Label>
              <input
                className="input-field"
                value={form.orderNo}
                onChange={(e) => setForm({ ...form, orderNo: e.target.value })}
                required
              />
            </div>

            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 6,
                }}
              >
                <Label>원 결재권자 (피대리인) *</Label>
                <button
                  type="button"
                  onClick={() => {
                    setVacantMode((v) => !v);
                    setForm((f) => ({
                      ...f,
                      originalVacantTitle: "",
                      vacantRoleLevel: "SENIOR_PROSECUTOR",
                    }));
                  }}
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 700,
                    padding: "2px 9px",
                    borderRadius: 6,
                    cursor: "pointer",
                    border: vacantMode
                      ? "1px solid rgba(245,158,11,0.6)"
                      : "1px solid var(--border-subtle)",
                    background: vacantMode
                      ? "rgba(245,158,11,0.12)"
                      : "var(--bg-elevated)",
                    color: vacantMode
                      ? "var(--primary-amber)"
                      : "var(--text-muted)",
                    transition: "all 0.15s",
                  }}
                >
                  {vacantMode ? "🔓 공석 입력 중" : "🏚️ 공석 (계정 없음)"}
                </button>
              </div>
              {vacantMode ? (
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  <input
                    className="input-field"
                    placeholder="예: 검찰사무국장 / 부장검사 (공석)"
                    value={form.originalVacantTitle}
                    onChange={(e) =>
                      setForm({ ...form, originalVacantTitle: e.target.value })
                    }
                    required
                    autoFocus
                  />
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--text-muted)",
                      paddingLeft: 2,
                    }}
                  >
                    계정 없는 공석 직위명을 직접 입력합니다. 발령 대장에{" "}
                    <em>(공석)</em>으로 표시됩니다.
                  </div>
                  <div style={{ marginTop: 2 }}>
                    <Label>공석 직위 권한 등급 *</Label>
                    <select
                      className="select-field"
                      value={form.vacantRoleLevel}
                      onChange={(e) =>
                        setForm({ ...form, vacantRoleLevel: e.target.value })
                      }
                      required
                    >
                      {Object.entries(ROLE_LABELS)
                        .filter(([key]) => key !== "SUPER_ADMIN")
                        .map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                    </select>
                    <div
                      style={{
                        fontSize: "0.7rem",
                        color: "var(--text-muted)",
                        paddingLeft: 2,
                        marginTop: 3,
                      }}
                    >
                      직무대리자에게 부여할 권한 등급입니다. 피대리 직위의 실제
                      권한과 일치해야 합니다.
                    </div>
                  </div>
                </div>
              ) : (
                <select
                  className="select-field"
                  value={form.originalUserId}
                  onChange={(e) =>
                    setForm({ ...form, originalUserId: e.target.value })
                  }
                >
                  {prosecutorsList
                    .filter((p) => p.status !== "RETIRED")
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.position || p.title} / {p.dept})
                      </option>
                    ))}
                </select>
              )}
            </div>

            <div>
              <Label>직무대리자 (대리 수행 검사) *</Label>
              <select
                className="select-field"
                value={form.actingUserId}
                onChange={(e) =>
                  setForm({ ...form, actingUserId: e.target.value })
                }
              >
                {prosecutorsList
                  .filter((p) => p.status !== "RETIRED")
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.position || p.title} / {p.dept})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <Label>부여할 직무대리 직위 명칭 *</Label>
              <input
                className="input-field"
                placeholder="예: 부장검사 직무대리 / 지검장 직무대리"
                value={form.actingTitle}
                onChange={(e) =>
                  setForm({ ...form, actingTitle: e.target.value })
                }
                required
              />
            </div>

            <div>
              <Label>발령 기간 *</Label>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="date"
                  className="input-field"
                  value={form.actingStart}
                  onChange={(e) =>
                    setForm({ ...form, actingStart: e.target.value })
                  }
                  required
                  style={{ flex: 1 }}
                />
                <span
                  style={{
                    color: "var(--text-muted)",
                    fontSize: "0.82rem",
                    flexShrink: 0,
                  }}
                >
                  ~
                </span>
                <input
                  type="date"
                  className="input-field"
                  value={form.actingEnd}
                  onChange={(e) =>
                    setForm({ ...form, actingEnd: e.target.value })
                  }
                  required
                  style={{ flex: 1 }}
                  min={form.actingStart}
                />
              </div>
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  marginTop: 3,
                  paddingLeft: 2,
                }}
              >
                종료일이 지나면 직무대리 권한이 자동으로 회수됩니다.
              </div>
            </div>

            <div>
              <Label>발령 근거 및 사유</Label>
              <textarea
                className="textarea-field"
                rows={2}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>

            <button
              type="submit"
              className="btn btn-gold"
              style={{ padding: 10, fontWeight: 800, justifyContent: "center" }}
            >
              <Award size={15} /> 직무대리명령 발령 & 관인 날인
            </button>
          </form>
        </div>

        <div
          className="glass-panel"
          style={{
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              fontWeight: 800,
              fontSize: "0.9rem",
              color: "var(--text-main)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span>📋 발령된 직무대리명령 대장</span>
            <span className="badge badge-gold" style={{ fontSize: "0.72rem" }}>
              총 {orders.length}건
            </span>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "0.78rem",
              }}
            >
              <thead>
                <tr
                  style={{
                    background: "var(--bg-elevated)",
                    borderBottom: "1px solid var(--border-subtle)",
                    color: "var(--text-muted)",
                  }}
                >
                  <th style={{ padding: 8, textAlign: "left" }}>명령서 번호</th>
                  <th style={{ padding: 8, textAlign: "left" }}>원 결재자</th>
                  <th style={{ padding: 8, textAlign: "left" }}>직무대리자</th>
                  <th style={{ padding: 8, textAlign: "left" }}>
                    직무대리 직위
                  </th>
                  <th style={{ padding: 8, textAlign: "left" }}>발령 기간</th>
                  <th style={{ padding: 8, textAlign: "center" }}>상태</th>
                  <th style={{ padding: 8, textAlign: "center" }}>관리</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr
                    key={o.id}
                    style={{ borderBottom: "1px solid var(--border-subtle)" }}
                  >
                    <td
                      style={{
                        fontFamily: "monospace",
                        color: "var(--primary-amber)",
                        fontWeight: 700,
                      }}
                    >
                      {o.orderNo}
                    </td>
                    <td style={{ fontWeight: 700 }}>{o.originalUser}</td>
                    <td style={{ color: "#38bdf8", fontWeight: 700 }}>
                      {o.actingUser}
                    </td>
                    <td style={{ color: "var(--text-main)" }}>
                      {o.actingTitle}
                    </td>
                    <td style={{ color: "var(--text-muted)" }}>{o.period}</td>
                    <td style={{ textAlign: "center" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 10,
                          fontSize: "0.7rem",
                          fontWeight: 800,
                          background:
                            o.status === "발령중"
                              ? "rgba(52,211,153,0.15)"
                              : "var(--bg-elevated)",
                          color:
                            o.status === "발령중"
                              ? "#34d399"
                              : "var(--text-muted)",
                        }}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {o.status === "발령중" && (
                        <button
                          onClick={() =>
                            handleRevokeOrder(
                              o.id,
                              o.originalUserId,
                              o.actingUserId,
                            )
                          }
                          className="btn btn-secondary"
                          style={{
                            padding: "3px 8px",
                            fontSize: "0.7rem",
                            color: "#f87171",
                          }}
                        >
                          명령 해제
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
