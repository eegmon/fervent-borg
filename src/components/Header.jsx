import React, { useState } from "react";
import {
  Scale,
  FileSpreadsheet,
  FileCheck,
  Building2,
  FileText,
  ShieldAlert,
  AlertOctagon,
  Search,
  BarChart3,
  PlusCircle,
  LogOut,
  Lock,
  Bell,
  KeyRound,
  UserCheck,
  ClipboardList,
  Archive,
} from "lucide-react";

const TABS = [
  { id: "mycases", label: "내 담당 사건", icon: UserCheck },
  { id: "ledger", label: "사건 원부", icon: FileSpreadsheet },
  { id: "preserved", label: "보존사건", icon: Archive },
  { id: "warrants", label: "영장 관리", icon: ShieldAlert },
  { id: "approvals", label: "전자 결재함", icon: FileCheck },
  { id: "secretariat", label: "검찰사무국", icon: Building2 },
  { id: "reports", label: "사건 신고", icon: FileText },
  { id: "appeals", label: "항고 관리", icon: ShieldAlert },
  { id: "bookings", label: "입건 현황", icon: AlertOctagon },
  { id: "search", label: "사건 조회", icon: Search },
  { id: "analytics", label: "통계 현황", icon: BarChart3 },
  { id: "auditlog", label: "감사 로그", icon: ClipboardList, adminOnly: true },
];

export default function Header({
  activeTab,
  setActiveTab,
  currentUser,
  onLogout,
  onOpenLoginModal,
  onOpenPasswordModal,
  pendingApprovalsCount,
  onOpenIntakeModal,
  onOpenDeadlineModal,
  onOpenTemplateModal,
  totalAlertsCount = 0,
  isGlobalAdmin = false,
  canViewLoginRecords = false,
}) {
  return (
    <header
      style={{
        background: "var(--bg-card)",
        borderBottom: "1px solid var(--border-subtle)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      {/* Top Bar */}
      <div
        className="site-header-topbar"
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "12px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: "linear-gradient(135deg, #1e3a8a, #f59e0b)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Scale size={20} color="#fff" />
          </div>
          <div>
            <div
              style={{
                fontWeight: 800,
                fontSize: "1.05rem",
                color: "var(--text-main)",
                lineHeight: 1.2,
              }}
            >
              도스온라인 검찰청
            </div>
            <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
              통합 사건처리 포털
            </div>
          </div>
        </div>

        {/* Right Actions */}
        <div
          className="site-header-actions"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          {/* Template Copy */}
          <button
            onClick={onOpenTemplateModal}
            className="btn btn-secondary"
            style={{
              fontSize: "0.8rem",
              padding: "7px 12px",
              color: "var(--primary-amber)",
              border: "1px solid rgba(245,158,11,0.35)",
              gap: 6,
            }}
          >
            <FileText size={14} />
            {"📋 서식 복사"}
          </button>

          {/* New Case */}
          <button
            onClick={onOpenIntakeModal}
            className="btn btn-gold"
            style={{ fontSize: "0.8rem", padding: "7px 14px" }}
          >
            <PlusCircle size={15} />
            신규 사건 접수
          </button>

          {/* Notification Bell -> Deadline Alert Dashboard */}
          <button
            onClick={onOpenDeadlineModal}
            title={
              totalAlertsCount > 0
                ? `법정기한/미결재 경보 ${totalAlertsCount}건`
                : "기한 알림 센터"
            }
            style={{
              position: "relative",
              background: "rgba(245,158,11,0.08)",
              border: "1px solid rgba(245,158,11,0.2)",
              cursor: "pointer",
              padding: "6px 12px",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 6,
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(245,158,11,0.18)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(245,158,11,0.08)")
            }
          >
            <Bell
              size={16}
              color={totalAlertsCount > 0 ? "#f59e0b" : "var(--text-muted)"}
            />
            <span
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                color: "var(--primary-amber)",
              }}
            >
              기한 알림
            </span>
            {totalAlertsCount > 0 && (
              <span
                style={{
                  background: "#ef4444",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "1px 6px",
                  fontSize: "0.68rem",
                  fontWeight: 800,
                  pointerEvents: "none",
                }}
              >
                {totalAlertsCount}
              </span>
            )}
          </button>

          {/* User */}
          {currentUser ? (
            <div
              className="site-header-user"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                background: "var(--bg-elevated)",
                borderRadius: 10,
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "var(--primary-amber)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 800,
                  fontSize: "0.8rem",
                  color: "#000",
                }}
              >
                {currentUser.name[0]}
              </div>
              <div style={{ lineHeight: 1.3 }}>
                <div
                  style={{
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    color: "var(--text-main)",
                  }}
                >
                  {currentUser.name}
                </div>
                <div
                  style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}
                >
                  {currentUser.position || currentUser.title}
                  {currentUser.actingTitle && (
                    <span style={{ color: "var(--primary-amber)", fontWeight: 700 }}>
                      {" | "}{currentUser.actingTitle}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={onOpenPasswordModal}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: 4,
                  marginLeft: 2,
                }}
                title="비밀번호 변경"
              >
                <KeyRound size={14} />
              </button>
              <button
                onClick={onLogout}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: 4,
                  marginLeft: 2,
                }}
                title="로그아웃"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLoginModal}
              className="btn btn-secondary"
              style={{ fontSize: "0.8rem", padding: "7px 12px" }}
            >
              <Lock size={14} />
              로그인
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div
        className="site-header-tabs"
        style={{
          maxWidth: 1400,
          margin: "0 auto",
          padding: "0 24px",
          display: "flex",
          gap: 4,
          overflowX: "auto",
        }}
      >
        {TABS.map((tab) => {
          // 감사 로그는 관리용 계정만 표시
          if (tab.adminOnly && !canViewLoginRecords) return null;
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="site-header-tab"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 16px",
                background: isActive ? "var(--primary-amber)" : "transparent",
                color: isActive ? "#000" : "var(--text-muted)",
                border: "none",
                borderRadius: "8px 8px 0 0",
                fontWeight: 700,
                fontSize: "0.82rem",
                cursor: "pointer",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
                borderBottom: isActive
                  ? "2px solid var(--primary-amber)"
                  : "2px solid transparent",
              }}
            >
              <Icon size={15} />
              {tab.label}
              {tab.id === "approvals" && pendingApprovalsCount > 0 && (
                <span
                  style={{
                    background: "#ef4444",
                    color: "#fff",
                    borderRadius: "50%",
                    width: 16,
                    height: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.65rem",
                    fontWeight: 800,
                  }}
                >
                  {pendingApprovalsCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </header>
  );
}
