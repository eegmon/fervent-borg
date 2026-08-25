import React, { useState, useMemo } from 'react';
import { Search, ExternalLink, AlertCircle, Scale, RefreshCw, FileText, UserCheck, ChevronRight } from 'lucide-react';

const STATUS_COLOR = (s) => {
  if (!s) return '#94a3b8';
  if (s.includes('구속')) return '#f87171';
  if (s.includes('기소') && !s.includes('불기소')) return '#fb923c';
  if (s.includes('불기소') || s.includes('무혐의')) return '#34d399';
  return '#93c5fd';
};

export default function SearchSystem({ ledgerData = [], onSelectEvidence, onSelectSuspect }) {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState('all');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Real-time null-safe filter calculation
  const filteredResults = useMemo(() => {
    const q = (query || '').toLowerCase().trim();

    return ledgerData.filter(item => {
      if (!item) return false;

      const hNo = (item.hyeongjeNo || '').toLowerCase();
      const sName = (item.suspectName || '').toLowerCase();
      const pName = (item.prosecutorName || '').toLowerCase();
      const cName = (item.chargeName || '').toLowerCase();
      const sUuid = (item.suspectUuid || '').toLowerCase();
      const disp = (item.disposition || item.bookingStatus || '').toLowerCase();
      const c1No = (item.court1No || '').toLowerCase();
      const c2No = (item.court2No || '').toLowerCase();
      const c3No = (item.court3No || '').toLowerCase();
      const notes = (item.notes || '').toLowerCase();

      // 1. Text Search Filter
      let matchQuery = true;
      if (q) {
        if (searchType === 'case') {
          matchQuery = hNo.includes(q) || gNo.includes(q) || c1No.includes(q) || c2No.includes(q) || c3No.includes(q);
        } else if (searchType === 'suspect') {
          matchQuery = sName.includes(q) || sUuid.includes(q);
        } else if (searchType === 'prosecutor') {
          matchQuery = pName.includes(q);
        } else if (searchType === 'charge') {
          matchQuery = cName.includes(q);
        } else {
          // 'all' - Deep integrated search
          matchQuery =
            hNo.includes(q) ||
            gNo.includes(q) ||
            sName.includes(q) ||
            pName.includes(q) ||
            cName.includes(q) ||
            sUuid.includes(q) ||
            disp.includes(q) ||
            c1No.includes(q) ||
            notes.includes(q);
        }
      }

      // 2. Status Filter
      let matchStatus = true;
      if (statusFilter !== 'ALL') {
        matchStatus = disp.includes(statusFilter.toLowerCase());
      }

      return matchQuery && matchStatus;
    });
  }, [ledgerData, query, searchType, statusFilter]);

  const handleReset = () => {
    setQuery('');
    setSearchType('all');
    setStatusFilter('ALL');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Search Header Banner */}
      <div className="glass-panel gold-border" style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Search size={18} color="var(--primary-amber)" />
              사건 통합 맞춤 검색 & 실시간 조회 시스템
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
              사건번호, 피의자 닉네임, UUID, 죄명, 담당검사 키워드로 즉시 실시간 조회가 가능합니다.
            </div>
          </div>
          <span className="badge badge-gold" style={{ fontSize: '0.78rem', padding: '5px 12px' }}>
            조회 가능 사건: {ledgerData.length}건
          </span>
        </div>

        {/* Search Controls */}
        <form onSubmit={e => e.preventDefault()} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="select-field"
            value={searchType}
            onChange={e => setSearchType(e.target.value)}
            style={{ width: 150, flexShrink: 0 }}
          >
            <option value="all">전체 통합 검색</option>
            <option value="case">사건/형제/법원번호</option>
            <option value="suspect">피의자 닉네임/UUID</option>
            <option value="prosecutor">담당 검사명</option>
            <option value="charge">죄명 (범죄 유형)</option>
          </select>

          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={15} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              className="input-field"
              style={{ paddingLeft: 36, fontSize: '0.85rem' }}
              placeholder="사건번호, 닉네임, UUID, 죄명, 검사명 검색어 즉시 입력..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              autoFocus
            />
          </div>

          <select
            className="select-field"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            style={{ width: 140, flexShrink: 0 }}
          >
            <option value="ALL">전체 사건 상태</option>
            <option value="접수">접수중</option>
            <option value="기소">구속/불구속 기소</option>
            <option value="불기소">불기소 / 무혐의</option>
            <option value="종국">종국 처분</option>
          </select>

          {(query || searchType !== 'all' || statusFilter !== 'ALL') && (
            <button
              type="button"
              onClick={handleReset}
              className="btn btn-secondary"
              style={{ flexShrink: 0, fontSize: '0.78rem', gap: 4 }}
            >
              <RefreshCw size={13} /> 초기화
            </button>
          )}
        </form>
      </div>

      {/* Results Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {query.trim() ? (
            <>
              '<span style={{ color: 'var(--primary-amber)', fontWeight: 800 }}>{query}</span>' 검색 결과: <strong style={{ color: 'var(--text-main)' }}>{filteredResults.length}건</strong>
            </>
          ) : (
            <>전체 등록 사건 목록: <strong style={{ color: 'var(--primary-amber)' }}>{filteredResults.length}건</strong></>
          )}
        </div>
      </div>

      {/* Results List */}
      <div className="glass-panel" style={{ overflow: 'hidden' }}>
        {filteredResults.length === 0 ? (
          <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <AlertCircle size={36} color="var(--primary-amber)" style={{ margin: '0 auto 12px', opacity: 0.7 }} />
            <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-main)', marginBottom: 4 }}>
              검색 조건에 해당되는 사건이 없습니다.
            </div>
            <div style={{ fontSize: '0.78rem' }}>
              검색어(형제번호, 피의자 닉네임, UUID 등)나 필터 설정을 변경해보세요.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredResults.map((item, idx) => {
              const statusColor = STATUS_COLOR(item.disposition || item.bookingStatus);
              return (
                <div
                  key={item.id || idx}
                  style={{
                    padding: '16px 20px',
                    borderBottom: idx === filteredResults.length - 1 ? 'none' : '1px solid var(--border-subtle)',
                    display: 'grid',
                    gridTemplateColumns: '130px 100px 1.2fr 1fr 120px auto',
                    gap: 14,
                    alignItems: 'center',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    transition: 'background 0.15s',
                  }}
                >
                  {/* 사건번호 */}
                  <div>
                    <div style={{ fontFamily: 'monospace', fontWeight: 800, fontSize: '0.88rem', color: 'var(--primary-amber)' }}>
                      {item.hyeongjeNo || '번호미부여'}
                    </div>
                  </div>

                  {/* 담당검사 */}
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>담당 검사</div>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-main)' }}>
                      {item.prosecutorName || '-'}
                    </div>
                  </div>

                  {/* 피의자 정보 */}
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>피의자 닉네임 / UUID</div>
                    <button
                      onClick={() => onSelectSuspect && onSelectSuspect(item.suspectName)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
                    >
                      <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.85rem', textDecoration: 'underline dotted' }}>
                        {item.suspectName || '-'}
                      </div>
                      {item.suspectUuid && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'monospace', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.suspectUuid}
                        </div>
                      )}
                    </button>
                  </div>

                  {/* 죄명 & 재판번호 */}
                  <div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>죄명</div>
                    <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--primary-amber)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.chargeName || '-'}
                    </div>
                    {item.court1No && (
                      <div style={{ fontSize: '0.68rem', color: '#93c5fd', fontFamily: 'monospace' }}>
                        1심: {item.court1No}
                      </div>
                    )}
                  </div>

                  {/* 처분 상황 */}
                  <div>
                    <span className="badge" style={{ background: `${statusColor}20`, color: statusColor, fontSize: '0.72rem', padding: '4px 10px' }}>
                      {item.disposition || item.bookingStatus || '접수'}
                    </span>
                  </div>

                  {/* 증거 / 링크 */}
                  <div>
                    {item.bookingBasis?.includes('http') ? (
                      <button
                        onClick={() => onSelectEvidence && onSelectEvidence(item.bookingBasis, item.hyeongjeNo, item.suspectName)}
                        className="btn btn-outline"
                        style={{ padding: '4px 10px', fontSize: '0.72rem', color: 'var(--primary-amber)', border: '1px solid rgba(245,158,11,0.3)', gap: 4 }}
                      >
                        <ExternalLink size={12} /> 증거 확인
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>-</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
