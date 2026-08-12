// 핀 조회 부하테스트 — 지도 조회 → 장소 홈 → 핀 상세 (실제 앱 조회 흐름)
//
//   1) GET /api/v1/places?bbox&filter=wagle   (지도에서 장소+핀 집계)
//   2) GET /api/v1/places/{placeId}           (장소 홈: 핀 카드 목록)
//   3) GET /api/v1/pins/{pinId}               (핀 상세: presigned URL 발급 포함)
//
// 사전 준비: psql -f seed/seed.sql  (+ 1시간 경과 시 refresh-pins.sql 재실행)
//
// 실행:
//   k6 run -e BASE_URL=... -e JWT_SECRET=... scenarios/pin-read.js
//
// 주의: 지도 조회는 bbox 캐시(30초) 미스 시 장소당 카카오 로컬 API를 실시간 호출한다.
//       이 스크립트는 고정 bbox 1개를 사용해 카카오 호출을 30초당 1회로 억제한다.
//       임의 bbox로 바꾸면 카카오 쿼터를 태울 수 있으니 주의.

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import {
  BASE_URL, PLACE_ID, PLACE_LAT, PLACE_LNG, jsonParams, requesterId,
} from '../lib/config.js';
import { mintAccessToken } from '../lib/jwt.js';

const mapOk = new Rate('pin_read_map_ok');
const detailOk = new Rate('pin_read_detail_ok');

export const options = {
  scenarios: {
    pin_read: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: Number(__ENV.VUS || 50) },
        { duration: __ENV.DURATION || '2m', target: Number(__ENV.VUS || 50) },
        { duration: '10s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.01'],
    pin_read_map_ok: ['rate>0.99'],
  },
};

const DELTA = 0.01; // 시드 장소 주변 약 ±1km bbox (고정 → 서버 캐시 활용)

let token = null;

export default function () {
  if (token === null) token = mintAccessToken(requesterId(__VU));
  const params = jsonParams(token);

  // 1) 지도 범위 조회
  const mapRes = http.get(
    `${BASE_URL}/api/v1/places` +
    `?southWestLatitude=${PLACE_LAT - DELTA}&southWestLongitude=${PLACE_LNG - DELTA}` +
    `&northEastLatitude=${PLACE_LAT + DELTA}&northEastLongitude=${PLACE_LNG + DELTA}` +
    `&filter=wagle`,
    { ...params, tags: { name: 'places_bbox' } },
  );
  const mapPassed = check(mapRes, {
    '지도 조회 200': (r) => r.status === 200,
    '장소 1개 이상': (r) => (r.json('data.places') || []).length > 0,
  });
  mapOk.add(mapPassed);

  // 2) 장소 홈 (핀 카드 목록)
  const homeRes = http.get(
    `${BASE_URL}/api/v1/places/${PLACE_ID}`,
    { ...params, tags: { name: 'place_home' } },
  );
  check(homeRes, { '장소 홈 200': (r) => r.status === 200 });

  // 3) 핀 상세 (장소 홈에서 무작위 핀 선택)
  const pins = homeRes.status === 200 ? (homeRes.json('data.pins') || []) : [];
  if (pins.length > 0) {
    const pin = pins[Math.floor(Math.random() * pins.length)];
    const detailRes = http.get(
      `${BASE_URL}/api/v1/pins/${pin.pinId}`,
      { ...params, tags: { name: 'pin_detail' } },
    );
    detailOk.add(check(detailRes, { '핀 상세 200': (r) => r.status === 200 }));
  }

  sleep(1);
}
