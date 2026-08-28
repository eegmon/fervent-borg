import React, { useMemo } from 'react';
import { BarChart3, Scale, Users, Archive, CheckCircle2 } from 'lucide-react';
import { isCaseConcluded, isCaseIndicted, isCaseInvestigating } from '../data/prosecutionData';
import { isArchivedCase } from '../services/caseUtils';

const StatCard = ({ label, value, color, sub }) => (
  <div className="glass-panel" style={{ padding: '20px 24px', borderLeft: `3px solid ${color}` }}>
    <div style={{ fontSize: '2.2rem', fontWeight: 900, color }}>{value}</div>
    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginTop: 4 }}>{label}</div>
    {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
  </div>
);

export default function AnalyticsDashboard({ ledgerData = [] }) {
  const stats = useMemo(() => {
    const active = ledgerData.filter(c => !isArchivedCase(c));
    const archived = ledgerData.filter(c => isArchivedCase(c));

    const countByDisp = (list, fn) => list.filter(fn).length;

    return {
      total: ledgerData.length,
      active: active.length,
      archived: archived.length,
      investigating: countByDisp(ledgerData, isCaseInvestigating),
      indicted: countByDisp(ledgerData, isCaseIndicted),
      concluded: countByDisp(ledgerData, isCaseConcluded),
      activeInvestigating: countByDisp(active, isCaseInvestigating),
      activeIndicted: countByDisp(active, isCaseIndicted),
      activeConcluded: countByDisp(active, isCaseConcluded),
      archivedConcluded: countByDisp(archived, isCaseConcluded),
      gusok: ledgerData.filter(d => (d.disposition || '').includes('구속') && (d.disposition || '').includes('기소')).length,
      bulgusok: ledgerData.filter(d => {
        const disp = d.disposition || '';
        return disp.includes('불구속') && disp.includes('기소');
      }).length,
      bulgis: ledgerData.filter(d => (d.disposition || '').includes('불기소')).length,
    };
  }, [ledgerData]);

  const prosecutorStats = useMemo(() => {
    const activeOnly = ledgerData.filter(c => !isArchivedCase(c));
    return activeOnly.reduce((acc, c) => {
      const name = c.prosecutorName || '미배정';
      acc[name] = (acc[name] || 0) + 1;
      return acc;
    }, {});
  }, [ledgerData]);

  const maxProsecutor = Object.entries(prosecutorStats).sort((a, b) => b[1] - a[1])[0];
  const activeTotal = stats.active || 1;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="glass-panel gold-border" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <BarChart3 size={18} color="var(--primary-amber)" />
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>통계 및 실시간 현황</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>활성·보존·종국 사건 분류 통계 (도스온라인 검찰청)</div>
        </div>
      </div>

      {/* 사건 상태 개요 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <StatCard label="총 등록 사건" value={stats.total} color="#60a5fa" sub="전체 원부 기준" />
        <StatCard label="현재 처리중" value={stats.active} color="#3b82f6" sub="보존 제외 활성 사건" />
        <StatCard label="보존사건" value={stats.archived} color="#f59e0b" sub="보존기록 서고" />
        <StatCard label="종국 처분" value={stats.concluded} color="#34d399" sub="불기소·기소유예 등" />
        <StatCard label="기소" value={stats.indicted} color="#fb923c" sub="구속·불구속·약식" />
        <StatCard label="수사 진행중" value={stats.investigating} color="#fcd34d" sub="처분 미완료" />
      </div>

      {/* 활성 vs 보존 비교 */}
      <div className="glass-panel" style={{ padding: 20 }}>
        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Archive size={16} color="var(--primary-amber)" />
          활성 / 보존 사건 분류
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          <div style={{ padding: 16, borderRadius: 10, background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)' }}>
            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#3b82f6', marginBottom: 10 }}>현재 처리중 ({stats.active}건)</div>
            {[
              { label: '수사 진행', count: stats.activeInvestigating, color: '#fcd34d' },
              { label: '기소', count: stats.activeIndicted, color: '#fb923c' },
              { label: '종국', count: stats.activeConcluded, color: '#34d399' },
            ].map(d => (
              <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>{d.label}</span>
                <span style={{ fontWeight: 700, color: d.color }}>{d.count}건</span>
              </div>
            ))}
          </div>
          <div style={{ padding: 16, borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: '#f59e0b', marginBottom: 10 }}>보존사건 ({stats.archived}건)</div>
            {[
              { label: '종국·불기소', count: stats.archivedConcluded, color: '#34d399' },
              { label: '기타', count: stats.archived - stats.archivedConcluded, color: '#94a3b8' },
            ].map(d => (
              <div key={d.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 6 }}>
                <span style={{ color: 'var(--text-muted)' }}>{d.label}</span>
                <span style={{ fontWeight: 700, color: d.color }}>{d.count}건</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 검사별 담당 (활성 사건만) */}
      <div className="glass-panel" style={{ padding: 20 }}>
        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Users size={16} color="var(--primary-amber)" />
          검사별 활성 담당 사건
          {maxProsecutor && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              · 최다: {maxProsecutor[0]} ({maxProsecutor[1]}건)
            </span>
          )}
        </div>
        {Object.entries(prosecutorStats).sort((a, b) => b[1] - a[1]).map(([name, count]) => {
          const pct = Math.round((count / activeTotal) * 100);
          return (
            <div key={name} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: '0.82rem' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{name}</span>
                <span style={{ color: 'var(--primary-amber)', fontWeight: 700 }}>{count}건</span>
              </div>
              <div style={{ height: 8, background: 'var(--bg-elevated)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #f59e0b, #d97706)', borderRadius: 4, transition: 'width 0.5s' }} />
              </div>
            </div>
          );
        })}
        {Object.keys(prosecutorStats).length === 0 && (
          <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>활성 담당 사건이 없습니다.</div>
        )}
      </div>

      {/* 처분 유형 분포 */}
      <div className="glass-panel" style={{ padding: 20 }}>
        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Scale size={16} color="var(--primary-amber)" />
          처분 유형 분포
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
          {[
            { label: '구속기소', count: stats.gusok, color: '#f87171' },
            { label: '불구속기소', count: stats.bulgusok, color: '#fb923c' },
            { label: '불기소', count: stats.bulgis, color: '#34d399' },
            { label: '수사진행', count: stats.investigating, color: '#fcd34d' },
            { label: '종국처분', count: stats.concluded, color: '#6ee7b7' },
            { label: '보존사건', count: stats.archived, color: '#f59e0b' },
          ].map(d => (
            <div key={d.label} style={{ padding: '14px 16px', borderRadius: 10, background: `${d.color}12`, border: `1px solid ${d.color}30`, textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: d.color }}>{d.count}</div>
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
          보존사건 탭 또는 사건 조회의 보존사건 필터로 열람할 수 있습니다.
        </div>
      </div>
    </div>
  );
}
