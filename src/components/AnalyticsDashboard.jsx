import React, { useMemo, useState } from 'react';
import { BarChart3, Scale, Users, Archive, CheckCircle2, X } from 'lucide-react';
import { isCaseConcluded, isCaseIndicted, isCaseInvestigating } from '../data/prosecutionData';
import { isArchivedCase } from '../services/caseUtils';

const ARCHIVE_FILTERS = [
  { id: 'ALL', label: '전체', sub: '활성 + 보존' },
  { id: 'ACTIVE', label: '보존 미적용', sub: '현재 처리중' },
  { id: 'ARCHIVED', label: '보존 적용', sub: '보존기록 서고' },
];

const DISPOSITION_CATEGORIES = [
  { key: 'gusok', label: '구속기소', color: '#f87171' },
  { key: 'bulgusok', label: '불구속기소', color: '#fb923c' },
  { key: 'bulgis', label: '불기소', color: '#34d399' },
  { key: 'investigating', label: '수사진행', color: '#fcd34d' },
  { key: 'concluded', label: '종국처분', color: '#6ee7b7' },
  { key: 'archived', label: '보존사건', color: '#f59e0b', hideWhen: ['ACTIVE', 'ARCHIVED'] },
];

const StatCard = ({ label, value, color, sub }) => (
  <div className="glass-panel" style={{ padding: '20px 24px', borderLeft: `3px solid ${color}` }}>
    <div style={{ fontSize: '2.2rem', fontWeight: 900, color }}>{value}</div>
    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginTop: 4 }}>{label}</div>
    {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
  </div>
);

function buildDispositionBreakdown(cases) {
  return {
    total: cases.length,
    active: cases.filter((c) => !isArchivedCase(c)).length,
    gusok: cases.filter((d) => (d.disposition || '').includes('구속') && (d.disposition || '').includes('기소')).length,
    bulgusok: cases.filter((d) => {
      const disp = d.disposition || '';
      return disp.includes('불구속') && disp.includes('기소');
    }).length,
    bulgis: cases.filter((d) => (d.disposition || '').includes('불기소')).length,
    investigating: cases.filter(isCaseInvestigating).length,
    concluded: cases.filter(isCaseConcluded).length,
    indicted: cases.filter(isCaseIndicted).length,
    archived: cases.filter(isArchivedCase).length,
    byDisposition: cases.reduce((acc, c) => {
      const label = (c.disposition || c.bookingStatus || '미처분').trim() || '미처분';
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {}),
  };
}

function buildStats(data) {
  const active = data.filter((c) => !isArchivedCase(c));
  const archived = data.filter((c) => isArchivedCase(c));
  const countByDisp = (list, fn) => list.filter(fn).length;

  return {
    total: data.length,
    active: active.length,
    archived: archived.length,
    investigating: countByDisp(data, isCaseInvestigating),
    indicted: countByDisp(data, isCaseIndicted),
    concluded: countByDisp(data, isCaseConcluded),
    activeInvestigating: countByDisp(active, isCaseInvestigating),
    activeIndicted: countByDisp(active, isCaseIndicted),
    activeConcluded: countByDisp(active, isCaseConcluded),
    archivedConcluded: countByDisp(archived, isCaseConcluded),
    gusok: data.filter((d) => (d.disposition || '').includes('구속') && (d.disposition || '').includes('기소')).length,
    bulgusok: data.filter((d) => {
      const disp = d.disposition || '';
      return disp.includes('불구속') && disp.includes('기소');
    }).length,
    bulgis: data.filter((d) => (d.disposition || '').includes('불기소')).length,
  };
}

function getVisibleCategories(archiveFilter) {
  return DISPOSITION_CATEGORIES.filter(
    (d) => !d.hideWhen?.includes(archiveFilter),
  );
}

export default function AnalyticsDashboard({ ledgerData = [] }) {
  const [archiveFilter, setArchiveFilter] = useState('ALL');
  const [selectedProsecutor, setSelectedProsecutor] = useState(null);

  const filteredData = useMemo(() => {
    if (archiveFilter === 'ACTIVE') return ledgerData.filter((c) => !isArchivedCase(c));
    if (archiveFilter === 'ARCHIVED') return ledgerData.filter((c) => isArchivedCase(c));
    return ledgerData;
  }, [ledgerData, archiveFilter]);

  const stats = useMemo(() => buildStats(filteredData), [filteredData]);
  const globalStats = useMemo(() => buildStats(ledgerData), [ledgerData]);

  const prosecutorStats = useMemo(() => {
    return filteredData.reduce((acc, c) => {
      const name = c.prosecutorName || '미배정';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});
  }, [filteredData]);

  const selectedProsecutorBreakdown = useMemo(() => {
    if (!selectedProsecutor) return null;
    const cases = filteredData.filter(
      (c) => (c.prosecutorName || '미배정') === selectedProsecutor,
    );
    return buildDispositionBreakdown(cases);
  }, [filteredData, selectedProsecutor]);

  const maxProsecutor = Object.entries(prosecutorStats).sort((a, b) => b[1] - a[1])[0];
  const scopeTotal = stats.total || 1;
  const visibleCategories = getVisibleCategories(archiveFilter);
  const filterMeta = ARCHIVE_FILTERS.find((f) => f.id === archiveFilter);

  const prosecutorSectionTitle =
    archiveFilter === 'ARCHIVED'
      ? '검사별 보존 사건'
      : archiveFilter === 'ACTIVE'
        ? '검사별 활성 담당 사건'
        : '검사별 담당 사건';

  const handleArchiveFilterChange = (next) => {
    setArchiveFilter(next);
    setSelectedProsecutor(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="glass-panel gold-border" style={{ padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <BarChart3 size={18} color="var(--primary-amber)" />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>통계 및 실시간 현황</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
              {filterMeta?.sub} 기준 · {stats.total}건 조회 중
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ARCHIVE_FILTERS.map((f) => {
            const isActive = archiveFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => handleArchiveFilterChange(f.id)}
                className={isActive ? 'btn btn-gold' : 'btn btn-secondary'}
                style={{
                  padding: '8px 14px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 2,
                  minWidth: 110,
                }}
              >
                <span>{f.label}</span>
                <span style={{ fontSize: '0.65rem', opacity: 0.85, fontWeight: 500 }}>{f.sub}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 사건 상태 개요 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        {archiveFilter === 'ALL' && (
          <>
            <StatCard label="총 등록 사건" value={globalStats.total} color="#60a5fa" sub="전체 원부 기준" />
            <StatCard label="현재 처리중" value={globalStats.active} color="#3b82f6" sub="보존 미적용" />
            <StatCard label="보존사건" value={globalStats.archived} color="#f59e0b" sub="보존기록 적용" />
          </>
        )}
        {archiveFilter !== 'ALL' && (
          <StatCard
            label={archiveFilter === 'ACTIVE' ? '현재 처리중' : '보존사건'}
            value={stats.total}
            color={archiveFilter === 'ACTIVE' ? '#3b82f6' : '#f59e0b'}
            sub={filterMeta?.sub}
          />
        )}
        <StatCard label="종국 처분" value={stats.concluded} color="#34d399" sub="불기소·기소유예 등" />
        <StatCard label="기소" value={stats.indicted} color="#fb923c" sub="구속·불구속·약식" />
        <StatCard label="수사 진행중" value={stats.investigating} color="#fcd34d" sub="처분 미완료" />
      </div>

      {/* 활성 vs 보존 비교 — 전체 보기일 때만 */}
      {archiveFilter === 'ALL' && (
        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Archive size={16} color="var(--primary-amber)" />
            보존 미적용 / 보존 적용 비교
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <div style={{ padding: 16, borderRadius: 10, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)' }}>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#3b82f6', marginBottom: 10 }}>
                보존 미적용 ({globalStats.active}건)
              </div>
              {[
                { label: '수사 진행', count: globalStats.activeInvestigating, color: '#fcd34d' },
                { label: '기소', count: globalStats.activeIndicted, color: '#fb923c' },
                { label: '종국', count: globalStats.activeConcluded, color: '#34d399' },
              ].map((d) => (
                <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{d.label}</span>
                  <span style={{ fontWeight: 700, color: d.color }}>{d.count}건</span>
                </div>
              ))}
            </div>
            <div style={{ padding: 16, borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#f59e0b', marginBottom: 10 }}>
                보존 적용 ({globalStats.archived}건)
              </div>
              {[
                { label: '종국·불기소', count: globalStats.archivedConcluded, color: '#34d399' },
                { label: '기타', count: globalStats.archived - globalStats.archivedConcluded, color: '#94a3b8' },
              ].map((d) => (
                <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 6 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{d.label}</span>
                  <span style={{ fontWeight: 700, color: d.color }}>{d.count}건</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 검사별 담당 */}
      <div className="glass-panel" style={{ padding: 20 }}>
        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <Users size={16} color="var(--primary-amber)" />
          {prosecutorSectionTitle}
          {maxProsecutor && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              · 최다: {maxProsecutor[0]} ({maxProsecutor[1]}건)
            </span>
          )}
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: 'auto' }}>
            검사명 클릭 → 처분 유형 상세
          </span>
        </div>
        {Object.entries(prosecutorStats).sort((a, b) => b[1] - a[1]).map(([name, count]) => {
          const pct = Math.round((count / scopeTotal) * 100);
          const isSelected = selectedProsecutor === name;
          return (
            <button
              key={name}
              type="button"
              onClick={() => setSelectedProsecutor(isSelected ? null : name)}
              style={{
                width: '100%',
                marginBottom: 12,
                padding: '10px 12px',
                borderRadius: 10,
                border: isSelected ? '1px solid rgba(245,158,11,0.5)' : '1px solid transparent',
                background: isSelected ? 'rgba(245,158,11,0.08)' : 'transparent',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.82rem' }}>
                <span style={{ fontWeight: 700, color: isSelected ? 'var(--primary-amber)' : 'var(--text-main)' }}>{name}</span>
                <span style={{ color: 'var(--primary-amber)', fontWeight: 700 }}>{count}건</span>
              </div>
              <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: isSelected ? 'linear-gradient(90deg, #fbbf24, #f59e0b)' : 'linear-gradient(90deg, #f59e0b, #d97706)', borderRadius: 4, transition: 'width 0.5s' }} />
              </div>
            </button>
          );
        })}
        {Object.keys(prosecutorStats).length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            {archiveFilter === 'ARCHIVED' ? '보존 사건이 없습니다.' : '해당 조건의 담당 사건이 없습니다.'}
          </div>
        )}

        {selectedProsecutor && selectedProsecutorBreakdown && (
          <div
            style={{
              marginTop: 8,
              padding: 16,
              borderRadius: 10,
              background: 'rgba(245,158,11,0.06)',
              border: '1px solid rgba(245,158,11,0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                  {selectedProsecutor} 검사 · 처분 유형
                  <span style={{ marginLeft: 8, fontSize: '0.72rem', color: 'var(--primary-amber)', fontWeight: 600 }}>
                    ({filterMeta?.label})
                  </span>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {selectedProsecutorBreakdown.total}건
                  {archiveFilter === 'ALL' &&
                    ` · 활성 ${selectedProsecutorBreakdown.active}건 · 보존 ${selectedProsecutorBreakdown.archived}건`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedProsecutor(null)}
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.72rem', gap: 4 }}
              >
                <X size={12} /> 닫기
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, marginBottom: 16 }}>
              {visibleCategories.map((d) => (
                <div
                  key={d.key}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: `${d.color}12`,
                    border: `1px solid ${d.color}30`,
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: '1.4rem', fontWeight: 900, color: d.color }}>
                    {selectedProsecutorBreakdown[d.key]}
                  </div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-main)', marginTop: 2 }}>
                    {d.label}
                  </div>
                </div>
              ))}
            </div>

            <div style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 8 }}>
              세부 처분 내역
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {Object.entries(selectedProsecutorBreakdown.byDisposition)
                .sort((a, b) => b[1] - a[1])
                .map(([label, count]) => {
                  const pct = selectedProsecutorBreakdown.total
                    ? Math.round((count / selectedProsecutorBreakdown.total) * 100)
                    : 0;
                  return (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.8rem' }}>
                      <span style={{ flex: 1, color: 'var(--text-main)', fontWeight: 600 }}>{label}</span>
                      <span style={{ color: 'var(--primary-amber)', fontWeight: 700, minWidth: 48, textAlign: 'right' }}>
                        {count}건
                      </span>
                      <div style={{ width: 80, height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${pct}%`,
                            background: 'var(--primary-amber)',
                            borderRadius: 3,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* 처분 유형 분포 */}
      <div className="glass-panel" style={{ padding: 20 }}>
        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Scale size={16} color="var(--primary-amber)" />
          처분 유형 분포
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            · {filterMeta?.label}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          {visibleCategories.map((d) => (
            <div key={d.key} style={{ padding: '14px 16px', borderRadius: 10, background: `${d.color}12`, border: `1px solid ${d.color}30`, textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: d.color }}>{stats[d.key]}</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', marginTop: 4 }}>{d.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 종국 사건 안내 */}
      <div style={{ padding: '16px 20px', borderRadius: 10, background: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.2)' }}>
        <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#34d399', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
          <CheckCircle2 size={15} /> 종국·보존 사건 안내
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
          종국 처분(불기소·기소유예·혐의없음 등) 완료 사건은 보존기록 서고로 이관됩니다.
          상단 필터에서 <strong style={{ color: 'var(--text-main)' }}>보존 미적용</strong> / <strong style={{ color: 'var(--text-main)' }}>보존 적용</strong>으로 나눠 통계를 확인할 수 있습니다.
        </div>
      </div>
    </div>
  );
}
