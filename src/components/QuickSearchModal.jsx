import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  Search,
  FileText,
  FileSpreadsheet,
  FileCheck,
  ShieldAlert,
  Calendar,
  Building2,
  AlertOctagon,
  BarChart3,
  ClipboardList,
  UserCheck,
  PlusCircle,
  Archive,
  Sun,
  Moon,
  Clock,
  ArrowRight,
  X,
  Scale,
} from "lucide-react";

export default function QuickSearchModal({
  isOpen,
  onClose,
  ledgerData = [],
  approvalsData = [],
  warrantsData = [],
  currentUser,
  activeTab,
  setActiveTab,
  onOpenIntakeModal,
  onOpenDeadlineModal,
  onOpenTemplateModal,
  onOpenTimelineModal,
  onToggleTheme,
  theme,
  isReadOnly = false,
}) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Auto focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Navigation Items
  const navigationItems = useMemo(() => {
    const navs = [
      {
        id: "nav-mycases",
        type: "NAV",
        category: "바로가기",
        title: "내 담당 사건",
        subtitle: "내게 배당된 사건 및 수사 목록",
        icon: UserCheck,
        action: () => {
          setActiveTab("mycases");
          onClose();
        },
      },
      {
        id: "nav-schedule",
        type: "NAV",
        category: "바로가기",
        title: "수사 캘린더",
        subtitle: "조사 일정 및 기일 캘린더",
        icon: Calendar,
        action: () => {
          setActiveTab("schedule");
          onClose();
        },
      },
      {
        id: "nav-ledger",
        type: "NAV",
        category: "바로가기",
        title: "사건 원부",
        subtitle: "전체 사건 목록 및 사건 관리",
        icon: FileSpreadsheet,
        action: () => {
          setActiveTab("ledger");
          onClose();
        },
      },
      {
        id: "nav-preserved",
        type: "NAV",
        category: "바로가기",
        title: "보존 사건 대장",
        subtitle: "종결 및 불기소 보존 사건 목록",
        icon: Archive,
        action: () => {
          setActiveTab("preserved");
          onClose();
        },
      },
      {
        id: "nav-approvals",
        type: "NAV",
        category: "바로가기",
        title: "전자 결재함",
        subtitle: "결재 상신, 결재 대기 및 결재 문서함",
        icon: FileCheck,
        action: () => {
          setActiveTab("approvals");
          onClose();
        },
      },
      {
        id: "nav-warrants",
        type: "NAV",
        category: "바로가기",
        title: "영장 관리",
        subtitle: "체포·구속·압수수색 영장 청구 및 발부 대장",
        icon: ShieldAlert,
        action: () => {
          setActiveTab("warrants");
          onClose();
        },
      },
      {
        id: "nav-appeals",
        type: "NAV",
        category: "바로가기",
        title: "항고 관리",
        subtitle: "항고 및 재항고 대장",
        icon: ShieldAlert,
        action: () => {
          setActiveTab("appeals");
          onClose();
        },
      },
      {
        id: "nav-secretariat",
        type: "NAV",
        category: "바로가기",
        title: "검찰사무국 관리",
        subtitle: "직무대리, 지정결재, 삭제관리, 엑셀 업로드",
        icon: Building2,
        action: () => {
          setActiveTab("secretariat");
          onClose();
        },
      },
      {
        id: "nav-bookings",
        type: "NAV",
        category: "바로가기",
        title: "입건 현황",
        subtitle: "형제 입건 및 수제 번호 대장",
        icon: AlertOctagon,
        action: () => {
          setActiveTab("bookings");
          onClose();
        },
      },
      {
        id: "nav-analytics",
        type: "NAV",
        category: "바로가기",
        title: "통계 현황",
        subtitle: "사건 통계 및 처리율 대시보드",
        icon: BarChart3,
        action: () => {
          setActiveTab("analytics");
          onClose();
        },
      },
    ];

    if (currentUser?.isGlobalAdmin || currentUser?.role === "admin") {
      navs.push({
        id: "nav-auditlog",
        type: "NAV",
        category: "바로가기",
        title: "감사 로그",
        subtitle: "시스템 열람 및 수정 이력 감사",
        icon: ClipboardList,
        action: () => {
          setActiveTab("auditlog");
          onClose();
        },
      });
    }

    return navs;
  }, [currentUser, setActiveTab, onClose]);

  // Action Items
  const actionItems = useMemo(() => {
    return [
      {
        id: "act-intake",
        type: "ACTION",
        category: "빠른 실행",
        title: "신규 사건 접수",
        subtitle: "새로운 형제/수제/내사 사건 등록",
        icon: PlusCircle,
        disabled: isReadOnly,
        action: () => {
          if (!isReadOnly && onOpenIntakeModal) {
            onClose();
            onOpenIntakeModal();
          }
        },
      },
      {
        id: "act-deadline",
        type: "ACTION",
        category: "빠른 실행",
        title: "공소시효 및 기일 알림",
        subtitle: "만료 임박 사건 및 수사 기일 종합 확인",
        icon: Clock,
        action: () => {
          if (onOpenDeadlineModal) {
            onClose();
            onOpenDeadlineModal();
          }
        },
      },
      {
        id: "act-template",
        type: "ACTION",
        category: "빠른 실행",
        title: "공식 서식 복사",
        subtitle: "공소장, 불기소이유서 등 검찰 공식 서식 템플릿",
        icon: FileText,
        action: () => {
          if (onOpenTemplateModal) {
            onClose();
            onOpenTemplateModal();
          }
        },
      },
      {
        id: "act-theme",
        type: "ACTION",
        category: "빠른 실행",
        title: theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환",
        subtitle: "현재 테마: " + (theme === "dark" ? "다크" : "라이트") + " 모드",
        icon: theme === "dark" ? Sun : Moon,
        action: () => {
          if (onToggleTheme) {
            onToggleTheme();
          }
        },
      },
    ];
  }, [isReadOnly, onOpenIntakeModal, onOpenDeadlineModal, onOpenTemplateModal, onToggleTheme, theme, onClose]);

  // Filtered Results
  const filteredResults = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) {
      return [...actionItems, ...navigationItems];
    }

    // 1. Search Cases
    const matchedCases = (ledgerData || [])
      .filter((c) => {
        const caseNo = (c.hyeongjeNo || "") + " " + (c.sujeNo || "") + " " + (c.naesaNo || "");
        const suspect = c.suspectName || "";
        const charge = c.charge || "";
        const prosecutor = c.prosecutorName || "";
        const victim = c.victimName || "";
        const disposition = c.disposition || "";
        return (
          caseNo.toLowerCase().includes(q) ||
          suspect.toLowerCase().includes(q) ||
          charge.toLowerCase().includes(q) ||
          prosecutor.toLowerCase().includes(q) ||
          victim.toLowerCase().includes(q) ||
          disposition.toLowerCase().includes(q)
        );
      })
      .slice(0, 8)
      .map((c) => {
        const displayNo = c.hyeongjeNo || c.sujeNo || c.naesaNo || ("사건 #" + c.id);
        return {
          id: "case-" + c.id,
          type: "CASE",
          category: "사건",
          title: displayNo + " · " + (c.suspectName || "피의자 미상"),
          subtitle: "죄명: " + (c.charge || "미지정") + " | 담당: " + (c.prosecutorName || "미배당") + " | 처분: " + (c.disposition || "수사중"),
          badge: c.disposition || c.bookingStatus || "수사중",
          badgeColor: c.disposition ? "#10b981" : "#3b82f6",
          icon: Scale,
          data: c,
          action: () => {
            onClose();
            if (onOpenTimelineModal) {
              onOpenTimelineModal(c);
            } else {
              setActiveTab("ledger");
            }
          },
        };
      });

    // 2. Search Approvals
    const matchedApprovals = (approvalsData || [])
      .filter((a) => {
        const docNo = a.docNo || "";
        const title = a.title || "";
        const drafter = a.drafterName || "";
        const formName = a.formName || "";
        const status = a.status || "";
        return (
          docNo.toLowerCase().includes(q) ||
          title.toLowerCase().includes(q) ||
          drafter.toLowerCase().includes(q) ||
          formName.toLowerCase().includes(q) ||
          status.toLowerCase().includes(q)
        );
      })
      .slice(0, 5)
      .map((a) => ({
        id: "approval-" + a.id,
        type: "APPROVAL",
        category: "전자결재",
        title: (a.docNo || "문서") + " · " + (a.title || "제목 없음"),
        subtitle: "기안: " + (a.drafterName || "-") + " | 서식: " + (a.formName || "-"),
        badge: a.status || "대기",
        badgeColor:
          a.status === "승인" ? "#10b981" : a.status === "반려" ? "#ef4444" : "#f59e0b",
        icon: FileCheck,
        data: a,
        action: () => {
          onClose();
          setActiveTab("approvals");
        },
      }));

    // 3. Search Warrants
    const matchedWarrants = (warrantsData || [])
      .filter((w) => {
        const warrantNo = w.warrantNo || "";
        const suspect = w.suspectName || "";
        const charge = w.charge || "";
        const type = w.warrantType || w.type || "";
        const status = w.status || "";
        return (
          warrantNo.toLowerCase().includes(q) ||
          suspect.toLowerCase().includes(q) ||
          charge.toLowerCase().includes(q) ||
          type.toLowerCase().includes(q) ||
          status.toLowerCase().includes(q)
        );
      })
      .slice(0, 5)
      .map((w) => ({
        id: "warrant-" + w.id,
        type: "WARRANT",
        category: "영장",
        title: (w.warrantNo || "영장") + " · " + (w.suspectName || "피의자") + " (" + (w.warrantType || w.type || "영장") + ")",
        subtitle: "죄명: " + (w.charge || "-") + " | 상태: " + (w.status || "-"),
        badge: w.status || "청구",
        badgeColor: w.status === "발부" ? "#10b981" : "#f59e0b",
        icon: ShieldAlert,
        data: w,
        action: () => {
          onClose();
          setActiveTab("warrants");
        },
      }));

    // 4. Search Actions & Navigation
    const matchedNavs = navigationItems.filter(
      (n) => n.title.toLowerCase().includes(q) || n.subtitle.toLowerCase().includes(q)
    );
    const matchedActs = actionItems.filter(
      (a) => a.title.toLowerCase().includes(q) || a.subtitle.toLowerCase().includes(q)
    );

    return [
      ...matchedCases,
      ...matchedApprovals,
      ...matchedWarrants,
      ...matchedActs,
      ...matchedNavs,
    ];
  }, [
    query,
    ledgerData,
    approvalsData,
    warrantsData,
    actionItems,
    navigationItems,
    onClose,
    onOpenTimelineModal,
    setActiveTab,
  ]);

  // Adjust selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Handle Keyboard Navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev < filteredResults.length - 1 ? prev + 1 : 0
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) =>
          prev > 0 ? prev - 1 : filteredResults.length - 1
        );
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = filteredResults[selectedIndex];
        if (selected && selected.action) {
          selected.action();
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, filteredResults, selectedIndex, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector(
        '[data-index="' + selectedIndex + '"]'
      );
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(6px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
        zIndex: 9999,
        animation: "fadeIn 0.15s ease-out",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 680,
          background: "var(--bg-card)",
          borderRadius: 14,
          border: "1px solid var(--border-subtle)",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          maxHeight: "75vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header Input */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            background: "var(--bg-elevated)",
          }}
        >
          <Search size={20} color="var(--primary-amber)" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="사건번호, 피의자, 죄명, 결재문서, 메뉴 바로가기 검색... (Ctrl+K)"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-main)",
              fontSize: "1rem",
              fontWeight: 500,
            }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text-muted)",
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
              }}
            >
              <X size={16} />
            </button>
          )}
          <kbd
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 6,
              padding: "3px 7px",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              fontWeight: 600,
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          style={{
            overflowY: "auto",
            padding: "10px 12px",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          {filteredResults.length === 0 ? (
            <div
              style={{
                padding: "36px 20px",
                textAlign: "center",
                color: "var(--text-muted)",
              }}
            >
              <Search size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
              <div style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                {"'" + query + "'에 일치하는 결과가 없습니다"}
              </div>
              <div style={{ fontSize: "0.8rem", marginTop: 4, opacity: 0.7 }}>
                사건번호(형제/수제), 피의자명, 죄명, 결재 문서 제목을 확인해 보세요.
              </div>
            </div>
          ) : (
            filteredResults.map((item, index) => {
              const isSelected = index === selectedIndex;
              const IconComponent = item.icon || FileText;

              return (
                <div
                  key={item.id}
                  data-index={index}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 14px",
                    borderRadius: 10,
                    background: isSelected
                      ? "var(--btn-secondary-hover)"
                      : "transparent",
                    cursor: "pointer",
                    transition: "background 0.1s ease",
                    border: isSelected
                      ? "1px solid var(--border-color)"
                      : "1px solid transparent",
                  }}
                >
                  {/* Category / Type Icon */}
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 8,
                      background: isSelected
                        ? "var(--primary-blue)"
                        : "var(--bg-elevated)",
                      color: isSelected ? "#fff" : "var(--primary-amber)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      transition: "all 0.1s",
                    }}
                  >
                    <IconComponent size={18} />
                  </div>

                  {/* Main Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginBottom: 2,
                      }}
                    >
                      <span
                        style={{
                          fontWeight: isSelected ? 700 : 600,
                          fontSize: "0.9rem",
                          color: "var(--text-main)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.title}
                      </span>
                      {item.badge && (
                        <span
                          style={{
                            fontSize: "0.68rem",
                            padding: "2px 6px",
                            borderRadius: 4,
                            fontWeight: 700,
                            background: item.badgeColor
                              ? item.badgeColor + "22"
                              : "var(--bg-elevated)",
                            color: item.badgeColor || "var(--text-muted)",
                            border: "1px solid " + (item.badgeColor || "var(--border-subtle)") + "55",
                            flexShrink: 0,
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {item.subtitle}
                    </div>
                  </div>

                  {/* Category Tag */}
                  <div
                    style={{
                      fontSize: "0.7rem",
                      color: "var(--text-muted)",
                      padding: "2px 8px",
                      borderRadius: 4,
                      background: "var(--bg-elevated)",
                      border: "1px solid var(--border-subtle)",
                      flexShrink: 0,
                    }}
                  >
                    {item.category}
                  </div>

                  {/* Enter indicator */}
                  {isSelected && (
                    <ArrowRight
                      size={16}
                      color="var(--primary-amber)"
                      style={{ flexShrink: 0 }}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Guide */}
        <div
          style={{
            padding: "10px 20px",
            borderTop: "1px solid var(--border-subtle)",
            background: "var(--bg-elevated)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.72rem",
            color: "var(--text-muted)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <span>
              <kbd style={{ background: "var(--bg-card)", padding: "1px 4px", borderRadius: 4, border: "1px solid var(--border-subtle)" }}>↑</kbd>
              <kbd style={{ background: "var(--bg-card)", padding: "1px 4px", borderRadius: 4, border: "1px solid var(--border-subtle)", marginLeft: 2 }}>↓</kbd> 이동
            </span>
            <span>
              <kbd style={{ background: "var(--bg-card)", padding: "1px 4px", borderRadius: 4, border: "1px solid var(--border-subtle)" }}>↵</kbd> 선택/이동
            </span>
            <span>
              <kbd style={{ background: "var(--bg-card)", padding: "1px 4px", borderRadius: 4, border: "1px solid var(--border-subtle)" }}>ESC</kbd> 닫기
            </span>
          </div>
          <div>
            <span>Dose-PROS 통합 퀵 서치</span>
          </div>
        </div>
      </div>
    </div>
  );
}
