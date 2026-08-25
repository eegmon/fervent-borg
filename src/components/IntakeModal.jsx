import React, { useState } from 'react';
import { Scale, Link, CheckCircle2, User, Search, RefreshCw, Plus, Trash2, Users } from 'lucide-react';
import { PROSECUTORS } from '../data/prosecutionData';
import { fetchMojangUuid } from '../services/mojangApi';

export default function IntakeModal({ isOpen, onClose, onSubmitIntake }) {
  const todayStr = new Date().toISOString().split('T')[0];
  const generateCaseNumber = () => `2026수제${Math.floor(280 + Math.random() * 50)}`;
  const generateEconomyNumber = () => `2026경제${Math.floor(180 + Math.random() * 50)}`;
  const [formData, setFormData] = useState({
    hyeongjeNo: generateCaseNumber(),
    gyeongjeNo: generateEconomyNumber(),
    chargeName: '자본시장법 위반 및 사기',
    bookingStatus: '입건:불구속', prosecutorId: 'AUTO_ASSIGN',
    bookingBasis: 'https://cafe.naver.com/doseonline/', content: '', confiscation: '0 원',
    incidentDate: todayStr,
    bookingDate: todayStr,
  });
  // Reset case numbers each time the modal opens
  React.useEffect(() => {
    if (isOpen) {
      setFormData(prev => ({
        ...prev,
        hyeongjeNo: generateCaseNumber(),
        gyeongjeNo: generateEconomyNumber(),
      }));
    }
  }, [isOpen]);

  // Multiple Suspects State
  const [suspectsList, setSuspectsList] = useState([
    { id: 1, name: '', uuid: '', role: '주범', bookingStatus: '입건:불구속' }
  ]);

  const [mojangLoadingMap, setMojangLoadingMap] = useState({});
  const [mojangStatusMsg, setMojangStatusMsg] = useState(null);

  if (!isOpen) return null;

  const sortedP = [...PROSECUTORS].filter(p => p.roleLevel !== 'CHIEF_ADMINISTRATOR').sort((a, b) => (a.activeCases || 0) - (b.activeCases || 0));
  const set = (k, v) => setFormData(p => ({ ...p, [k]: v }));

  // Suspect Array Actions
  const handleAddSuspect = () => {
    setSuspectsList(prev => [
      ...prev,
      { id: Date.now(), name: '', uuid: '', role: prev.length === 0 ? '주범' : '공범', bookingStatus: '입건:불구속' }
    ]);
  };

  const handleRemoveSuspect = (id) => {
    if (suspectsList.length <= 1) {
      alert('최소 1명의 피의자가 필요합니다.');
      return;
    }
    setSuspectsList(prev => prev.filter(s => s.id !== id));
  };

  const handleUpdateSuspect = (id, field, value) => {
    setSuspectsList(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
  };

  const handleLookupMojangForSuspect = async (suspectId, name) => {
    if (!name || !name.trim()) {
      setMojangStatusMsg({ type: 'error', text: '먼저 피의자 닉네임을 입력해주세요.' });
      return;
    }
    setMojangLoadingMap(prev => ({ ...prev, [suspectId]: true }));
    setMojangStatusMsg({ type: 'info', text: `'${name}' 마인크래프트 계정 Mojang DB 조회 중...` });
    
    const res = await fetchMojangUuid(name);
    setMojangLoadingMap(prev => ({ ...prev, [suspectId]: false }));

    if (res.success) {
      handleUpdateSuspect(suspectId, 'uuid', res.uuid);
      setMojangStatusMsg({ type: 'success', text: `✅ Mojang DB 연결 성공: ${res.name} (UUID: ${res.uuid})` });
    } else {
      setMojangStatusMsg({ type: 'error', text: res.message || 'Mojang API 조회 실패' });
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const validSuspects = suspectsList.filter(s => s.name.trim() !== '');
    if (validSuspects.length === 0) {
      alert('최소 1명 이상의 피의자 닉네임을 입력해주세요.');
      return;
    }

    const primarySuspect = validSuspects[0];
    const displaySuspectName = validSuspects.length > 1
      ? `${primarySuspect.name} 외 ${validSuspects.length - 1}명`
      : primarySuspect.name;

    // 자동배정 제외 대상(isAutoAssignExcluded) 및 휴직자(ON_LEAVE) 제외 후 사건 수 최저 검사 선정
    const validAssignees = PROSECUTORS.filter(p =>
      p.id !== 'sys_admin' &&
      p.roleLevel !== 'CHIEF_ADMINISTRATOR' &&
      p.status !== 'ON_LEAVE' &&
      !p.isAutoAssignExcluded
    ).sort((a, b) => (a.activeCases || 0) - (b.activeCases || 0));

    let assignedProsecutor = null;
    if (formData.prosecutorId === 'AUTO_ASSIGN') {
      assignedProsecutor = validAssignees[0] || PROSECUTORS.find(p => p.id === 'yooa7374');
    } else {
      assignedProsecutor = PROSECUTORS.find(p => p.id === formData.prosecutorId);
    }

    onSubmitIntake({
      id: Date.now(),
      ...formData,
      prosecutorId: assignedProsecutor?.id || 'yooa7374',
      prosecutorName: assignedProsecutor?.name || '유아 검사',
      sujeNo: formData.hyeongjeNo,
      hyeongjeNo: '-', // 기소 결정 시 형제번호 부여
      suspectName: displaySuspectName,
      suspectUuid: primarySuspect.uuid || '',
      suspects: validSuspects,
      latestHyeongjeNo: '-',
      bookingDate: new Date().toISOString().split('T')[0],
      disposition: '수사중', reAppeal: '-',
      court1No: '-', court1Result: '-', court1Doc: '-', court1Appealed: '-', court1Appellant: '-',
      court2No: '-', court2Dismissed: '-', court2Result: '-', court2Doc: '-',
      court3Appealed: '-', court3Appellant: '-', court3No: '-', court3Remanded: '-', court3Result: '-', court3Doc: '-',
      notes: validSuspects.length > 1 ? `공동피의자 사건 (총 ${validSuspects.length}명: ${validSuspects.map(s => `${s.name}[${s.role}]`).join(', ')})` : '신규 접수 및 담당검사 배당 완료',
    });
    onClose();
  };

  const Label = ({ children }) => (
    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>{children}</label>
  );

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 720, maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Scale size={20} color="var(--primary-amber)" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>신규 사건 접수 & 다수 피의자 배당</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>공동피의자 / 공범 다수 사건 등록 포털</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.2rem' }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Case Numbers */}
          <div style={{ padding: 14, borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
            <Label>사건번호 (검찰사무규칙 제16조 기본: 수제)</Label>
            <input className="input-field" style={{ fontFamily: 'monospace', color: 'var(--primary-amber)', fontWeight: 700 }}
              value={formData.hyeongjeNo} onChange={e => set('hyeongjeNo', e.target.value)} />
          </div>

          {/* Multiple Suspects Section */}
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 16, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--primary-amber)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={16} /> 피의자 목록 (공동피의자/공범 등록)
                <span className="badge badge-gold" style={{ fontSize: '0.68rem' }}>{suspectsList.length}명</span>
              </div>
              <button type="button" onClick={handleAddSuspect} className="btn btn-gold" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                <Plus size={13} /> + 피의자/공범 추가
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {suspectsList.map((s, idx) => (
                <div key={s.id} style={{ padding: 12, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                      피의자 #{idx + 1} ({s.role || '주범'})
                    </span>
                    {suspectsList.length > 1 && (
                      <button type="button" onClick={() => handleRemoveSuspect(s.id)} style={{ background: 'none', border: 'none', color: '#f87171', cursor: 'pointer' }} title="삭제">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr 1fr', gap: 8 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>닉네임 *</span>
                        <button type="button" onClick={() => handleLookupMojangForSuspect(s.id, s.name)} disabled={mojangLoadingMap[s.id]}
                          className="btn btn-outline" style={{ padding: '1px 6px', fontSize: '0.65rem', color: 'var(--primary-amber)', border: '1px solid rgba(245,158,11,0.3)' }}>
                          {mojangLoadingMap[s.id] ? <RefreshCw size={9} className="animate-spin" /> : <Search size={9} />}
                          Mojang UUID
                        </button>
                      </div>
                      <input className="input-field" required placeholder="피의자 닉네임"
                        value={s.name} onChange={e => handleUpdateSuspect(s.id, 'name', e.target.value)} />
                    </div>

                    <div>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>UUID</span>
                      <input className="input-field" style={{ fontFamily: 'monospace', fontSize: '0.72rem' }} placeholder="모장 UUID"
                        value={s.uuid} onChange={e => handleUpdateSuspect(s.id, 'uuid', e.target.value)} />
                    </div>

                    <div>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>공범 구분</span>
                      <select className="select-field" value={s.role} onChange={e => handleUpdateSuspect(s.id, 'role', e.target.value)}>
                        <option value="주범">주범</option>
                        <option value="공범">공범</option>
                        <option value="교사범">교사범</option>
                        <option value="방조범">방조범</option>
                        <option value="피의자">피의자</option>
                      </select>
                    </div>

                    <div>
                      <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>입건 상태</span>
                      <select className="select-field" value={s.bookingStatus} onChange={e => handleUpdateSuspect(s.id, 'bookingStatus', e.target.value)}>
                        <option value="입건:불구속">입건:불구속</option>
                        <option value="입건:구속">입건:구속</option>
                        <option value="체포영장 발부">체포영장 발부</option>
                        <option value="지명수배">지명수배</option>
                        <option value="내사종결">내사종결</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {mojangStatusMsg && (
              <div style={{
                marginTop: 10, fontSize: '0.75rem', padding: '6px 12px', borderRadius: 6,
                background: mojangStatusMsg.type === 'success' ? 'rgba(52,211,153,0.1)' : mojangStatusMsg.type === 'info' ? 'rgba(59,130,246,0.1)' : 'rgba(239,68,68,0.1)',
                color: mojangStatusMsg.type === 'success' ? '#34d399' : mojangStatusMsg.type === 'info' ? '#60a5fa' : '#f87171',
                border: `1px solid ${mojangStatusMsg.type === 'success' ? '#34d39940' : mojangStatusMsg.type === 'info' ? '#60a5fa40' : '#f8717140'}`
              }}>
                {mojangStatusMsg.text}
              </div>
            )}
          </div>

          {/* Incident Date & Booking Date */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>📅 사건 발생일시 (범죄행위 종료일 - 공소시효 기산일) *</Label>
              <input type="date" className="input-field" value={formData.incidentDate} onChange={e => set('incidentDate', e.target.value)} required />
            </div>
            <div>
              <Label>📋 사건 접수일시 *</Label>
              <input type="date" className="input-field" value={formData.bookingDate} onChange={e => set('bookingDate', e.target.value)} required />
            </div>
          </div>

          {/* Charge + Prosecutor */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <Label>적용 죄명</Label>
              <input className="input-field" value={formData.chargeName} onChange={e => set('chargeName', e.target.value)} />
            </div>
            <div>
              <Label>담당 검사 배당</Label>
              <select className="select-field" value={formData.prosecutorId} onChange={e => set('prosecutorId', e.target.value)}>
                <option value="AUTO_ASSIGN">🎲 검사 자동 배정 (사건 보유 최저 검사 우선)</option>
                {PROSECUTORS.filter(p => p.id !== 'sys_admin' && p.roleLevel !== 'CHIEF_ADMINISTRATOR').map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.position || p.title} / {p.dept}){p.isAutoAssignExcluded ? ' [🚫 자동배정 제외]' : ''}{p.status === 'ON_LEAVE' ? ' [🟡 휴직중]' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Evidence Link */}
          <div>
            <Label>증거 자료 링크 (네이버 카페 게시글)</Label>
            <input className="input-field" value={formData.bookingBasis} onChange={e => set('bookingBasis', e.target.value)} />
          </div>

          {/* Submit buttons */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '10px 20px' }}>
              취소
            </button>
            <button type="submit" className="btn btn-gold" style={{ padding: '10px 24px', fontWeight: 800 }}>
              <CheckCircle2 size={16} /> 사건 접수 및 자동 배당 완료
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
