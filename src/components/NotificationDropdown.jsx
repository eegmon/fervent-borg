import React, { useState, useRef, useEffect } from "react";
import {
  Bell,
  Check,
  CheckCheck,
  Trash2,
  FileText,
  Briefcase,
  Calendar,
  AlertCircle,
  ExternalLink,
} from "lucide-react";

export default function NotificationDropdown({
  notifications = [],
  unreadCount = 0,
  onMarkAsRead,
  onMarkAllAsRead,
  onDeleteNotification,
  onNavigate,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState("ALL"); // ALL | UNREAD
  const dropdownRef = useRef(null);

  // 외부 클릭 시 닫기
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const filteredNotifications = notifications.filter((n) => {
    if (filter === "UNREAD") return !n.isRead;
    return true;
  });

  const getIcon = (type) => {
    switch (type) {
      case "CASE_ASSIGNED":
        return <Briefcase size={16} color="var(--primary-amber)" />;
      case "APPROVAL_REQ":
        return <FileText size={16} color="#60a5fa" />;
      case "APPROVAL_RESULT":
        return <CheckCheck size={16} color="#34d399" />;
      case "SCHEDULE":
        return <Calendar size={16} color="#c084fc" />;
      default:
        return <AlertCircle size={16} color="var(--primary-amber)" />;
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMin = Math.floor((now - d) / (1000 * 60));
      if (diffMin < 1) return "방금 전";
      if (diffMin < 60) return `${diffMin}분 전`;
      const diffHours = Math.floor(diffMin / 60);
      if (diffHours < 24) return `${diffHours}시간 전`;
      return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
    } catch {
      return dateStr;
    }
  };

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      {/* 종 모양 버튼 */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="btn btn-outline"
        title="실시간 알림"
        style={{
          position: "relative",
          padding: "6px 10px",
          display: "flex",
          alignItems: "center",
          gap: 4,
          borderRadius: 8,
          background: isOpen ? "rgba(255,255,255,0.08)" : "transparent",
        }}
      >
        <Bell size={17} color={unreadCount > 0 ? "var(--primary-amber)" : "var(--text-muted)"} />
        {unreadCount > 0 && (
          <span
            style={{
              position: "absolute",
              top: -3,
              right: -3,
              background: "#ef4444",
              color: "#fff",
              fontSize: "0.65rem",
              fontWeight: 800,
              minWidth: 17,
              height: 17,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 4px",
              boxShadow: "0 0 8px rgba(239,68,68,0.7)",
            }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* 알림 팝오버 드롭다운 */}
      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            width: 380,
            maxHeight: 520,
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            boxShadow: "0 16px 40px rgba(0,0,0,0.6)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            animation: "fadeIn 0.15s ease",
          }}
        >
          {/* 헤더 */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--bg-elevated)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Bell size={16} color="var(--primary-amber)" />
              <span style={{ fontWeight: 800, fontSize: "0.88rem", color: "var(--text-main)" }}>
                알림 센터
              </span>
              {unreadCount > 0 && (
                <span
                  style={{
                    fontSize: "0.68rem",
                    padding: "1px 6px",
                    borderRadius: 10,
                    background: "rgba(239,68,68,0.2)",
                    color: "#f87171",
                    fontWeight: 700,
                  }}
                >
                  {unreadCount}건 미확인
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                onClick={onMarkAllAsRead}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "0.72rem",
                  color: "var(--primary-amber)",
                  cursor: "pointer",
                  fontWeight: 600,
                  padding: "2px 6px",
                }}
              >
                모두 읽음
              </button>
            )}
          </div>

          {/* 필터 탭 */}
          <div
            style={{
              display: "flex",
              borderBottom: "1px solid var(--border-subtle)",
              background: "rgba(0,0,0,0.2)",
            }}
          >
            <button
              onClick={() => setFilter("ALL")}
              style={{
                flex: 1,
                padding: "8px",
                fontSize: "0.74rem",
                fontWeight: filter === "ALL" ? 800 : 500,
                color: filter === "ALL" ? "var(--primary-amber)" : "var(--text-muted)",
                border: "none",
                borderBottom: filter === "ALL" ? "2px solid var(--primary-amber)" : "2px solid transparent",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              전체 ({notifications.length})
            </button>
            <button
              onClick={() => setFilter("UNREAD")}
              style={{
                flex: 1,
                padding: "8px",
                fontSize: "0.74rem",
                fontWeight: filter === "UNREAD" ? 800 : 500,
                color: filter === "UNREAD" ? "var(--primary-amber)" : "var(--text-muted)",
                border: "none",
                borderBottom: filter === "UNREAD" ? "2px solid var(--primary-amber)" : "2px solid transparent",
                background: "transparent",
                cursor: "pointer",
              }}
            >
              읽지 않음 ({unreadCount})
            </button>
          </div>

          {/* 알림 목록 */}
          <div style={{ flex: 1, overflowY: "auto", maxHeight: 380 }}>
            {filteredNotifications.length === 0 ? (
              <div
                style={{
                  padding: "36px 16px",
                  textAlign: "center",
                  color: "var(--text-muted)",
                  fontSize: "0.8rem",
                }}
              >
                {filter === "UNREAD" ? "읽지 않은 알림이 없습니다." : "수신된 알림이 없습니다."}
              </div>
            ) : (
              filteredNotifications.map((notif) => {
                const isUnread = !notif.isRead;
                return (
                  <div
                    key={notif.id}
                    onClick={() => {
                      if (isUnread && onMarkAsRead) {
                        onMarkAsRead(notif.id);
                      }
                      if (notif.linkTab && onNavigate) {
                        onNavigate(notif.linkTab, notif.linkId);
                        setIsOpen(false);
                      }
                    }}
                    style={{
                      padding: "12px 14px",
                      borderBottom: "1px solid var(--border-subtle)",
                      cursor: notif.linkTab ? "pointer" : "default",
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      background: isUnread ? "rgba(245,158,11,0.06)" : "transparent",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isUnread
                        ? "rgba(245,158,11,0.12)"
                        : "rgba(255,255,255,0.04)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isUnread
                        ? "rgba(245,158,11,0.06)"
                        : "transparent";
                    }}
                  >
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: isUnread
                          ? "rgba(245,158,11,0.15)"
                          : "rgba(255,255,255,0.05)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {getIcon(notif.type)}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          marginBottom: 3,
                        }}
                      >
                        <span
                          style={{
                            fontWeight: isUnread ? 800 : 600,
                            fontSize: "0.79rem",
                            color: isUnread ? "var(--text-main)" : "var(--text-muted)",
                          }}
                        >
                          {notif.title}
                        </span>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          {formatTime(notif.createdAt)}
                        </span>
                      </div>

                      <div
                        style={{
                          fontSize: "0.75rem",
                          color: isUnread ? "var(--text-main)" : "var(--text-muted)",
                          lineHeight: 1.4,
                          wordBreak: "break-word",
                        }}
                      >
                        {notif.message}
                      </div>

                      {notif.linkTab && (
                        <div
                          style={{
                            marginTop: 6,
                            fontSize: "0.7rem",
                            color: "var(--primary-amber)",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                            fontWeight: 600,
                          }}
                        >
                          바로가기 <ExternalLink size={11} />
                        </div>
                      )}
                    </div>

                    {/* 삭제 버튼 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onDeleteNotification) onDeleteNotification(notif.id);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--text-muted)",
                        padding: 4,
                        borderRadius: 4,
                        opacity: 0.6,
                      }}
                      title="알림 삭제"
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.6")}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
