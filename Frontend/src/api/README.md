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
  코드에 두므로 Fast Refresh로 즉시 반영되고, 어떤 엔드포인트가 없는지 기록으로 남는다.
  **엔드포인트가 생기면 그 줄을 지운다.**
