import { apiBaseUrl } from '@/constants/env';

/**
 * 요청을 실제 서버로 보낼지 `src/mocks`의 고정 데이터로 처리할지 결정한다.
 *
 * 앱 전체의 기본값이다. 모듈별로 다르게 두려면 `usesMock`을 쓴다.
 * 서버 주소가 비어 있으면 별도 설정 없이 목업으로 동작한다.
 */
export const usesMockApi = process.env.EXPO_PUBLIC_USE_MOCK_API === 'true' || !apiBaseUrl;

/**
 * 목업 여부를 따로 정할 수 있는 API 단위.
 *
 * 파일이 아니라 **엔드포인트** 기준으로 나눈다. 한 파일이 서로 다른 엔드포인트를 다루는
 * 경우가 있어서다 — `user/nickname.ts`는 중복 확인과 `PATCH /users/me`를 함께 갖는데,
 * 앞은 서버에 있고 뒤는 없다. 이름을 잘못 적으면 컴파일에서 걸린다.
 */
export type ApiModule =
  | 'chat/decision'
  | 'chat/leave'
  | 'chat/messages'
  | 'chat/pins'
  | 'chat/read'
  | 'chat/request'
  | 'chat/rooms'
  | 'pin/create'
  | 'pin/detail'
  | 'pin/evaluate'
  | 'pin/remove'
  | 'pin/status'
  | 'pin/tag-pins'
  | 'pin/tag-search'
  | 'pin/update'
  | 'pin/unlock'
  | 'pin/videoUpload'
  | 'pin/videoUploadTask'
  | 'place/detail'
  | 'place/list'
  | 'place/nearby'
  | 'place/search'
  | 'place/search-confirm'
  | 'place/search-recent'
  | 'recommend/places'
  | 'user/credits'
  | 'user/me'
  | 'user/today-pins'
  | 'user/nickname-availability';

/**
 * 전역 설정과 다르게 둘 것만 적는다. **지금 서버에 없는 것만 남긴다.**
 *
 * 백엔드가 일부 엔드포인트만 먼저 내주는 동안, 화면 하나 때문에 앱 전체를 목업으로 돌려야
 * 하는 상황을 피하려고 둔다.
 *
 * `.env`가 아니라 코드에 두는 이유는 `EXPO_PUBLIC_*`가 Metro 시작 시점에 번들로 박히기
 * 때문이다 — 바꿀 때마다 서버를 다시 띄워야 하는 값과 달리 이 표는 Fast Refresh로 즉시 반영된다.
 *
 * **엔드포인트가 생기면 그 줄과 설명을 함께 지운다.** 두면 서버가 준비된 뒤에도 목업을 계속 본다.
 *
 * **연결이 끝난 것을 기념하는 주석을 이 안에 쌓지 않는다.** 무엇을 언제 연결했고 명세와 무엇이
 * 달랐는지는 `src/api/README.md`의 "연동 기록"에 적는다. 여기에 쌓아 두었더니 서로 다른
 * 엔드포인트를 붙인 두 사람이 **같은 자리를 고쳐 매번 병합 충돌이 났다**(2026-08-05). 표에는
 * 지금 동작에 영향을 주는 줄만 있어야 읽을 때도 짧다.
 */
/*
  지금은 비어 있다 — 화면이 쓰는 엔드포인트가 모두 실서버로 연결됐다(2026-08-05).

  비워 두는 편이 낫다. 이 표에 줄이 있으면 그 화면만 목업으로 도는데, 그것을 모르고 "서버가
  이상하다"로 읽는 일이 반복됐다. 새 엔드포인트가 아직 없을 때만 한 줄 넣고, 연결되면 지운다.
*/
const MOCK_OVERRIDES: Partial<Record<ApiModule, boolean>> = {};

/**
 * 이 API를 목업으로 처리할지.
 *
 * 서버 주소가 없으면 무엇도 부를 수 없으므로 표보다 우선한다.
 */
export function usesMock(module: ApiModule): boolean {
  if (!apiBaseUrl) return true;
  return MOCK_OVERRIDES[module] ?? process.env.EXPO_PUBLIC_USE_MOCK_API === 'true';
}
