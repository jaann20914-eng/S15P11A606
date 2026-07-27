declare const process: {
  env: {
    EXPO_PUBLIC_API_BASE_URL?: string;
    /** 소켓 주소를 API 주소와 다르게 둘 때만 설정한다. 없으면 API 주소에서 파생한다. */
    EXPO_PUBLIC_WS_BASE_URL?: string;
  };
};
