// 핀 등록 부하테스트
//
// 기본 모드: POST /api/v1/pins/upload-url 만 반복 (순수 API 계층 성능 측정)
//
// 전체 흐름 모드 (-e FULL_PIN_CREATE=1):
//   1) POST /api/v1/pins/upload-url   → presigned PUT URL 발급
//   2) PUT  {uploadUrl}               → 더미 mp4 바이트를 S3에 실제 업로드
//   3) POST /api/v1/pins              → 핀 등록 (202, 비동기 블러 처리 시작)
//   - 서버가 S3 객체 존재/Content-Type을 검증하므로 실제 업로드가 필요하다.
//   - 등록마다 RabbitMQ 블러 잡이 생성되어 AI 워커까지 부하가 전파된다. (더미 파일이라
//     블러는 실패 → video_status FAILED. 파이프라인 처리량 측정 목적으로만 사용)
//   - 장소 검증(50m)은 시드 장소(loadtest-place-1) 좌표를 그대로 써서 통과시킨다.
//
// 사전 준비: psql -f seed/seed.sql
// 실행: k6 run -e BASE_URL=... -e JWT_SECRET=... scenarios/pin-create.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import {
  BASE_URL, KAKAO_PLACE_ID, PLACE_LAT, PLACE_LNG, jsonParams, ownerId,
} from '../lib/config.js';
import { mintAccessToken } from '../lib/jwt.js';

const uploadUrlOk = new Rate('pin_create_upload_url_ok');
const createOk = new Rate('pin_create_full_ok');

const FULL = __ENV.FULL_PIN_CREATE === '1';
const DUMMY_SIZE = 1024;
const DUMMY_BODY = 'x'.repeat(DUMMY_SIZE); // 서버는 크기/Content-Type만 검증 (매직바이트 검증 없음)

export const options = {
  scenarios: {
    pin_create: {
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
    http_req_failed: ['rate<0.01'],
    pin_create_upload_url_ok: ['rate>0.99'],
  },
};

let token = null;

export default function () {
  if (token === null) token = mintAccessToken(ownerId(__VU));
  const params = jsonParams(token);

  // 1) presigned URL 발급
  const urlRes = http.post(
    `${BASE_URL}/api/v1/pins/upload-url`,
    JSON.stringify({ contentType: 'video/mp4', fileSize: DUMMY_SIZE }),
    { ...params, tags: { name: 'pin_upload_url' } },
  );
  const urlPassed = check(urlRes, {
    'upload-url 200': (r) => r.status === 200,
    'uploadUrl 존재': (r) => !!r.json('data.uploadUrl'),
  });
  uploadUrlOk.add(urlPassed);

  if (FULL && urlPassed) {
    const uploadUrl = urlRes.json('data.uploadUrl');
    const videoKey = urlRes.json('data.originalVideoKey');

    // 2) S3 직접 업로드
    const putRes = http.put(uploadUrl, DUMMY_BODY, {
      headers: { 'Content-Type': 'video/mp4' },
      tags: { name: 's3_put' },
    });
    const putPassed = check(putRes, { 'S3 PUT 200': (r) => r.status === 200 });

    // 3) 핀 등록 (시드 장소 좌표 그대로 → 50m 검증 통과, DB에 장소가 있어 카카오 호출 없음)
    if (putPassed) {
      const createRes = http.post(
        `${BASE_URL}/api/v1/pins`,
        JSON.stringify({
          originalVideoKey: videoKey,
          kakaoPlaceId: KAKAO_PLACE_ID,
          placeName: '부하테스트카페',
          kakaoPlaceLatitude: PLACE_LAT,
          kakaoPlaceLongitude: PLACE_LNG,
          latitude: PLACE_LAT,
          longitude: PLACE_LNG,
          crowdLevel: 'WAGLE_WAGLE',
          memo: '부하테스트 핀',
          tags: ['#부하테스트'],
        }),
        { ...params, tags: { name: 'pin_create' } },
      );
      createOk.add(check(createRes, {
        '핀 등록 202': (r) => r.status === 202,
        'pinId 존재': (r) => !!r.json('data.pinId'),
      }));
    } else {
      createOk.add(false);
    }
  }

  sleep(1);
}
