// 로그인(토큰 발급) 부하테스트 — POST /api/v1/auth/refresh
//
// 실제 로그인은 카카오/네이버 OAuth 일회용 인가코드가 필요해 k6로 재현할 수 없다.
// 대신 토큰 재발급 엔드포인트(JWT 2개 서명 + 리프레시 토큰 DB 회전)를 부하 대상으로 삼는다.
// 비용 구조가 로그인 성공 경로와 거의 같다.
//
// 사전 준비 (매 실행 전 반드시! — RTR 때문에 이전 실행에서 토큰이 전부 회전됨):
//   1) node seed/mint-refresh-tokens.js   (JWT_SECRET, MEMBERS 환경변수)
//   2) psql -f seed/refresh-tokens.sql
//
// 실행:
//   k6 run -e BASE_URL=http://localhost:8080 scenarios/login.js
//
// 제약: VUS <= MEMBERS (토큰 체인이 VU당 1개씩 필요. 초과 VU는 체인을 공유해
//       서버의 재사용 감지(REUSE_DETECTED)에 걸려 전체 체인이 폐기된다.)

import http from 'k6/http';
import { check, fail, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Rate } from 'k6/metrics';
import { BASE_URL, jsonParams } from '../lib/config.js';

const seedTokens = new SharedArray('refresh-tokens', () =>
  JSON.parse(open('../seed/refresh-tokens.json')));

const refreshOk = new Rate('login_refresh_ok');

export const options = {
  scenarios: {
    login: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Number(__ENV.VUS || 20) },
        { duration: __ENV.DURATION || '1m', target: Number(__ENV.VUS || 20) },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    login_refresh_ok: ['rate>0.99'],
  },
};

// VU별 토큰 체인 (회전된 최신 토큰을 유지)
let currentToken = null;

export default function () {
  if (currentToken === null) {
    if (__VU > seedTokens.length) {
      fail(`VU(${__VU})가 시드 토큰 수(${seedTokens.length})를 초과했습니다. MEMBERS를 늘리거나 VUS를 줄이세요.`);
    }
    currentToken = seedTokens[__VU - 1].refreshToken;
  }

  const res = http.post(
    `${BASE_URL}/api/v1/auth/refresh`,
    JSON.stringify({ refreshToken: currentToken }),
    jsonParams(null, { name: 'auth_refresh' }),
  );

  const ok = check(res, {
    'refresh 200': (r) => r.status === 200,
    'accessToken 존재': (r) => !!r.json('data.accessToken'),
    'refreshToken 회전됨': (r) => !!r.json('data.refreshToken'),
  });
  refreshOk.add(ok);

  if (ok) {
    currentToken = res.json('data.refreshToken'); // RTR: 다음 반복은 새 토큰 사용
  }

  sleep(1);
}
