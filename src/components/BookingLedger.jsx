import React from 'react';
import { AlertOctagon, ExternalLink } from 'lucide-react';

export default function BookingLedger({ bookings, onSelectEvidence, onSelectSuspect }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="glass-panel gold-border" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertOctagon size={18} color="var(--primary-amber)" />
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>입건 현황 (입건)</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>입건 피의자 수사 진행 및 기소결정 현황</div>
          </div>
        </div>
        <span className="badge badge-danger">{bookings.length}건</span>
      </div>

      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div className="ledger-table-container">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>형제번호</th>
                <th>담당검사</th>
                <th>피의자</th>
                <th>UUID</th>
                <th>처분 현황</th>
                <th>입건일자</th>
                <th>경과 일수</th>
                <th>기소결정</th>
                <th>증거</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map(b => (
                <tr key={b.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-amber)' }}>{b.hyeongjeNo}</td>
                  <td style={{ fontWeight: 700 }}>{b.prosecutorName}</td>
                  <td>
                    <button onClick={() => onSelectSuspect(b.suspectName)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', fontWeight: 700, textDecoration: 'underline dotted' }}>
                      {b.suspectName}
                    </button>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: 'var(--text-muted)' }}>{b.suspectUuid}</td>
                  <td>
                    <span className={`badge ${b.dispositionStatus?.includes('구속') ? 'badge-danger' : b.dispositionStatus?.includes('기소') ? 'badge-warning' : 'badge-info'}`}>
                      {b.dispositionStatus}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{b.bookingDate}</td>
                  <td style={{ fontWeight: 700, color: b.daysElapsed > 30 ? '#f87171' : b.daysElapsed > 14 ? '#fcd34d' : '#6ee7b7' }}>
                    {b.daysElapsed}일
                  </td>
                  <td style={{ maxWidth: 160 }}><div style={{ whiteSpace: 'normal', lineHeight: 1.4 }}>{b.indictmentDecision}</div></td>
                  <td>
                    <button onClick={() => onSelectEvidence(b.basisUrl || "", b.hyeongjeNo, b.suspectName)}
                      className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '0.72rem', color: 'var(--primary-amber)', border: '1px solid rgba(245,158,11,0.3)' }}>
                      <ExternalLink size={12} />증거
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
