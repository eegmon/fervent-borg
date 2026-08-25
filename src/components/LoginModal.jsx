import React, { useState } from "react";
import { Lock, User, KeyRound, AlertCircle, UserPlus } from "lucide-react";
import RegisterModal from "./RegisterModal";

export default function LoginModal({
  isOpen,
  onLoginSuccess,
  onClose,
  prosecutorsList,
  departmentsData,
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showRegister, setShowRegister] = useState(false);

  if (!isOpen) return null;

  const handleLogin = (e) => {
    if (e) e.preventDefault();
    const cleanId = username.trim();
    if (!cleanId) {
      setError("검찰청 아이디를 입력해주세요.");
      return;
    }
    setError("");
    onLoginSuccess({ id: cleanId, password });
  };

  return (
    <>
      <div className="modal-overlay">
        <div
          className="modal-content"
          style={{ maxWidth: 440, position: "relative" }}
        >
          {onClose && (
            <button
              onClick={onClose}
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                background: "none",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                fontSize: "1.2rem",
              }}
              aria-label="닫기"
            >
              ✕
            </button>
          )}

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: "linear-gradient(135deg, #1e3a8a, #f59e0b)",
                border: "1px solid rgba(245,158,11,0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 14px",
              }}
            >
              <Lock size={26} color="#fff" />
            </div>
            <div
              style={{
                fontSize: "1.25rem",
                fontWeight: 800,
                color: "var(--text-main)",
              }}
            >
              도스온라인 검찰청
            </div>
            <div
              style={{
                fontSize: "0.8rem",
                color: "var(--text-muted)",
                marginTop: 4,
              }}
            >
              K-PROS 수사 정보 보안 인증 시스템
            </div>
          </div>

          <form
            onSubmit={handleLogin}
            style={{ display: "flex", flexDirection: "column", gap: 14 }}
          >
            {/* ID Input */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  marginBottom: 6,
                }}
              >
                검찰청 아이디 (ID)
              </label>
              <div style={{ position: "relative" }}>
                <User
                  size={16}
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                  }}
                />
                <input
                  className="input-field"
                  style={{ paddingLeft: 38 }}
                  type="text"
                  placeholder="아이디 입력"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    setError("");
                  }}
                  autoFocus
                  required
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  marginBottom: 6,
                }}
              >
                비밀번호 (Password)
              </label>
              <div style={{ position: "relative" }}>
                <KeyRound
                  size={16}
                  style={{
                    position: "absolute",
                    left: 12,
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                  }}
                />
                <input
                  className="input-field"
                  style={{ paddingLeft: 38 }}
                  type="password"
                  placeholder="비밀번호 입력"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError("");
                  }}
                  required
                />
              </div>
            </div>

            {error && (
              <div
                style={{
                  color: "#f87171",
                  fontSize: "0.78rem",
                  padding: "8px 12px",
                  borderRadius: 6,
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <AlertCircle size={14} /> {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-gold"
              style={{
                width: "100%",
                padding: "12px",
                fontSize: "0.95rem",
                fontWeight: 800,
                justifyContent: "center",
                marginTop: 4,
              }}
            >
              <Lock size={16} /> 로그인 인증
            </button>
          </form>

          {/* 구분선 */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              margin: "16px 0 4px",
            }}
          >
            <div
              style={{ flex: 1, height: 1, background: "var(--border-subtle)" }}
            />
            <span
              style={{
                fontSize: "0.72rem",
                color: "var(--text-muted)",
                whiteSpace: "nowrap",
              }}
            >
              계정이 없으신가요?
            </span>
            <div
              style={{ flex: 1, height: 1, background: "var(--border-subtle)" }}
            />
          </div>

          {/* 가입 신청 버튼 */}
          <button
            type="button"
            onClick={() => setShowRegister(true)}
            className="btn btn-secondary"
            style={{
              width: "100%",
              padding: "11px",
              fontWeight: 700,
              justifyContent: "center",
              fontSize: "0.88rem",
              marginTop: 4,
            }}
          >
            <UserPlus size={15} /> 검찰청 가입 신청
          </button>

          <div
            style={{
              fontSize: "0.7rem",
              color: "var(--text-muted)",
              textAlign: "center",
              marginTop: 6,
            }}
          >
            가입 신청 후{" "}
            <strong style={{ color: "var(--primary-amber)" }}>
              검찰사무국
            </strong>
            의 허가가 완료되면 로그인 가능합니다
          </div>
        </div>
      </div>

      {/* 가입 신청 모달 (로그인 모달 위에 렌더) */}
      <RegisterModal
        isOpen={showRegister}
        onClose={() => setShowRegister(false)}
        departmentsData={departmentsData}
      />
    </>
  );
}
