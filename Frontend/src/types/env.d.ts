declare const process: {
  env: {
    /** 백엔드 서버 주소 (`src/constants/env.ts`에서만 읽는다) */
    EXPO_PUBLIC_API_BASE_URL?: string;
    /**
     * `'true'`면 실제 서버 대신 `src/mocks`의 고정 데이터를 사용한다.
     * 값이 없어도 `EXPO_PUBLIC_API_BASE_URL`이 비어 있으면 목업으로 동작한다.
     */
    EXPO_PUBLIC_USE_MOCK_API?: string;
    /** 카카오 개발자 콘솔의 JavaScript 키 (`src/constants/env.ts`에서만 읽는다) */
    EXPO_PUBLIC_KAKAOMAP_APPKEY?: string;
    /** 카카오 개발자 콘솔의 REST API 키. 소셜 로그인 전용이며 지도 키와 다르다. */
    EXPO_PUBLIC_KAKAO_REST_API_KEY?: string;
    /** 네이버 개발자센터 애플리케이션의 Client ID. Secret은 앱에 넣지 않는다. */
    EXPO_PUBLIC_NAVER_CLIENT_ID?: string;
  };
};
