# API boundary

화면은 URL을 직접 호출하지 않고 이 폴더를 통해 서버에 접근한다.

## 구조

```
client.ts        공용 axios 인스턴스, 인터셉터, ApiError. axios를 import하는 유일한 파일이다
config.ts        목업/실서버 전환. 전역(usesMockApi)과 API별(usesMock)
pin/detail.ts    GET    /api/v1/pins/{pinId}
pin/unlock.ts    POST   /api/v1/pins/{pinId}/unlock
pin/evaluate.ts  POST   /api/v1/pins/{pinId}/evaluations
pin/remove.ts    DELETE /api/v1/pins/{pinId}
chat/request.ts  POST   /api/v1/chat/request/{pinId}
chat/leave.ts    POST   /api/v1/chat/pins/{pinId}/rooms/leave
```

도메인이 늘어나면 `recommend/`, `member/`처럼 폴더를 추가한다.

**파일명은 엔드포인트가 하는 일로 짓고 `index.ts`를 두지 않는다.**
import 경로만 보고 어떤 요청인지 알 수 있어야 한다(`@/api/pin/unlock`).

**경로가 속한 도메인을 기준으로 나눈다.** 예를 들어 "이미 떠났어요"는 핀 상세 화면에서 부르지만
경로가 `/api/v1/chat/...`이므로 `chat/`에 둔다.

## 규칙

- 도메인 모듈은 `apiRequest`만 쓰고 axios를 직접 import하지 않는다.
- 실패는 `client.ts`의 인터셉터가 `ApiError`로 바꿔 던진다. 호출부는 `code`로 분기한다.
- 서버 응답 모양과 화면이 쓰는 모양이 다르면 도메인 모듈 안에서 변환한다
  (`pin/detail.ts`의 `toPinDetail` 참고). 화면이 서버 enum을 알 필요가 없게 한다.
- 백엔드가 아직 없는 API는 목업으로 갈라 `src/mocks`의 고정 데이터를 쓴다.
  `EXPO_PUBLIC_API_BASE_URL`이 비어 있으면 무엇도 부를 수 없으므로 전부 목업이다.
- 앱 전체를 바꾸려면 `.env`의 `EXPO_PUBLIC_USE_MOCK_API`를 쓴다. Metro 재시작이 필요하다.
- **일부만** 목업으로 두려면 `config.ts`의 `MOCK_OVERRIDES`에 그 API를 적는다. 서버가 A는
  주고 B는 아직인 상황에서, B 하나 때문에 앱 전체를 목업으로 돌리지 않기 위한 것이다.
  코드에 두므로 Fast Refresh로 즉시 반영된다. **엔드포인트가 생기면 그 줄을 지운다.**
- **연결이 끝난 기록은 `MOCK_OVERRIDES` 안에 쌓지 않고 아래 "연동 기록"에 적는다.**
  표 안에 주석으로 쌓아 두었더니 서로 다른 엔드포인트를 붙인 두 사람이 같은 자리를 고쳐
  **병합 충돌이 반복됐다**(2026-08-05). 표에는 지금 목업으로 두는 줄만 남긴다.

## 연동 기록

지금 목업으로 두는 것은 `MOCK_OVERRIDES`에만 있다. 아래는 **이미 실서버로 연결한 것**과
연결하면서 알게 된 명세와의 차이다. 새로 연결하면 한 줄 추가하고 표에서 그 줄을 지운다.

| 시점 | 연결한 것 | 알아 둘 점 |
|---|---|---|
| 2026-08-01 | 로그인·온보딩, 닉네임 중복확인, 영상 등록 3종(`upload-url`·`POST /pins`·`status`), 태그 검색, 장소 검색·확정·최근검색 | 태그 자동완성(GET)은 Elasticsearch 색인을 읽고 그 색인에 쓰는 코드가 없어 **늘 0건**이다. 확정(POST)은 DB를 읽어 정상 |
| 2026-08-04 | 핀 상세 계열 5종(상세·수정·삭제·열람·평가) | `POST /pins/{pinId}/evaluation`(단수). "이미 떠났어요"는 명세의 `/chat/pins/{pinId}/rooms/leave`가 아니라 `POST /pins/{pinId}/leave`다 |
| 2026-08-04 | 개인화 장소 추천 | 응답에 인기순 대체 여부(`recommendationType`)와 영업 상태·영업시간 문구가 **없다**. 타입에서 선택으로 두고 값이 없으면 그 줄을 그리지 않는다 |
| 2026-08-04 | 마이페이지 4종(프로필·닉네임 수정·오늘 핀·크레딧 내역) | — |
| 2026-08-04 | 등록 화면의 "현재 위치" 주변 조회 | `GET /places/search`의 `q`를 선택으로 바꾸는 대신 별도 경로가 나왔다 — `GET /places/nearby`. 좌표만 받고 반경 50m를 거리순으로 주며, 등록 요청에 실을 카카오 메타까지 함께 온다 |
| 2026-08-05 | 장소 상세(`GET /places/{placeId}`), 홈 지도·목록(`GET /places`) | `filter`는 **필수 파라미터**이고 값이 비어 있으면 필터 미적용이다. 필터를 걸면 평균 혼잡도가 없는 장소가 응답에서 빠진다. 결과는 최대 10건, 활성 핀 많은 순 → 지도 중심에 가까운 순 |

### 서버가 아직 채워 주지 않는 값

화면이 자리를 비워 두거나 다른 응답에서 메워 쓰는 것들이다. 서버가 주기 시작하면 그 우회를 지운다.

- **핀 카드 좌표** — 장소 상세의 `PinCard`에 위도·경도가 없다. `GET /places`의 `activePins[]`에는
  있어서 `usePlaceDetail`이 `pinId`로 맞춰 붙인다.
- **썸네일** — `PinCardAssembler`가 S3 객체 키를 그대로 넣는다(핀 상세처럼 presigned URL로 바꾸지
  않는다). `api/place/detail.ts`가 URL이 아닌 값을 `null`로 걸러 자리만 비운다.
- **공개 전 핀이 목록에 섞인다** — 장소 상세의 핀 목록은 `videoStatus`를 보지 않아 AI 처리 중인
  핀도 카드로 온다. 그 카드를 열면 상세는 `PIN_NOT_FOUND`다(상세는 `ACTIVE`만 준다).
