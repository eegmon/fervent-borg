import React, { useState, useEffect } from 'react';
import { X, User, Clock, RefreshCw } from 'lucide-react';
import { fetchSuspectProfile } from '../services/api';

export default function SuspectHistoryModal({ isOpen, onClose, suspectName, suspectUuid, ledgerData }) {
  if (!isOpen) return null;

  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setProfileData(null);

    if (suspectUuid && suspectUuid.length >= 4) {
      // UUID 있으면 서버 API로 전 부서 종국 사건 포함 조회
      setLoading(true);
      fetchSuspectProfile(suspectUuid).then((res) => {
        setLoading(false);
        if (res?.cases) setProfileData(res);
      }).catch(() => setLoading(false));
    }
  }, [isOpen, suspectUuid]);

  // UUID 조회 결과 또는 ledgerData 폴백
  const history = profileData?.cases
    ? profileData.cases
    : (ledgerData || []).filter(
        (c) => c.suspectName && c.suspectName.toLowerCase() === (suspectName || "").toLowerCase()
      );

  const displayUuid = suspectUuid || history[0]?.suspectUuid || null;

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 700 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 10, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img
                src={`https://crafthead.net/avatar/${encodeURIComponent(displayUuid || suspectName || 'steve')}`}
                alt={suspectName}
                onError={(e) => { e.target.onerror = null; e.target.src = 'https://crafthead.net/avatar/steve'; }}
                style={{ width: 38, height: 38, borderRadius: 6, objectFit: 'cover' }}
              />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
                {suspectName} 피의자 전과 기록
                <span className="badge badge-gold" style={{ fontSize: '0.68rem' }}>Mojang 검증</span>
                {profileData && (
                  <span style={{ fontSize: '0.68rem', color: '#34d399', fontWeight: 700 }}>
                    ✅ 전 부서 조회
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {displayUuid ? `UUID: ${displayUuid} · ` : ''}총 {history.length}건 수사/재판 기록
                {!profileData && suspectUuid && (
                  <span style={{ marginLeft: 6, color: '#f59e0b' }}>(본 부서 기준 — UUID 조회 실패)</span>
                )}
                {!suspectUuid && (
                  <span style={{ marginLeft: 6, color: 'var(--text-muted)' }}>(UUID 없음 — 이름 검색)</span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
            전과 기록 조회 중...
          </div>
        ) : history.length === 0 ? (
          <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            해당 피의자의 전과 기록이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: '60vh', overflowY: 'auto' }}>
            {history.map((c, idx) => (
              <div key={c.id || idx} style={{ padding: '14px 16px', borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(245,158,11,0.15)', color: 'var(--primary-amber)', fontWeight: 800, fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {idx + 1}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.85rem', color: 'var(--primary-amber)' }}>
                      {c.hyeongjeNo && c.hyeongjeNo !== '-' && c.sujeNo
                        ? `${c.hyeongjeNo}(${c.sujeNo})`
                        : c.hyeongjeNo || c.sujeNo || '-'}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '0.78rem', color: 'var(--text-muted)' }}>담당: {c.prosecutorName}</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-main)', fontWeight: 600, marginBottom: 6 }}>{c.chargeName}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span className={`badge ${(c.disposition || '').includes('구속') ? 'badge-danger' : (c.disposition || '').includes('불기소') ? 'badge-success' : 'badge-warning'}`}>
                      {c.disposition || '수사중'}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Clock size={11} />{c.bookingDate || '-'}
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
