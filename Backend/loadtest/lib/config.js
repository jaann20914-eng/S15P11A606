// 부하테스트 공통 설정. 모든 값은 k6 -e 환경변수로 덮어쓸 수 있다.

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:8080';
export const WS_URL = __ENV.WS_URL || `${BASE_URL.replace(/^http/, 'ws')}/ws`;

export const JWT_SECRET = __ENV.JWT_SECRET || '';
export const JWT_ISSUER = __ENV.JWT_ISSUER || 'wagglewaggle';

// seed/seed.sql 이 만드는 예약 ID 대역과 반드시 일치해야 한다.
export const MEMBERS = Number(__ENV.MEMBERS || 100);
export const REQUESTER_BASE_ID = 910000; // 채팅 요청자 members.id = 910001 ~
export const OWNER_BASE_ID = 920000;     // 핀 작성자   members.id = 920001 ~

// seed/seed.sql 이 넣는 장소 (충북 산간 좌표 — 실데이터와 겹치지 않게 외딴 곳)
export const PLACE_ID = Number(__ENV.PLACE_ID || 990001);
export const KAKAO_PLACE_ID = __ENV.KAKAO_PLACE_ID || 'loadtest-place-1';
export const PLACE_LAT = Number(__ENV.PLACE_LAT || 36.5372);
export const PLACE_LNG = Number(__ENV.PLACE_LNG || 127.9552);

export function requesterId(vu) {
  return REQUESTER_BASE_ID + ((vu - 1) % MEMBERS) + 1;
}

export function ownerId(vu) {
  return OWNER_BASE_ID + ((vu - 1) % MEMBERS) + 1;
}

export function jsonParams(token, extraTags) {
  return {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    tags: extraTags,
  };
}

export function uuid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
