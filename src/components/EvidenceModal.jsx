import React, { useEffect, useState } from 'react';
import { X, ExternalLink, Plus, Trash2, FileText, CheckCircle2, Shield, FolderPlus } from 'lucide-react';
import { createEvidenceApi, deleteEvidenceApi, fetchEvidence, updateEvidenceApi } from '../services/api';

const EVIDENCE_TYPES = [
  { id: 'CAFE', label: '카페 게시글 링크', color: '#f59e0b' },
  { id: 'DOCUMENT', label: '수사보고서 / 공문서', color: '#60a5fa' },
  { id: 'IMAGE', label: '디지털 증거 스크린샷', color: '#a78bfa' },
  { id: 'RECORD', label: '녹취록 / 음성자료', color: '#4ade80' },
  { id: 'ACCOUNT', label: '계좌 / 금융 거래 내역', color: '#f87171' },
];

export default function EvidenceModal({ isOpen, onClose, url, caseNo, suspectName, onSaveEvidence }) {
  const [activeUrl, setActiveUrl] = useState(url || '');
  const [evidenceList, setEvidenceList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newType, setNewType] = useState('CAFE');
  const [newRecord, setNewRecord] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingRecord, setEditingRecord] = useState('');

  useEffect(() => {
    if (!isOpen || !caseNo) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchEvidence(caseNo).then(data => {
      if (cancelled) return;
      if (Array.isArray(data)) setEvidenceList(data);
      else setError('증거자료를 불러오지 못했습니다.');
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [isOpen, caseNo]);

  useEffect(() => {
    setActiveUrl(url || '');
  }, [url]);

  if (!isOpen) return null;

  const handleAddEvidence = async (e) => {
    e.preventDefault();
    if (!newUrl.trim()) {
      alert('증거 URL 또는 파일 링크를 입력해주세요.');
      return;
    }
    setSaving(true);
    setError('');
    const res = await createEvidenceApi(caseNo, {
      title: newTitle.trim() || `신규 증거 자료 #${evidenceList.length + 1}`,
      url: newUrl.trim(),
      type: newType,
      record: newRecord.trim(),
    });
    setSaving(false);
    if (!res?.success) {
      setError(res?.message || '증거자료 저장에 실패했습니다.');
      return;
    }
    const item = res.evidence;
    setEvidenceList(prev => [item, ...prev]);
    setActiveUrl(item.url);
    setNewTitle('');
    setNewUrl('');
    setNewRecord('');
    setShowAddForm(false);
    alert('✅ 신규 증거 자료가 정상적으로 저장되었습니다.');
  };

  const handleRemoveEvidence = async (id) => {
    const res = await deleteEvidenceApi(id);
    if (!res?.success) {
      setError(res?.message || '증거자료 삭제에 실패했습니다.');
      return;
    }
    setEvidenceList(prev => prev.filter(e => e.id !== id));
  };

  const handleUpdateRecord = async (item) => {
    const res = await updateEvidenceApi(item.id, { record: editingRecord });
    if (!res?.success) {
      setError(res?.message || '사건기록 수정에 실패했습니다.');
      return;
    }
    setEvidenceList(prev => prev.map(e => e.id === item.id ? { ...e, record: editingRecord } : e));
    setEditingId(null);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 950, width: '92vw', padding: 0, overflow: 'hidden', borderRadius: 14 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Shield size={18} color="var(--primary-amber)" />
              📎 사건 증거자료 보관함 — {caseNo || '사건'} {suspectName ? `· ${suspectName}` : ''}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
              총 {evidenceList.length}건의 디지털 증거 및 수사 자료 보관 중
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="btn btn-gold"
              style={{ fontSize: '0.78rem', padding: '6px 12px', gap: 6 }}
            >
              <FolderPlus size={14} />
              {showAddForm ? '닫기' : '+ 증거 신규 저장'}
            </button>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Add Evidence Form */}
        {showAddForm && (
          <div style={{ background: 'rgba(245,158,11,0.06)', padding: 16, borderBottom: '1px solid rgba(245,158,11,0.2)' }}>
            <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--primary-amber)', marginBottom: 10 }}>
              📥 신규 디지털 증거 및 수사 서류 추가 저장
            </div>
            <form onSubmit={handleAddEvidence} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.5fr 1fr auto', gap: 10, alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>증거 명칭</label>
                <input
                  className="input-field"
                  placeholder="예: 피의자 자백 녹취록 / 스크린샷"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>증거 URL / 카페 링크 *</label>
                <input
                  className="input-field"
                  placeholder="https://cafe.naver.com/doseonline/..."
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  required
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>증거 종류</label>
                <select className="select-field" value={newType} onChange={e => setNewType(e.target.value)}>
                  {EVIDENCE_TYPES.map(t => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 4 }}>사건기록 / 증거 설명</label>
                <textarea
                  className="textarea-field"
                  rows={3}
                  placeholder="증거의 입수 경위, 관련 사실, 분석 내용 등을 기록하세요."
                  value={newRecord}
                  onChange={e => setNewRecord(e.target.value)}
                />
              </div>
              <button type="submit" className="btn btn-gold" style={{ padding: '8px 14px', fontSize: '0.8rem', gap: 4 }}>
                <CheckCircle2 size={14} /> {saving ? '저장 중...' : '저장'}
              </button>
            </form>
          </div>
        )}

        {error && <div style={{ padding: '8px 16px', color: '#f87171', background: 'rgba(239,68,68,0.1)', fontSize: '0.78rem' }}>{error}</div>}

        {/* Main Split Layout: Left Stored Evidence List, Right Active Preview */}
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', height: '68vh' }}>
          {/* Left Evidence List */}
          <div style={{ borderRight: '1px solid var(--border-subtle)', background: 'var(--bg-card)', padding: 12, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', padding: '4px 6px' }}>
              저장된 증거 목록 ({evidenceList.length}건)
            </div>
            {loading ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>증거자료를 불러오는 중...</div>
            ) : evidenceList.length === 0 ? (
              <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                저장된 증거가 없습니다. 상단에서 신규 증거를 추가하세요.
              </div>
            ) : (
              evidenceList.map(item => {
                const isActive = activeUrl === item.url;
                const typeObj = EVIDENCE_TYPES.find(t => t.id === item.type) || EVIDENCE_TYPES[0];
                return (
                  <div
                    key={item.id}
                    onClick={() => setActiveUrl(item.url)}
                    style={{
                      padding: 10, borderRadius: 8, cursor: 'pointer', transition: 'all 0.15s',
                      border: isActive ? '1px solid var(--primary-amber)' : '1px solid var(--border-subtle)',
                      background: isActive ? 'rgba(245,158,11,0.08)' : 'var(--bg-elevated)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: `${typeObj.color}20`, color: typeObj.color }}>
                        {typeObj.label}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleRemoveEvidence(item.id); }}
                        style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }}
                        title="증거 삭제"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.8rem', color: isActive ? 'var(--primary-amber)' : 'var(--text-main)', marginBottom: 4 }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontFamily: 'monospace', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.url}
                      </span>
                      <span>{(item.createdAt || item.date || '').slice(0, 10)}</span>
                    </div>
                    {editingId === item.id ? (
                      <div style={{ marginTop: 7 }}>
                        <textarea className="textarea-field" rows={3} value={editingRecord} onChange={e => setEditingRecord(e.target.value)} />
                        <button type="button" className="btn btn-gold" style={{ marginTop: 5, fontSize: '0.68rem' }} onClick={() => handleUpdateRecord(item)}>기록 저장</button>
                      </div>
                    ) : (
                      <div style={{ marginTop: 7, fontSize: '0.7rem', color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>
                        {item.record || '사건기록 없음'}
                        <button type="button" className="btn btn-outline" style={{ marginLeft: 6, padding: '2px 6px', fontSize: '0.65rem' }} onClick={(e) => { e.stopPropagation(); setEditingId(item.id); setEditingRecord(item.record || ''); }}>기록 수정</button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Right Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', background: '#060b18' }}>
            {activeUrl ? (
              <>
                <div style={{ padding: '8px 14px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.72rem', color: '#60a5fa', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeUrl}
                  </span>
                  <a href={activeUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline" style={{ padding: '2px 8px', fontSize: '0.7rem', color: 'var(--primary-amber)' }}>
                    <ExternalLink size={11} /> 새 창에서 열기
                  </a>
                </div>
                <iframe src={activeUrl} title="증거자료 미리보기" style={{ width: '100%', flex: 1, border: 'none' }} />
              </>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                좌측 목록에서 열람할 증거를 선택하세요.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
