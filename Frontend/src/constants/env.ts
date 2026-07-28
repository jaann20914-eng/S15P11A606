/**
 * 런타임 환경변수 단일 소스.
 *
 * Expo는 `EXPO_PUBLIC_` 접두사가 붙은 값만 클라이언트 번들에 주입한다.
 * 접두사가 없는 값(`KAKAOMAP_APPKEY` 등)은 앱에서 읽을 수 없으므로 `.env`에도 접두사를 붙인다.
 * 값을 바꾼 뒤에는 Metro 캐시 때문에 `npx expo start -c`로 다시 띄워야 반영된다.
 */

export const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? '';

/** 카카오맵 JavaScript 키. 미설정이면 지도 대신 목업 이미지가 표시된다. */
export const kakaoMapAppKey = process.env.EXPO_PUBLIC_KAKAOMAP_APPKEY ?? '';

export const hasKakaoMapAppKey = kakaoMapAppKey.length > 0;
