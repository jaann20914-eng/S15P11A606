declare const process: {
  env: {
    EXPO_PUBLIC_API_BASE_URL?: string;
    /**
     * `'true'`면 실제 서버 대신 `src/mocks`의 고정 데이터를 사용한다.
     * 값이 없어도 `EXPO_PUBLIC_API_BASE_URL`이 비어 있으면 목업으로 동작한다.
     */
    EXPO_PUBLIC_USE_MOCK_API?: string;
  };
};
