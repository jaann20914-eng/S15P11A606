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

  // 핀 상세·수정·열람·평가·삭제는 아직 없다. 등록 3종(발급·등록·상태)만 열려 있다.
  'pin/detail': true,
  // PATCH /api/v1/pins/{pinId} 는 명세만 나왔다. PinController에 아직 매핑이 없다.
  'pin/update': true,
  'pin/unlock': true,
  'pin/evaluate': true,
  'pin/remove': true,

  // GET /api/v1/recommendations/places 도 아직 없다. recommendation 컨트롤러가 없다.
  'recommend/places': true,

  // GET /api/v1/places/{placeId} 는 명세만 나왔다. 목록(/places)은 있어 별도 지정을 두지 않는다.
  'place/detail': true,

  /*
    채팅 요청과 응답은 ChatController에 들어와 실서버로 연결했다(2026-08-03).
    핀 떠났어요(POST /chat/pins/{pinId}/rooms/leave)만 아직 컨트롤러가 없다.
  */
  'chat/leave': true,
  /*
    목록 3종(GET /chat/rooms, /chat/rooms/{pinId}, /chat/pins)도 아직 없다.

    2026-08-03에 실서버로 돌려 확인했다 — 없는 경로인데 404가 아니라 500
    (INTERNAL_SERVER_ERROR)이 온다. 그래서 이 스위치를 끄기 전에는 서버가 준비됐는지
    상태 코드만으로 판단할 수 없다. 컨트롤러가 생겼는지 확인하고 지우는 편이 확실하다.
  */
  'chat/rooms': true,
  'chat/pins': true,
  /*
    메시지 이력(GET /chat/rooms/{roomId}/messages)도 아직 없다(2026-08-04, dev 확인).
    ChatController에는 요청 · 응답 · 읽음 갱신 세 개뿐이다.

    읽음 갱신(PATCH /chat/rooms/{roomId}/read)은 들어와 실서버로 연결했다. 다만 이력이 목업인
    동안 보내는 messageId는 목업의 것이라 서버에서 CHAT_MESSAGE_NOT_FOUND(404)가 온다 —
    실패 로그가 그렇게 찍히면 이 조합 때문이지 읽음 API 자체의 문제가 아니다.
  */
  'chat/messages': true,

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
