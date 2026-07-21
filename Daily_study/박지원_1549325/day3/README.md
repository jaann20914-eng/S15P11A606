# 학습 일지 — React Native 스타일링(CSS) & 라이브러리 리서치

- **작성일**: 2026.07.16
- **주제**: 핀플(Pinple) 프로젝트 — RN 폴더구조 회의 후속 리서치
- **목표**: 스타일링 방식 확정 근거 마련 + 확정 라이브러리 목록에 추가 검토가 필요한 항목 정리

---

## 1. React Native 스타일링 방식 비교

> RN에는 웹의 CSS 미디어쿼리가 없어서, 아래 네 가지 중 하나를 고르는 구도로 접근해야 한다는 걸 알게 됨.

### 1-1. StyleSheet (기본 내장)

- RN이 기본 제공하는 가장 가벼운 방식.
- 러닝커브 없음, 타입 지원 확실.
- 단점: 다크모드·디자인 토큰 전환 같은 테마 시스템을 직접 짜야 하는 부담.
- 벤치마크(250개 아이템 렌더링 기준)에서 restyle, tamagui, react-native-unistyles, nativewind 등이 기본 StyleSheet 대비 더 나은 성능을 보인 사례도 있음.

### 1-2. NativeWind (Tailwind 문법)

- 빌드 타임에 Tailwind 클래스를 `StyleSheet.create` 객체로 컴파일 → 런타임에는 컴파일된 스타일만 적용하는 구조.
- hover/focus/active 같은 조건부 로직도 빌드 타임에 결정됨.
- **v4부터 런타임 파싱 → 빌드타임 컴파일 방식으로 아키텍처 전환** → 성능 크게 개선.
- Expo 공식 문서에 권장 방식으로 등재.
- 웹(Tailwind) 경험 있는 팀이면 적응 빠름.

### 1-3. Tamagui

- RN + 웹을 아우르는 유니버설 UI 시스템. 자체 컴파일러가 플랫폼별 최적화 스타일 생성.
- 웹 버전(Next.js 등)까지 동시에 만들 계획이 없다면 핀플 규모엔 과함.

### 1-4. twrnc (Tailwind React Native Classnames)

- 런타임에 Tailwind 클래스를 파싱, 설정 거의 불필요, 가장 가벼움.
- 단, 동적 스타일 컴포넌트가 200개 이상 리렌더링될 때는 런타임 파싱 비용(초기 렌더 시 약 50~100ms) 부담 가능.

### 1-5. 성능 참고 수치 (iPhone 15 Pro, Expo Go 기준)

| 방식 | JS 스레드 오버헤드 |
| --- | --- |
| StyleSheet.create (기준선) | 0ms |
| NativeWind v4 (컴파일됨) | 약 2ms |
| Tamagui (컴파일됨) | 약 1ms |
| twrnc (런타임) | 렌더당 8~15ms |

### 1-6. 결론 (핀플 기준)

- 팀 문서에서 이미 **NativeWind**로 방향을 잡은 건 합리적인 선택.
- 다만 팀 문서 내 "반응형 전략" 섹션(NativeWind는 지금 규모엔 불필요 — 미도입)과 "라이브러리 확정" 표(NativeWind 확정)가 **서로 모순** → 회의에서 한 번 정리 필요.
- NativeWind로 최종 확정 시, 반응형 전략의 "useWindowDimensions 훅" 항목은 NativeWind의 `sm:` / `md:` 반응형 클래스와 병행하는 방향으로 재작성하는 게 자연스러움.

---

## 2. 확정 라이브러리에 추가 검토할 항목

### 2-1. 리스트 렌더링 — FlashList (Shopify)

- 피드/핀 리스트처럼 스크롤이 핵심인 화면에 특히 관련.
- FlatList: 500개 미만 아이템엔 무난.
- FlashList: 컴포넌트를 파괴·재생성 대신 **재활용(recycle)** → 대용량 리스트에서 5~10배 성능 개선.
- 마이그레이션 자체는 보통 15분 내외로 끝남 (API 유사).
- 단점: `estimatedItemSize` 지정 필요.
- **적용 후보**: `useFeed.ts` 피드 무한스크롤, 핀 카드 리스트.
- **전략**: 초기엔 FlatList로 시작 → 스크롤 이슈 발생 시 FlashList로 교체.

### 2-2. Expo SDK 56 버전 확인 및 영향

- "Expo SDK 56"은 실제 존재하는 버전, **2026.05.21 정식 출시**. React Native 0.85 + React 19.2 포함.
- 프로젝트에 영향 줄 수 있는 변경점:
  - `expo/fetch`가 전역 `fetch`를 대체 (`EXPO_PUBLIC_USE_RN_FETCH=1`로 옵트아웃 가능)
  - `@expo/vector-icons` → scoped `@react-native-vector-icons` 패키지로 deprecated (팀 라이브러리 목록의 아이콘 항목 재확인 필요)
  - `expo-router`가 더 이상 `react-navigation`에 의존하지 않음
  - React Native 0.85부터 **New Architecture가 기본 전제** → 애니메이션(reanimated) 세팅 시 New Arch 기준으로 작업
  - `react-native-reanimated` import만으로도 Hermes V1과의 상호작용으로 **메모리 사용량 25~30% 증가** 이슈 있음 → worklets bundle mode 활성화로 워크어라운드 권장 (바텀시트/스와이프 카드에 reanimated 사용 예정이므로 팀 공유 필요)
  - `@gorhom/bottom-sheet` 등 커뮤니티 라이브러리에 대한 Expo UI 기반 drop-in 대체제 등장 — 단 SwiftUI/Compose 기반이라 props 차이 있을 수 있음. **기존 `@gorhom/bottom-sheet` 그대로 사용해도 무방**, 급하게 교체할 필요 없음.

### 2-3. 반응형 — react-native-size-matters 재논의 결론

- 핀플은 폰 전용(약 375~430px) 앱, 2단계 분기(작은 폰/큰 폰)로 충분.
- NativeWind 확정 시 Tailwind 반응형 클래스(`sm:`)로 대체 가능.
- → **size-matters 계열 미도입 쪽에 무게**.

---

## 3. 요약 표

| 항목 | 결론 |
| --- | --- |
| 스타일링 | NativeWind 유지 (반응형 전략 문서와의 모순만 정리) |
| 리스트 | 피드/핀리스트에 FlashList 검토 (초기엔 FlatList로 시작 가능) |
| SDK 56 공유 사항 | reanimated 메모리 이슈 / vector-icons deprecation / expo-router의 react-navigation 미의존 |
| size-matters | 도입 보류 유지 |
