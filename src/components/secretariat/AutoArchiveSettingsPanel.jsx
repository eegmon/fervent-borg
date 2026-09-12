import React, { useState, useEffect } from "react";
import { Archive } from "lucide-react";
import {
  fetchAutoArchiveSettings,
  updateAutoArchiveSettings,
} from "../../services/api";

const Label = ({ children }) => (
  <label
    style={{
      display: "block",
      fontSize: "0.78rem",
      fontWeight: 700,
      color: "var(--text-muted)",
      marginBottom: 6,
    }}
  >
    {children}
  </label>
);

/**
 * 불기소 자동보존 설정 패널
 */
export default function AutoArchiveSettingsPanel({ addLog }) {
  const [enabled, setEnabled] = useState(true);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchAutoArchiveSettings().then((res) => {
      if (res) {
        setEnabled(Boolean(res.enabled));
        setDays(Number(res.days) || 7);
      }
      setLoading(false);
    });
  }, []);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    const res = await updateAutoArchiveSettings({ enabled, days });
    setSaving(false);
    if (res?.success) {
      setSaved(true);
      addLog?.(
        "자동보존 설정 변경",
        `사용: ${enabled ? "ON" : "OFF"}, 기간: ${days}일`,
      );
      setTimeout(() => setSaved(false), 2500);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        className="glass-panel gold-border"
        style={{ padding: "14px 20px", background: "rgba(245,158,11,0.06)" }}
      >
        <div
          style={{
            fontWeight: 800,
            fontSize: "0.95rem",
            color: "var(--primary-amber)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <Archive size={18} /> 불기소 자동보존 설정
        </div>
        <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          불기소 처분 후 설정된 기간 동안 항고가 없으면 사건을 자동으로 보존기록
          서고에 이관합니다.
        </div>
      </div>

      {loading ? (
        <div
          style={{
            color: "var(--text-muted)",
            fontSize: "0.85rem",
            padding: 20,
          }}
        >
          설정 불러오는 중...
        </div>
      ) : (
        <form onSubmit={handleSave}>
          <div
            className="glass-panel"
            style={{
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 18,
              maxWidth: 480,
            }}
          >
            {/* 사용 여부 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "0.88rem",
                    color: "var(--text-main)",
                  }}
                >
                  자동보존 사용
                </div>
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--text-muted)",
                    marginTop: 2,
                  }}
                >
                  비활성화하면 자동보존이 실행되지 않습니다.
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEnabled((v) => !v)}
                style={{
                  width: 52,
                  height: 28,
                  borderRadius: 14,
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  background: enabled
                    ? "var(--primary-amber)"
                    : "var(--bg-elevated)",
                  boxShadow: enabled
                    ? "0 0 0 1px rgba(245,158,11,0.6)"
                    : "0 0 0 1px var(--border-subtle)",
                  position: "relative",
                }}
                aria-label={enabled ? "자동보존 비활성화" : "자동보존 활성화"}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 4,
                    transition: "all 0.2s",
                    left: enabled ? 28 : 4,
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: enabled ? "#000" : "var(--text-muted)",
                  }}
                />
              </button>
            </div>

            {/* 보존 기간 */}
            <div>
              <Label>처분 후 자동보존 기간 (일)</Label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input
                  type="number"
                  className="input-field"
                  value={days}
                  min={1}
                  max={365}
                  onChange={(e) => setDays(Math.max(1, Number(e.target.value)))}
                  disabled={!enabled}
                  style={{ width: 120, opacity: enabled ? 1 : 0.5 }}
                  required
                />
                <span
                  style={{ fontSize: "0.82rem", color: "var(--text-muted)" }}
                >
                  일 경과 후 항고 없으면 자동 보존
                </span>
              </div>
            </div>

            {/* 대상 처분 안내 */}
            <div
              style={{
                padding: "10px 14px",
                borderRadius: 8,
                background: "rgba(99,102,241,0.08)",
                border: "1px solid rgba(99,102,241,0.25)",
                fontSize: "0.78rem",
                color: "#a5b4fc",
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                📋 자동보존 대상 처분
              </div>
              <div>
                불기소 · 혐의없음 · 무혐의 · 기소유예 · 공소권없음 · 기소중지 ·
                죄가안됨
              </div>
              <div style={{ marginTop: 6, color: "var(--text-muted)" }}>
                항고가 접수된 경우 자동보존 대상에서 제외됩니다.
              </div>
            </div>

            {/* 저장 버튼 */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <button
                type="submit"
                className="btn btn-gold"
                style={{ padding: "9px 24px", fontWeight: 800 }}
                disabled={saving}
              >
                {saving ? "저장 중..." : "💾 설정 저장"}
              </button>
              {saved && (
                <span
                  style={{
                    fontSize: "0.82rem",
                    color: "#34d399",
                    fontWeight: 700,
                  }}
                >
                  ✅ 저장되었습니다
                </span>
              )}
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
