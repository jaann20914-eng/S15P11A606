/** 소셜 로그인 제공자. 백엔드 경로 `/api/v1/auth/oauth/{provider}`의 값과 같다. */
export type OAuthProvider = 'kakao' | 'naver';

/**
 * 인증 상태. 서버가 내려준 `authStatus`를 그대로 쓴다.
 *
 * 신규 회원 판별은 이 값으로만 한다. `isNewUser` 같은 별도 플래그는 명세에 없고,
 * 온보딩을 중간에 그만둔 기존 회원도 `ONBOARDING_REQUIRED`로 다시 내려온다.
 */
export type AuthStatus = 'AUTHENTICATED' | 'ONBOARDING_REQUIRED' | 'UNAUTHENTICATED';

/** 서비스 API를 호출할 수 있는 토큰 한 쌍. */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * `POST /api/v1/auth/oauth/{provider}` 응답.
 *
 * 두 분기가 서로 다른 필드를 주므로 판별 유니온으로 받는다.
 * `AUTHENTICATED`에는 `onboardingToken`이 없고, 그 반대도 마찬가지다.
 */
export type OAuthLoginResult =
  | ({ authStatus: 'AUTHENTICATED' } & TokenPair)
  | { authStatus: 'ONBOARDING_REQUIRED'; onboardingToken: string };

/**
 * `POST /api/v1/auth/refresh` 응답.
 *
 * RTR(Refresh Token Rotation) 정책이라 재발급마다 두 토큰이 모두 새로 나오고
 * 요청에 쓴 refreshToken은 즉시 폐기된다. 응답을 받으면 반드시 둘 다 갈아끼워야 한다.
 */
export interface RefreshedTokens extends TokenPair {
  /** 초 단위 만료 시간. 현재는 저장하지 않고 401을 신호로 삼는다. */
  accessTokenExpiresIn: number;
  refreshTokenExpiresIn: number;
}
