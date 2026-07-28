# 지금핀 모바일 UX/UI 목업

실시간 영상핀으로 장소의 현재 혼잡도를 확인하는 Android 우선 React Native 목업입니다.

## 실행

```bash
npm install
npm run start
```

Expo Go 또는 Android 에뮬레이터에서 실행할 수 있습니다. 카카오맵은 요구사항에 따라 실제 연동하지 않았으며 `src/components/home/MapPlaceholder.tsx`가 후속 SDK 연동 지점입니다.

## 주요 흐름

- OAuth 진입 → 3단계 온보딩 → 지도 홈
- 검색 → 장소 상세 → 영상핀 결제 → 평가·채팅
- 실시간 5초 촬영 → 위치·혼잡도·메모·태그 → AI 블러 → 등록
- 추천, 채팅 요청/수락, 마이페이지, 크레딧, 작성 영상 관리, 닉네임 수정

## 폴더 구조

```
app/                  Expo Router 라우트. 파라미터를 읽고 화면을 조립하는 일만 한다
src/
  features/{화면}/     그 화면에서만 쓰는 코드
    components/       화면 조각
    hooks/            데이터 로딩 · 상호작용 상태
    styles.ts         그 화면의 StyleSheet
  components/         두 화면 이상이 쓰는 UI
    common/           도메인과 무관한 UI (버튼, 탭 바, 모달, 오류 화면)
    {도메인}/          도메인에 묶이지만 여러 화면이 쓰는 UI (home/, pin/)
  api/                서버 요청 경계
    client.ts         axios 인스턴스·인터셉터·ApiError. axios를 import하는 유일한 파일
    config.ts         목업/실서버 전환 스위치
    {도메인}/{동작}.ts  pin/detail.ts, pin/unlock.ts, chat/leave.ts
  mocks/{도메인}.ts    백엔드가 없는 API의 고정 데이터
  hooks/              두 화면 이상이 쓰는 훅
  store/              여러 화면이 공유하는 클라이언트 상태
  types/              API 응답과 도메인 타입 (api와 features가 함께 쓴다)
  constants/          디자인 토큰, 혼잡도, 카테고리
  utils/              의존성 없는 순수 함수
```

## 배치 규칙

**한 곳에서만 쓰면 그 옆에, 둘 이상이 쓰면 위로 올린다.**
`src/features/{화면}/`에서 시작하고, 두 번째 화면이 쓰기 시작할 때 `components`·`hooks`·`utils`로 옮긴다.

**API는 경로가 속한 도메인으로 나눈다.**
"이미 떠났어요"는 핀 상세 화면에서 부르지만 경로가 `/api/v1/chat/...`이므로 `api/chat/`에 둔다.
호출하는 화면이 아니라 엔드포인트가 기준이다.

**파일명은 무엇을 하는지 드러낸다. 배럴(`index.ts`)을 새로 만들지 않는다.**
import 경로만 보고 대상을 알 수 있어야 한다 — `@/api/pin/unlock`,
`@/features/pin-detail/hooks/usePinDetail`.

**화면은 서버 모양을 모른다.**
응답 구조가 화면에 맞지 않으면 `api/{도메인}/` 안에서 변환한다(`api/pin/detail.ts`의 `toPinDetail`).
실패는 `client.ts` 인터셉터가 `ApiError`로 바꿔 던지므로 화면은 `code`로만 분기한다.

**타입은 `src/types`에 둔다.** `api`와 `features`가 같이 쓰기 때문에 어느 한쪽에 넣지 않는다.

## 아직 정리 안 된 것

- `src/components/common/index.ts` 배럴이 남아 있다. 5개 화면이 쓰고 있어 한 번에 걷어내지 않았다.
  새 코드는 배럴 대신 파일을 직접 import한다.
- 목업 위치가 두 곳이다. `src/data/mock.ts`(목업 화면용 하드코딩)와 `src/mocks/`(API 고정 데이터).
  전자는 화면이 API에 붙는 순서대로 사라질 예정이다.
- `src/types/place.ts`의 `Place`는 현재 참조하는 곳이 없다.

현재 파일 목록은 `docs/FOLDER_STRUCTURE.md`, 설계 기준과 요구사항 추적표는 `docs/UX-SPEC.md`에 있습니다.

