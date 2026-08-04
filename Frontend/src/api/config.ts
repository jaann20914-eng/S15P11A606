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
  | 'chat/pins'
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
const MOCK_OVERRIDES: Partial<Record<ApiModule, boolean>> = {
  /*
    채팅 목록(GET /chat/rooms · /chat/pins).

    **2026-08-05 dev 머지로 서버 쪽이 생겼다** — `ChatController.rooms`·`pins`·`pinRooms`와
    `ChatRoomListService`·`ChatPinListService`가 들어왔다. 그래서 이 두 줄은 이제 "없어서"가
    아니라 **"응답 모양을 아직 맞춰 보지 못해서" 남아 있다.**

    지우는 것은 채팅 화면을 맡은 사람이 판단한다. 커서 기반 목록이라(`ChatRoomCursor`)
    프론트 타입과 페이지 규약이 맞는지 확인해야 하고, 어긋난 채로 켜면 목록이 비거나 화면이
    죽는다. 확인해서 맞으면 이 블록과 두 줄을 함께 지운다.

    참고: 없는 경로일 때 이 서버는 404가 아니라 500(INTERNAL_SERVER_ERROR)을 준다. 상태
    코드만으로 준비 여부를 판단할 수 없어 컨트롤러를 직접 확인해야 한다(2026-08-03 확인).
  */
  'chat/rooms': true,
  'chat/pins': true,
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
