import React, { useState } from "react";
import { KeyRound, CheckCircle2, X } from "lucide-react";

export default function PasswordChangeModal({
  isOpen,
  onClose,
  currentUser,
  onChangePassword,
}) {
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [error, setError] = useState("");

  if (!isOpen || !currentUser) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!currentPwd) {
      setError("현재 비밀번호를 입력해주세요.");
      return;
    }
    if (!newPwd) {
      setError("새 비밀번호를 입력해주세요.");
      return;
    }
    if (newPwd.length < 10) {
      setError("비밀번호는 10자 이상이어야 합니다.");
      return;
    }
    if (newPwd !== confirmPwd) {
      setError("새 비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setError("");
    const changed = await onChangePassword(currentUser.id, currentPwd, newPwd);
    if (!changed) return;
    setCurrentPwd("");
    setNewPwd("");
    setConfirmPwd("");
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: 440 }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: 20,
            paddingBottom: 12,
            borderBottom: "1px solid var(--border-subtle)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 10,
                background: "rgba(245,158,11,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <KeyRound size={20} color="var(--primary-amber)" />
            </div>
            <div>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  color: "var(--text-main)",
                }}
              >
                비밀번호 변경
              </div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                {currentUser.name} ({currentUser.dept} ·{" "}
                {currentUser.position || currentUser.title})
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
            }}
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: 14 }}
        >
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
              현재 비밀번호 *
            </label>
            <input
              type="password"
              className="input-field"
              placeholder="현재 비밀번호 입력"
              value={currentPwd}
              onChange={(e) => {
                setCurrentPwd(e.target.value);
                setError("");
              }}
              required
            />
          </div>

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
              새 비밀번호 *
            </label>
            <input
              type="password"
              className="input-field"
              placeholder="변경할 새 비밀번호 입력 (10자리 이상)"
              value={newPwd}
              onChange={(e) => {
                setNewPwd(e.target.value);
                setError("");
              }}
              required
            />
          </div>

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
              새 비밀번호 확인 *
            </label>
            <input
              type="password"
              className="input-field"
              placeholder="새 비밀번호 다시 입력"
              value={confirmPwd}
              onChange={(e) => {
                setConfirmPwd(e.target.value);
                setError("");
              }}
              required
            />
          </div>

          {error && (
            <div
              style={{
                color: "#f87171",
                fontSize: "0.75rem",
                padding: "6px 10px",
                borderRadius: 6,
                background: "rgba(248,113,113,0.1)",
                border: "1px solid rgba(248,113,113,0.2)",
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "flex-end",
              marginTop: 10,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ fontSize: "0.82rem" }}
            >
              취소
            </button>
            <button
              type="submit"
              className="btn btn-gold"
              style={{ fontSize: "0.82rem", padding: "8px 18px" }}
            >
              <CheckCircle2 size={15} /> 비밀번호 변경
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
