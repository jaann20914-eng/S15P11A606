// 혼합 시나리오 — 실제 트래픽 비율을 흉내내 세 흐름을 동시에 돌린다.
//   핀 조회(다수) + 핀 등록 upload-url(소수) + 채팅(중간)
//
// 로그인(refresh)은 토큰 시드 파일이 필요해 별도 실행: scenarios/login.js
//
// 실행: k6 run -e BASE_URL=... -e JWT_SECRET=... scenarios/mixed.js

export { default as pinRead } from './pin-read.js';
export { default as pinCreate } from './pin-create.js';
export { default as chat } from './chat.js';

export const options = {
  scenarios: {
    pin_read: {
      executor: 'ramping-vus',
      exec: 'pinRead',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Number(__ENV.READ_VUS || 50) },
        { duration: __ENV.DURATION || '3m', target: Number(__ENV.READ_VUS || 50) },
        { duration: '10s', target: 0 },
      ],
    },
    pin_create: {
      executor: 'ramping-vus',
      exec: 'pinCreate',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Number(__ENV.CREATE_VUS || 10) },
        { duration: __ENV.DURATION || '3m', target: Number(__ENV.CREATE_VUS || 10) },
        { duration: '10s', target: 0 },
      ],
    },
    chat: {
      executor: 'ramping-vus',
      exec: 'chat',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Number(__ENV.CHAT_VUS || 20) },
        { duration: __ENV.DURATION || '3m', target: Number(__ENV.CHAT_VUS || 20) },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{scenario:pin_read}': ['p(95)<500'],
    'http_req_duration{scenario:pin_create}': ['p(95)<500'],
    chat_message_delivered: ['rate>0.99'],
  },
};
