import { createClient } from "@libsql/client";

const db = createClient({
  url: "libsql://dosepro-eegmon.aws-ap-northeast-1.turso.io",
  authToken: "eyJhbGciOiJFZERTQSIsInR5cCI6IkpXVCJ9.eyJhIjoicnciLCJpYXQiOjE3ODc2MzQ5MzksImlkIjoiMDFhMDM3NTgtNTgwMS03YTliLThjYzAtYTcxYWJkOTA3NTE0Iiwia2lkIjoiMThtWm1tVE11OTIyYWhkbWR5aWJ6eFFZYnhQQUh6bTR3MjZ0Y015SnNIdyIsInJpZCI6ImZiOTMwZDM0LTZlZDktNGU4NS1hOTEwLTk3YmM4MWVlMmMzYSJ9.0mrSDXfZxWiksjAU2_X_MkWAJ8m67gP9TBTmHGX4QSn6n6aFIeNh1EERC1Q0A2AvEXHS_-b0AjkxSn_-2L4LDQ"
});

// 테이블 목록
const tables = await db.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
console.log("=== TABLES ===");
tables.rows.forEach(r => console.log(" -", r.name));

// cases
const cases = await db.execute(
  "SELECT id, hyeongje_no, gyeongje_no, suspect_name, suspect_uuid, prosecutor_name, disposition, charge_name, booking_date FROM cases WHERE deleted_at='' ORDER BY rowid DESC LIMIT 20"
);
console.log("\n=== CASES (최근 20건) ===");
cases.rows.forEach(r => console.log(JSON.stringify(r)));

// prosecutors
const pros = await db.execute(
  "SELECT id, name, role_level, dept, status FROM prosecutors ORDER BY rowid DESC"
);
console.log("\n=== PROSECUTORS ===");
pros.rows.forEach(r => console.log(JSON.stringify(r)));

// cases 스키마
const schema = await db.execute("PRAGMA table_info(cases)");
console.log("\n=== CASES 컬럼 목록 ===");
schema.rows.forEach(r => console.log(` ${r.cid} | ${r.name} | ${r.type} | default: ${r.dflt_value}`));
