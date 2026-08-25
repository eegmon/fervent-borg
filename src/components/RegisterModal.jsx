import React, { useState } from 'react';
import { UserPlus, User, KeyRound, AlertCircle, CheckCircle2, Building2, BadgeCheck, ChevronDown } from 'lucide-react';
import { registerApi } from '../services/api';
import { INITIAL_DEPARTMENTS, ROLE_LABELS } from '../data/prosecutionData';

// 신청 가능한 직급 (SUPER_ADMIN 제외)
const AVAILABLE_ROLES = [
  { value: 'PROSECUTOR',          label: '평검사' },
  { value: 'PROBATIONARY',        label: '검사시보' },
  { value: 'SENIOR_PROSECUTOR',   label: '부장검사' },
  { value: 'ADMINISTRATOR',       label: '검찰사무관' },
  { value: 'ADMIN_PROBATIONARY',  label: '검찰사무관시보' },
];

const INITIAL_FORM = {
  id: '',
  name: '',
  roleLevel: 'PROBATIONARY',
  dept: '',
  position: '',
  password: '',
  passwordConfirm: '',
  note: '',
};

export default function RegisterModal({ isOpen, onClose, departmentsData }) {
  const [form, setForm] = useState(INITIAL_FORM);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const depts = departmentsData || INITIAL_DEPARTMENTS;

  if (!isOpen) return null;

  const set = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setError('');
  };

  const validate = () => {
    if (!form.id.trim()) return '아이디를 입력해주세요.';
    if (!/^[a-zA-Z0-9_\-]{2,30}$/.test(form.id.trim())) {
      return '아이디는 영문/숫자/언더스코어/하이픈 2~30자여야 합니다.';
    }
    if (!form.name.trim()) return '이름(닉네임)을 입력해주세요.';
    if (!form.dept) return '소속 부서를 선택해주세요.';
    if (!form.password) return '비밀번호를 입력해주세요.';
    if (form.password.length < 4) return '비밀번호는 4자 이상이어야 합니다.';
    if (form.password !== form.passwordConfirm) return '비밀번호가 일치하지 않습니다.';
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }

    setLoading(true);
    setError('');

    const selectedRole = AVAILABLE_ROLES.find(r => r.value === form.roleLevel);
    const payload = {
      id: form.id.trim(),
      name: form.name.trim(),
      roleLevel: form.roleLevel,
      dept: form.dept,
      position: form.position.trim() || `${form.dept} ${selectedRole?.label || ''}`,
      title: selectedRole?.label || '평검사',
      rank: selectedRole?.label || '평검사',
      password: form.password,
      note: form.note.trim(),
    };

    const res = await registerApi(payload);
    setLoading(false);

    if (res?.success) {
      setSuccess(res.message || '가입 신청이 접수되었습니다.');
      setForm(INITIAL_FORM);
    } else {
      setError(res?.message || '신청 중 오류가 발생했습니다.');
    }
  };

  const handleClose = () => {
    setForm(INITIAL_FORM);
    setError('');
    setSuccess('');
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 500, position: 'relative', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* 닫기 버튼 */}
        <button
          onClick={handleClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem', zIndex: 1 }}
          aria-label="닫기"
        >
          ✕
        </button>

        {/* 헤더 */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, #1e3a8a, #34d399)',
            border: '1px solid rgba(52,211,153,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 14px',
          }}>
            <UserPlus size={26} color="#fff" />
          </div>
          <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
            도스온라인 검찰청 가입 신청
          </div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
            신청 후 검찰사무국의 심사 및 허가가 필요합니다
          </div>
        </div>

        {/* 성공 메시지 */}
        {success && (
          <div style={{
            color: '#34d399', fontSize: '0.85rem',
            padding: '14px 16px', borderRadius: 8,
            background: 'rgba(52,211,153,0.08)',
            border: '1px solid rgba(52,211,153,0.25)',
            display: 'flex', alignItems: 'flex-start', gap: 10,
            marginBottom: 16,
          }}>
            <CheckCircle2 size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>
              <div style={{ fontWeight: 800, marginBottom: 4 }}>가입 신청 접수 완료</div>
              <div>{success}</div>
              <div style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                검찰사무국에서 신청을 검토 후 계정을 활성화합니다.
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 아이디 */}
          <div>
            <FieldLabel>검찰청 아이디 (로그인 ID) *</FieldLabel>
            <div style={{ position: 'relative' }}>
              <User size={15} style={iconStyle} />
              <input
                className="input-field"
                style={{ paddingLeft: 36 }}
                type="text"
                placeholder="영문/숫자/_ 2~30자"
                value={form.id}
                onChange={e => set('id', e.target.value)}
                autoComplete="off"
                required
              />
            </div>
          </div>

          {/* 이름 */}
          <div>
            <FieldLabel>이름 (닉네임) *</FieldLabel>
            <div style={{ position: 'relative' }}>
              <BadgeCheck size={15} style={iconStyle} />
              <input
                className="input-field"
                style={{ paddingLeft: 36 }}
                type="text"
                placeholder="게임 내 닉네임"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                required
              />
            </div>
          </div>

          {/* 직급 + 부서 (2열) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <FieldLabel>신청 직급 *</FieldLabel>
              <div style={{ position: 'relative' }}>
                <ChevronDown size={15} style={{ ...iconStyle, right: 10, left: 'auto' }} />
                <select
                  className="select-field"
                  value={form.roleLevel}
                  onChange={e => set('roleLevel', e.target.value)}
                  style={{ paddingRight: 32 }}
                >
                  {AVAILABLE_ROLES.map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <FieldLabel>희망 소속 부서 *</FieldLabel>
              <div style={{ position: 'relative' }}>
                <Building2 size={15} style={iconStyle} />
                <select
                  className="select-field"
                  style={{ paddingLeft: 32 }}
                  value={form.dept}
                  onChange={e => set('dept', e.target.value)}
                  required
                >
                  <option value="">부서 선택</option>
                  {depts.filter(d => d.name !== '검찰총장실').map(d => (
                    <option key={d.id} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 직위명 (선택) */}
          <div>
            <FieldLabel>직위명 (선택 — 미입력 시 자동 설정)</FieldLabel>
            <input
              className="input-field"
              type="text"
              placeholder="예: 첨단범죄수사부 검사"
              value={form.position}
              onChange={e => set('position', e.target.value)}
            />
          </div>

          {/* 비밀번호 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <FieldLabel>비밀번호 *</FieldLabel>
              <div style={{ position: 'relative' }}>
                <KeyRound size={15} style={iconStyle} />
                <input
                  className="input-field"
                  style={{ paddingLeft: 36 }}
                  type="password"
                  placeholder="4자 이상"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <FieldLabel>비밀번호 확인 *</FieldLabel>
              <div style={{ position: 'relative' }}>
                <KeyRound size={15} style={iconStyle} />
                <input
                  className="input-field"
                  style={{ paddingLeft: 36 }}
                  type="password"
                  placeholder="동일하게 입력"
                  value={form.passwordConfirm}
                  onChange={e => set('passwordConfirm', e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* 신청 사유 (선택) */}
          <div>
            <FieldLabel>신청 사유 / 참고 사항 (선택)</FieldLabel>
            <textarea
              className="textarea-field"
              rows={2}
              placeholder="검찰청 가입을 신청하는 이유나 참고 사항을 입력해주세요."
              value={form.note}
              onChange={e => set('note', e.target.value)}
            />
          </div>

          {/* 에러 */}
          {error && (
            <div style={{
              color: '#f87171', fontSize: '0.78rem',
              padding: '8px 12px', borderRadius: 6,
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.2)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* 안내 문구 */}
          <div style={{
            fontSize: '0.73rem', color: 'var(--text-muted)',
            padding: '8px 12px', borderRadius: 6,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            lineHeight: 1.6,
          }}>
            ⚠️ 가입 신청 후 <strong>검찰사무국</strong>의 검토 및 허가를 받아야 로그인이 가능합니다.
            신청 결과는 관리자에게 문의해주세요.
          </div>

          <button
            type="submit"
            className="btn btn-gold"
            style={{ width: '100%', padding: 12, fontSize: '0.95rem', fontWeight: 800, justifyContent: 'center', marginTop: 4 }}
            disabled={loading}
          >
            <UserPlus size={16} />
            {loading ? '신청 중...' : '가입 신청 제출'}
          </button>
        </form>
      </div>
    </div>
  );
}

const FieldLabel = ({ children }) => (
  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6 }}>
    {children}
  </label>
);

const iconStyle = {
  position: 'absolute', left: 10,
  top: '50%', transform: 'translateY(-50%)',
  color: 'var(--text-muted)', pointerEvents: 'none',
};
