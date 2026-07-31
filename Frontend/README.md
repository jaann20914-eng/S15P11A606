# 와글와글 모바일 UX/UI 목업

실시간 영상핀으로 장소의 현재 혼잡도를 확인하는 Android 우선 React Native 목업입니다.

## 실행

```bash
npm install
npx expo start -c --dev-client
```

**Expo Go로는 실행되지 않습니다.** 카메라·보안 저장소·소셜 로그인 복귀(App Link) 등
네이티브 모듈을 쓰므로 EAS `development` 빌드 APK를 설치한 안드로이드 실기기가 필요합니다.

```bash
eas build --platform android --profile development
```

JS만 바뀌면 다시 빌드하지 않아도 됩니다. `app.json`이나 네이티브 모듈이 바뀔 때만 다시 빌드합니다.
`EXPO_PUBLIC_*`는 번들 시점에 값이 박히므로 `.env`를 고친 뒤에는 반드시 `-c`로 캐시를 비웁니다.

## 네이티브 모듈 추가 규칙

**`npm install` 대신 `npx expo install`을 쓰고, import하는 네이티브 모듈은 전부 `package.json`에 직접 선언한다.**

전이 의존성으로 들어온 네이티브 모듈은 SDK와 다른 버전이 최상위에 깔릴 수 있다.
실제로 `@expo/vector-icons`의 peer 범위(`expo-font: >=14.0.4`)가 버전 점프한
`expo-font@57`을 끌어와, JS는 정상인데 APK만 `NoSuchMethodError`로 죽는 일이 있었다.
번들에는 잡히지 않고 실기기 빌드에서만 드러나므로 의존성을 건드린 뒤에는 이걸 돌린다.

```bash
npx expo-doctor
```

`Check that required peer dependencies are installed`가 실패하면 EAS 빌드 전에 반드시 해결한다.

## 소셜 로그인 설정

카카오/네이버 네이티브 SDK를 쓰지 않습니다. 시스템 브라우저(Custom Tabs)에서 인증을 마치고
**Android App Link**로 앱에 복귀한 뒤, 인가 코드를 백엔드에 넘겨 서비스 토큰으로 바꿉니다.

1. `.env`에 세 값을 채웁니다. 하나라도 비면 로그인 버튼이 목업으로 동작하거나 설정 오류를 띄웁니다.

   ```
   EXPO_PUBLIC_API_BASE_URL=https://i15a606.p.ssafy.io
   EXPO_PUBLIC_USE_MOCK_API=false
   EXPO_PUBLIC_KAKAO_REST_API_KEY=카카오_REST_API_키
   EXPO_PUBLIC_NAVER_CLIENT_ID=네이버_Client_ID
   ```

   `EXPO_PUBLIC_` 값은 **번들 시점에 코드로 박히므로** 바꾼 뒤에는 `npx expo start -c`로 다시 띄워야 합니다.
   목업 모드로 돌고 있으면 로그인 화면 하단에 그 사실이 표시됩니다.

2. Redirect URI는 `src/utils/oauth.ts`에 상수로 고정돼 있습니다. 콘솔·서버와 한 글자도 달라선 안 되므로
   환경변수로 빼지 않았습니다.

   ```
   https://i15a606.p.ssafy.io/oauth/callback/kakao
   https://i15a606.p.ssafy.io/oauth/callback/naver
   ```

3. **이 주소는 서버가 404를 반환하는 게 정상입니다.** 앱이 App Link로 가로채는 용도이기 때문입니다.
   따라서 App Link 검증이 실패하면 인증까지 성공해도 앱으로 돌아오지 못하고 브라우저에 404만 남습니다.

### 제공자 콘솔 설정

브라우저 기반 흐름이므로 **두 콘솔 모두 "웹" 환경으로 등록해야 한다.**
Android 네이티브 환경(패키지명·키 해시·다운로드 URL)은 네이티브 SDK 방식용이라 이 구조에서는 쓰지 않는다.

- **카카오**: 제품 설정 > 카카오 로그인을 **활성화**하고 **Redirect URI**에 위 주소를 등록한다.
  키는 앱 키 > **REST API 키**(지도용 JavaScript 키와 다른 값)를 쓴다.
  브라우저 방식이라 Android 플랫폼 키 해시 등록은 필요 없다.
- **네이버**: 애플리케이션 > API 설정 > **로그인 오픈 API 서비스 환경**에 **PC웹 또는 모바일웹**을 추가하고
  서비스 URL과 **Callback URL**을 등록한다. Callback URL 입력란은 웹 환경에만 있다 —
  Android 환경만 등록하면 `client_id`는 유효한데도 인증 페이지가
  "서비스 설정에 오류가 있어 로그인할 수 없습니다"로 끊긴다.

네이버 설정 오류는 `authorize` 응답의 `disp_stat` 값으로 확인할 수 있다.
redirect_uri를 바꿔도 값이 그대로면 애플리케이션 자체의 설정 문제다.

```bash
curl -s "https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=$NAVER_CLIENT_ID&redirect_uri=https%3A%2F%2Fi15a606.p.ssafy.io%2Foauth%2Fcallback%2Fnaver&state=t"
```

### App Link 검증 확인

`https://i15a606.p.ssafy.io/.well-known/assetlinks.json`의 `package_name`이 `app.json`의
`android.package`와 **정확히 같아야** 하고, `sha256_cert_fingerprints`에 빌드 서명 지문이 있어야 합니다.

실기기를 **USB로 연결하고**(무선 QR 연결로는 adb가 붙지 않습니다) 확인합니다.
`adb`는 Android SDK에 들어 있고 PATH에 없을 수 있습니다. PowerShell에서 현재 세션에만 추가하려면:

```powershell
$env:Path += ";$env:LOCALAPPDATA\Android\Sdk\platform-tools"
```

```bash
adb shell pm get-app-links com.waglewagle.mobile
```

`i15a606.p.ssafy.io: verified`가 나와야 합니다. **`assetlinks.json`을 앱 설치 이후에 고쳤다면
Android가 이전 결과를 캐시하고 있으므로** 반드시 재검증을 요청합니다(또는 앱을 삭제하고 다시 설치합니다).

```bash
adb shell pm verify-app-links --re-verify com.waglewagle.mobile
```

OAuth 흐름과 무관하게 복귀 동작만 따로 시험하려면 인텐트를 직접 던집니다.
앱이 열리면 App Link가 동작하는 것이고, 브라우저가 열리면 검증이 실패한 상태입니다.

```bash
adb shell am start -a android.intent.action.VIEW -d "https://i15a606.p.ssafy.io/oauth/callback/kakao?code=test&state=test"
```

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
