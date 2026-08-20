#!/usr/bin/env node
// 로그인(토큰 재발급) 부하테스트용 리프레시 토큰 발급기.
//
// 서버 로그인이 카카오/네이버 OAuth 전용이라 k6로 실제 로그인을 돌릴 수 없다.
// 대신 JWT_SECRET으로 리프레시 토큰을 직접 만들어 DB(refresh_tokens)에 해시를 심으면
// POST /api/v1/auth/refresh (JWT 발급 + DB 회전 — 로그인과 거의 같은 비용)를 부하테스트할 수 있다.
//
// 사용법:
//   JWT_SECRET=<서버와 동일한 시크릿> MEMBERS=100 node mint-refresh-tokens.js
//   psql "$DATABASE_URL" -f refresh-tokens.sql
//
// 산출물 (이 디렉터리에 생성):
//   refresh-tokens.json — k6 login.js 가 읽는 토큰 원문 (한 회원당 1개)
//   refresh-tokens.sql  — DB에 넣을 SHA-256 해시 INSERT문
//
// 주의: 서버가 RTR(회전) 방식이라 한 번 테스트를 돌리면 JSON의 토큰은 무효가 된다.
//       login 테스트를 다시 돌리기 전에 이 스크립트 + SQL을 매번 재실행할 것.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const secret = process.env.JWT_SECRET;
if (!secret) {
  console.error('JWT_SECRET 환경변수가 필요합니다. (서버 jwt.secret과 동일한 값)');
  process.exit(1);
}

const n = Number(process.env.MEMBERS || 100);
const issuer = process.env.JWT_ISSUER || 'wagglewaggle';
const ttl = Number(process.env.REFRESH_TTL_SECONDS || 14 * 24 * 3600);
const REQUESTER_BASE_ID = 910000; // seed.sql 예약 대역과 동일

const b64url = (s) => Buffer.from(s).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const exp = now + ttl;

const rows = [];
for (let i = 1; i <= n; i++) {
  const memberId = REQUESTER_BASE_ID + i;
  const header = b64url(JSON.stringify({ alg: 'HS256' }));
  const payload = b64url(JSON.stringify({
    iss: issuer,
    iat: now,
    sub: String(memberId),
    purpose: 'REFRESH',
    jti: crypto.randomUUID(),
    exp,
  }));
  const signature = crypto.createHmac('sha256', secret)
    .update(`${header}.${payload}`).digest('base64url');
  const token = `${header}.${payload}.${signature}`;
  const hash = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
  rows.push({ memberId, token, hash });
}

fs.writeFileSync(
  path.join(__dirname, 'refresh-tokens.json'),
  JSON.stringify(rows.map((r) => ({ memberId: r.memberId, refreshToken: r.token })), null, 2),
);

const sql = [
  'BEGIN;',
  `DELETE FROM refresh_tokens WHERE member_id BETWEEN 910001 AND 930000;`,
  ...rows.map((r) =>
    `INSERT INTO refresh_tokens (member_id, token_hash, expires_at) ` +
    `VALUES (${r.memberId}, '${r.hash}', to_timestamp(${exp}));`),
  'COMMIT;',
  '',
].join('\n');
fs.writeFileSync(path.join(__dirname, 'refresh-tokens.sql'), sql);

console.log(`리프레시 토큰 ${n}개 생성 완료`);
console.log(`  - ${path.join(__dirname, 'refresh-tokens.json')} (k6 login.js 입력)`);
console.log(`  - ${path.join(__dirname, 'refresh-tokens.sql')} (psql로 DB에 적용할 것)`);
