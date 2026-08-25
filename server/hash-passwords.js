/**
 * server/hash-passwords.js
 * database/db.json 의 평문 비밀번호를 bcrypt 해시로 일괄 변환
 *
 * 사용법:
 *   node server/hash-passwords.js
 *
 * 주의:
 *   - 이미 '$2a$' 또는 '$2b$' 로 시작하는 값은 이미 해시된 것으로 판단하고 건너뜁니다.
 *   - 원본 db.json 은 db.json.bak 으로 백업합니다.
 *   - 이 스크립트는 migrate.js 실행 전에 먼저 실행하세요.
 */
import { readFileSync, writeFileSync, copyFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath    = resolve(__dirname, '../database/db.json');
const backupPath = resolve(__dirname, '../database/db.json.bak');

const SALT_ROUNDS = 12;

let data;
try {
  data = JSON.parse(readFileSync(dbPath, 'utf-8'));
} catch (e) {
  console.error('[hash-passwords] db.json 읽기 실패:', e.message);
  process.exit(1);
}

if (!Array.isArray(data.prosecutors) || data.prosecutors.length === 0) {
  console.log('[hash-passwords] prosecutors 데이터가 없습니다.');
  process.exit(0);
}

// 백업
copyFileSync(dbPath, backupPath);
console.log(`[hash-passwords] 백업 생성: ${backupPath}`);

let count = 0;
for (const p of data.prosecutors) {
  const pw = String(p.password || '');
  if (pw.startsWith('$2a$') || pw.startsWith('$2b$')) {
    console.log(`  - ${p.id}: 이미 해시됨, 건너뜀`);
    continue;
  }
  p.password = await bcrypt.hash(pw, SALT_ROUNDS);
  console.log(`  - ${p.id}: 해시 완료`);
  count++;
}

writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf-8');
console.log(`\n✅ ${count}개 비밀번호 해시 완료 → ${dbPath}`);
