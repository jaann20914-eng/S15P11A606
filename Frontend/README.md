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

## 구조

- `app/`: Expo Router 화면 진입점과 이동 흐름
- `src/components/`: 공용 UI와 도메인별 컴포넌트
- `src/constants/`: 디자인 토큰, 혼잡도, 장소 카테고리
- `src/api/`: 실제 API가 연결될 요청 경계
- `src/hooks/`: 서버 상태 훅 경계
- `src/store/`: 여러 화면에서 공유하는 클라이언트 상태 경계
- `src/types/`: API와 도메인 타입

화면 파일은 라우팅과 화면 조립에 집중하고, 재사용 UI와 로직은 `src/`에서 관리합니다. 상세 설계 기준과 요구사항 추적표는 `docs/UX-SPEC.md`, 현재 폴더 기준은 `docs/FOLDER_STRUCTURE.md`에 정리했습니다.

