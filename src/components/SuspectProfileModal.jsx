/**
 * SuspectProfileModal.jsx
 * 피의자 통합 프로필 모달
 *
 * Props:
 *   uuid         string   — 마인크래프트 UUID
 *   onClose      fn
 *   currentUser  object
 */
import React, { useState, useEffect } from "react";
import {
  X,
  User,
  FileText,
  ShieldAlert,
  Gavel,
  BarChart3,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Scale,
} from "lucide-react";
import { fetchSuspectProfile } from "../services/api";
import { getDisplayCaseNumber } from "../services/caseUtils";

const TABS = [
  { key: "cases",    label: "사건 이력",   icon: <Scale size={13} /> },
  { key: "warrants", label: "영장 이력",   icon: <ShieldAlert size={13} /> },
  { key: "appeals",  label: "항고 이력",   icon: <Gavel size={13} /> },
  { key: "stats",    label: "통계",        icon: <BarChart3 size={13} /> },
];

function StatCard({ label, value, color = "var(--primary-amber)" }) {
  return (
    <div
      style={{
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        borderRadius: 10,
        padding: "14px 16px",
        textAlign: "center",
        flex: 1,
        minWidth: 90,
      }}
    >
      <div style={{ fontSize: "1.6rem", fontWeight: 900, color, lineHeight: 1 }}>
        {value ?? 0}
      </div>
      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 4, fontWeight: 700 }}>
        {label}
      </div>
    </div>
  );
}

function DispositionBar({ stats = {} }) {
  const entries = Object.entries(stats).filter(([, v]) => v > 0);
  if (!entries.length) return (
    <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", padding: "16px 0", textAlign: "center" }}>
      처분 데이터 없음
    </div>
  );
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const COLORS = [
    "#f59e0b", "#ef4444", "#3b82f6", "#10b981",
    "#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
  ];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {entries.map(([key, val], i) => (
        <div key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 70, fontSize: "0.72rem", color: "var(--text-muted)", textAlign: "right", flexShrink: 0 }}>
            {key}
          </div>
          <div style={{ flex: 1, background: "var(--bg-elevated)", borderRadius: 4, height: 16, overflow: "hidden" }}>
            <div
              style={{
                width: `${Math.round((val / total) * 100)}%`,
                height: "100%",
                background: COLORS[i % COLORS.length],
                borderRadius: 4,
                transition: "width 0.4s",
              }}
            />
          </div>
          <div style={{ width: 32, fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "monospace" }}>
            {val}건
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SuspectProfileModal({ uuid, onClose, currentUser }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("cases");
  const [avatarError, setAvatarError] = useState(false);

  const load = async () => {
    if (!uuid) return;
    setLoading(true);
    setError(null);
    const data = await fetchSuspectProfile(uuid);
    if (data?.stats) {
      setProfile(data);
    } else {
      setError(data?.message || "프로필을 불러올 수 없습니다.");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    setActiveTab("cases");
    setAvatarError(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uuid]);

  if (!uuid) return null;

  const avatarUrl = `https://crafatar.com/avatars/${uuid}?size=72&overlay=true`;
  const s = profile?.stats || {};

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1100,
        background: "rgba(3,7,18,0.85)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="glass-panel gold-border"
        style={{
          width: "100%", maxWidth: 760, maxHeight: "90vh",
          display: "flex", flexDirection: "column",
          padding: "24px 28px", boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
        }}
      >
        {/* 헤더 */}
        <div
          style={{
            display: "flex", alignItems: "flex-start",
            justifyContent: "space-between", marginBottom: 20,
            paddingBottom: 16, borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* 마인크래프트 아바타 */}
            {!avatarError ? (
              <img
                src={avatarUrl}
                alt="avatar"
                onError={() => setAvatarError(true)}
                style={{
                  width: 56, height: 56, borderRadius: 10,
                  border: "2px solid rgba(245,158,11,0.3)",
                  imageRendering: "pixelated",
                  background: "var(--bg-elevated)",
                }}
              />
            ) : (
              <div
                style={{
                  width: 56, height: 56, borderRadius: 10,
                  background: "rgba(245,158,11,0.1)",
                  border: "2px solid rgba(245,158,11,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <User size={26} color="var(--primary-amber)" />
              </div>
            )}
            <div>
              <div style={{ fontWeight: 900, fontSize: "1.15rem", color: "var(--text-main)" }}>
                {loading ? "조회 중..." : (profile?.suspectName || "알 수 없음")}
              </div>
              <div
                style={{
                  fontFamily: "monospace", fontSize: "0.7rem",
                  color: "var(--text-muted)", marginTop: 3,
                }}
              >
                UUID: {uuid}
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>
                피의자 통합 프로필
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, color: "var(--text-muted)" }}>
            <RefreshCw size={18} className="animate-spin" /> 프로필 조회 중...
          </div>
        ) : error ? (
          <div
            style={{
              flex: 1, display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center", gap: 10,
              color: "#f87171",
            }}
          >
            <AlertCircle size={32} />
            <div style={{ fontSize: "0.9rem", fontWeight: 700 }}>{error}</div>
            <button className="btn btn-outline" style={{ fontSize: "0.8rem" }} onClick={load}>
              <RefreshCw size={13} /> 다시 시도
            </button>
          </div>
        ) : profile ? (
          <>
            {/* 요약 통계 카드 */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
              <StatCard label="총 사건" value={s.totalCases} color="var(--primary-amber)" />
              <StatCard label="기소" value={s.indicted} color="#ef4444" />
              <StatCard label="불기소" value={s.nonIndicted} color="#3b82f6" />
              <StatCard label="수사중" value={s.pending} color="#94a3b8" />
              <StatCard label="영장" value={s.totalWarrants} color="#8b5cf6" />
              <StatCard label="항고" value={s.totalAppeals} color="#f97316" />
            </div>

            {/* 탭 */}
            <div
              style={{
                display: "flex", gap: 0, borderBottom: "1px solid var(--border-subtle)",
                marginBottom: 14, flexShrink: 0,
              }}
            >
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "8px 16px", fontSize: "0.78rem", fontWeight: 700,
                    background: "none", border: "none", cursor: "pointer",
                    borderBottom: activeTab === tab.key
                      ? "2px solid var(--primary-amber)"
                      : "2px solid transparent",
                    color: activeTab === tab.key
                      ? "var(--primary-amber)"
                      : "var(--text-muted)",
                    marginBottom: -1, transition: "all 0.15s",
                  }}
                >
                  {tab.icon}{tab.label}
                </button>
              ))}
            </div>

            {/* 탭 콘텐츠 */}
            <div style={{ flex: 1, overflowY: "auto" }}>
              {activeTab === "cases" && (
                <CasesTab cases={profile.cases} />
              )}
              {activeTab === "warrants" && (
                <WarrantsTab warrants={profile.warrants} />
              )}
              {activeTab === "appeals" && (
                <AppealsTab appeals={profile.appeals} />
              )}
              {activeTab === "stats" && (
                <StatsTab stats={s} />
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

/* ── 사건 이력 탭 ── */
function CasesTab({ cases = [] }) {
  if (!cases.length) return <EmptyState label="연관 사건 없음" />;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            {["사건번호", "죄명", "담당검사", "입건상태", "처분"].map(h => (
              <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: "var(--text-muted)", fontWeight: 700, whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cases.map((c, i) => (
            <tr
              key={c.id || i}
              style={{
                borderBottom: "1px solid var(--border-subtle)",
                background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
              }}
            >
              <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "var(--primary-amber)", whiteSpace: "nowrap" }}>
                {getDisplayCaseNumber(c) || "-"}
              </td>
              <td style={{ padding: "8px 10px", color: "var(--text-main)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {c.chargeName || "-"}
              </td>
              <td style={{ padding: "8px 10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {c.prosecutorName || "-"}
              </td>
              <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                <StatusBadge text={c.bookingStatus} />
              </td>
              <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                <DispositionBadge text={c.disposition} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── 영장 이력 탭 ── */
function WarrantsTab({ warrants = [] }) {
  if (!warrants.length) return <EmptyState label="청구된 영장 없음" />;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            {["영장번호", "종류", "사건번호", "청구일", "상태"].map(h => (
              <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: "var(--text-muted)", fontWeight: 700, whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {warrants.map((w, i) => (
            <tr
              key={w.id || i}
              style={{
                borderBottom: "1px solid var(--border-subtle)",
                background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
              }}
            >
              <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "#a78bfa", whiteSpace: "nowrap" }}>
                {w.warrantNo || "-"}
              </td>
              <td style={{ padding: "8px 10px", color: "var(--text-main)", whiteSpace: "nowrap" }}>
                {w.warrantTypeName || w.warrantType || "-"}
              </td>
              <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {w.caseNo || "-"}
              </td>
              <td style={{ padding: "8px 10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {w.requestedAt || "-"}
              </td>
              <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                <StatusBadge text={w.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── 항고 이력 탭 ── */
function AppealsTab({ appeals = [] }) {
  if (!appeals.length) return <EmptyState label="항고 이력 없음" />;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
            {["항고번호", "사건번호", "죄명", "처분", "상태"].map(h => (
              <th key={h} style={{ padding: "6px 10px", textAlign: "left", color: "var(--text-muted)", fontWeight: 700, whiteSpace: "nowrap" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {appeals.map((a, i) => (
            <tr
              key={a.id || i}
              style={{
                borderBottom: "1px solid var(--border-subtle)",
                background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)",
              }}
            >
              <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "#f97316", whiteSpace: "nowrap" }}>
                {a.appealNo || "-"}
              </td>
              <td style={{ padding: "8px 10px", fontFamily: "monospace", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {getDisplayCaseNumber(a) || "-"}
              </td>
              <td style={{ padding: "8px 10px", color: "var(--text-main)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {a.chargeName || "-"}
              </td>
              <td style={{ padding: "8px 10px", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                {a.disposition || "-"}
              </td>
              <td style={{ padding: "8px 10px", whiteSpace: "nowrap" }}>
                <StatusBadge text={a.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── 통계 탭 ── */
function StatsTab({ stats }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, padding: "8px 0" }}>
      <div>
        <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--primary-amber)", marginBottom: 12 }}>
          처분 유형 분포
        </div>
        <DispositionBar stats={stats.dispositionStats} />
      </div>
      <div>
        <div style={{ fontSize: "0.8rem", fontWeight: 800, color: "var(--primary-amber)", marginBottom: 12 }}>
          전체 현황 요약
        </div>
        <div
          style={{
            display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8,
            fontSize: "0.8rem",
          }}
        >
          {[
            ["총 사건 수", stats.totalCases, "var(--primary-amber)"],
            ["기소 건수", stats.indicted, "#ef4444"],
            ["불기소 건수", stats.nonIndicted, "#3b82f6"],
            ["수사 진행 중", stats.pending, "#94a3b8"],
            ["영장 청구 수", stats.totalWarrants, "#8b5cf6"],
            ["항고 건수", stats.totalAppeals, "#f97316"],
          ].map(([label, val, color]) => (
            <div
              key={label}
              style={{
                padding: "10px 14px",
                background: "var(--bg-elevated)",
                border: "1px solid var(--border-subtle)",
                borderRadius: 8,
                display: "flex", justifyContent: "space-between", alignItems: "center",
              }}
            >
              <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{label}</span>
              <span style={{ color, fontWeight: 900, fontSize: "1.05rem" }}>{val ?? 0}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── 공통 헬퍼 컴포넌트 ── */
function EmptyState({ label }) {
  return (
    <div
      style={{
        padding: "36px 0", textAlign: "center",
        fontSize: "0.78rem", color: "var(--text-muted)",
      }}
    >
      <FileText size={28} style={{ display: "block", margin: "0 auto 10px", opacity: 0.25 }} />
      {label}
    </div>
  );
}

function StatusBadge({ text }) {
  if (!text) return <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>-</span>;
  const isActive = text.includes("진행") || text.includes("청구") || text.includes("접수");
  const isDone = text.includes("완료") || text.includes("인용") || text.includes("발부");
  const isRejected = text.includes("기각") || text.includes("취소") || text.includes("실효");
  const bg = isDone
    ? "rgba(52,211,153,0.12)"
    : isRejected
    ? "rgba(239,68,68,0.1)"
    : isActive
    ? "rgba(245,158,11,0.12)"
    : "rgba(148,163,184,0.1)";
  const color = isDone ? "#34d399" : isRejected ? "#f87171" : isActive ? "var(--primary-amber)" : "#94a3b8";
  return (
    <span
      style={{
        background: bg, color, padding: "2px 8px",
        borderRadius: 10, fontSize: "0.68rem", fontWeight: 700,
      }}
    >
      {text}
    </span>
  );
}

function DispositionBadge({ text }) {
  if (!text) return <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>수사중</span>;
  const isIndicted = text.includes("기소") || text.includes("구공판");
  const isNonIndicted = ["불기소", "혐의없음", "기소유예", "각하"].some(k => text.includes(k));
  const bg = isIndicted ? "rgba(239,68,68,0.1)" : isNonIndicted ? "rgba(59,130,246,0.1)" : "rgba(148,163,184,0.1)";
  const color = isIndicted ? "#f87171" : isNonIndicted ? "#60a5fa" : "#94a3b8";
  return (
    <span style={{ background: bg, color, padding: "2px 8px", borderRadius: 10, fontSize: "0.68rem", fontWeight: 700 }}>
      {text.length > 12 ? text.slice(0, 12) + "…" : text}
    </span>
  );
}
