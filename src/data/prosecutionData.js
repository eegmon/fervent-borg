// 도스온라인 검찰청 (Dose Online Prosecution Office) 표준 데이터셋
// 검찰청법 제3조(검사의 직급) / 제4조(검찰청직원의 직급) 기반

/**
 * 직급(Rank) 체계 (검찰청법 제3조, 제4조)
 *
 * [검사 직급]
 *   PROSECUTOR_GENERAL  검찰총장
 *   CHIEF_PROSECUTOR    검사장
 *   DEPUTY_CHIEF        차장검사
 *   SENIOR_PROSECUTOR   부장검사
 *   PROSECUTOR          평검사
 *   PROBATIONARY        검사시보
 *
 * [검찰청직원 직급 및 대우] (제4조 제2항: 직급 부여 시 차장검사, 부장검사, 평검사, 검사시보 직급 부여)
 *   CHIEF_ADMINISTRATOR 검찰관리관     (차장검사 대우)
 *   ADMINISTRATOR       검찰사무관     (평검사 대우)
 *   ADMIN_PROBATIONARY  검찰사무관시보 (검사시보 대우)
 */
// 배열 순서: 앞일수록 상위 직급.
// 검찰사무관/관리관은 행정 보조직이므로 수사지휘 라인 검사보다 하위에 위치.
// (검찰청법 제3조·제4조, ROLE_AUTHORITY 수치와 동기화)
export const ROLE_HIERARCHY = [
  "SUPER_ADMIN",            // 최고 시스템 관리자 (전체 퍼미션)
  "PROSECUTOR_GENERAL",     // 검찰총장
  "CHIEF_PROSECUTOR",       // 검사장
  "DEPUTY_CHIEF",           // 차장검사
  "CHIEF_ADMINISTRATOR",    // 검찰관리관 (차장검사 대우 — 행정직)
  "SENIOR_PROSECUTOR",      // 부장검사
  "PROSECUTOR",             // 평검사 (소추·수사 주체)
  "ADMINISTRATOR",          // 검찰사무관 (평검사 대우 — 행정/수사보조)
  "ADMIN_PROBATIONARY",     // 검찰사무관시보
  "PROBATIONARY",           // 검사시보
];

// 배열의 앞일수록 상위 직급이다. 권한 비교는 문자열 비교 대신 이 순서를 사용한다.
export const ROLE_LEVELS = Object.fromEntries(
  ROLE_HIERARCHY.map((role, index) => [role, ROLE_HIERARCHY.length - index]),
);

export function hasRoleAtLeast(role, requiredRole) {
  return (ROLE_LEVELS[role] || 0) >= (ROLE_LEVELS[requiredRole] || 0);
}

export const ROLE_LABELS = {
  SUPER_ADMIN: "최고 시스템 관리자 (All Permissions)",
  PROSECUTOR_GENERAL: "검찰총장",
  CHIEF_PROSECUTOR: "검사장",
  DEPUTY_CHIEF: "차장검사",
  CHIEF_ADMINISTRATOR: "검찰관리관 (차장검사 대우 · 행정직)",
  SENIOR_PROSECUTOR: "부장검사",
  PROSECUTOR: "평검사",
  ADMINISTRATOR: "검찰사무관 (평검사 대우 · 행정직)",
  PROBATIONARY: "검사시보",
  ADMIN_PROBATIONARY: "검찰사무관시보",
};

export function isManagementAccount(account) {
  return Boolean(
    account?.dept?.includes("사무국") ||
    ["CHIEF_ADMINISTRATOR", "ADMINISTRATOR", "ADMIN_PROBATIONARY"].includes(
      account?.roleLevel,
    ),
  );
}

export const ROLE_COLORS = {
  SUPER_ADMIN: "#f59e0b", // 최고 관리자 — 골드
  PROSECUTOR_GENERAL: "#dc2626", // 최고 — 빨강
  CHIEF_PROSECUTOR: "#ea580c", // 검사장 — 주황
  DEPUTY_CHIEF: "#d97706", // 차장검사
  CHIEF_ADMINISTRATOR: "#d97706", // 차장검사 대우 (검찰관리관)
  SENIOR_PROSECUTOR: "#a78bfa", // 부장검사 — 보라
  PROSECUTOR: "#3b82f6", // 평검사 — 파랑
  ADMINISTRATOR: "#0ea5e9", // 검찰사무관 — 하늘
  PROBATIONARY: "#94a3b8", // 검사시보 — 회색
  ADMIN_PROBATIONARY: "#6b7280", // 검찰사무관시보
};

export const INITIAL_DEPARTMENTS = [
  {
    id: "dept_general",
    name: "검찰총장실",
    headId: "",
    headName: "",
    desc: "검찰 사무 및 지휘 총괄",
    canIntake: true,
  },
  {
    id: "dept_admin",
    name: "검찰사무국",
    headId: "",
    headName: "",
    desc: "검찰 행정, 문서관리, 기록보존 및 인사",
    canIntake: true,
  },
];

export const PROSECUTORS = [];

/**
 * KST (대한민국 표준시, UTC+9) 기준 날짜 변환 헬퍼
 */
export function getKSTNow() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 9 * 60 * 60 * 1000);
}

export function formatKSTDateStr(dateInput) {
  let date = dateInput
    ? new Date(String(dateInput).replace(/\./g, "-"))
    : new Date();
  if (isNaN(date.getTime())) date = new Date();
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 60 * 60 * 1000);
  const yyyy = kst.getFullYear();
  const mm = String(kst.getMonth() + 1).padStart(2, "0");
  const dd = String(kst.getDate()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd}`;
}

const CONCLUDED_KEYWORDS = [
  "불기소", "종국", "기소유예", "혐의없음", "무혐의", "죄가안됨",
  "공소권없음", "각하", "기소중지", "참고인중지", "타관송치",
  "종결", "처분완료", "결재완료",
];

/** 종국 처분 여부 (불기소·기소유예·혐의없음 등, 기소 제외) */
export function isCaseConcluded(c) {
  if (!c) return false;
  const disp = (c.disposition || "").trim();
  const bookingStatus = (c.bookingStatus || "").trim();
  const status = (c.status || "").trim();

  return (
    Boolean(c.isConcluded) ||
    status.includes("종국") ||
    status.includes("완료") ||
    status.includes("종결") ||
    bookingStatus.includes("종국") ||
    bookingStatus.includes("완료") ||
    CONCLUDED_KEYWORDS.some((k) => disp.includes(k))
  );
}

/** 기소 처분 여부 (구속기소·불구속기소·약식기소 등) */
export function isCaseIndicted(c) {
  if (!c) return false;
  const disp = (c.disposition || "").trim();
  const bookingStatus = (c.bookingStatus || "").trim();
  const status = (c.status || "").trim();

  return (
    (disp.includes("기소") || disp.includes("구공판") || bookingStatus.includes("기소") || status.includes("기소")) &&
    !disp.includes("불기소") &&
    !disp.includes("미기소") &&
    !disp.includes("기소유예") &&
    !disp.includes("기소중지") &&
    !bookingStatus.includes("불기소") &&
    !bookingStatus.includes("미기소") &&
    !bookingStatus.includes("기소유예") &&
    !bookingStatus.includes("기소중지")
  );
}

/** 수사 진행중 여부 (종국·기소 모두 아님) */
export function isCaseInvestigating(c) {
  if (!c) return false;
  return !isCaseConcluded(c) && !isCaseIndicted(c);
}

/**
 * 사건이 종국 처분되었거나 기소되었는지 여부 확인
 * - 기소된 사건(구속기소, 불구속기소, 약식기소, 기소, 구공판 등): 공소제기가 완료되어 공소시효 진행이 정지/완료됨.
 * - 종국 사건(불기소, 기소유예, 혐의없음, 죄가안됨, 공소권없음, 각하, 타관송치, 기소중지, 참고인중지, 종결, 처분완료 등): 이미 처분이 완료됨.
 * - 따라서 종국/기소 사건은 공소시효 만료 경보 및 48시간 영장 기한 알림 대상에서 제외된다.
 */
export function isCaseClosedOrIndicted(c) {
  return isCaseConcluded(c) || isCaseIndicted(c);
}

/**
 * 도스온라인 소송법 제21조의2 및 제21조의3(공소시효 특례) 기준 공소시효 자동 계산
 * - 제21조의2① 일반 범죄: 20일
 * - 제21조의3① 경제범죄(절도, 강도, 사기, 공갈, 횡령, 배임 등): 42일
 * - 제21조의3② 특정범죄가중처벌법 제8조~제10조 규정 죄: 공소시효 미적용 (무제한)
 */
export function calculateStatuteOfLimitations(
  chargeName,
  incidentDateOrBookingDate,
) {
  const charge = (chargeName || "").toLowerCase();

  // 특가법 제8조 내지 제10조 규정 죄만 시효 미적용 (소송법 제21조의3 제2항)
  const isSpecialArt8To10 =
    (charge.includes("특가법") || charge.includes("특정범죄가중")) &&
    (charge.includes("8조") ||
      charge.includes("9조") ||
      charge.includes("10조") ||
      charge.includes("제8조") ||
      charge.includes("제9조") ||
      charge.includes("제10조"));

  if (isSpecialArt8To10) {
    return {
      periodDays: Infinity,
      expireDateStr: "시효 없음 (특가법 제8조~제10조)",
      dDay: 9999,
      isExpired: false,
      dDayText: "시효 무제한 (특가법 제8~10조)",
      lawArticle: "소송법 제21조의3 제2항",
    };
  }

  // 1. 경제범죄 (형법 제13장~제15장: 절도, 강도, 사기, 공갈, 횡령, 배임 등) -> 42일
  let periodDays = 20; // 기본 20일 (제21조의2 제1항)
  let lawArticle = "소송법 제21조의2 (일반 20일)";

  if (
    charge.includes("사기") ||
    charge.includes("절도") ||
    charge.includes("강도") ||
    charge.includes("공갈") ||
    charge.includes("횡령") ||
    charge.includes("배임") ||
    charge.includes("경제")
  ) {
    periodDays = 42; // 경제범죄 42일 (제21조의3 제1항)
    lawArticle = "소송법 제21조의3 (경제범죄 42일 특례)";
  }

  // KST Base date parsing
  let baseDate = getKSTNow();
  if (incidentDateOrBookingDate) {
    const cleanStr = String(incidentDateOrBookingDate)
      .replace(/\./g, "-")
      .trim();
    const parsed = new Date(cleanStr);
    if (!isNaN(parsed.getTime())) {
      const utc = parsed.getTime() + parsed.getTimezoneOffset() * 60000;
      baseDate = new Date(utc + 9 * 60 * 60 * 1000);
    }
  }

  // Expiration date (KST)
  const expireDate = new Date(
    baseDate.getTime() + periodDays * 24 * 60 * 60 * 1000,
  );

  // Calculate remaining D-days from KST today
  const todayKST = getKSTNow();
  const diffTime = expireDate.getTime() - todayKST.getTime();
  const dDay = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const yyyy = expireDate.getFullYear();
  const mm = String(expireDate.getMonth() + 1).padStart(2, "0");
  const dd = String(expireDate.getDate()).padStart(2, "0");
  const expireStr = `${yyyy}.${mm}.${dd} (KST)`;

  return {
    periodDays,
    expireDateStr: expireStr,
    dDay,
    isExpired: dDay <= 0,
    dDayText: dDay <= 0 ? "공소시효 완성 (만료)" : `시효 만료 D-${dDay}`,
    lawArticle,
  };
}

/**
 * 검찰사무규칙 제18조(불기소결정) 기반 불기소 사유 표준 분류 (검찰청훈령 제1호)
 */
export const NON_INDICTMENT_REASONS = [
  {
    id: "NO_SUSPICION_NO_CRIME",
    label: "혐의없음 (범죄인정안됨)",
    category: "혐의없음",
    desc: "검찰사무규칙 제18조제2호가목: 피의사실이 범죄를 구성하지 않거나 인정되지 않음",
  },
  {
    id: "NO_SUSPICION_NO_EVIDENCE",
    label: "혐의없음 (증거불충분)",
    category: "혐의없음",
    desc: "검찰사무규칙 제18조제2호나목: 피의사실을 인정할 만한 충분한 증거가 없음",
  },
  {
    id: "NOT_A_CRIME",
    label: "죄가안됨",
    category: "죄가안됨",
    desc: "검찰사무규칙 제18조제3호: 피의사실이 범죄구성요건에는 해당하나 위법성·책임 조각",
  },
  {
    id: "NO_PROSECUTION_RIGHT",
    label: "공소권없음",
    category: "공소권없음",
    desc: "검찰사무규칙 제18조제4호: 시효완성, 사망, 사면, 형폐지, 이중공소, 고소취소, 반의사불벌 등",
  },
  {
    id: "SUSPENSION_PROSECUTION",
    label: "기소유예",
    category: "기소유예",
    desc: "검찰사무규칙 제18조제1호: 피의사실 인정되나 형법 제41조 참작 소추 필요성 없음",
  },
  {
    id: "DISMISSAL",
    label: "각하",
    category: "각하",
    desc: "검찰사무규칙 제18조제5호: 법률위반 고소·고발, 동일사건 불기소재고소, 익명풍문제보, 공공이익 미비 등",
  },
  {
    id: "STAY_PROSECUTION",
    label: "기소중지",
    category: "기소중지",
    desc: "검찰사무규칙 제14조제1항제3호: 피의자의 소재불명 등으로 수사를 종결할 수 없음",
  },
];

export const NON_INDICTMENT_REASON_COLORS = {
  NO_SUSPICION_NO_CRIME: "#34d399",
  NO_SUSPICION_NO_EVIDENCE: "#6ee7b7",
  NOT_A_CRIME: "#2dd4bf",
  NO_PROSECUTION_RIGHT: "#93c5fd",
  SUSPENSION_PROSECUTION: "#fcd34d",
  DISMISSAL: "#94a3b8",
  STAY_PROSECUTION: "#c4b5fd",
  UNKNOWN: "#64748b",
};

function getCaseDispositionText(caseItem) {
  return (caseItem?.disposition || caseItem?.bookingStatus || "").trim();
}

/** 불기소·기소유예 등 불기소 결정 사건 여부 */
export function isNonIndictmentCase(caseItem) {
  return resolveNonIndictmentReasonId(caseItem) !== null;
}

/** 사건의 불기소 사유 ID 반환 (해당 없으면 null) */
export function resolveNonIndictmentReasonId(caseItem) {
  if (!caseItem) return null;

  if (caseItem.nonIndictReasonId) {
    const matched = NON_INDICTMENT_REASONS.find((r) => r.id === caseItem.nonIndictReasonId);
    if (matched) return matched.id;
  }

  const disp = getCaseDispositionText(caseItem);
  if (!disp || isCaseIndicted(caseItem)) return null;

  const matchers = [
    { id: "NO_SUSPICION_NO_CRIME", test: (d) => d.includes("범죄인정안됨") },
    { id: "NO_SUSPICION_NO_EVIDENCE", test: (d) => d.includes("증거불충분") },
    { id: "NOT_A_CRIME", test: (d) => d.includes("죄가안됨") },
    { id: "NO_PROSECUTION_RIGHT", test: (d) => d.includes("공소권없음") },
    { id: "SUSPENSION_PROSECUTION", test: (d) => d.includes("기소유예") },
    { id: "DISMISSAL", test: (d) => d.includes("각하") },
    { id: "STAY_PROSECUTION", test: (d) => d.includes("기소중지") || d.includes("참고인중지") },
  ];

  for (const m of matchers) {
    if (m.test(disp)) return m.id;
  }

  for (const r of NON_INDICTMENT_REASONS) {
    if (disp.includes(r.label)) return r.id;
  }

  if (
    disp.includes("불기소") ||
    disp.includes("무혐의") ||
    (disp.includes("혐의없음") && !disp.includes("기소"))
  ) {
    return "UNKNOWN";
  }

  return null;
}

/** 불기소 사유별 건수 집계 */
export function buildNonIndictmentBreakdown(cases = []) {
  const byReason = { UNKNOWN: 0 };
  NON_INDICTMENT_REASONS.forEach((r) => {
    byReason[r.id] = 0;
  });

  let total = 0;
  cases.forEach((c) => {
    const reasonId = resolveNonIndictmentReasonId(c);
    if (!reasonId) return;
    byReason[reasonId] = (byReason[reasonId] || 0) + 1;
    total += 1;
  });

  return { total, byReason };
}

export const DOCUMENT_TYPES = [
  {
    id: "GIAN",
    label: "기안문 (별지 제34호서식)",
    icon: "FilePen",
    desc: "검찰사무규칙 제31조 행정·수사 기안문 양식",
    hwpFormId: "FORM_34",
  },
  {
    id: "DISPOSITION",
    label: "검찰 처분 결의서 (별지 제14호서식 연동)",
    icon: "FileText",
    desc: "기소/불기소/구속기소 최종 결의",
    hwpFormId: "FORM_14",
  },
  {
    id: "NON_INDICTMENT",
    label: "불기소 이유 통지서 & 결정서 (별지 제13호서식)",
    icon: "XCircle",
    desc: "검찰사무규칙 제14조제3항 및 제18조 불기소 결의",
    hwpFormId: "FORM_13",
  },
  {
    id: "WARRANT_ARREST",
    label: "구속영장 청구서 (별지 제3호서식)",
    icon: "ShieldAlert",
    desc: "검찰사무규칙 제12조 피의자 구속영장 청구",
    hwpFormId: "FORM_03",
  },
  {
    id: "WARRANT_SEARCH",
    label: "압수·수색·검증영장 청구서 (별지 제5호서식)",
    icon: "Search",
    desc: "검찰사무규칙 제13조 인벤토리 및 장소 영장 청구",
    hwpFormId: "FORM_05",
  },
  {
    id: "WARRANT_DEMOLITION",
    label: "건축물철거영장 청구서 (별지 제7호서식)",
    icon: "Home",
    desc: "검찰사무규칙 제23조 불법 건축물 철거 영장 청구",
    hwpFormId: "FORM_07",
  },
  {
    id: "WARRANT_LOG",
    label: "로그영장 청구서 (별지 제8호서식)",
    icon: "Database",
    desc: "검찰사무규칙 제26조 장소 로그 확인 영장 청구",
    hwpFormId: "FORM_08",
  },
  {
    id: "INDICTMENT",
    label: "공소장 (별지 제14호서식)",
    icon: "Scale",
    desc: "검찰사무규칙 제15조 공소제기 (영장 첨부)",
    hwpFormId: "FORM_14",
  },
  {
    id: "GOVT_NOTICE",
    label: "공무원 고소·고발 사건 통지서 (별지 제11호서식)",
    icon: "UserCheck",
    desc: "검찰사무규칙 제14조제4항 소속 기관 통지",
    hwpFormId: "FORM_11",
  },
];

export const INITIAL_AUDIT_LOGS = [];

export const INITIAL_MAIN_LEDGER = [];

export const INITIAL_REPORTS = [];

export const INITIAL_APPEALS = [];

export const INITIAL_BOOKINGS = [];

export const INITIAL_APPROVALS = [];

export const SUSPECT_HISTORIES = {};
