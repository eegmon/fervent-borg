import React, { useState, useMemo } from "react";
import {
  ClipboardList,
  Search,
  Filter,
  User,
  Clock,
  Trash2,
  CheckCircle,
  XCircle,
  Plus,
  Edit3,
  LogIn,
  FileText,
  ChevronDown,
  ChevronUp,
  History,
} from "lucide-react";

// ── 액션 메타 ────────────────────────────────────────────────────────
const ACTION_META = {
  CREATE: { label: "생성", color: "#22c55e", icon: Plus },
  UPDATE: { label: "수정", color: "#3b82f6", icon: Edit3 },
  DELETE: { label: "삭제", color: "#ef4444", icon: Trash2 },
  APPROVE: { label: "결재승인", color: "#f59e0b", icon: CheckCircle },
  REJECT: { label: "반려", color: "#f87171", icon: XCircle },
  LOGIN: { label: "로그인", color: "#a78bfa", icon: LogIn },
  LOGOUT: { label: "로그아웃", color: "#6b7280", icon: LogIn },
};

const ENTITY_LABELS = {
  case: "사건",
  report: "신고",
  appeal: "항고",
  booking: "입건",
  approval: "결재문서",
  prosecutor: "검사계정",
  system: "시스템",
};

const formatKst = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || !String(value).includes("T"))
    return value;
  return `${new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(/\. /g, "-")
    .replace(/\.$/, "")} KST`;
};

// ── 감사 로그 detail 파싱: "변경 내역:\n..." 이후를 행별 파싱 ────────
function parseDetail(detail) {
  if (!detail) return { summary: "", changes: [] };
  const sep = "\n변경 내역:\n";
  const idx = detail.indexOf(sep);
  if (idx === -1) return { summary: detail, changes: [] };
  const summary = detail.slice(0, idx).trim();
  const lines = detail
    .slice(idx + sep.length)
    .split("\n")
    .filter(Boolean);
  // 각 줄: "필드명: "이전값" → "이후값""
  const changes = lines.map((line) => {
    const arrowIdx = line.indexOf('" → "');
    if (arrowIdx === -1) return { raw: line };
    const colonIdx = line.indexOf(': "');
    if (colonIdx === -1) return { raw: line };
    const field = line.slice(0, colonIdx).trim();
    const oldVal = line.slice(colonIdx + 3, arrowIdx);
    const newVal = line.slice(arrowIdx + 5, line.length - 1); // 마지막 " 제거
    return { field, oldVal, newVal };
  });
  return { summary, changes };
}

// ── 감사 이벤트 단일 행 ───────────────────────────────────────────────
function AuditRow({ log }) {
  const [expanded, setExpanded] = useState(false);
  const meta = ACTION_META[log.action] || {
    label: log.action,
    color: "#6b7280",
    icon: ClipboardList,
  };
  const Icon = meta.icon;
  const entityLabel = ENTITY_LABELS[log.entityType] || log.entityType;
  const { summary, changes } = parseDetail(log.detail);
  const hasChanges = changes.length > 0;

  return (
    <div
      style={{
        borderRadius: 10,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        overflow: "hidden",
        transition: "box-shadow 0.15s",
      }}
    >
      {/* 메인 행 */}
      <div
        style={{
          padding: "11px 16px",
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          cursor: hasChanges ? "pointer" : "default",
        }}
        onClick={() => hasChanges && setExpanded((v) => !v)}
      >
        {/* 액션 아이콘 */}
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            flexShrink: 0,
            background: `${meta.color}15`,
            border: `1px solid ${meta.color}30`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={14} color={meta.color} />
        </div>

        {/* 내용 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexWrap: "wrap",
              marginBottom: 3,
            }}
          >
            <span
              style={{
                padding: "2px 7px",
                borderRadius: 5,
                fontSize: "0.71rem",
                fontWeight: 800,
                background: `${meta.color}20`,
                color: meta.color,
              }}
            >
              {meta.label}
            </span>
            <span
              style={{
                padding: "2px 7px",
                borderRadius: 5,
                fontSize: "0.71rem",
                fontWeight: 700,
                background: "rgba(255,255,255,0.05)",
                color: "var(--text-muted)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              {entityLabel}
            </span>
            {log.entityLabel && (
              <span
                style={{
                  fontFamily: "monospace",
                  fontSize: "0.78rem",
                  color: "var(--primary-amber)",
                  fontWeight: 700,
                }}
              >
                {log.entityLabel}
              </span>
            )}
            {hasChanges && (
              <span
                style={{
                  padding: "2px 7px",
                  borderRadius: 5,
                  fontSize: "0.69rem",
                  fontWeight: 700,
                  background: "rgba(59,130,246,0.12)",
                  color: "#60a5fa",
                  border: "1px solid rgba(59,130,246,0.25)",
                }}
              >
                {changes.length}개 변경
              </span>
            )}
          </div>
          {summary && (
            <div
              style={{
                fontSize: "0.76rem",
                color: "var(--text-muted)",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {summary}
            </div>
          )}
        </div>

        {/* 우측: 작성자 + 시간 + 펼치기 */}
        <div
          style={{
            flexShrink: 0,
            textAlign: "right",
            display: "flex",
            flexDirection: "column",
            gap: 3,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              justifyContent: "flex-end",
            }}
          >
            <User size={11} color="var(--text-muted)" />
            <span
              style={{
                fontSize: "0.73rem",
                fontWeight: 700,
                color: "var(--text-main)",
              }}
            >
              {log.actorName || log.actorId}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              justifyContent: "flex-end",
            }}
          >
            <Clock size={10} color="var(--text-muted)" />
            <span
              style={{
                fontSize: "0.68rem",
                color: "var(--text-muted)",
                fontFamily: "monospace",
              }}
            >
              {formatKst(log.createdAt)}
            </span>
          </div>
          {hasChanges && (
            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                marginTop: 2,
              }}
            >
              {expanded ? (
                <ChevronUp size={13} color="var(--text-muted)" />
              ) : (
                <ChevronDown size={13} color="var(--text-muted)" />
              )}
            </div>
          )}
        </div>
      </div>

      {/* 변경 상세 펼침 */}
      {expanded && hasChanges && (
        <div
          style={{
            borderTop: "1px solid var(--border-subtle)",
            padding: "10px 16px 12px 60px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {changes.map((ch, i) =>
            ch.raw ? (
              <div
                key={i}
                style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}
              >
                {ch.raw}
              </div>
            ) : (
              <div
                key={i}
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                <span
                  style={{
                    fontSize: "0.71rem",
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    minWidth: 72,
                    flexShrink: 0,
                  }}
                >
                  {ch.field}
                </span>
                <span
                  style={{
                    fontSize: "0.74rem",
                    color: "#f87171",
                    background: "rgba(239,68,68,0.08)",
                    padding: "1px 6px",
                    borderRadius: 4,
                    fontFamily: "monospace",
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textDecoration: "line-through",
                    opacity: 0.85,
                    flexShrink: 0,
                  }}
                  title={ch.oldVal}
                >
                  {ch.oldVal || "(없음)"}
                </span>
                <span
                  style={{
                    fontSize: "0.68rem",
                    color: "var(--text-muted)",
                    flexShrink: 0,
                  }}
                >
                  →
                </span>
                <span
                  style={{
                    fontSize: "0.74rem",
                    color: "#4ade80",
                    background: "rgba(34,197,94,0.08)",
                    padding: "1px 6px",
                    borderRadius: 4,
                    fontFamily: "monospace",
                    maxWidth: 200,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                  title={ch.newVal}
                >
                  {ch.newVal || "(없음)"}
                </span>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

// ── 원부 수정 이력 단일 행 ────────────────────────────────────────────
function HistoryRow({ item }) {
  return (
    <div
      style={{
        padding: "10px 16px",
        borderRadius: 10,
        background: "var(--bg-elevated)",
        border: "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        flexWrap: "wrap",
      }}
    >
      {/* 사건번호 */}
      <span
        style={{
          fontFamily: "monospace",
          fontSize: "0.77rem",
          fontWeight: 700,
          color: "var(--primary-amber)",
          flexShrink: 0,
        }}
      >
        {item.hyeongjeNo || item.caseId}
      </span>
      {/* 필드명 */}
      <span
        style={{
          fontSize: "0.71rem",
          fontWeight: 700,
          color: "var(--text-muted)",
          minWidth: 68,
          flexShrink: 0,
        }}
      >
        {item.fieldName}
      </span>
      {/* 이전값 */}
      <span
        style={{
          fontSize: "0.74rem",
          color: "#f87171",
          background: "rgba(239,68,68,0.08)",
          padding: "1px 7px",
          borderRadius: 4,
          fontFamily: "monospace",
          maxWidth: 220,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textDecoration: "line-through",
          opacity: 0.85,
          flexShrink: 0,
        }}
        title={item.oldValue}
      >
        {item.oldValue || "(없음)"}
      </span>
      <span
        style={{
          fontSize: "0.68rem",
          color: "var(--text-muted)",
          flexShrink: 0,
        }}
      >
        →
      </span>
      {/* 이후값 */}
      <span
        style={{
          fontSize: "0.74rem",
          color: "#4ade80",
          background: "rgba(34,197,94,0.08)",
          padding: "1px 7px",
          borderRadius: 4,
          fontFamily: "monospace",
          maxWidth: 220,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
        title={item.newValue}
      >
        {item.newValue || "(없음)"}
      </span>
      {/* 우측: 작성자·시간 */}
      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <User size={11} color="var(--text-muted)" />
          <span
            style={{
              fontSize: "0.71rem",
              fontWeight: 700,
              color: "var(--text-main)",
            }}
          >
            {item.actorName || item.actorId}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Clock size={10} color="var(--text-muted)" />
          <span
            style={{
              fontSize: "0.67rem",
              color: "var(--text-muted)",
              fontFamily: "monospace",
            }}
          >
            {formatKst(item.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── 공통 요약 카운트 카드 ─────────────────────────────────────────────
function CountBadge({ label, color, count, active, onClick }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "9px 14px",
        borderRadius: 10,
        cursor: "pointer",
        background: active ? `${color}20` : "var(--bg-card)",
        border: `1px solid ${active ? color : "var(--border-subtle)"}`,
        display: "flex",
        alignItems: "center",
        gap: 7,
        transition: "all 0.15s",
      }}
    >
      <span style={{ fontSize: "0.77rem", fontWeight: 700, color }}>
        {label}
      </span>
      <span
        style={{
          fontSize: "0.77rem",
          fontWeight: 800,
          color: "var(--text-main)",
        }}
      >
        {count}
      </span>
    </div>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────
export default function AuditLogViewer({ auditLogs = [], caseHistory = [] }) {
  const [tab, setTab] = useState("audit"); // "audit" | "history"
  const [search, setSearch] = useState("");
  const [filterAction, setFilterAction] = useState("ALL");
  const [filterEntity, setFilterEntity] = useState("ALL");
  const [filterField, setFilterField] = useState("ALL");

  // ── 감사 로그 필터 ──────────────────────────────────────────────────
  const filteredAudit = useMemo(() => {
    return auditLogs.filter((log) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        (log.actorName || "").toLowerCase().includes(q) ||
        (log.actorId || "").toLowerCase().includes(q) ||
        (log.entityLabel || "").toLowerCase().includes(q) ||
        (log.detail || "").toLowerCase().includes(q);
      const matchAction = filterAction === "ALL" || log.action === filterAction;
      const matchEntity =
        filterEntity === "ALL" || log.entityType === filterEntity;
      return matchSearch && matchAction && matchEntity;
    });
  }, [auditLogs, search, filterAction, filterEntity]);

  const actionCounts = useMemo(() => {
    const counts = {};
    auditLogs.forEach((l) => {
      counts[l.action] = (counts[l.action] || 0) + 1;
    });
    return counts;
  }, [auditLogs]);

  // ── 원부 수정 이력 필터 ─────────────────────────────────────────────
  const fieldOptions = useMemo(() => {
    const set = new Set(caseHistory.map((h) => h.fieldName).filter(Boolean));
    return ["ALL", ...Array.from(set).sort()];
  }, [caseHistory]);

  const filteredHistory = useMemo(() => {
    return caseHistory.filter((h) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        (h.hyeongjeNo || "").toLowerCase().includes(q) ||
        (h.actorName || "").toLowerCase().includes(q) ||
        (h.fieldName || "").toLowerCase().includes(q) ||
        (h.oldValue || "").toLowerCase().includes(q) ||
        (h.newValue || "").toLowerCase().includes(q);
      const matchField = filterField === "ALL" || h.fieldName === filterField;
      return matchSearch && matchField;
    });
  }, [caseHistory, search, filterField]);

  const TAB_STYLE = (active) => ({
    padding: "8px 18px",
    borderRadius: 8,
    fontSize: "0.82rem",
    fontWeight: 700,
    cursor: "pointer",
    border: "none",
    background: active ? "var(--primary-amber)" : "transparent",
    color: active ? "#000" : "var(--text-muted)",
    transition: "all 0.15s",
  });

  const resetFilters = () => {
    setSearch("");
    setFilterAction("ALL");
    setFilterEntity("ALL");
    setFilterField("ALL");
  };

  const hasFilter =
    search ||
    filterAction !== "ALL" ||
    filterEntity !== "ALL" ||
    filterField !== "ALL";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* 헤더 */}
      <div
        className="glass-panel gold-border"
        style={{
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
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
            <ClipboardList size={17} color="var(--primary-amber)" />
            감사 로그 (Audit Trail)
          </div>
          <div
            style={{
              fontSize: "0.73rem",
              color: "var(--text-muted)",
              marginTop: 2,
            }}
          >
            사건 생성·수정·삭제, 결재 승인/반려, 로그인 등 모든 작업 이력
          </div>
        </div>
        {/* 탭 */}
        <div
          style={{
            display: "flex",
            gap: 4,
            background: "var(--bg-card)",
            padding: 4,
            borderRadius: 10,
            border: "1px solid var(--border-subtle)",
          }}
        >
          <button
            style={TAB_STYLE(tab === "audit")}
            onClick={() => {
              setTab("audit");
              resetFilters();
            }}
          >
            <ClipboardList
              size={13}
              style={{ marginRight: 5, verticalAlign: "middle" }}
            />
            이벤트 로그
            <span style={{ marginLeft: 6, fontSize: "0.7rem", opacity: 0.8 }}>
              {auditLogs.length}
            </span>
          </button>
          <button
            style={TAB_STYLE(tab === "history")}
            onClick={() => {
              setTab("history");
              resetFilters();
            }}
          >
            <History
              size={13}
              style={{ marginRight: 5, verticalAlign: "middle" }}
            />
            원부 수정 이력
            <span style={{ marginLeft: 6, fontSize: "0.7rem", opacity: 0.8 }}>
              {caseHistory.length}
            </span>
          </button>
        </div>
      </div>

      {/* ── 이벤트 로그 탭 ────────────────────────────────────────── */}
      {tab === "audit" && (
        <>
          {/* 액션 요약 카드 */}
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {Object.entries(ACTION_META).map(([key, meta]) => {
              const count = actionCounts[key] || 0;
              if (count === 0) return null;
              return (
                <CountBadge
                  key={key}
                  label={meta.label}
                  color={meta.color}
                  count={count}
                  active={filterAction === key}
                  onClick={() =>
                    setFilterAction(filterAction === key ? "ALL" : key)
                  }
                />
              );
            })}
          </div>

          {/* 검색 + 필터 */}
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <Search
                size={13}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />
              <input
                className="input-field"
                type="text"
                placeholder="담당자, 사건번호, 상세 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 30, fontSize: "0.8rem" }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <Filter size={13} color="var(--text-muted)" />
              <select
                className="select-field"
                value={filterEntity}
                onChange={(e) => setFilterEntity(e.target.value)}
                style={{ fontSize: "0.78rem" }}
              >
                <option value="ALL">전체 유형</option>
                {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            {hasFilter && (
              <button
                onClick={resetFilters}
                className="btn btn-secondary"
                style={{ fontSize: "0.76rem", padding: "5px 11px" }}
              >
                초기화
              </button>
            )}
            <span style={{ fontSize: "0.73rem", color: "var(--text-muted)" }}>
              {filteredAudit.length}건 표시
            </span>
          </div>

          {/* 목록 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {filteredAudit.length === 0 ? (
              <div
                style={{
                  padding: 48,
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: "0.84rem",
                  background: "var(--bg-card)",
                  borderRadius: 12,
                }}
              >
                감사 로그가 없습니다.
              </div>
            ) : (
              filteredAudit.map((log) => <AuditRow key={log.id} log={log} />)
            )}
          </div>
        </>
      )}

      {/* ── 원부 수정 이력 탭 ─────────────────────────────────────── */}
      {tab === "history" && (
        <>
          {/* 검색 + 필드 필터 */}
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
              <Search
                size={13}
                style={{
                  position: "absolute",
                  left: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                }}
              />
              <input
                className="input-field"
                type="text"
                placeholder="사건번호, 담당자, 필드명, 변경 내용 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ paddingLeft: 30, fontSize: "0.8rem" }}
              />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <FileText size={13} color="var(--text-muted)" />
              <select
                className="select-field"
                value={filterField}
                onChange={(e) => setFilterField(e.target.value)}
                style={{ fontSize: "0.78rem" }}
              >
                {fieldOptions.map((f) => (
                  <option key={f} value={f}>
                    {f === "ALL" ? "전체 필드" : f}
                  </option>
                ))}
              </select>
            </div>
            {hasFilter && (
              <button
                onClick={resetFilters}
                className="btn btn-secondary"
                style={{ fontSize: "0.76rem", padding: "5px 11px" }}
              >
                초기화
              </button>
            )}
            <span style={{ fontSize: "0.73rem", color: "var(--text-muted)" }}>
              {filteredHistory.length}건 표시
            </span>
          </div>

          {/* 헤더 레이블 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "5px 16px",
              fontSize: "0.68rem",
              fontWeight: 700,
              color: "var(--text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            <span style={{ minWidth: 110, flexShrink: 0 }}>사건번호</span>
            <span style={{ minWidth: 68, flexShrink: 0 }}>필드</span>
            <span style={{ minWidth: 90, flexShrink: 0 }}>수정 전</span>
            <span style={{ width: 14, flexShrink: 0 }} />
            <span style={{ minWidth: 90, flexShrink: 0 }}>수정 후</span>
            <span style={{ marginLeft: "auto", flexShrink: 0 }}>
              담당자 / 시각
            </span>
          </div>

          {/* 목록 */}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {filteredHistory.length === 0 ? (
              <div
                style={{
                  padding: 48,
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: "0.84rem",
                  background: "var(--bg-card)",
                  borderRadius: 12,
                }}
              >
                원부 수정 이력이 없습니다.
              </div>
            ) : (
              filteredHistory.map((item) => (
                <HistoryRow key={item.id} item={item} />
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
