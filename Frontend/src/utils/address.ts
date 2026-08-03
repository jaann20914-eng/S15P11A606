/**
 * 주소에서 뒤에 붙은 괄호를 떼어 낸다.
 *
 * 카카오 주소는 `서울 광진구 동일로 60길 47 1층 (군자동)`처럼 도로명 뒤에 법정동을 괄호로
 * 붙여 준다. 한 줄로 두면 좁은 화면에서 그 괄호 때문에 줄이 넘치거나 잘려, 정작 필요한 도로명이
 * 가려진다. 두 줄로 나누면 앞줄이 온전히 남는다.
 *
 * 괄호가 없으면 뒷줄은 null이다. 서버가 형식을 바꾸거나 동 정보가 없는 주소도 있어서,
 * 없을 때를 정상으로 다룬다.
 */
export interface SplitAddress {
  /** 도로명까지의 본문. */
  street: string;
  /** 괄호에 들어 있던 부분. 괄호를 포함한 형태 그대로 돌려준다. */
  region: string | null;
}

/** 문장 끝의 괄호 한 덩어리만 본다. 중간에 있는 괄호는 주소의 일부라 건드리지 않는다. */
const TRAILING_PARENTHESES = /\s*(\([^()]*\))\s*$/;

export function splitAddress(address: string): SplitAddress {
  const matched = TRAILING_PARENTHESES.exec(address);

  if (matched === null) return { street: address.trim(), region: null };

  return { street: address.slice(0, matched.index).trim(), region: matched[1] };
}
