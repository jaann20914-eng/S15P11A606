// 서버 JWT_SECRET으로 액세스 토큰을 직접 발급한다.
// 로그인이 카카오/네이버 OAuth 전용이라 k6에서 실제 로그인을 돌릴 수 없어,
// 인증이 필요한 API 테스트는 이 토큰을 사용한다. (JwtProvider와 동일한 HS256/클레임 구조)

import crypto from 'k6/crypto';
import encoding from 'k6/encoding';
import { fail } from 'k6';
import { JWT_SECRET, JWT_ISSUER } from './config.js';

function b64url(obj) {
  return encoding.b64encode(JSON.stringify(obj), 'rawurl');
}

export function mintAccessToken(memberId, ttlSeconds = 3600) {
  if (!JWT_SECRET) {
    fail('JWT_SECRET 환경변수가 필요합니다. 예: k6 run -e JWT_SECRET=... script.js');
  }
  const now = Math.floor(Date.now() / 1000);
  const header = b64url({ alg: 'HS256' });
  const payload = b64url({
    iss: JWT_ISSUER,
    iat: now,
    sub: String(memberId),
    purpose: 'ACCESS',
    exp: now + ttlSeconds,
  });
  const signature = crypto.hmac('sha256', JWT_SECRET, `${header}.${payload}`, 'base64rawurl');
  return `${header}.${payload}.${signature}`;
}
