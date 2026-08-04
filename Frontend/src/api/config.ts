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
  /*
    2026-08-01 기준, 백엔드에 컨트롤러가 없는 것들이다.

    있는 것(`PinController`·`PlaceController`·`TagController`·`RecentSearchController`·
    `UserController`에서 확인):
    - /auth/oauth, /auth/refresh, /onboarding, /users/nickname-availability
    - /pins/upload-url, POST /pins, /pins/{pinId}/status, /pins/tags/search(GET·POST)
    - /places/search, /places, /places/{placeId}
    - /places/search/{kakaoPlaceId}, /places/search/recent

    검색 3종(장소 확정·최근 검색기록·태그)은 컨트롤러를 직접 확인하고 아래 표에 넣지 않았다.
    API 명세 CSV에는 최근 검색기록이 "진행 중"으로 남아 있으나 RecentSearchController가
    완성돼 있다.
  */

  /*
    ⚠ 등록 3종은 실서버로 연결했지만 **업로드부터는 아직 확인하지 못했다** (2026-08-01).

    배포 서버에 `AWS_S3_BUCKET`이 비어 있어 Presigned URL이
    `https://s3.ap-northeast-2.amazonaws.com/${AWS_S3_BUCKET}/pins/original/...` 로 발급되고
    S3가 `InvalidBucketName`(400)으로 거절한다. 등록(`POST /pins`)은 그 객체가 S3에 있는지
    확인하므로(`VIDEO_NOT_ACCESSIBLE`) 업로드가 막히면 그다음 단계도 전부 막힌다.

    확인된 것: 발급 요청·응답 형식, 객체 키 형식, 파일 크기 전달.
    확인 못한 것: 업로드 성공, 등록 202, 상태 폴링(PENDING → ACTIVE), AI 블러 결과 반영.

    버킷 환경변수와 자격증명(또는 IAM 역할)이 채워지면 코드 변경 없이 다시 시도해 확인한다.
  */

  /*
    핀 상세 계열 5종(상세 · 수정 · 열람 · 평가 · 삭제)은 2026-08-04에 전부 실서버로 연결했다.
    `PinController`에서 확인했다 — GET·PATCH·DELETE /pins/{pinId},
    POST /pins/{pinId}/unlock, POST /pins/{pinId}/evaluation.
  */

  /*
    개인화 장소 추천도 2026-08-04에 실서버로 연결했다(`RecommendationController`).

    명세와 다른 점이 있다 — 응답에 인기순 대체 여부(`recommendationType`)와 영업 상태 ·
    영업시간 문구가 없다. 화면이 준비해 둔 자리라 타입에서는 선택으로 남기고, 값이 없으면 그
    줄을 그리지 않는다(`types/recommend.ts`).
  */

  // GET /api/v1/places/{placeId} 는 명세만 나왔다. 목록(/places)은 있어 별도 지정을 두지 않는다.
  'place/detail': true,
  /*
    등록 화면의 "현재 위치"가 쓰는 주변 조회는 2026-08-04에 실서버로 연결했다.

    `GET /places/search`의 `q`를 선택으로 바꾸는 대신 별도 경로가 나왔다 —
    `GET /places/nearby`(`PlaceController.getNearbyPlaces`). 좌표만 받고 반경 50m 안을
    거리순으로 주며, 등록 요청에 실을 카카오 메타까지 함께 온다.
  */

  /*
    핀 떠났어요도 2026-08-04에 실서버로 연결했다.

    명세의 `POST /chat/pins/{pinId}/rooms/leave`가 아니라 `POST /pins/{pinId}/leave`로
    나왔다(`PinController.leavePin`). 응답 모양은 명세와 같다 — 상태 `LEFT`와 이번에 종료된
    채팅방 목록을 준다.
  */
  /*
    채팅은 2026-08-04에 전부 실서버로 연결됐다 — 요청 · 응답 · 읽음 · 이력 · 목록 3종.

    목록 응답이 명세와 두 곳 달랐고 타입에 그대로 반영했다.
    - 상태를 세 가지로 줄여 준다(거절 · 나감을 `CLOSED`로 합침). 목록은 "종료"로만 보여준다
    - 상대 뷰 온도 필드 이름이 이력과 다르다(목록 `otherUserViewAngle`,
      이력 `otherUserViewTemperature`)
  */

  /*
    마이페이지 4종(프로필 조회 · 닉네임 수정 · 오늘 핀 · 크레딧 내역)은 2026-08-04에 전부
    실서버로 연결했다. `UserController`에서 확인했다 —
    GET /users/me, PATCH /users/me/nickname, GET /users/me/pins/today,
    GET /users/me/credits/transactions.
  */
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
