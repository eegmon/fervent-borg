const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const adapter = new FileSync(path.join(dbDir, 'db.json'));
const db = low(adapter);

// Set Default Data Schema if Empty
db.defaults({
  prosecutors: [
    { id: 'yooa7374', name: '유아 검사', title: '담당검사', roleLevel: 'PROSECUTOR', dept: '첨단범죄수사부', password: '1234', activeCases: 14 },
    { id: 'eegmon', name: '이그몬 검사', title: '수석/부장검사', roleLevel: 'SENIOR_PROSECUTOR', dept: '형사1부', password: '1234', activeCases: 22 },
    { id: 'jjaehee1013', name: '재희 검사', title: '담당검사', roleLevel: 'PROSECUTOR', dept: '금융조세범죄부', password: '1234', activeCases: 9 },
    { id: 'AndyLab', name: '앤디 검사', title: '지검장/검찰총장', roleLevel: 'CHIEF_PROSECUTOR', dept: '검찰집행부', password: '1234', activeCases: 5 },
    { id: 'Solips_', name: '솔립스 검사', title: '부장검사', roleLevel: 'SENIOR_PROSECUTOR', dept: '공공수사부', password: '1234', activeCases: 18 },
    { id: 'nsy_', name: '남상 검사', title: '담당검사', roleLevel: 'PROSECUTOR', dept: '강력범죄수사부', password: '1234', activeCases: 11 }
  ],
  cases: [
    {
      id: 1,
      hyeongjeNo: '2026형제196',
      gyeongjeNo: '2026경제104',
      latestHyeongjeNo: '2026형제196',
      prosecutorName: '유아 검사',
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
      prosecutorName: '이그몬 검사',
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
  ],
  reports: [
    {
      id: 101,
      reportNo: '2026접수-101',
      hyeongjeNo: '2026형제196',
      title: '도스온라인 주식시세 조종 및 미공개 정보 이용 신고 건',
      prosecutorName: '유아 검사',
      suspectName: 'Donut_0824',
      suspectUuid: '4fb7a73d914649ba8e5a3ca10f676aba',
      status: '입건 완료',
      createdAt: '2026-07-02 14:20',
      basisUrl: 'https://cafe.naver.com/doseonline/128529',
      period: '2026.07.02 ~ 2026.08.05',
      confiscation: '125,000,000 골드'
    }
  ],
  appeals: [
    {
      id: 201,
      appealNo: '2026항고12',
      hyeongjeNo: '2026형제222',
      gyeongjeNo: '-',
      status: '항고기각',
      prosecutorName: '유아 검사',
      suspectName: 'HoneyKR',
      disposition: '항고기각 처분 (원처분 적정)',
      dispositionDate: '2026-08-01',
      basisUrl: 'https://cafe.naver.com/doseonline/129433'
    }
  ],
  bookings: [
    {
      id: 301,
      hyeongjeNo: '2026형제196',
      prosecutorName: '유아 검사',
      suspectName: 'Donut_0824',
      suspectUuid: '4fb7a73d914649ba8e5a3ca10f676aba',
      dispositionStatus: '기소(구속기소)',
      bookingDate: '2026-07-05',
      basisUrl: 'https://cafe.naver.com/doseonline/128529',
      daysElapsed: 12,
      indictmentDecision: '구속기소 완료'
    }
  ],
  approvals: [
    {
      id: 'APP-2026-001',
      docNo: '2026-결재-089',
      docType: 'DISPOSITION',
      docTypeName: '검찰 처분 결의서',
      title: '2026형제210호 피의자 jjaehee1013 특정경제범죄가중처벌법위반 구속기소 처분 결의서',
      hyeongjeNo: '2026형제210',
      prosecutorId: 'eegmon',
      prosecutorName: '이그몬 검사',
      suspectName: 'jjaehee1013',
      dispositionType: '구속기소',
      chargeName: '특정경제범죄가중처벌등에관한법률 위반 (사기)',
      summary: '피의자는 다수의 피해자를 상대로 거래 사기를 범하고 피해액이 4억 5천만 골드에 달하며 증거인멸 위험이 상존함. 구속기소함이 타당함.',
      status: '최종승인',
      createdAt: '2026-07-15',
      approvals: [
        { role: '담당검사', name: '이그몬 검사', status: '상신완료', date: '2026-07-15 10:00' },
        { role: '부장검사', name: '솔립스 검사', status: '검토승인', date: '2026-07-15 11:30' },
        { role: '지검장', name: '앤디 검사', status: '최종결재(인장날인)', date: '2026-07-15 14:00' }
      ]
    }
  ]
}).write();

module.exports = db;
