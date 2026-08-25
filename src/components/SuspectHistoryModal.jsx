import React from 'react';
import { X, User, Clock } from 'lucide-react';

export default function SuspectHistoryModal({ isOpen, onClose, suspectName, ledgerData }) {
  if (!isOpen) return null;

  const history = ledgerData.filter(c =>
    c.suspectName.toLowerCase() === suspectName.toLowerCase()
  );

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 680 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img 
                src={`https://crafthead.net/avatar/${encodeURIComponent(suspectName)}`} 
                alt={suspectName}
                onError={(e) => { e.target.onerror = null; e.target.src = 'https://crafthead.net/avatar/steve'; }}
                style={{ width: 38, height: 38, borderRadius: 6, objectFit: 'cover' }}
              />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {suspectName} 피의자 전과 기록
                <span className="badge badge-gold" style={{ fontSize: '0.68rem' }}>Mojang 검증</span>
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                UUID: {history[0]?.suspectUuid || 'Mojang API 자동연동'} · 총 {history.length}건 수사/재판 기록
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {history.length === 0 ? (
          <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            해당 피의자의 전과 기록이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {history.map((c, idx) => (
              <div key={c.id} style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                {/* Index */}
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(245,158,11,0.15)', color: 'var(--primary-amber)', fontWeight: 800, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.85rem', color: 'var(--primary-amber)' }}>{c.hyeongjeNo}</span>
                    <span style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-muted)' }}>담당: {c.prosecutorName}</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: 600, marginBottom: 6 }}>{c.chargeName}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className={`badge ${c.disposition.includes('구속') ? 'badge-danger' : c.disposition.includes('불기소') ? 'badge-success' : 'badge-warning'}`}>
                      {c.disposition}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} />{c.bookingDate}
                    </span>
                    {c.court1Result && c.court1Result !== '-' && (
                      <span className="badge badge-info">1심 {c.court1Result.slice(0, 8)}</span>
                    )}
                    {c.court2Result && c.court2Result !== '-' && (
                      <span className="badge" style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>2심 {c.court2Result.slice(0, 8)}</span>
                    )}
                    {c.court3Result && c.court3Result !== '-' && (
                      <span className="badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399' }}>3심 {c.court3Result.slice(0, 8)}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
