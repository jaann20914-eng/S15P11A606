declare const process: {
  env: {
    EXPO_PUBLIC_API_BASE_URL?: string;
    /**
     * `'true'`면 실제 서버 대신 `src/mocks`의 고정 데이터를 사용한다.
     * 값이 없어도 `EXPO_PUBLIC_API_BASE_URL`이 비어 있으면 목업으로 동작한다.
     */
    EXPO_PUBLIC_USE_MOCK_API?: string;
    /** 카카오 개발자 콘솔의 JavaScript 키 (`src/constants/env.ts`에서만 읽는다) */
    EXPO_PUBLIC_KAKAOMAP_APPKEY?: string;
  };
};
