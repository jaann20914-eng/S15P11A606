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
// 비동기 완료 측정(-e WAIT_FOR_RESULT=1, FULL_PIN_CREATE=1과 함께 사용):
//   4) GET /api/v1/pins/{pinId}/status를 주기적으로 조회
//   5) ACTIVE/REJECTED/FAILED 도달까지 걸린 시간을 pin_async_completion_duration으로 기록
//
// 사전 준비: psql -f seed/seed.sql
// 실행: k6 run -e BASE_URL=... -e JWT_SECRET=... scenarios/pin-create.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import {
  BASE_URL, KAKAO_PLACE_ID, PLACE_LAT, PLACE_LNG, jsonParams, ownerId,
} from '../lib/config.js';
import { mintAccessToken } from '../lib/jwt.js';

const uploadUrlOk = new Rate('pin_create_upload_url_ok');
const createOk = new Rate('pin_create_full_ok');
const asyncCompleted = new Rate('pin_async_completed');
const asyncCompletionDuration = new Trend('pin_async_completion_duration', true);
const asyncActive = new Counter('pin_async_active');
const asyncRejected = new Counter('pin_async_rejected');
const asyncFailed = new Counter('pin_async_failed');
const asyncTimedOut = new Counter('pin_async_timed_out');

const FULL = __ENV.FULL_PIN_CREATE === '1';
const WAIT_FOR_RESULT = FULL && __ENV.WAIT_FOR_RESULT === '1';
const RESULT_TIMEOUT_SECONDS = Number(__ENV.RESULT_TIMEOUT_SECONDS || 60);
const RESULT_POLL_INTERVAL_SECONDS = Number(__ENV.RESULT_POLL_INTERVAL_SECONDS || 0.25);
const TERMINAL_STATUSES = new Set(['ACTIVE', 'REJECTED', 'FAILED']);
const DUMMY_SIZE = 1024;
const DUMMY_BODY = 'x'.repeat(DUMMY_SIZE); // 서버는 크기/Content-Type만 검증 (매직바이트 검증 없음)

if (!Number.isFinite(RESULT_TIMEOUT_SECONDS) || RESULT_TIMEOUT_SECONDS <= 0
    || !Number.isFinite(RESULT_POLL_INTERVAL_SECONDS) || RESULT_POLL_INTERVAL_SECONDS <= 0) {
  throw new Error('RESULT_TIMEOUT_SECONDS와 RESULT_POLL_INTERVAL_SECONDS는 0보다 커야 합니다.');
}

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
    ...(WAIT_FOR_RESULT ? { pin_async_completed: ['rate>0.99'] } : {}),
  },
};

let token = null;

function recordTerminalStatus(status) {
  if (status === 'ACTIVE') asyncActive.add(1);
  if (status === 'REJECTED') asyncRejected.add(1);
  if (status === 'FAILED') asyncFailed.add(1);
}

function waitForResult(pinId, params, startedAtMillis) {
  const deadline = startedAtMillis + RESULT_TIMEOUT_SECONDS * 1000;

  while (Date.now() < deadline) {
    const statusRes = http.get(
      `${BASE_URL}/api/v1/pins/${pinId}/status`,
      { ...params, tags: { name: 'pin_status' } },
    );

    if (statusRes.status === 200) {
      const status = statusRes.json('data.videoStatus');
      if (TERMINAL_STATUSES.has(status)) {
        asyncCompletionDuration.add(Date.now() - startedAtMillis);
        asyncCompleted.add(true);
        recordTerminalStatus(status);
        return;
      }
    }

    sleep(RESULT_POLL_INTERVAL_SECONDS);
  }

  asyncCompleted.add(false);
  asyncTimedOut.add(1);
}

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
      const asyncStartedAt = Date.now();
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
      const createPassed = check(createRes, {
        '핀 등록 202': (r) => r.status === 202,
        'pinId 존재': (r) => !!r.json('data.pinId'),
      });
      createOk.add(createPassed);

      if (WAIT_FOR_RESULT) {
        if (createPassed) {
          waitForResult(createRes.json('data.pinId'), params, asyncStartedAt);
        } else {
          asyncCompleted.add(false);
        }
      }
    } else {
      createOk.add(false);
      if (WAIT_FOR_RESULT) asyncCompleted.add(false);
    }
  }

  sleep(1);
}
