/**
 * CaseMemoPanel.jsx
 * 사건 수사 메모 패널 — EditCaseModal 하단 탭으로 삽입됨
 *
 * Props:
 *   caseId       string   — cases.id
 *   hyeongjeNo   string   — 형제번호 (표시용)
 *   currentUser  object   — 로그인 사용자
 *   onToast      fn       — (message, type) 토스트 알림
 */
import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Lock,
  Unlock,
  Trash2,
  Send,
  RefreshCw,
  AlertCircle,
} from "lucide-react";
import { fetchCaseMemos, createCaseMemoApi, deleteCaseMemoApi } from "../services/api";

function formatDateTime(str) {
  if (!str) return "-";
  const d = new Date(str.replace(" ", "T"));
  if (isNaN(d)) return str;
  return d.toLocaleString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CaseMemoPanel({ caseId, hyeongjeNo, currentUser, onToast }) {
  const [memos, setMemos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState(null);
  const bottomRef = useRef(null);

  const isGlobalAdmin =
    currentUser?.isSuperAdmin ||
    ["SUPER_ADMIN", "PROSECUTOR_GENERAL", "CHIEF_PROSECUTOR", "DEPUTY_CHIEF", "CHIEF_ADMINISTRATOR"].includes(
      currentUser?.roleLevel,
    ) ||
    currentUser?.dept?.includes("사무국");

  const load = async () => {
    if (!caseId) return;
    setLoading(true);
    const data = await fetchCaseMemos(caseId);
    if (Array.isArray(data)) {
      setMemos(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  // 새 메모 추가 시 스크롤 이동
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [memos.length]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return;
    if (trimmed.length > 2000) {
      onToast?.("메모는 2000자 이하로 작성해주세요.", "error");
      return;
    }
    setSubmitting(true);
    const res = await createCaseMemoApi(caseId, trimmed, isPrivate);
    setSubmitting(false);
    if (res?.success) {
      setMemos((prev) => [...prev, res.memo]);
      setContent("");
      setIsPrivate(false);
      onToast?.("메모가 등록되었습니다.", "success");
    } else {
      onToast?.(res?.message || "메모 등록에 실패했습니다.", "error");
    }
  };

  const handleDelete = async (memoId) => {
    const res = await deleteCaseMemoApi(caseId, memoId);
    if (res?.success) {
      setMemos((prev) => prev.filter((m) => m.id !== memoId));
      setDeleteConfirmId(null);
      onToast?.("메모가 삭제되었습니다.", "info");
    } else {
      onToast?.(res?.message || "메모 삭제에 실패했습니다.", "error");
    }
  };

  const canDelete = (memo) =>
    memo.authorId === currentUser?.id ||
    isGlobalAdmin ||
    currentUser?.dept?.includes("사무국");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* 헤더 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingBottom: 8,
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: "0.82rem",
            fontWeight: 800,
            color: "var(--primary-amber)",
          }}
        >
          <MessageSquare size={15} />
          수사 메모
          <span
            style={{
              fontSize: "0.68rem",
              background: "rgba(245,158,11,0.15)",
              color: "var(--primary-amber)",
              borderRadius: 10,
              padding: "1px 8px",
              fontWeight: 700,
            }}
          >
            {memos.length}건
          </span>
        </div>
        <button
          onClick={load}
          disabled={loading}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: "0.72rem",
          }}
          title="새로고침"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          새로고침
        </button>
      </div>

      {/* 메모 타임라인 */}
      <div
        style={{
          maxHeight: 320,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 0,
          paddingRight: 4,
        }}
      >
        {loading && memos.length === 0 ? (
          <div
            style={{
              padding: "24px 0",
              textAlign: "center",
              fontSize: "0.78rem",
              color: "var(--text-muted)",
            }}
          >
            <RefreshCw size={16} className="animate-spin" style={{ display: "inline" }} />
            &nbsp;로딩 중...
          </div>
        ) : memos.length === 0 ? (
          <div
            style={{
              padding: "28px 0",
              textAlign: "center",
              fontSize: "0.78rem",
              color: "var(--text-muted)",
              background: "var(--bg-elevated)",
              borderRadius: 8,
            }}
          >
            <MessageSquare size={22} style={{ display: "block", margin: "0 auto 8px", opacity: 0.3 }} />
            등록된 수사 메모가 없습니다.
            <br />
            아래에서 첫 메모를 작성해보세요.
          </div>
        ) : (
          memos.map((memo, idx) => {
            const isOwn = memo.authorId === currentUser?.id;
            const isPrivateMemo = Boolean(memo.isPrivate);
            const isLast = idx === memos.length - 1;
            return (
              <div
                key={memo.id}
                style={{
                  display: "flex",
                  gap: 0,
                  position: "relative",
                  marginBottom: isLast ? 0 : 0,
                }}
              >
                {/* 타임라인 선 */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    marginRight: 10,
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      marginTop: 14,
                      background: isPrivateMemo
                        ? "#f87171"
                        : isOwn
                        ? "var(--primary-amber)"
                        : "var(--text-muted)",
                      border: "2px solid var(--bg-card)",
                      flexShrink: 0,
                      zIndex: 1,
                    }}
                  />
                  {!isLast && (
                    <div
                      style={{
                        flex: 1,
                        width: 1,
                        background: "var(--border-subtle)",
                        minHeight: 16,
                      }}
                    />
                  )}
                </div>

                {/* 메모 카드 */}
                <div
                  style={{
                    flex: 1,
                    marginBottom: 12,
                    padding: "10px 12px",
                    borderRadius: 8,
                    background: isPrivateMemo
                      ? "rgba(239,68,68,0.06)"
                      : "var(--bg-elevated)",
                    border: isPrivateMemo
                      ? "1px solid rgba(239,68,68,0.2)"
                      : "1px solid var(--border-subtle)",
                  }}
                >
                  {/* 메타 행 */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 6,
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 800,
                          color: isOwn ? "var(--primary-amber)" : "var(--text-main)",
                        }}
                      >
                        {memo.authorName}
                      </span>
                      {isPrivateMemo && (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 3,
                            fontSize: "0.65rem",
                            color: "#f87171",
                            background: "rgba(239,68,68,0.12)",
                            padding: "1px 6px",
                            borderRadius: 8,
                            fontWeight: 700,
                          }}
                        >
                          <Lock size={9} />
                          비공개
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--text-muted)",
                          fontFamily: "monospace",
                        }}
                      >
                        {formatDateTime(memo.createdAt)}
                      </span>
                      {canDelete(memo) && (
                        deleteConfirmId === memo.id ? (
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              onClick={() => handleDelete(memo.id)}
                              style={{
                                fontSize: "0.65rem",
                                padding: "2px 8px",
                                background: "#ef4444",
                                color: "#fff",
                                border: "none",
                                borderRadius: 4,
                                cursor: "pointer",
                                fontWeight: 700,
                              }}
                            >
                              삭제
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              style={{
                                fontSize: "0.65rem",
                                padding: "2px 8px",
                                background: "var(--bg-card)",
                                color: "var(--text-muted)",
                                border: "1px solid var(--border-subtle)",
                                borderRadius: 4,
                                cursor: "pointer",
                              }}
                            >
                              취소
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(memo.id)}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--text-muted)",
                              padding: 2,
                              display: "flex",
                              alignItems: "center",
                            }}
                            title="메모 삭제"
                          >
                            <Trash2 size={12} />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                  {/* 본문 */}
                  <div
                    style={{
                      fontSize: "0.82rem",
                      color: "var(--text-main)",
                      lineHeight: 1.7,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {memo.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* 입력 폼 */}
      <form
        onSubmit={handleSubmit}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          paddingTop: 8,
          borderTop: "1px solid var(--border-subtle)",
        }}
      >
        <textarea
          className="textarea-field"
          rows={3}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="수사 메모를 작성하세요 (최대 2000자)..."
          maxLength={2000}
          style={{ resize: "vertical", fontSize: "0.82rem" }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              handleSubmit(e);
            }
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          {/* 비공개 토글 */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: "pointer",
              fontSize: "0.78rem",
              color: isPrivate ? "#f87171" : "var(--text-muted)",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={isPrivate}
              onChange={(e) => setIsPrivate(e.target.checked)}
              style={{ accentColor: "#ef4444", width: 14, height: 14 }}
            />
            {isPrivate ? (
              <>
                <Lock size={13} /> 비공개 메모 (본인 + 관리자만 열람)
              </>
            ) : (
              <>
                <Unlock size={13} /> 공개 메모 (같은 부서 열람 가능)
              </>
            )}
          </label>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: "0.7rem",
                color: content.length > 1800 ? "#f87171" : "var(--text-muted)",
              }}
            >
              {content.length}/2000
            </span>
            <button
              type="submit"
              disabled={submitting || !content.trim()}
              className="btn btn-gold"
              style={{ padding: "6px 16px", fontSize: "0.8rem" }}
            >
              {submitting ? (
                <RefreshCw size={13} className="animate-spin" />
              ) : (
                <Send size={13} />
              )}
              &nbsp;등록
            </button>
          </div>
        </div>
        <div
          style={{
            fontSize: "0.68rem",
            color: "var(--text-muted)",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <AlertCircle size={10} />
          Ctrl+Enter로 빠르게 등록할 수 있습니다.
        </div>
      </form>
    </div>
  );
}
