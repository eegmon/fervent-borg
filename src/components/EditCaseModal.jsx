import React, { useState } from 'react';
import { X, Save, Edit, Scale, AlertCircle, Search, RefreshCw, Plus, Trash2, Users, Lock, Unlock } from 'lucide-react';
import { fetchMojangUuid } from '../services/mojangApi';

export default function EditCaseModal({ isOpen, onClose, caseItem, onSave, prosecutorsList = [], chargesData = [], currentUser, onToast }) {
  if (!isOpen || !caseItem) return null;

  // 공개 범위 변경 권한: 담당검사·작성자·검찰총장만
  const GLOBAL_DATA_ROLES = new Set(['SUPER_ADMIN', 'PROSECUTOR_GENERAL', 'CHIEF_PROSECUTOR', 'DEPUTY_CHIEF', 'CHIEF_ADMINISTRATOR']);
  const isGlobalAccess = Boolean(currentUser?.isSuperAdmin || GLOBAL_DATA_ROLES.has(currentUser?.roleLevel));
  const isSecretariat = Boolean(currentUser?.dept?.includes('사무국'));
  // 담당검사 재배치 권한: 전역권한(검사장 이상)·사무국만 가능
  const canReassign = isGlobalAccess || isSecretariat;

  const isOwner = Boolean(
    currentUser && (
      currentUser.id === caseItem.prosecutorId ||
      currentUser.id === caseItem.createdBy
    )
  );
  const isProsecutorGeneral = Boolean(currentUser?.isSuperAdmin || currentUser?.roleLevel === 'PROSECUTOR_GENERAL');
  const canEditVisibility = isOwner || isProsecutorGeneral;

  const [formData, setFormData] = useState({ ...caseItem });
  // privateViewerIds: caseItem에서 파싱 (서버에서 JSON 문자열로 올 수 있음)
  const [privateViewerIds, setPrivateViewerIds] = useState(() => {
    const raw = caseItem.privateViewerIds;
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return []; }
    }
    return [];
  });

  const [suspectsList, setSuspectsList] = useState(() => {
    if (caseItem.suspects && caseItem.suspects.length > 0) {
      return caseItem.suspects;
    }
    return [
      { id: 1, name: caseItem.suspectName || '', uuid: caseItem.suspectUuid || '', role: '주범', bookingStatus: caseItem.bookingStatus || '입건:불구속' }
    ];
  });

  const [mojangLoadingMap, setMojangLoadingMap] = useState({});
  const [mojangStatusMsg, setMojangStatusMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);
    const validSuspects = suspectsList.filter(s => s.name.trim() !== '');
    const primarySuspect = validSuspects[0] || { name: formData.suspectName, uuid: formData.suspectUuid };
    const displaySuspectName = validSuspects.length > 1
      ? `${primarySuspect.name} 외 ${validSuspects.length - 1}명`
      : primarySuspect.name;

    const success = await onSave({
      ...formData,
      suspectName: displaySuspectName,
      suspectUuid: primarySuspect.uuid || '',
      bookingStatus: primarySuspect.bookingStatus || formData.bookingStatus || '',
      suspects: validSuspects,
      privateViewerIds,
    });

    setSaving(false);
    // onSave가 명시적으로 false를 반환하면 실패 — 모달 유지
    if (success === false) {
      setSaveError('저장에 실패했습니다. 다시 시도해주세요.');
      return;
    }
    // 성공(true) 또는 구버전 onSave(undefined) 모두 닫기
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(3, 7, 18, 0.85)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16
    }}>
      <div className="glass-panel gold-border" style={{
        width: '100%', maxWidth: 780, maxHeight: '90vh', overflowY: 'auto',
        padding: '24px 28px', boxShadow: '0 25px 60px rgba(0,0,0,0.6)'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Scale size={20} color="var(--primary-amber)" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)' }}>사건 원부 정보 수정 (다수 피의자)</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>사건번호: {caseItem.hyeongjeNo}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '1.4rem' }}>
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Section 1: Basic Info */}
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 16, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary-amber)', marginBottom: 12 }}>1. 사건 기본 정보</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div>
                <label className="input-label">사건 번호</label>
                <input className="input-field" name="hyeongjeNo" value={formData.hyeongjeNo || ''} onChange={handleChange} required />
              </div>
              <div>
                <label className="input-label">담당 검사</label>
                <select
                  className="select-field"
                  name="prosecutorName"
                  value={formData.prosecutorName || ''}
                  onChange={handleChange}
                  disabled={!canReassign}
                  title={!canReassign ? '담당검사 변경은 검사장 이상 또는 사무국만 가능합니다.' : undefined}
                  style={!canReassign ? { opacity: 0.6, cursor: 'not-allowed' } : undefined}
                >
                  {prosecutorsList.map(p => (
                    <option key={p.id} value={p.name}>{p.name} ({p.position || p.title})</option>
                  ))}
                </select>
                {!canReassign && (
                  <div style={{ marginTop: 3, fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                    담당검사 변경은 검사장 이상 또는 사무국 권한이 필요합니다.
                  </div>
                )}
              </div>
              <div>
                <label className="input-label">📅 사건 발생일시 (공소시효 기산일)</label>
                <input type="date" className="input-field" name="incidentDate" value={formData.incidentDate || ''} onChange={handleChange} />
              </div>
              <div>
                <label className="input-label">📋 사건 접수일시</label>
                <input type="date" className="input-field" name="bookingDate" value={formData.bookingDate || ''} onChange={handleChange} />
              </div>
            </div>
          </div>

          {/* Section 2: Multiple Suspects */}
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 16, border: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--primary-amber)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Users size={16} /> 2. 피의자 목록 (주범 및 공범/공동피의자)
                <span className="badge badge-gold" style={{ fontSize: '0.68rem' }}>{suspectsList.length}명</span>
              </div>
              <button type="button" onClick={handleAddSuspect} className="btn btn-gold" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                <Plus size={13} /> + 피의자 추가
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {suspectsList.map((s, idx) => (
                <div key={s.id || idx} style={{ padding: 12, borderRadius: 8, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
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
                      <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>구분</span>
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

            <div style={{ marginTop: 12 }}>
              <label className="input-label">적용 죄명</label>
              <input className="input-field" name="chargeName" value={formData.chargeName || ''} onChange={handleChange} required list="edit-charge-options" placeholder="죄명 직접 입력 또는 목록 선택" />
              <datalist id="edit-charge-options">
                {chargesData.map((charge) => (
                  <option key={charge.id || charge} value={charge.name || charge} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Section 3: Status & Disposition */}
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 16, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary-amber)', marginBottom: 12 }}>3. 입건 및 처분 내역</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div>
                <label className="input-label">대표 입건 상태</label>
                <select className="select-field" name="bookingStatus" value={formData.bookingStatus || ''} onChange={handleChange}>
                  <option value="입건:구속">입건:구속</option>
                  <option value="입건:불구속">입건:불구속</option>
                  <option value="체포영장 발부">체포영장 발부</option>
                  <option value="내사종결">내사종결</option>
                </select>
              </div>
              <div>
                <label className="input-label">검찰 처분 상태</label>
                <input className="input-field" name="disposition" value={formData.disposition || ''} onChange={handleChange} placeholder="예: 구속기소, 수사중, 기소유예" />
              </div>
              <div>
                <label className="input-label">몰수 및 추징금</label>
                <input className="input-field" name="confiscation" value={formData.confiscation || ''} onChange={handleChange} placeholder="예: 추징금 5,000,000원" />
              </div>
            </div>
          </div>

          {/* Section 4: Trial Results */}
          <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 16, border: '1px solid var(--border-subtle)' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--primary-amber)', marginBottom: 12 }}>4. 법원 재판 및 확정 판결 (1심 · 2심 · 3심)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              <div style={{ padding: 10, borderRadius: 8, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#60a5fa', marginBottom: 6 }}>1심 (지방법원)</div>
                <label className="input-label">사건번호</label>
                <input className="input-field" name="court1No" value={formData.court1No || ''} onChange={handleChange} placeholder="2026고단102" style={{ marginBottom: 6 }} />
                <label className="input-label">판결 결과</label>
                <input className="input-field" name="court1Result" value={formData.court1Result || ''} onChange={handleChange} placeholder="징역 1년 6월" />
              </div>
              <div style={{ padding: 10, borderRadius: 8, background: 'rgba(139,92,246,0.06)', border: '1px solid rgba(139,92,246,0.2)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#a78bfa', marginBottom: 6 }}>2심 (고등법원)</div>
                <label className="input-label">사건번호</label>
                <input className="input-field" name="court2No" value={formData.court2No || ''} onChange={handleChange} placeholder="2026노45" style={{ marginBottom: 6 }} />
                <label className="input-label">판결 결과</label>
                <input className="input-field" name="court2Result" value={formData.court2Result || ''} onChange={handleChange} placeholder="항소기각" />
              </div>
              <div style={{ padding: 10, borderRadius: 8, background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#34d399', marginBottom: 6 }}>3심 (대법원)</div>
                <label className="input-label">사건번호</label>
                <input className="input-field" name="court3No" value={formData.court3No || ''} onChange={handleChange} placeholder="2026도88" style={{ marginBottom: 6 }} />
                <label className="input-label">판결 결과</label>
                <input className="input-field" name="court3Result" value={formData.court3Result || ''} onChange={handleChange} placeholder="상고기각 (확정)" />
              </div>
            </div>
          </div>

          {/* Section 5: Visibility */}
          {canEditVisibility && (
            <div style={{ background: 'var(--bg-elevated)', borderRadius: 10, padding: 16, border: `1px solid ${formData.visibility === 'PRIVATE' ? 'rgba(239,68,68,0.35)' : 'var(--border-subtle)'}` }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: formData.visibility === 'PRIVATE' ? '#f87171' : 'var(--primary-amber)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                {formData.visibility === 'PRIVATE' ? <Lock size={14} /> : <Unlock size={14} />}
                5. 사건 공개 범위
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                <div>
                  <label className="input-label">공개 범위</label>
                  <select
                    className="select-field"
                    value={formData.visibility || 'PUBLIC'}
                    onChange={e => setFormData(prev => ({ ...prev, visibility: e.target.value }))}
                  >
                    <option value="PUBLIC">공개 사건</option>
                    <option value="PRIVATE">비공개 사건 (담당자·생성자·검찰총장만 열람)</option>
                  </select>
                </div>
              </div>
              {formData.visibility === 'PRIVATE' && (
                <div style={{ marginTop: 12 }}>
                  <label className="input-label">추가 열람 허용 검사 (검찰총장·담당검사·작성자는 자동 포함)</label>
                  <select
                    className="select-field"
                    multiple
                    value={privateViewerIds}
                    onChange={e => setPrivateViewerIds(Array.from(e.target.selectedOptions, o => o.value))}
                    style={{ minHeight: 100 }}
                  >
                    {prosecutorsList
                      .filter(p => !p.dept?.includes('사무국') && p.roleLevel !== 'CHIEF_ADMINISTRATOR')
                      .map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.position || p.title})
                        </option>
                      ))}
                  </select>
                  <div style={{ marginTop: 4, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Ctrl 또는 Shift를 사용해 여러 명을 선택할 수 있습니다.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Section 6: Notes */}
          <div>
            <label className="input-label">특이사항 및 비고</label>
            <textarea className="textarea-field" name="notes" rows={2} value={formData.notes || ''} onChange={handleChange} placeholder="추가 메모 또는 수사 참고사항 기입..." />
          </div>

          {/* Submit buttons */}
          {saveError && (
            <div style={{
              padding: '8px 14px',
              borderRadius: 8,
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.4)',
              color: '#f87171',
              fontSize: '0.82rem',
              marginTop: 4,
            }}>
              ❌ {saveError}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 12 }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '10px 20px' }} disabled={saving}>
              취소
            </button>
            <button type="submit" className="btn btn-gold" style={{ padding: '10px 24px', fontWeight: 800, opacity: saving ? 0.6 : 1 }} disabled={saving}>
              <Save size={16} /> {saving ? '저장 중...' : '사건원부 저장 및 반영'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
