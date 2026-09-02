import React, { useState, useMemo, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Clock,
  User,
  MapPin,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  AlertCircle,
  MoreHorizontal,
  Edit2,
  Trash2,
  Search,
  Scale,
} from "lucide-react";
import {
  calculateStatuteOfLimitations,
  isCaseClosedOrIndicted,
} from "../data/prosecutionData";
import {
  createScheduleApi,
  updateScheduleApi,
  deleteScheduleApi,
} from "../services/api";

const STATUS_CONFIG = {
  SCHEDULED: { label: "예정", bg: "rgba(59,130,246,0.15)", color: "#60a5fa" },
  ATTENDED: { label: "출석완료", bg: "rgba(52,211,153,0.15)", color: "#34d399" },
  NO_SHOW: { label: "불출석", bg: "rgba(239,68,68,0.15)", color: "#f87171" },
  POSTPONED: { label: "연기", bg: "rgba(245,158,11,0.15)", color: "#fbbf24" },
  CANCELLED: { label: "취소", bg: "rgba(148,163,184,0.15)", color: "#94a3b8" },
};

function formatLocalYmd(d) {
  if (!d || isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** 날짜 문자열 정규화 (YYYY-MM-DD) */
function normalizeYmd(str) {
  if (!str) return "";
  const cleaned = String(str).trim().replace(/\./g, "-");
  const datePart = cleaned.split(/[ T]/)[0];
  const parts = datePart.split("-");
  if (parts.length === 3) {
    const y = parts[0];
    const m = String(parts[1]).padStart(2, "0");
    const d = String(parts[2]).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return datePart.slice(0, 10);
}

/** 시간 문자열 추출 (HH:mm) */
function extractTimeStr(str) {
  if (!str) return "";
  const s = String(str).trim();
  if (s.includes("T")) return s.split("T")[1]?.slice(0, 5) || "";
  if (s.includes(" ")) return s.split(" ")[1]?.slice(0, 5) || "";
  return "";
}

export default function InvestigationCalendar({
  schedules = [],
  ledgerData = [],
  currentUser,
  showToast,
  onOpenSummonsModal,
  onSchedulesUpdated,
  onNavigateToCase,
}) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("MONTH"); // MONTH | LIST
  const [selectedCategory, setSelectedCategory] = useState("ALL"); // ALL | SCHEDULE | STATUTE | ARREST
  const [myOnly, setMyOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // 모달 상태
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [selectedDayEvents, setSelectedDayEvents] = useState(null); // 날짜 클릭 시 팝업

  // 신규 등록 폼 상태
  const [formData, setFormData] = useState({
    caseId: "",
    hyeongjeNo: "",
    targetType: "SUSPECT",
    targetName: "",
    targetContact: "",
    scheduledAt: "",
    location: "검찰청 제1검사실",
    investigatorId: currentUser?.id || "",
    investigatorName: currentUser?.name || "",
    purpose: "피고사건에 관한 피의자 신문",
    notes: "",
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 이전/다음 월 이동
  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const handleToday = () => setCurrentDate(new Date());

  // 1. 공소시효 만료일 이벤트 계산
  const statuteEvents = useMemo(() => {
    const list = [];
    ledgerData.forEach((c) => {
      if (isCaseClosedOrIndicted(c)) return;

      const sol = calculateStatuteOfLimitations(
        c.chargeName,
        c.incidentDate || c.bookingDate,
      );
      if (sol.periodDays === Infinity || (!sol.expireDateIso && !sol.expireDateStr)) return;

      const eventDateStr =
        sol.expireDateIso ||
        (sol.expireDateStr ? sol.expireDateStr.slice(0, 10).replace(/\./g, "-") : "");

      const isMyCase =
        c.prosecutorId === currentUser?.id ||
        c.prosecutorName === currentUser?.name;

      list.push({
        id: `STATUTE-${c.id}`,
        type: "STATUTE",
        dateStr: eventDateStr,
        title: `[공소시효 만료] ${c.sujeNo || c.hyeongjeNo}`,
        subtitle: `${c.suspectName || "-"} · ${c.chargeName || "-"}`,
        dDay: sol.dDay,
        dDayText: sol.dDayText,
        lawArticle: sol.lawArticle,
        urgency: sol.dDay <= 3 ? "CRITICAL" : sol.dDay <= 7 ? "WARNING" : "NORMAL",
        caseItem: c,
        isMyCase,
      });
    });
    return list;
  }, [ledgerData, currentUser]);

  // 2. 구속 48시간 만료 이벤트 계산
  const arrestEvents = useMemo(() => {
    const list = [];
    const now = new Date();
    ledgerData.forEach((c) => {
      if (isCaseClosedOrIndicted(c)) return;

      const statusStr = (c.bookingStatus || "").trim();
      const isArrested =
        (statusStr.includes("구속") &&
          !statusStr.includes("불구속") &&
          !statusStr.includes("미구속")) ||
        statusStr.includes("체포영장") ||
        statusStr.includes("구속영장");

      if (!isArrested) return;

      const baseDate = c.bookingDate
        ? new Date(c.bookingDate.replace(/\./g, "-"))
        : now;
      const expireDate = new Date(baseDate.getTime() + 48 * 60 * 60 * 1000);
      const expireDateStr = formatLocalYmd(expireDate);
      const diffHours = Math.ceil((expireDate - now) / (1000 * 60 * 60));

      const isMyCase =
        c.prosecutorId === currentUser?.id ||
        c.prosecutorName === currentUser?.name;

      list.push({
        id: `ARREST-${c.id}`,
        type: "ARREST",
        dateStr: expireDateStr,
        title: `[🚨 구속 48h] ${c.sujeNo || c.hyeongjeNo}`,
        subtitle: `${c.suspectName} (잔여 ${diffHours}시간)`,
        diffHours,
        caseItem: c,
        isMyCase,
      });
    });
    return list;
  }, [ledgerData, currentUser]);

  // 마운트 시 최신 조사 일정 자동 조회
  useEffect(() => {
    onSchedulesUpdated?.();
  }, []);

  // 3. 조사 및 공판 일정 이벤트 변환
  const scheduleEvents = useMemo(() => {
    return schedules.map((s) => {
      const dateStr = s.scheduledAt ? normalizeYmd(s.scheduledAt) : "";
      const timeStr = s.scheduledAt ? extractTimeStr(s.scheduledAt) : "";
      const isMySchedule =
        s.investigatorId === currentUser?.id ||
        s.investigatorName === currentUser?.name ||
        s.createdBy === currentUser?.name;

      const targetLabel =
        s.targetType === "SUSPECT"
          ? "피의자"
          : s.targetType === "TRIAL"
          ? "공판"
          : "참고인";

      return {
        id: `SCH-${s.id}`,
        type: "SCHEDULE",
        dateStr,
        timeStr,
        title: `[${targetLabel}] ${s.targetName}`,
        subtitle: `${s.hyeongjeNo ? s.hyeongjeNo + " · " : ""}${s.location}`,
        schedule: s,
        isMySchedule,
      };
    });
  }, [schedules, currentUser]);

  // 필터 적용된 전체 이벤트 목록
  const allEvents = useMemo(() => {
    let list = [];
    if (selectedCategory === "ALL") {
      list.push(...scheduleEvents, ...statuteEvents, ...arrestEvents);
    } else if (selectedCategory === "SCHEDULE") {
      list.push(...scheduleEvents.filter((e) => e.schedule.targetType !== "TRIAL"));
    } else if (selectedCategory === "TRIAL") {
      list.push(...scheduleEvents.filter((e) => e.schedule.targetType === "TRIAL"));
    } else if (selectedCategory === "STATUTE") {
      list.push(...statuteEvents);
    } else if (selectedCategory === "ARREST") {
      list.push(...arrestEvents);
    }

    if (myOnly) {
      list = list.filter((e) => e.isMySchedule || e.isMyCase);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.title.toLowerCase().includes(q) ||
          e.subtitle?.toLowerCase().includes(q),
      );
    }

    return list;
  }, [scheduleEvents, statuteEvents, arrestEvents, selectedCategory, myOnly, searchQuery]);

  // 날짜별 이벤트 매핑
  const eventsByDate = useMemo(() => {
    const map = new Map();
    allEvents.forEach((e) => {
      if (!e.dateStr) return;
      if (!map.has(e.dateStr)) map.set(e.dateStr, []);
      map.get(e.dateStr).push(e);
    });
    return map;
  }, [allEvents]);

  // 캘린더 그리드 날짜 계산 (일~토 6주)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay(); // 0 = 일요일
    const totalDays = lastDay.getDate();

    const days = [];
    // 이전 달 일자
    const prevLastDay = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      const d = prevLastDay - i;
      const prevDate = new Date(year, month - 1, d);
      days.push({
        date: prevDate,
        dateStr: formatLocalYmd(prevDate),
        dayNum: d,
        isCurrentMonth: false,
      });
    }

    // 현재 달 일자
    for (let d = 1; d <= totalDays; d++) {
      const thisDate = new Date(year, month, d);
      days.push({
        date: thisDate,
        dateStr: formatLocalYmd(thisDate),
        dayNum: d,
        isCurrentMonth: true,
      });
    }

    // 다음 달 일자 (42칸 맞춤)
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      days.push({
        date: nextDate,
        dateStr: formatLocalYmd(nextDate),
        dayNum: d,
        isCurrentMonth: false,
      });
    }

    return days;
  }, [year, month]);

  // 사건 선택 시 폼 자동완성
  const handleSelectCase = (caseId) => {
    const found = ledgerData.find((c) => String(c.id) === String(caseId));
    if (found) {
      setFormData((prev) => ({
        ...prev,
        caseId: found.id,
        hyeongjeNo: found.sujeNo || found.hyeongjeNo || "",
        targetName: found.suspectName || "",
        purpose: `${found.chargeName || "피고사건"} 관련 피의자 신문 조사`,
      }));
    }
  };

  // 일정 등록 핸들러
  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    if (!formData.targetName || !formData.scheduledAt) {
      showToast?.("대상자 성명과 조사 일시를 입력해주세요.", "error");
      return;
    }

    try {
      if (editingSchedule) {
        const res = await updateScheduleApi(editingSchedule.id, formData);
        if (res?.success) {
          showToast?.("조사 일정이 수정되었습니다.", "success");
          if (onSchedulesUpdated) onSchedulesUpdated();
          setIsAddModalOpen(false);
          setEditingSchedule(null);
        } else {
          showToast?.(res?.message || "수정 실패", "error");
        }
      } else {
        const res = await createScheduleApi(formData);
        if (res?.success) {
          showToast?.("신규 조사 일정이 등록되었습니다.", "success");
          if (onSchedulesUpdated) onSchedulesUpdated();
          setIsAddModalOpen(false);
        } else {
          showToast?.(res?.message || "등록 실패", "error");
        }
      }
    } catch (err) {
      showToast?.("오류: " + err.message, "error");
    }
  };

  // 일정 상태 변경 핸들러
  const handleChangeStatus = async (scheduleId, newStatus) => {
    try {
      const res = await updateScheduleApi(scheduleId, { status: newStatus });
      if (res?.success) {
        showToast?.(`조사 상태가 [${STATUS_CONFIG[newStatus]?.label}]로 변경되었습니다.`, "success");
        if (onSchedulesUpdated) onSchedulesUpdated();
      }
    } catch (err) {
      showToast?.("상태 변경 실패: " + err.message, "error");
    }
  };

  // 일정 삭제
  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm("해당 조사 일정을 정말 삭제하시겠습니까?")) return;
    try {
      const res = await deleteScheduleApi(scheduleId);
      if (res?.success) {
        showToast?.("조사 일정이 삭제되었습니다.", "success");
        if (onSchedulesUpdated) onSchedulesUpdated();
        setSelectedDayEvents((prev) => {
          if (!prev) return null;
          const remaining = prev.events.filter((e) => e.schedule?.id !== scheduleId);
          return remaining.length > 0 ? { ...prev, events: remaining } : null;
        });
      } else {
        showToast?.(res?.message || "삭제 실패", "error");
      }
    } catch (err) {
      showToast?.("삭제 실패: " + err.message, "error");
    }
  };

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%" }}>
      {/* ── 컨트롤 바 ── */}
      <div
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: 12,
          padding: "12px 18px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        {/* 월 이동 네비게이션 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={handlePrevMonth}
            className="btn btn-outline"
            style={{ padding: "6px 10px" }}
            title="이전 달"
          >
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: "1.1rem", fontWeight: 900, minWidth: 140, textAlign: "center", color: "var(--text-main)" }}>
            {year}년 {month + 1}월
          </span>
          <button
            onClick={handleNextMonth}
            className="btn btn-outline"
            style={{ padding: "6px 10px" }}
            title="다음 달"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={handleToday}
            className="btn btn-outline"
            style={{ fontSize: "0.78rem", padding: "6px 12px", marginLeft: 4 }}
          >
            오늘
          </button>
        </div>

        {/* 필터 카테고리 버튼들 */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "ALL", label: "전체" },
            { id: "SCHEDULE", label: "📅 조사·신문", color: "#60a5fa" },
            { id: "TRIAL", label: "⚖️ 공판일정", color: "#c084fc" },
            { id: "STATUTE", label: "⏳ 공소시효 만료", color: "var(--primary-amber)" },
            { id: "ARREST", label: "🚨 구속 48h", color: "#ef4444" },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              style={{
                fontSize: "0.76rem",
                padding: "6px 12px",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 700,
                border: selectedCategory === cat.id ? "none" : "1px solid var(--border-subtle)",
                background: selectedCategory === cat.id ? "var(--primary-amber)" : "var(--bg-elevated)",
                color: selectedCategory === cat.id ? "#000" : "var(--text-muted)",
              }}
            >
              {cat.label}
            </button>
          ))}

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              fontSize: "0.76rem",
              color: "var(--text-muted)",
              cursor: "pointer",
              marginLeft: 8,
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={myOnly}
              onChange={(e) => setMyOnly(e.target.checked)}
              style={{ cursor: "pointer" }}
            />
            내 담당만 보기
          </label>
        </div>

        {/* 우측 검색 & 등록 버튼 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ position: "relative" }}>
            <Search
              size={13}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }}
            />
            <input
              className="input-field"
              placeholder="일정/사건 검색..."
              style={{ paddingLeft: 28, fontSize: "0.76rem", width: 150 }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: "flex", background: "var(--bg-elevated)", borderRadius: 8, padding: 2 }}>
            <button
              onClick={() => setViewMode("MONTH")}
              style={{
                padding: "6px 12px",
                fontSize: "0.75rem",
                borderRadius: 6,
                border: "none",
                fontWeight: 700,
                cursor: "pointer",
                background: viewMode === "MONTH" ? "rgba(255,255,255,0.12)" : "transparent",
                color: viewMode === "MONTH" ? "var(--text-main)" : "var(--text-muted)",
              }}
            >
              달력
            </button>
            <button
              onClick={() => setViewMode("LIST")}
              style={{
                padding: "6px 12px",
                fontSize: "0.75rem",
                borderRadius: 6,
                border: "none",
                fontWeight: 700,
                cursor: "pointer",
                background: viewMode === "LIST" ? "rgba(255,255,255,0.12)" : "transparent",
                color: viewMode === "LIST" ? "var(--text-main)" : "var(--text-muted)",
              }}
            >
              목록
            </button>
          </div>

          <button
            onClick={() => {
              setEditingSchedule(null);
              setFormData({
                caseId: "",
                hyeongjeNo: "",
                targetType: "SUSPECT",
                targetName: "",
                targetContact: "",
                scheduledAt: `${todayStr}T14:00`,
                location: "검찰청 제1검사실",
                investigatorId: currentUser?.id || "",
                investigatorName: currentUser?.name || "",
                purpose: "피고사건에 관한 피의자 신문",
                notes: "",
              });
              setIsAddModalOpen(true);
            }}
            className="btn btn-gold"
            style={{ fontSize: "0.78rem", padding: "6px 14px", gap: 5 }}
          >
            <Plus size={14} /> 조사 일정 등록
          </button>
        </div>
      </div>

      {/* ── 월간 캘린더 그리드 뷰 ── */}
      {viewMode === "MONTH" && (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            overflow: "hidden",
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* 요일 헤더 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              background: "var(--bg-elevated)",
              borderBottom: "1px solid var(--border-subtle)",
              textAlign: "center",
              fontWeight: 800,
              fontSize: "0.78rem",
            }}
          >
            {["일", "월", "화", "수", "목", "금", "토"].map((day, idx) => (
              <div
                key={day}
                style={{
                  padding: "10px 0",
                  color: idx === 0 ? "#f87171" : idx === 6 ? "#60a5fa" : "var(--text-muted)",
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* 달력 날짜 칸 */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(7, 1fr)",
              gridTemplateRows: "repeat(6, 1fr)",
              flex: 1,
              background: "rgba(0,0,0,0.1)",
            }}
          >
            {calendarDays.map((d, idx) => {
              const dayEvents = eventsByDate.get(d.dateStr) || [];
              const isToday = d.dateStr === todayStr;

              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (dayEvents.length > 0) {
                      setSelectedDayEvents({ dateStr: d.dateStr, events: dayEvents });
                    }
                  }}
                  style={{
                    borderRight: "1px solid var(--border-subtle)",
                    borderBottom: "1px solid var(--border-subtle)",
                    padding: "6px 8px",
                    minHeight: 90,
                    display: "flex",
                    flexDirection: "column",
                    background: isToday
                      ? "rgba(245,158,11,0.06)"
                      : d.isCurrentMonth
                        ? "transparent"
                        : "rgba(0,0,0,0.25)",
                    opacity: d.isCurrentMonth ? 1 : 0.45,
                    cursor: dayEvents.length > 0 ? "pointer" : "default",
                    transition: "background 0.1s",
                  }}
                  onMouseEnter={(e) => {
                    if (dayEvents.length > 0) e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isToday
                      ? "rgba(245,158,11,0.06)"
                      : d.isCurrentMonth
                        ? "transparent"
                        : "rgba(0,0,0,0.25)";
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.78rem",
                        fontWeight: isToday ? 900 : 600,
                        color: isToday
                          ? "#000"
                          : idx % 7 === 0
                            ? "#f87171"
                            : idx % 7 === 6
                              ? "#60a5fa"
                              : "var(--text-main)",
                        background: isToday ? "var(--primary-amber)" : "transparent",
                        width: isToday ? 22 : "auto",
                        height: isToday ? 22 : "auto",
                        borderRadius: "50%",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {d.dayNum}
                    </span>
                    {dayEvents.length > 0 && (
                      <span
                        style={{
                          fontSize: "0.65rem",
                          fontWeight: 800,
                          color: "var(--primary-amber)",
                          background: "rgba(245,158,11,0.15)",
                          padding: "1px 5px",
                          borderRadius: 6,
                        }}
                      >
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  {/* 날짜 내부 이벤트 칩 */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 3, overflow: "hidden" }}>
                    {dayEvents.slice(0, 3).map((e) => {
                      if (e.type === "SCHEDULE") {
                        const isTrial = e.schedule.targetType === "TRIAL";
                        const st = STATUS_CONFIG[e.schedule.status] || STATUS_CONFIG.SCHEDULED;
                        return (
                          <div
                            key={e.id}
                            style={{
                              fontSize: "0.68rem",
                              padding: "2px 5px",
                              borderRadius: 4,
                              background: isTrial ? "rgba(168,85,247,0.25)" : st.bg,
                              color: isTrial ? "#e9d5ff" : st.color,
                              fontWeight: 700,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              display: "flex",
                              alignItems: "center",
                              gap: 3,
                            }}
                          >
                            <span>{isTrial ? "⚖️" : "🕒"} {e.timeStr}</span> {e.title}
                          </div>
                        );
                      }

                      if (e.type === "STATUTE") {
                        const isCrit = e.urgency === "CRITICAL";
                        return (
                          <div
                            key={e.id}
                            style={{
                              fontSize: "0.68rem",
                              padding: "2px 5px",
                              borderRadius: 4,
                              background: isCrit ? "rgba(239,68,68,0.2)" : "rgba(245,158,11,0.18)",
                              color: isCrit ? "#f87171" : "var(--primary-amber)",
                              fontWeight: 800,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            ⏳ 시효 {e.dDayText} | {e.caseItem?.suspectName}
                          </div>
                        );
                      }

                      if (e.type === "ARREST") {
                        return (
                          <div
                            key={e.id}
                            style={{
                              fontSize: "0.68rem",
                              padding: "2px 5px",
                              borderRadius: 4,
                              background: "rgba(239,68,68,0.25)",
                              color: "#fca5a5",
                              fontWeight: 800,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            🚨 구속만기 {e.caseItem?.suspectName}
                          </div>
                        );
                      }

                      return null;
                    })}

                    {dayEvents.length > 3 && (
                      <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", textAlign: "right" }}>
                        +{dayEvents.length - 3}건 더보기
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 목록 뷰 (LIST VIEW) ── */}
      {viewMode === "LIST" && (
        <div
          style={{
            background: "var(--bg-card)",
            border: "1px solid var(--border-subtle)",
            borderRadius: 12,
            overflow: "hidden",
            flex: 1,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div style={{ overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {allEvents.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)", fontSize: "0.85rem" }}>
                해당 조건의 일정이나 시효 기한이 없습니다.
              </div>
            ) : (
              allEvents
                .sort((a, b) => (a.dateStr || "").localeCompare(b.dateStr || ""))
                .map((e) => {
                  if (e.type === "SCHEDULE") {
                    const st = STATUS_CONFIG[e.schedule.status] || STATUS_CONFIG.SCHEDULED;
                    return (
                      <div
                        key={e.id}
                        style={{
                          background: "var(--bg-elevated)",
                          border: "1px solid var(--border-subtle)",
                          borderRadius: 10,
                          padding: "12px 16px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 16,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div
                            style={{
                              background: st.bg,
                              color: st.color,
                              padding: "6px 12px",
                              borderRadius: 8,
                              fontWeight: 800,
                              fontSize: "0.78rem",
                              minWidth: 70,
                              textAlign: "center",
                            }}
                          >
                            {st.label}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "var(--text-main)" }}>
                              {e.title}
                            </div>
                            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 2 }}>
                              📅 {e.dateStr} {e.timeStr} · 📍 {e.schedule.location} · 👤 수사관: {e.schedule.investigatorName}
                            </div>
                            {e.schedule.purpose && (
                              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: 2 }}>
                                📝 목적: {e.schedule.purpose}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {/* 소환장 발급 버튼 */}
                          <button
                            onClick={() => {
                              const relatedCase = ledgerData.find((c) => String(c.id) === String(e.schedule.caseId));
                              onOpenSummonsModal?.(e.schedule, relatedCase);
                            }}
                            className="btn btn-outline"
                            style={{ fontSize: "0.75rem", padding: "5px 12px", gap: 4, color: "#60a5fa" }}
                          >
                            <FileText size={13} /> 소환장 발급
                          </button>

                          {/* 상태 변경 셀렉트 */}
                          <select
                            className="select-field"
                            value={e.schedule.status}
                            onChange={(ev) => handleChangeStatus(e.schedule.id, ev.target.value)}
                            style={{ fontSize: "0.74rem", padding: "4px 8px" }}
                          >
                            <option value="SCHEDULED">예정</option>
                            <option value="ATTENDED">출석완료</option>
                            <option value="NO_SHOW">불출석</option>
                            <option value="POSTPONED">연기</option>
                            <option value="CANCELLED">취소</option>
                          </select>

                          {/* 수정 / 삭제 */}
                          <button
                            onClick={() => {
                              setEditingSchedule(e.schedule);
                              setFormData({
                                caseId: e.schedule.caseId || "",
                                hyeongjeNo: e.schedule.hyeongjeNo || "",
                                targetType: e.schedule.targetType || "SUSPECT",
                                targetName: e.schedule.targetName || "",
                                targetContact: e.schedule.targetContact || "",
                                scheduledAt: e.schedule.scheduledAt || "",
                                location: e.schedule.location || "",
                                investigatorId: e.schedule.investigatorId || "",
                                investigatorName: e.schedule.investigatorName || "",
                                purpose: e.schedule.purpose || "",
                                notes: e.schedule.notes || "",
                              });
                              setIsAddModalOpen(true);
                            }}
                            className="btn btn-outline"
                            style={{ padding: 6 }}
                            title="수정"
                          >
                            <Edit2 size={13} />
                          </button>

                          <button
                            onClick={() => handleDeleteSchedule(e.schedule.id)}
                            className="btn btn-outline"
                            style={{ padding: 6, color: "#f87171" }}
                            title="삭제"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  }

                  if (e.type === "STATUTE") {
                    return (
                      <div
                        key={e.id}
                        style={{
                          background: "rgba(245,158,11,0.06)",
                          border: "1px solid rgba(245,158,11,0.3)",
                          borderRadius: 10,
                          padding: "12px 16px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div
                            style={{
                              background: "var(--primary-amber)",
                              color: "#000",
                              padding: "6px 12px",
                              borderRadius: 8,
                              fontWeight: 900,
                              fontSize: "0.78rem",
                              minWidth: 70,
                              textAlign: "center",
                            }}
                          >
                            {e.dDayText}
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "var(--text-main)" }}>
                              {e.title}
                            </div>
                            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 2 }}>
                              피의자: {e.subtitle} · 만료예정일: {e.dateStr} · {e.lawArticle}
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => onNavigateToCase?.(e.caseItem)}
                          className="btn btn-gold"
                          style={{ fontSize: "0.75rem", padding: "5px 12px" }}
                        >
                          사건 열람 →
                        </button>
                      </div>
                    );
                  }

                  if (e.type === "ARREST") {
                    return (
                      <div
                        key={e.id}
                        style={{
                          background: "rgba(239,68,68,0.08)",
                          border: "1px solid rgba(239,68,68,0.3)",
                          borderRadius: 10,
                          padding: "12px 16px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                          <div
                            style={{
                              background: "#ef4444",
                              color: "#fff",
                              padding: "6px 12px",
                              borderRadius: 8,
                              fontWeight: 900,
                              fontSize: "0.78rem",
                              minWidth: 70,
                              textAlign: "center",
                            }}
                          >
                            구속 48h
                          </div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: "0.88rem", color: "#fca5a5" }}>
                              {e.title}
                            </div>
                            <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 2 }}>
                              피의자: {e.subtitle} · 만기일시: {e.dateStr} (소송법 제14조)
                            </div>
                          </div>
                        </div>

                        <button
                          onClick={() => onNavigateToCase?.(e.caseItem)}
                          className="btn btn-outline"
                          style={{ fontSize: "0.75rem", padding: "5px 12px", color: "#f87171" }}
                        >
                          기소/석방 처리 →
                        </button>
                      </div>
                    );
                  }

                  return null;
                })
            )}
          </div>
        </div>
      )}

      {/* ── 특정 일자 이벤트 팝업 모달 ── */}
      {selectedDayEvents && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 14,
              width: "100%",
              maxWidth: 580,
              maxHeight: "80vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--bg-elevated)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CalendarIcon size={16} color="var(--primary-amber)" />
                <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-main)" }}>
                  {selectedDayEvents.dateStr} 일정 및 기한
                </span>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                  ({selectedDayEvents.events.length}건)
                </span>
              </div>
              <button
                onClick={() => setSelectedDayEvents(null)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <XCircle size={18} />
              </button>
            </div>

            <div style={{ padding: 16, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
              {selectedDayEvents.events.map((e) => {
                if (e.type === "SCHEDULE") {
                  const st = STATUS_CONFIG[e.schedule.status] || STATUS_CONFIG.SCHEDULED;
                  return (
                    <div
                      key={e.id}
                      style={{
                        padding: 14,
                        borderRadius: 10,
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-subtle)",
                        display: "flex",
                        flexDirection: "column",
                        gap: 8,
                      }}
                    >
                      {/* 카드 상단: 상태 배지 + 제목 + 액션 버튼들 */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span
                            style={{
                              background: st.bg,
                              color: st.color,
                              padding: "3px 8px",
                              borderRadius: 6,
                              fontSize: "0.72rem",
                              fontWeight: 800,
                            }}
                          >
                            {st.label}
                          </span>
                          <span style={{ fontWeight: 800, fontSize: "0.9rem", color: "var(--text-main)" }}>
                            {e.title}
                          </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          {/* 소환장 발급 */}
                          <button
                            onClick={() => {
                              const relatedCase = ledgerData.find((c) => String(c.id) === String(e.schedule.caseId));
                              onOpenSummonsModal?.(e.schedule, relatedCase);
                            }}
                            className="btn btn-outline"
                            style={{ fontSize: "0.72rem", padding: "4px 8px", color: "#60a5fa" }}
                            title="출석요구서(소환장) 서식 생성"
                          >
                            <FileText size={13} /> 소환장
                          </button>

                          {/* 일정 수정 */}
                          <button
                            onClick={() => {
                              setSelectedDayEvents(null);
                              setEditingSchedule(e.schedule);
                              setFormData({
                                caseId: e.schedule.caseId || "",
                                hyeongjeNo: e.schedule.hyeongjeNo || "",
                                targetType: e.schedule.targetType || "SUSPECT",
                                targetName: e.schedule.targetName || "",
                                targetContact: e.schedule.targetContact || "",
                                scheduledAt: e.schedule.scheduledAt || "",
                                location: e.schedule.location || "",
                                investigatorId: e.schedule.investigatorId || "",
                                investigatorName: e.schedule.investigatorName || "",
                                purpose: e.schedule.purpose || "",
                                notes: e.schedule.notes || "",
                              });
                              setIsAddModalOpen(true);
                            }}
                            className="btn btn-outline"
                            style={{ padding: "4px 8px" }}
                            title="일정 수정"
                          >
                            <Edit2 size={13} />
                          </button>

                          {/* 일정 삭제 */}
                          <button
                            onClick={() => handleDeleteSchedule(e.schedule.id)}
                            className="btn btn-outline"
                            style={{ padding: "4px 8px", color: "#f87171", borderColor: "rgba(239,68,68,0.3)" }}
                            title="일정 삭제"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {/* 세부 정보 */}
                      <div style={{ fontSize: "0.76rem", color: "var(--text-muted)", display: "flex", flexDirection: "column", gap: 3 }}>
                        <div>📅 일시: <strong>{e.dateStr} {e.timeStr}</strong> · 📍 장소: <strong>{e.schedule.location}</strong></div>
                        <div>👤 담당수사관: {e.schedule.investigatorName} {e.schedule.targetContact ? `(연락처: ${e.schedule.targetContact})` : ""}</div>
                        {e.schedule.purpose && <div>📝 목적: {e.schedule.purpose}</div>}
                        {e.schedule.notes && <div>📌 메모: {e.schedule.notes}</div>}
                      </div>

                      {/* 상태 조절 셀렉트 */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4, paddingTop: 6, borderTop: "1px dashed var(--border-subtle)" }}>
                        <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 700 }}>조사 상태 변경:</span>
                        <select
                          className="select-field"
                          value={e.schedule.status}
                          onChange={(ev) => handleChangeStatus(e.schedule.id, ev.target.value)}
                          style={{ fontSize: "0.74rem", padding: "3px 8px", background: "var(--bg-elevated)" }}
                        >
                          <option value="SCHEDULED">예정</option>
                          <option value="ATTENDED">출석완료</option>
                          <option value="NO_SHOW">불출석</option>
                          <option value="POSTPONED">연기</option>
                          <option value="CANCELLED">취소</option>
                        </select>
                      </div>
                    </div>
                  );
                }

                if (e.type === "STATUTE") {
                  return (
                    <div
                      key={e.id}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: "rgba(245,158,11,0.06)",
                        border: "1px solid rgba(245,158,11,0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "var(--text-main)" }}>
                          {e.title}
                        </div>
                        <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 2 }}>
                          {e.subtitle} · 만료예정일: {e.dateStr}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedDayEvents(null);
                          onNavigateToCase?.(e.caseItem);
                        }}
                        className="btn btn-gold"
                        style={{ fontSize: "0.72rem", padding: "4px 10px" }}
                      >
                        사건 열람 →
                      </button>
                    </div>
                  );
                }

                if (e.type === "ARREST") {
                  return (
                    <div
                      key={e.id}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: "rgba(239,68,68,0.08)",
                        border: "1px solid rgba(239,68,68,0.3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: "0.85rem", color: "#fca5a5" }}>
                          {e.title}
                        </div>
                        <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: 2 }}>
                          {e.subtitle}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedDayEvents(null);
                          onNavigateToCase?.(e.caseItem);
                        }}
                        className="btn btn-outline"
                        style={{ fontSize: "0.72rem", padding: "4px 10px", color: "#f87171" }}
                      >
                        사건 처리 →
                      </button>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── 조사 일정 등록 / 수정 모달 ── */}
      {isAddModalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10001,
            padding: 16,
          }}
        >
          <form
            onSubmit={handleSaveSchedule}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              borderRadius: 14,
              width: "100%",
              maxWidth: 540,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 24px 70px rgba(0,0,0,0.7)",
            }}
          >
            <div
              style={{
                padding: "14px 18px",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "var(--bg-elevated)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <CalendarIcon size={18} color="var(--primary-amber)" />
                <span style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text-main)" }}>
                  {editingSchedule ? "조사·신문 일정 수정" : "신규 조사·신문 일정 등록"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
              >
                <XCircle size={18} />
              </button>
            </div>

            <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
              {/* 사건 연동 선택 */}
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  사건 선택 (자동 채우기)
                </label>
                <select
                  className="select-field"
                  style={{ width: "100%", fontSize: "0.78rem" }}
                  value={formData.caseId}
                  onChange={(e) => handleSelectCase(e.target.value)}
                >
                  <option value="">사건 미선택 (직접 입력)</option>
                  {ledgerData.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.sujeNo || c.hyeongjeNo} · {c.suspectName} · {c.chargeName}
                    </option>
                  ))}
                </select>
              </div>

              {/* 대상 구분 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    대상자 구분
                  </label>
                  <select
                    className="select-field"
                    style={{ width: "100%", fontSize: "0.78rem" }}
                    value={formData.targetType}
                    onChange={(e) => {
                      const val = e.target.value;
                      let loc = formData.location;
                      let pur = formData.purpose;
                      if (val === "TRIAL") {
                        if (!formData.location || formData.location === "검찰청 제1검사실") {
                          loc = "도스온라인 지방법원 형사단독 법정";
                        }
                        if (!formData.purpose || formData.purpose.includes("신문")) {
                          pur = "제1회 공판기일 (공판 진행 및 증인신문)";
                        }
                      }
                      setFormData({ ...formData, targetType: val, location: loc, purpose: pur });
                    }}
                  >
                    <option value="SUSPECT">🚨 피의자 (조사)</option>
                    <option value="WITNESS">👤 참고인 (조사)</option>
                    <option value="TRIAL">⚖️ 공판 (재판/기일)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    대상자 성명 *
                  </label>
                  <input
                    className="input-field"
                    style={{ width: "100%", fontSize: "0.78rem" }}
                    required
                    value={formData.targetName}
                    onChange={(e) => setFormData({ ...formData, targetName: e.target.value })}
                  />
                </div>
              </div>

              {/* 일시 & 장소 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    조사 일시 *
                  </label>
                  <input
                    type="datetime-local"
                    className="input-field"
                    style={{ width: "100%", fontSize: "0.78rem" }}
                    required
                    value={formData.scheduledAt ? formData.scheduledAt.replace(" ", "T").slice(0, 16) : ""}
                    onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    조사 장소
                  </label>
                  <input
                    className="input-field"
                    style={{ width: "100%", fontSize: "0.78rem" }}
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  />
                </div>
              </div>

              {/* 담당 수사관 */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    담당 검사/수사관
                  </label>
                  <input
                    className="input-field"
                    style={{ width: "100%", fontSize: "0.78rem" }}
                    value={formData.investigatorName}
                    onChange={(e) => setFormData({ ...formData, investigatorName: e.target.value })}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                    연락처 / 디스코드
                  </label>
                  <input
                    className="input-field"
                    style={{ width: "100%", fontSize: "0.78rem" }}
                    placeholder="선택 사항"
                    value={formData.targetContact}
                    onChange={(e) => setFormData({ ...formData, targetContact: e.target.value })}
                  />
                </div>
              </div>

              {/* 목적 */}
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  조사 목적
                </label>
                <input
                  className="input-field"
                  style={{ width: "100%", fontSize: "0.78rem" }}
                  value={formData.purpose}
                  onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
                />
              </div>

              {/* 메모 */}
              <div>
                <label style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", display: "block", marginBottom: 4 }}>
                  수사관 메모
                </label>
                <textarea
                  className="input-field"
                  style={{ width: "100%", minHeight: 50, fontSize: "0.78rem" }}
                  placeholder="조사 준비사항, 쟁점 메모 등"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                />
              </div>
            </div>

            <div
              style={{
                padding: "12px 18px",
                borderTop: "1px solid var(--border-subtle)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
                background: "var(--bg-elevated)",
              }}
            >
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="btn btn-outline"
                style={{ fontSize: "0.8rem", padding: "6px 14px" }}
              >
                취소
              </button>
              <button
                type="submit"
                className="btn btn-gold"
                style={{ fontSize: "0.8rem", padding: "6px 18px", fontWeight: 800 }}
              >
                {editingSchedule ? "수정 완료" : "일정 등록"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
