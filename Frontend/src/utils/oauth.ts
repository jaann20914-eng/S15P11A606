import * as Crypto from 'expo-crypto';
import { kakaoRestApiKey, naverClientId } from '@/constants/env';
import type { OAuthProvider } from '@/types/auth';

/**
 * 인가 코드를 돌려받을 주소.
 *
 * 카카오·네이버 콘솔과 백엔드에 등록된 값과 **한 글자도 다르면 안 된다**.
 * 그래서 환경변수로 빼지 않고 상수로 고정한다 — 오타 난 `.env` 하나로
 * 실기기에서만 실패하는 상황을 만들지 않기 위해서다.
 *
 * 앱은 이 주소를 Android App Link로 가로채 복귀한다(`app.json`의 `intentFilters`).
 */
const REDIRECT_URI: Record<OAuthProvider, string> = {
  kakao: 'https://i15a606.p.ssafy.io/oauth/callback/kakao',
  naver: 'https://i15a606.p.ssafy.io/oauth/callback/naver',
};

const AUTHORIZE_URL: Record<OAuthProvider, string> = {
  kakao: 'https://kauth.kakao.com/oauth/authorize',
  naver: 'https://nid.naver.com/oauth2.0/authorize',
};

/** 제공자별 클라이언트 식별자. 네이티브 SDK를 쓰지 않으므로 공개 키만 필요하다. */
const CLIENT_ID: Record<OAuthProvider, string> = {
  kakao: kakaoRestApiKey,
  naver: naverClientId,
};

export function oauthRedirectUri(provider: OAuthProvider): string {
  return REDIRECT_URI[provider];
}

/**
 * 커스텀 스킴 복귀 주소. `app.json`의 `scheme`과 같아야 한다.
 *
 * 카카오·네이버 콘솔은 Redirect URI에 http(s)만 받으므로 제공자에게 직접 줄 수는 없다.
 * 대신 **백엔드가 위 https 주소를 받아 이 주소로 302**를 주면 복귀가 확실해진다.
 * Chrome은 https를 자기가 처리할 수 있어 Custom Tab 안에서 앱으로 넘기지 않지만,
 * 모르는 스킴은 처리할 방법이 없어 반드시 인텐트를 던진다.
 */
export function appSchemeRedirectUri(provider: OAuthProvider): string {
  return `waglewagle://oauth/callback/${provider}`;
}

/**
 * 복귀로 인정할 주소들. https(App Link)와 커스텀 스킴을 모두 받는다.
 *
 * 둘 중 어느 쪽으로 와도 처리되므로, 백엔드가 302를 넣기 전과 후 모두 같은 코드로 동작한다.
 */
export function acceptedRedirectPrefixes(provider: OAuthProvider): string[] {
  return [REDIRECT_URI[provider], appSchemeRedirectUri(provider)];
}

/** 해당 제공자의 로그인을 시도할 수 있는지. 키가 비어 있으면 버튼을 잠근다. */
export function hasOAuthClientId(provider: OAuthProvider): boolean {
  return CLIENT_ID[provider].length > 0;
}

/**
 * CSRF 방지용 `state`.
 *
 * 브라우저를 거쳐 돌아온 인가 코드가 우리가 시작한 요청의 것인지 확인하는 유일한 수단이라
 * `Math.random()` 대신 암호학적 난수를 쓴다. 값은 메모리에만 두고 저장하지 않는다.
 */
export function createOAuthState(): string {
  return Array.from(Crypto.getRandomBytes(16), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * 시스템 브라우저에 띄울 인증 주소를 만든다.
 *
 * 카카오·네이버 모두 표준 Authorization Code 흐름이라 파라미터 이름이 같다.
 * 동의 항목(`scope`)은 콘솔 설정을 따르므로 앱에서 보내지 않는다.
 */
export function buildAuthorizeUrl(provider: OAuthProvider, state: string): string {
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID[provider],
    redirect_uri: REDIRECT_URI[provider],
    state,
  });

  return `${AUTHORIZE_URL[provider]}?${query.toString()}`;
}
