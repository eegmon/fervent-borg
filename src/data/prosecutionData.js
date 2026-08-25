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
 *   ADMINISTRATOR       검찰사무관     (평검사/부장검사 대우)
 *   ADMIN_PROBATIONARY  검찰사무관시보 (검사시보 대우)
 */
export const ROLE_HIERARCHY = [
  'SUPER_ADMIN',         // 최고 시스템 관리자 (전체 퍼미션)
  'PROSECUTOR_GENERAL',
  'CHIEF_PROSECUTOR',
  'DEPUTY_CHIEF',
  'CHIEF_ADMINISTRATOR', // 차장검사 대우 (검찰관리관)
  'SENIOR_PROSECUTOR',
  'PROSECUTOR',
  'ADMINISTRATOR',       // 검찰사무관
  'PROBATIONARY',
  'ADMIN_PROBATIONARY',  // 검찰사무관시보
];

export const ROLE_LABELS = {
  SUPER_ADMIN:         '최고 시스템 관리자 (All Permissions)',
  PROSECUTOR_GENERAL:  '검찰총장',
  CHIEF_PROSECUTOR:    '검사장',
  DEPUTY_CHIEF:        '차장검사',
  CHIEF_ADMINISTRATOR: '검찰관리관 (차장검사 대우)',
  SENIOR_PROSECUTOR:   '부장검사',
  PROSECUTOR:          '평검사',
  ADMINISTRATOR:       '검찰사무관',
  PROBATIONARY:        '검사시보',
  ADMIN_PROBATIONARY:  '검찰사무관시보',
};

export const ROLE_COLORS = {
  SUPER_ADMIN:         '#f59e0b', // 최고 관리자 — 골드
  PROSECUTOR_GENERAL:  '#dc2626', // 최고 — 빨강
  CHIEF_PROSECUTOR:    '#ea580c', // 검사장 — 주황
  DEPUTY_CHIEF:        '#d97706', // 차장검사
  CHIEF_ADMINISTRATOR: '#d97706', // 차장검사 대우 (검찰관리관)
  SENIOR_PROSECUTOR:   '#a78bfa', // 부장검사 — 보라
  PROSECUTOR:          '#3b82f6', // 평검사 — 파랑
  ADMINISTRATOR:       '#0ea5e9', // 검찰사무관 — 하늘
  PROBATIONARY:        '#94a3b8', // 검사시보 — 회색
  ADMIN_PROBATIONARY:  '#6b7280', // 검찰사무관시보
};

export const INITIAL_DEPARTMENTS = [
  { id: 'dept_general', name: '검찰총장실', headId: 'AndyLab', headName: 'Andy', desc: '검찰 사무 및 지휘 총괄', canIntake: true },
  { id: 'dept_central', name: '서울중앙지방검찰청', headId: 'eegmon', headName: 'Eegmon', desc: '지방검찰청 사건 수사 총괄', canIntake: true },
  { id: 'dept_public', name: '공공수사부', headId: 'Solips_', headName: 'Solips', desc: '공공안전 및 선거/노동 사건', canIntake: false },
  { id: 'dept_tech', name: '첨단범죄수사부', headId: 'yooa7374', headName: 'Yooa', desc: '디지털 및 정보통신 범죄', canIntake: false },
  { id: 'dept_finance', name: '금융조세범죄부', headId: 'jjaehee1013', headName: 'Jjaehee', desc: '자본시장법 위반 및 금융 사기', canIntake: false },
  { id: 'dept_violent', name: '강력범죄수사부', headId: 'nsy_', headName: 'Namsang', desc: '조직범죄 및 강력 사건', canIntake: false },
  { id: 'dept_admin', name: '검찰사무국', headId: 'admin_secretariat', headName: '검찰사무국', desc: '검찰 행정, 문서관리, 기록보존 및 인사', canIntake: true },
];


export const PROSECUTORS = [
  // ── 최고 관리자 (Super Admin) ───────────────────────────
  {
    id: 'sys_admin',
    name: '최고 시스템 관리자',
    rank: '최고 총괄 관리자',
    position: '시스템 총괄 관리자',
    title: '최고 관리자 (All Permissions)',
    roleLevel: 'SUPER_ADMIN',
    dept: '검찰총장실',
    password: '1234',
    activeCases: 0,
    isSuperAdmin: true,
    note: '모든 퍼미션과 관리 권한을 보유한 슈퍼 관리자 계정'
  },
  // ── 검찰청직원 ──────────────────────────────────────────
  {
    id: 'admin_secretariat',
    name: '검찰사무국',
    rank: '검찰관리관',
    position: '검찰사무국장',
    title: '검찰사무국장 (검찰관리관)',
    roleLevel: 'CHIEF_ADMINISTRATOR', // 차장검사 대우
    dept: '검찰사무국',
    password: '1234',
    activeCases: 0,
    status: 'ACTIVE',
    delegateTo: '',
    delegateReason: '',
    note: '직급: 검찰관리관 (차장검사 대우) / 직위: 검찰사무국장'
  },
  // ── 검사 ─────────────────────────────────────────────────
  {
    id: 'AndyLab',
    name: 'Andy',
    rank: '검찰총장',
    position: '검찰총장',
    title: '검찰총장',
    roleLevel: 'PROSECUTOR_GENERAL',
    dept: '검찰총장실',
    password: '1234',
    activeCases: 5,
    status: 'ACTIVE',
    delegateTo: '',
    delegateReason: '',
    isAutoAssignExcluded: true
  },
  {
    id: 'eegmon',
    name: 'Eegmon',
    rank: '검사장',
    position: '서울중앙지검장',
    title: '검사장',
    roleLevel: 'CHIEF_PROSECUTOR',
    dept: '서울중앙지방검찰청',
    password: '1234',
    activeCases: 22,
    status: 'ACTIVE',
    delegateTo: '',
    delegateReason: '',
    isAutoAssignExcluded: true
  },
  {
    id: 'Solips_',
    name: 'Solips',
    rank: '부장검사',
    position: '공공수사부장',
    title: '부장검사',
    roleLevel: 'SENIOR_PROSECUTOR',
    dept: '공공수사부',
    password: '1234',
    activeCases: 18,
    status: 'DELEGATED',
    delegateTo: 'Yooa',
    delegateReason: '연가 (결재권한 위임)',
    isAutoAssignExcluded: false
  },
  {
    id: 'yooa7374',
    name: 'Yooa',
    rank: '평검사',
    position: '첨단범죄수사부 검사',
    title: '평검사',
    roleLevel: 'PROSECUTOR',
    dept: '첨단범죄수사부',
    password: '1234',
    activeCases: 14,
    status: 'ACTIVE',
    delegateTo: '',
    delegateReason: '',
    isAutoAssignExcluded: false
  },
  {
    id: 'jjaehee1013',
    name: 'Jjaehee',
    rank: '평검사',
    position: '금융조세범죄부 검사',
    title: '평검사',
    roleLevel: 'PROSECUTOR',
    dept: '금융조세범죄부',
    password: '1234',
    activeCases: 9,
    status: 'ON_LEAVE',
    delegateTo: 'Yooa',
    delegateReason: '육아 휴직',
    isAutoAssignExcluded: false
  },
  {
    id: 'nsy_',
    name: 'Namsang',
    rank: '검사시보',
    position: '강력범죄수사부 시보검사',
    title: '검사시보',
    roleLevel: 'PROBATIONARY',
    dept: '강력범죄수사부',
    password: '1234',
    activeCases: 11,
    status: 'ACTIVE',
    delegateTo: '',
    delegateReason: '',
    isAutoAssignExcluded: false
  },
];


/**
 * KST (대한민국 표준시, UTC+9) 기준 날짜 변환 헬퍼
 */
export function getKSTNow() {
  const now = new Date();
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  return new Date(utc + (9 * 60 * 60 * 1000));
}

export function formatKSTDateStr(dateInput) {
  let date = dateInput ? new Date(String(dateInput).replace(/\./g, '-')) : new Date();
  if (isNaN(date.getTime())) date = new Date();
  const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
  const kst = new Date(utc + (9 * 60 * 60 * 1000));
  const yyyy = kst.getFullYear();
  const mm = String(kst.getMonth() + 1).padStart(2, '0');
  const dd = String(kst.getDate()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd}`;
}

/**
 * 도스온라인 소송법 제21조의2 및 제21조의3(공소시효 특례) 기준 공소시효 자동 계산
 * - 제21조의2① 일반 범죄: 20일
 * - 제21조의3① 경제범죄(절도, 강도, 사기, 공갈, 횡령, 배임 등): 42일
 * - 제21조의3② 특정범죄가중처벌법 제8조~제10조 규정 죄: 공소시효 미적용 (무제한)
 */
export function calculateStatuteOfLimitations(chargeName, incidentDateOrBookingDate) {
  const charge = (chargeName || '').toLowerCase();

  // 특가법 제8조 내지 제10조 규정 죄만 시효 미적용 (소송법 제21조의3 제2항)
  const isSpecialArt8To10 = (charge.includes('특가법') || charge.includes('특정범죄가중')) &&
    (charge.includes('8조') || charge.includes('9조') || charge.includes('10조') || charge.includes('제8조') || charge.includes('제9조') || charge.includes('제10조'));

  if (isSpecialArt8To10) {
    return {
      periodDays: Infinity,
      expireDateStr: '시효 없음 (특가법 제8조~제10조)',
      dDay: 9999,
      isExpired: false,
      dDayText: '시효 무제한 (특가법 제8~10조)',
      lawArticle: '소송법 제21조의3 제2항',
    };
  }

  // 1. 경제범죄 (형법 제13장~제15장: 절도, 강도, 사기, 공갈, 횡령, 배임 등) -> 42일
  let periodDays = 20; // 기본 20일 (제21조의2 제1항)
  let lawArticle = '소송법 제21조의2 (일반 20일)';

  if (
    charge.includes('사기') ||
    charge.includes('절도') ||
    charge.includes('강도') ||
    charge.includes('공갈') ||
    charge.includes('횡령') ||
    charge.includes('배임') ||
    charge.includes('경제')
  ) {
    periodDays = 42; // 경제범죄 42일 (제21조의3 제1항)
    lawArticle = '소송법 제21조의3 (경제범죄 42일 특례)';
  }

  // KST Base date parsing
  let baseDate = getKSTNow();
  if (incidentDateOrBookingDate) {
    const cleanStr = String(incidentDateOrBookingDate).replace(/\./g, '-').trim();
    const parsed = new Date(cleanStr);
    if (!isNaN(parsed.getTime())) {
      const utc = parsed.getTime() + (parsed.getTimezoneOffset() * 60000);
      baseDate = new Date(utc + (9 * 60 * 60 * 1000));
    }
  }

  // Expiration date (KST)
  const expireDate = new Date(baseDate.getTime() + periodDays * 24 * 60 * 60 * 1000);

  // Calculate remaining D-days from KST today
  const todayKST = getKSTNow();
  const diffTime = expireDate.getTime() - todayKST.getTime();
  const dDay = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  const yyyy = expireDate.getFullYear();
  const mm = String(expireDate.getMonth() + 1).padStart(2, '0');
  const dd = String(expireDate.getDate()).padStart(2, '0');
  const expireStr = `${yyyy}.${mm}.${dd} (KST)`;

  return {
    periodDays,
    expireDateStr: expireStr,
    dDay,
    isExpired: dDay <= 0,
    dDayText: dDay <= 0 ? '공소시효 완성 (만료)' : `시효 만료 D-${dDay}`,
    lawArticle,
  };
}

/**
 * 검찰사무규칙 제18조(불기소결정) 기반 불기소 사유 표준 분류 (검찰청훈령 제1호)
 */
export const NON_INDICTMENT_REASONS = [
  { id: 'NO_SUSPICION_NO_CRIME', label: '혐의없음 (범죄인정안됨)', category: '혐의없음', desc: '검찰사무규칙 제18조제2호가목: 피의사실이 범죄를 구성하지 않거나 인정되지 않음' },
  { id: 'NO_SUSPICION_NO_EVIDENCE', label: '혐의없음 (증거불충분)', category: '혐의없음', desc: '검찰사무규칙 제18조제2호나목: 피의사실을 인정할 만한 충분한 증거가 없음' },
  { id: 'NOT_A_CRIME', label: '죄가안됨', category: '죄가안됨', desc: '검찰사무규칙 제18조제3호: 피의사실이 범죄구성요건에는 해당하나 위법성·책임 조각' },
  { id: 'NO_PROSECUTION_RIGHT', label: '공소권없음', category: '공소권없음', desc: '검찰사무규칙 제18조제4호: 시효완성, 사망, 사면, 형폐지, 이중공소, 고소취소, 반의사불벌 등' },
  { id: 'SUSPENSION_PROSECUTION', label: '기소유예', category: '기소유예', desc: '검찰사무규칙 제18조제1호: 피의사실 인정되나 형법 제41조 참작 소추 필요성 없음' },
  { id: 'DISMISSAL', label: '각하', category: '각하', desc: '검찰사무규칙 제18조제5호: 법률위반 고소·고발, 동일사건 불기소재고소, 익명풍문제보, 공공이익 미비 등' },
  { id: 'STAY_PROSECUTION', label: '기소중지', category: '기소중지', desc: '검찰사무규칙 제14조제1항제3호: 피의자의 소재불명 등으로 수사를 종결할 수 없음' },
];

export const DOCUMENT_TYPES = [
  { id: 'GIAN', label: '기안문 (별지 제34호서식)', icon: 'FilePen', desc: '검찰사무규칙 제31조 행정·수사 기안문 양식', hwpFormId: 'FORM_34' },
  { id: 'DISPOSITION', label: '검찰 처분 결의서 (별지 제14호서식 연동)', icon: 'FileText', desc: '기소/불기소/구속기소 최종 결의', hwpFormId: 'FORM_14' },
  { id: 'NON_INDICTMENT', label: '불기소 이유 통지서 & 결정서 (별지 제13호서식)', icon: 'XCircle', desc: '검찰사무규칙 제14조제3항 및 제18조 불기소 결의', hwpFormId: 'FORM_13' },
  { id: 'WARRANT_ARREST', label: '구속영장 청구서 (별지 제3호서식)', icon: 'ShieldAlert', desc: '검찰사무규칙 제12조 피의자 구속영장 청구', hwpFormId: 'FORM_03' },
  { id: 'WARRANT_SEARCH', label: '압수·수색·검증영장 청구서 (별지 제5호서식)', icon: 'Search', desc: '검찰사무규칙 제13조 인벤토리 및 장소 영장 청구', hwpFormId: 'FORM_05' },
  { id: 'WARRANT_DEMOLITION', label: '건축물철거영장 청구서 (별지 제7호서식)', icon: 'Home', desc: '검찰사무규칙 제23조 불법 건축물 철거 영장 청구', hwpFormId: 'FORM_07' },
  { id: 'WARRANT_LOG', label: '로그영장 청구서 (별지 제8호서식)', icon: 'Database', desc: '검찰사무규칙 제26조 장소 로그 확인 영장 청구', hwpFormId: 'FORM_08' },
  { id: 'INDICTMENT', label: '공소장 (별지 제14호서식)', icon: 'Scale', desc: '검찰사무규칙 제15조 공소제기 (영장 첨부)', hwpFormId: 'FORM_14' },
  { id: 'GOVT_NOTICE', label: '공무원 고소·고발 사건 통지서 (별지 제11호서식)', icon: 'UserCheck', desc: '검찰사무규칙 제14조제4항 소속 기관 통지', hwpFormId: 'FORM_11' },
];


export const INITIAL_AUDIT_LOGS = [
  { id: 1, action: '사건 접수 & 자동 배당', details: '2026형제196호 사건 접수 (담당: Yooa)', actor: 'admin_secretariat', timestamp: '2026-08-24 10:15:20' },
  { id: 2, action: '전자결재 관인 날인', details: '2026-결재-089 구속기소 처분 지검장 승인', actor: 'AndyLab', timestamp: '2026-08-24 14:00:10' },
  { id: 3, action: '사건 담당자 재배당', details: '2026형제210호 담당자 재배당 (Eegmon)', actor: 'admin_secretariat', timestamp: '2026-08-24 16:30:45' }
];

export const INITIAL_MAIN_LEDGER = [
  {
    id: 1,
    hyeongjeNo: '2026형제196',
    gyeongjeNo: '2026경제104',
    latestHyeongjeNo: '2026형제196',
    prosecutorName: 'Yooa',
    prosecutorId: 'yooa7374',
    suspectName: 'Donut_0824',
    suspectUuid: '4fb7a73d914649ba8e5a3ca10f676aba',
    bookingStatus: '입건:불구속',
    bookingDate: '2026-07-05',
    bookingBasis: 'https://cafe.naver.com/doseonline/128529',
    disposition: '피의자(구속기소)',
    reAppeal: '-',
    court1No: '2026고단104',
    court1Result: '징역 1년 6월 (집행유예 3년)',
    court1Doc: 'https://cafe.naver.com/doseonline/128529',
    court1Appealed: '항소',
    court1Appellant: '피의자',
    court2No: '2026노412',
    court2Dismissed: '원심유지 (항소기각)',
    court2Result: '징역 1년 6월',
    court2Doc: 'https://cafe.naver.com/doseonline/129433',
    court3Appealed: '미상고',
    court3Appellant: '-',
    court3No: '-',
    court3Remanded: '-',
    court3Result: '형 확정',
    court3Doc: '-',
    notes: '자본시장법 위반 및 시세조종 관련 주요 사건',
    content: '도스온라인 거래소 미공개 정보 이용 매매 및 부당이득 취득 혐의',
    confiscation: '125,000,000 골드 추징',
    chargeName: '자본시장법 위반 / 전자금융거래법 위반'
  },
  {
    id: 2,
    hyeongjeNo: '2026형제210',
    gyeongjeNo: '2026경제112',
    latestHyeongjeNo: '2026형제210',
    prosecutorName: 'Eegmon',
    prosecutorId: 'eegmon',
    suspectName: 'jjaehee1013',
    suspectUuid: 'b822ec95-6964-489d-9fbd-cfcaf6f5b3ce',
    bookingStatus: '입건:구속',
    bookingDate: '2026-07-12',
    bookingBasis: 'https://cafe.naver.com/doseonline/128986',
    disposition: '기소(구속)',
    reAppeal: '-',
    court1No: '2026고합88',
    court1Result: '징역 2년 6월 (실형)',
    court1Doc: 'https://cafe.naver.com/doseonline/128986',
    court1Appealed: '항소',
    court1Appellant: '검사',
    court2No: '2026노520',
    court2Dismissed: '형량가중 (징역 3년 6월)',
    court2Result: '징역 3년 6월 실형 선고',
    court2Doc: 'https://cafe.naver.com/doseonline/130189',
    court3Appealed: '상고',
    court3Appellant: '피의자',
    court3No: '2026도301',
    court3Remanded: '상고기각',
    court3Result: '징역 3년 6월 확정',
    court3Doc: 'https://cafe.naver.com/doseonline/130189',
    notes: '조직적 사기 및 범죄단체 조직 혐의',
    content: '다수의 유저를 상대로 희귀 아이템 거래 사기 및 대포계정 운용',
    confiscation: '450,000,000 골드 몰수',
    chargeName: '특정경제범죄가중처벌법 위반 (사기)'
  }
];

export const INITIAL_REPORTS = [
  {
    id: 101,
    reportNo: '2026접수-101',
    hyeongjeNo: '2026형제196',
    title: '도스온라인 주식시세 조종 및 미공개 정보 이용 신고 건',
    prosecutorName: 'Yooa',
    suspectName: 'Donut_0824',
    suspectUuid: '4fb7a73d914649ba8e5a3ca10f676aba',
    status: '입건 완료',
    createdAt: '2026-07-02 14:20',
    basisUrl: 'https://cafe.naver.com/doseonline/128529',
    period: '2026.07.02 ~ 2026.08.05',
    confiscation: '125,000,000 골드'
  }
];

export const INITIAL_APPEALS = [
  {
    id: 201,
    jibulhangNo: '2026지불항1',
    gobulhangNo: '2026고불항1',
    jaebulhangNo: '2026재불항1',
    daejaebulhangNo: '2026대재불항1',
    sujeNo: '2026수제196',
    hyeongjeNo: '2026형제196',
    beobwonNo: '-',
    chargeName: '협박, 모욕',
    prosecutorName: 'yooa7374',
    chiefProsecutor: '_Memento__Mori_',
    prosecutorGeneral: 'Ace_0516',
    suspectName: 'Donut_0824',
    suspectUuid: '4fb7a73d914649ba8e5a3ca10f676aba',
    appealStatus: '항고기각(직접경정)',
    status: '항고기각(직접경정)',
    appealDisposition: '원처분 유지 및 기각 결정',
    appealDate: '2026. 7. 5',
    appealBasisUrl: 'https://cafe.naver.com/doseonline/130189',
    appealDecision: '항고기각',
    appealNoticeUrl: 'https://cafe.naver.com/doseonline/130189',
    originalStatus: '종국:불기소',
    intakeDate: '2026. 7. 5',
    intakeBasisUrl: 'https://cafe.naver.com/doseonline/128529',
    indictmentStatus: '혐의없음(범죄인정안됨)',
    indictmentDocUrl: 'https://naver.me/GwfVSyyA',
    disposition: '원처분 유지 및 항고기각 (범죄인정안됨)',
    dispositionDate: '2026-07-05',
    basisUrl: 'https://cafe.naver.com/doseonline/130189',
    appealNo: '2026지불항1',
  }
];

export const INITIAL_BOOKINGS = [
  {
    id: 301,
    hyeongjeNo: '2026형제196',
    prosecutorName: 'Yooa',
    suspectName: 'Donut_0824',
    suspectUuid: '4fb7a73d914649ba8e5a3ca10f676aba',
    dispositionStatus: '기소(구속기소)',
    bookingDate: '2026-07-05',
    basisUrl: 'https://cafe.naver.com/doseonline/128529',
    daysElapsed: 12,
    indictmentDecision: '구속기소 완료'
  }
];

export const INITIAL_APPROVALS = [
  {
    id: 'APP-2026-001',
    docNo: '2026-결재-089',
    docType: 'DISPOSITION',
    docTypeName: '검찰 처분 결의서',
    title: '2026형제210호 피의자 jjaehee1013 특정경제범죄가중처벌법위반 구속기소 처분 결의서',
    hyeongjeNo: '2026형제210',
    prosecutorId: 'eegmon',
    prosecutorName: 'Eegmon',
    suspectName: 'jjaehee1013',
    dispositionType: '구속기소',
    chargeName: '특정경제범죄가중처벌등에관한법률 위반 (사기)',
    summary: '피의자는 다수의 피해자를 상대로 거래 사기를 범하고 피해액이 4억 5천만 골드에 달하며 증거인멸 위험이 상존함. 구속기소함이 타당함.',
    status: '최종승인',
    createdAt: '2026-07-15',
    approvals: [
      { role: '담당검사', name: 'Eegmon', status: '상신완료', date: '2026-07-15 10:00' },
      { role: '부장검사', name: 'Solips', status: '검토승인', date: '2026-07-15 11:30' },
      { role: '지검장', name: 'Andy', status: '최종결재(인장날인)', date: '2026-07-15 14:00' }
    ]
  }
];

export const SUSPECT_HISTORIES = {
  'Donut_0824': {
    name: 'Donut_0824',
    uuid: '4fb7a73d914649ba8e5a3ca10f676aba',
    priorsCount: 2,
    records: [
      { date: '2025-11-10', caseNo: '2025형제882', charge: '명예훼손', outcome: '벌금 50만원' },
      { date: '2026-07-05', caseNo: '2026형제196', charge: '자본시장법 위반', outcome: '1심 징역 1년 6월 집행유예 3년' }
    ]
  }
};
