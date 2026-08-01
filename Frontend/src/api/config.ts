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
  | 'chat/leave'
  | 'chat/request'
  | 'pin/create'
  | 'pin/detail'
  | 'pin/evaluate'
  | 'pin/remove'
  | 'pin/status'
  | 'pin/tag-pins'
  | 'pin/tag-search'
  | 'pin/unlock'
  | 'pin/videoUpload'
  | 'pin/videoUploadTask'
  | 'place/detail'
  | 'place/list'
  | 'place/search'
  | 'place/search-confirm'
  | 'place/search-recent'
  | 'recommend/places'
  | 'user/credits'
  | 'user/me'
  | 'user/today-pins'
  | 'user/nickname-availability';

/**
 * 전역 설정과 다르게 둘 것만 적는다.
 *
 * 백엔드가 일부 엔드포인트만 먼저 내주는 동안, 화면 하나 때문에 앱 전체를 목업으로 돌려야
 * 하는 상황을 피하려고 둔다. 닉네임 중복 확인은 실서버로 확인하면서 아직 없는 프로필 조회만
 * 목업으로 두는 것이 그런 경우다.
 *
 * `.env`가 아니라 코드에 두는 이유는 두 가지다.
 * - `EXPO_PUBLIC_*`는 Metro가 시작할 때 번들에 박으므로 바꿀 때마다 서버를 다시 띄워야 한다.
 *   이 표는 Fast Refresh로 즉시 반영된다.
 * - 어떤 엔드포인트가 아직 없는지가 기록으로 남아 다음 사람이 같은 것을 다시 찾지 않는다.
 *
 * **엔드포인트가 생기면 해당 줄을 지운다.** 두면 서버가 준비된 뒤에도 목업을 계속 본다.
 */
const MOCK_OVERRIDES: Partial<Record<ApiModule, boolean>> = {
  // 2026-08-01 기준, 백엔드에 컨트롤러가 없는 것들이다.
  // 있는 것: /auth/oauth, /auth/refresh, /onboarding, /users/nickname-availability,
  //          /places, /places/{placeId}, /places/search,
  //          /places/search/{kakaoPlaceId}, /places/search/recent,
  //          /pins/tags/search(GET·POST)
  //
  // 검색 관련 셋(확정·최근기록·태그)은 컨트롤러를 확인하고 넣지 않았다. API 명세 CSV에는
  // 최근 검색기록이 "진행 중"으로 남아 있지만 RecentSearchController가 완성돼 있다.

  // pin 도메인 컨트롤러가 아직 없다. 엔티티와 마이그레이션만 들어와 있다.
  'pin/detail': true,
  'pin/create': true,
  'pin/unlock': true,
  'pin/evaluate': true,
  'pin/remove': true,
  'pin/status': true,
  'pin/videoUpload': true,
  // S3 직접 업로드라 우리 서버와 무관하지만, 업로드 주소를 pin/videoUpload에서 받는다.
  // 그쪽이 목업이면 가짜 주소로 실제 업로드를 시도하게 되므로 함께 목업으로 둔다.
  'pin/videoUploadTask': true,

  // GET /api/v1/recommendations/places 도 아직 없다. recommendation 컨트롤러가 없다.
  'recommend/places': true,

  // GET /api/v1/places/{placeId} 는 명세만 나왔다. 목록(/places)은 있어 별도 지정을 두지 않는다.
  'place/detail': true,

  // chat 도메인 컨트롤러가 아직 없다.
  'chat/request': true,
  'chat/leave': true,

  // GET·PATCH /api/v1/users/me 가 아직 없다.
  'user/me': true,
  // GET /api/v1/users/me/credits/transactions 도 아직 없다. credit 컨트롤러가 없다.
  'user/credits': true,
  // GET /api/v1/users/me/pins/today 도 아직 없다.
  'user/today-pins': true,
};

/**
 * 이 API를 목업으로 처리할지.
 *
 * 서버 주소가 없으면 무엇도 부를 수 없으므로 표보다 우선한다.
 */
export function usesMock(module: ApiModule): boolean {
  if (!apiBaseUrl) return true;
  return MOCK_OVERRIDES[module] ?? process.env.EXPO_PUBLIC_USE_MOCK_API === 'true';
}
