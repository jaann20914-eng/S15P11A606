# 와글와글 모바일 UX/UI 목업

실시간 영상핀으로 장소의 현재 혼잡도를 확인하는 Android 우선 React Native 목업입니다.

## 실행

```bash
npm install
npm run start
```

Expo Go 또는 Android 에뮬레이터에서 실행할 수 있습니다.

## 카카오맵 설정

홈 지도는 카카오맵 JavaScript SDK를 WebView(웹에서는 iframe) 안에서 구동합니다.

1. `.env.example`을 `.env`로 복사하고 [카카오 개발자 콘솔](https://developers.kakao.com)의 **JavaScript 키**를 채웁니다.

   ```
   EXPO_PUBLIC_KAKAOMAP_APPKEY=발급받은_JavaScript_키
   ```

   Expo는 `EXPO_PUBLIC_` 접두사가 붙은 값만 앱 번들에 주입하므로 접두사를 빼면 지도가 뜨지 않습니다.

2. 키를 바꾼 뒤에는 Metro 캐시를 비우고 다시 실행합니다: `npx expo start -c`

3. **장소명 검색**(장소 상세에서 좌표·주소를 채우는 임시 경로)까지 쓰려면, 콘솔의
   **앱 설정 > 플랫폼 > Web**에 `https://localhost`를 등록해야 합니다.
   실기기 WebView가 이 주소를 문서 URL로 쓰고, 카카오는 검색 호출마다 등록된 도메인을 확인합니다.
   등록하지 않으면 지도는 정상 동작하고 검색만 실패해 등록된 좌표로 표시됩니다.

**도메인 등록은 필요하지 않습니다.** 카카오는 SDK를 내려줄 때 Referer로 등록된 웹 도메인을 검사하는데,
WebView·Expo Go의 문서 주소는 콘솔에 등록하기 애매하고 팀원별로 달라 실기기에서 지도가 안 뜨는 원인이 됩니다.
그래서 지도 문서는 `referrer: no-referrer`로 SDK를 요청합니다. 검사할 Referer가 없으면 카카오가 정상 응답합니다.

지도를 못 띄우면 목업 이미지 대신 **원인이 적힌 안내 화면과 "다시 시도" 버튼**이 표시됩니다.
개발 모드에서는 같은 원인이 콘솔에도 경고로 찍힙니다.

`no-referrer`는 **SDK 파일을 받는 script 요청에만** 걸려 있습니다. 문서 전체에 걸면 그 위에서 도는
`services`(장소 검색) 호출까지 Referer를 잃어 인증이 깨집니다.

웹(`npm run start` → `w`)에서는 지도를 iframe(`srcdoc`)에 띄우는데 이 문서의 origin이 opaque라
도메인을 등록해도 검색은 401이 납니다. 검색 동작 확인은 실기기(Expo Go)에서 해주세요.

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
