import React from 'react';
import { FileText, ExternalLink, Search } from 'lucide-react';

export default function ReportLedger({ reports, onSelectEvidence, onSelectSuspect }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="glass-panel gold-border" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FileText size={18} color="var(--primary-amber)" />
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>사건 신고 대장 (신고)</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>접수된 사건 신고 및 고소·고발 현황</div>
          </div>
        </div>
        <span className="badge badge-info">{reports.length}건</span>
      </div>

      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        <div className="ledger-table-container">
          <table className="ledger-table">
            <thead>
              <tr>
                <th>접수번호</th>
                <th>형제번호</th>
                <th>신고 내용 / 죄명</th>
                <th>담당검사</th>
                <th>피의자</th>
                <th>입건 현황</th>
                <th>신고 일시</th>
                <th>몰수·추징</th>
                <th>증거</th>
              </tr>
            </thead>
            <tbody>
              {reports.map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--primary-amber)' }}>{r.reportNo}</td>
                  <td style={{ fontFamily: 'monospace', color: '#93c5fd' }}>{r.hyeongjeNo}</td>
                  <td style={{ maxWidth: 200 }}><div style={{ whiteSpace: 'normal', lineHeight: 1.4 }}>{r.title}</div></td>
                  <td style={{ fontWeight: 700 }}>{r.prosecutorName}</td>
                  <td>
                    <button onClick={() => onSelectSuspect && onSelectSuspect({ name: r.suspectName, uuid: r.suspectUuid || null })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-main)', fontWeight: 700, textDecoration: 'underline dotted' }}>
                      {r.suspectName}
                    </button>
                  </td>
                  <td>
                    <span className={`badge ${r.status.includes('완료') ? 'badge-success' : r.status.includes('수사') ? 'badge-warning' : 'badge-info'}`}>
                      {r.status}
                    </span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.createdAt}</td>
                  <td style={{ color: '#34d399', fontWeight: 700 }}>{r.confiscation}</td>
                  <td>
                    {r.basisUrl?.includes('http') && (
                      <button onClick={() => onSelectEvidence(r.basisUrl, r.hyeongjeNo, r.suspectName)}
                        className="btn btn-outline" style={{ padding: '4px 10px', fontSize: '0.72rem', color: 'var(--primary-amber)', border: '1px solid rgba(245,158,11,0.3)' }}>
                        <ExternalLink size={12} />카페
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
  );
}
