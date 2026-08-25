import React from 'react';
import { BarChart3, Scale, Users, FileCheck } from 'lucide-react';

const StatCard = ({ label, value, color, sub }) => (
  <div className="glass-panel" style={{ padding: '20px 24px', borderLeft: `3px solid ${color}` }}>
    <div style={{ fontSize: '2.2rem', fontWeight: 900, color }}>{value}</div>
    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginTop: 4 }}>{label}</div>
    {sub && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
  </div>
);

export default function AnalyticsDashboard({ ledgerData }) {
  const prosecutorStats = ledgerData.reduce((acc, c) => {
    acc[c.prosecutorName] = (acc[c.prosecutorName] || 0) + 1;
    return acc;
  }, {});

  const dispositionStats = {
    '구속기소': ledgerData.filter(d => d.disposition.includes('구속')).length,
    '불구속기소': ledgerData.filter(d => d.disposition.includes('불구속') && d.disposition.includes('기소')).length,
    '불기소': ledgerData.filter(d => d.disposition.includes('불기소')).length,
    '수사중': ledgerData.filter(d => d.disposition.includes('수사중')).length,
  };

  const maxProsecutor = Object.entries(prosecutorStats).sort((a, b) => b[1] - a[1])[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div className="glass-panel gold-border" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <BarChart3 size={18} color="var(--primary-amber)" />
        <div>
          <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>통계 및 실시간 현황</div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>도스온라인 검찰청 검찰 처분 및 검사 담당 사건 통계</div>
        </div>
      </div>

      {/* Main Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        <StatCard label="총 등록 사건" value={ledgerData.length} color="#60a5fa" sub="전체 원부 기준" />
        <StatCard label="구속·기소" value={dispositionStats['구속기소']} color="#f87171" sub="실형 기소 완료" />
        <StatCard label="수사 진행중" value={dispositionStats['수사중']} color="#fcd34d" sub="수사 미완료" />
        <StatCard label="불기소·기소유예" value={dispositionStats['불기소']} color="#34d399" sub="혐의 없음 등" />
        {maxProsecutor && (
          <StatCard label={`최다 담당: ${maxProsecutor[0]}`} value={`${maxProsecutor[1]}건`} color="#a78bfa" sub="최다 사건 수임 검사" />
        )}
      </div>

      {/* Prosecutor Workload Bars */}
      <div className="glass-panel" style={{ padding: 20 }}>
        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Users size={16} color="var(--primary-amber)" />검사별 담당 사건 수
        </div>
        {Object.entries(prosecutorStats).sort((a, b) => b[1] - a[1]).map(([name, count]) => {
          const pct = Math.round((count / ledgerData.length) * 100);
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
      </div>

      {/* Disposition Breakdown */}
      <div className="glass-panel" style={{ padding: 20 }}>
        <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <Scale size={16} color="var(--primary-amber)" />처분 유형 분포
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
          {[
            { label: '구속기소', count: dispositionStats['구속기소'], color: '#f87171' },
            { label: '불구속기소', count: dispositionStats['불구속기소'], color: '#fb923c' },
            { label: '불기소', count: dispositionStats['불기소'], color: '#34d399' },
            { label: '수사진행중', count: dispositionStats['수사중'], color: '#fcd34d' },
          ].map(d => (
            <div key={d.label} style={{ padding: '14px 16px', borderRadius: 10, background: `${d.color}12`, border: `1px solid ${d.color}30`, textAlign: 'center' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: d.color }}>{d.count}</div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', marginTop: 4 }}>{d.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* HWP Notice */}
      <div style={{ padding: '16px 20px', borderRadius: 10, background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.2)' }}>
        <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--primary-amber)', marginBottom: 6 }}>
          📎 HWP 카페 양식 연동 예정
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.7 }}>
          네이버 카페 공식 공지, 처분 결의서 등 HWP 문서 양식은 파일 제공 후 자동 연동될 예정입니다.
        </div>
      </div>
    </div>
  );
}
