import React, { useState, useMemo } from "react";
import { ClipboardList, Search, Filter, User, Clock, Trash2, CheckCircle, XCircle, Plus, Edit3, LogIn } from "lucide-react";

const ACTION_META = {
  CREATE:  { label: '생성',    color: '#22c55e', icon: Plus },
  UPDATE:  { label: '수정',    color: '#3b82f6', icon: Edit3 },
  DELETE:  { label: '삭제',    color: '#ef4444', icon: Trash2 },
  APPROVE: { label: '결재승인', color: '#f59e0b', icon: CheckCircle },
  REJECT:  { label: '반려',    color: '#f87171', icon: XCircle },
  LOGIN:   { label: '로그인',  color: '#a78bfa', icon: LogIn },
  LOGOUT:  { label: '로그아웃',color: '#6b7280', icon: LogIn },
};

const ENTITY_LABELS = {
  case:       '사건',
  report:     '신고',
  appeal:     '항고',
  booking:    '입건',
  approval:   '결재문서',
  prosecutor: '검사계정',
};

export default function AuditLogViewer({ auditLogs = [] }) {
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('ALL');
  const [filterEntity, setFilterEntity] = useState('ALL');

  const filtered = useMemo(() => {
    return auditLogs.filter(log => {
      const matchSearch = !search ||
        (log.actorName || '').includes(search) ||
        (log.actorId || '').includes(search) ||
        (log.entityLabel || '').includes(search) ||
        (log.detail || '').includes(search);
      const matchAction = filterAction === 'ALL' || log.action === filterAction;
      const matchEntity = filterEntity === 'ALL' || log.entityType === filterEntity;
      return matchSearch && matchAction && matchEntity;
    });
  }, [auditLogs, search, filterAction, filterEntity]);

  const actionCounts = useMemo(() => {
    const counts = {};
    auditLogs.forEach(l => { counts[l.action] = (counts[l.action] || 0) + 1; });
    return counts;
  }, [auditLogs]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 헤더 */}
      <div className="glass-panel gold-border" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <ClipboardList size={18} color="var(--primary-amber)" />
            감사 로그 (Audit Log)
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
            사건 생성·수정·삭제, 결재 승인/반려, 로그인 등 모든 작업 이력
          </div>
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          총 <span style={{ color: 'var(--primary-amber)', fontWeight: 800 }}>{auditLogs.length}</span>건
        </div>
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {Object.entries(ACTION_META).map(([key, meta]) => {
          const count = actionCounts[key] || 0;
          if (count === 0) return null;
          const Icon = meta.icon;
          return (
            <div
              key={key}
              onClick={() => setFilterAction(filterAction === key ? 'ALL' : key)}
              style={{
                padding: '10px 16px', borderRadius: 10, cursor: 'pointer',
                background: filterAction === key ? `${meta.color}20` : 'var(--bg-card)',
                border: `1px solid ${filterAction === key ? meta.color : 'var(--border-subtle)'}`,
                display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
              }}
            >
              <Icon size={14} color={meta.color} />
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: meta.color }}>{meta.label}</span>
              <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-main)' }}>{count}</span>
            </div>
          );
        })}
      </div>

      {/* 검색 + 필터 */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input-field"
            type="text"
            placeholder="담당자, 사건번호, 상세 검색..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 32 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={14} color="var(--text-muted)" />
          <select className="select-field" value={filterEntity} onChange={e => setFilterEntity(e.target.value)} style={{ fontSize: '0.8rem' }}>
            <option value="ALL">전체 유형</option>
            {Object.entries(ENTITY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        {(search || filterAction !== 'ALL' || filterEntity !== 'ALL') && (
          <button
            onClick={() => { setSearch(''); setFilterAction('ALL'); setFilterEntity('ALL'); }}
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', padding: '6px 12px' }}
          >
            필터 초기화
          </button>
        )}
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {filtered.length}건 표시
        </span>
      </div>

      {/* 로그 목록 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', background: 'var(--bg-card)', borderRadius: 12 }}>
            감사 로그가 없습니다.
          </div>
        ) : (
          filtered.map(log => {
            const meta = ACTION_META[log.action] || { label: log.action, color: '#6b7280', icon: ClipboardList };
            const Icon = meta.icon;
            const entityLabel = ENTITY_LABELS[log.entityType] || log.entityType;

            return (
              <div
                key={log.id}
                style={{
                  padding: '12px 16px', borderRadius: 10,
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                }}
              >
                {/* 아이콘 */}
                <div style={{
                  width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                  background: `${meta.color}15`,
                  border: `1px solid ${meta.color}30`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={15} color={meta.color} />
                </div>

                {/* 내용 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 5, fontSize: '0.72rem', fontWeight: 800,
                      background: `${meta.color}20`, color: meta.color,
                    }}>
                      {meta.label}
                    </span>
                    <span style={{
                      padding: '2px 8px', borderRadius: 5, fontSize: '0.72rem', fontWeight: 700,
                      background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)',
                      border: '1px solid var(--border-subtle)',
                    }}>
                      {entityLabel}
                    </span>
                    {log.entityLabel && (
                      <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: 'var(--primary-amber)', fontWeight: 700 }}>
                        {log.entityLabel}
                      </span>
                    )}
                  </div>
                  {log.detail && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {log.detail}
                    </div>
                  )}
                </div>

                {/* 우측: 담당자 + 시간 */}
                <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                    <User size={12} color="var(--text-muted)" />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      {log.actorName || log.actorId}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                    <Clock size={11} color="var(--text-muted)" />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {log.createdAt}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
