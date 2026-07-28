# pin-detail

`/pin/[pinId]` 한 화면에서만 쓰는 코드를 모아 둔다.
라우트 파일(`app/pin/[pinId]/index.tsx`)은 파라미터를 읽고 상태별 화면을 고르는 조립만 한다.

```
components/    화면 조각 (헤더, 본문, 메뉴, 모달)
hooks/         usePinDetail(데이터 로딩) · usePinDetailScreen(상호작용)
styles.ts      이 화면의 StyleSheet
```

## 경계

- **서버 요청은 여기 두지 않는다.** `src/api/pin/*`, `src/api/chat/*`를 호출한다.
- **여러 화면이 쓰는 것은 여기 두지 않는다.** `ConfirmModal`·`ErrorView`·`AppTabBar`는
  `src/components/common`에 있다.
- 타입(`src/types/pin.ts`)은 API 계층도 함께 쓰므로 밖에 둔다.

## 파일명 규칙

`index.ts`를 두지 않는다. import 경로만 보고 무엇인지 알 수 있어야 한다
(`@/features/pin-detail/hooks/usePinDetail`).
