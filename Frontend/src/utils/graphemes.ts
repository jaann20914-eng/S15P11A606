/**
 * 사용자 눈에 보이는 글자 단위(grapheme)로 문자열을 세고 자른다.
 *
 * 자바스크립트의 `length`는 UTF-16 단위라 이모지 하나가 2로 세어진다.
 * `😀`가 2자, `👨‍👩‍👧`는 8자가 되어 "50자"라는 안내와 실제 입력량이 어긋난다.
 * 공백도 한 글자로 센다.
 *
 * `Intl.Segmenter`가 있으면 그것을 쓴다. 없는 환경에서는 코드 포인트 단위로 떨어지는데,
 * 이 경우 결합 문자(가족 이모지, 피부색 변형, 국기)는 여러 글자로 세어진다.
 */

/** 런타임에 `Intl.Segmenter`가 있으면 재사용한다. 매번 만들면 비싸다. */
const segmenter = createSegmenter();

function createSegmenter(): Intl.Segmenter | null {
  if (typeof Intl === 'undefined' || typeof Intl.Segmenter !== 'function') return null;

  try {
    return new Intl.Segmenter('ko', { granularity: 'grapheme' });
  } catch {
    return null;
  }
}

/** 보이는 글자 단위로 쪼갠다. */
function split(value: string): string[] {
  if (!segmenter) return Array.from(value);
  return Array.from(segmenter.segment(value), (part) => part.segment);
}

/** 보이는 글자 수. 공백을 포함한다. */
export function countGraphemes(value: string): number {
  return split(value).length;
}

/**
 * 보이는 글자 수를 `max`로 맞춘다. 넘치지 않으면 원본을 그대로 돌려준다.
 *
 * 이모지 중간을 자르지 않으므로 깨진 문자가 남지 않는다.
 */
export function truncateGraphemes(value: string, max: number): string {
  const parts = split(value);
  if (parts.length <= max) return value;
  return parts.slice(0, max).join('');
}
