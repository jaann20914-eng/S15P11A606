/**
 * 닉네임 형식.
 *
 * 서버와 같은 규칙을 쓴다. 형식이 어긋난 값을 보내면 `INVALID_NICKNAME`으로 돌아오는데,
 * 그때는 중복 조회도 하지 않으므로 보내기 전에 걸러 왕복을 줄인다.
 *
 * 최종 판단은 서버가 한다. 저장할 때 유효성과 중복을 다시 검사하므로 여기서 통과했다고
 * 저장이 보장되지는 않는다.
 */

/** 닉네임 최소·최대 길이. 온보딩과 마이페이지가 같은 값을 쓴다. */
export const MIN_NICKNAME_LENGTH = 2;
export const MAX_NICKNAME_LENGTH = 12;

/**
 * 허용 문자와 길이.
 *
 * 숫자·영문·완성형 한글만 쓸 수 있다. 공백·기호·이모지는 물론 자모 단독(`ㄱ`, `ㅏ`)도
 * 완성형 범위 밖이라 쓸 수 없다.
 */
const NICKNAME_PATTERN = new RegExp(
  `^[0-9A-Za-z가-힣]{${MIN_NICKNAME_LENGTH},${MAX_NICKNAME_LENGTH}}$`,
);

/** 형식을 만족하는지. */
export function isValidNickname(nickname: string): boolean {
  return NICKNAME_PATTERN.test(nickname);
}

/**
 * 서버와 같은 방식으로 정규화한다.
 *
 * 영문 대소문자는 구분하지 않는다. `Waggle`과 `waggle`은 같은 닉네임이고 소문자로 저장된다.
 * 허용 문자에 로케일별 대소문자 규칙이 다른 글자가 없어 로케일을 지정하지 않는다.
 */
export function normalizeNickname(nickname: string): string {
  return nickname.toLowerCase();
}
