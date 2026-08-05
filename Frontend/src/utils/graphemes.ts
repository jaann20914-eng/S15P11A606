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

/**
 * 코드 포인트 뒤에 붙어 앞 글자와 한 덩어리가 되는 것들.
 *
 * 변형 선택자(이모지·문자 표시 지정), 피부색, 키캡, 결합 부호. 이들이 붙어도 보이는 글자는
 * 하나다.
 */
const TRAILING_COMBINER = /^[\u{FE0E}\u{FE0F}\u{20E3}\u{0300}-\u{036F}\u{1F3FB}-\u{1F3FF}]$/u;

/** 국기 이모지의 재료. 두 개가 나란히 오면 국기 하나다. */
const REGIONAL_INDICATOR = /^[\u{1F1E6}-\u{1F1FF}]$/u;

/** ZWJ(zero-width joiner). 앞뒤 이모지를 한 글자로 잇는다. 보이지 않는 문자라 코드로 적는다. */
const ZERO_WIDTH_JOINER = String.fromCharCode(0x200d);

/**
 * `Intl.Segmenter`가 없는 환경(Hermes)의 대체 분할.
 *
 * 코드 포인트로만 나누면 ❤️(하트+변형 선택자)가 2자, 👍🏻(엄지+피부색)가 2자, 국기가 2자로
 * 세어진다. 그래서 이모지만 채우면 50자 안내와 달리 40자 남짓에서 입력이 막혔다(2026-08-05).
 * 흔한 결합 규칙 — 변형 선택자 · 피부색 · 키캡 · 결합 부호 · ZWJ 연결 · 국기 쌍 — 을 앞
 * 글자에 붙여 세면 일상적인 이모지는 눈에 보이는 대로 세어진다. 완전한 구현은 아니지만
 * 서버(ICU 기준)보다 **많게 세는 일은 없어**, 잘려도 서버가 거절하는 일은 생기지 않는다.
 */
function splitFallback(value: string): string[] {
  const points = Array.from(value);
  const clusters: string[] = [];

  for (let index = 0; index < points.length; index += 1) {
    let cluster = points[index];

    // 국기: 지역 지시 문자 두 개가 한 글자다.
    if (
      REGIONAL_INDICATOR.test(cluster) &&
      index + 1 < points.length &&
      REGIONAL_INDICATOR.test(points[index + 1])
    ) {
      index += 1;
      cluster += points[index];
    }

    while (index + 1 < points.length) {
      const next = points[index + 1];

      if (TRAILING_COMBINER.test(next)) {
        index += 1;
        cluster += next;
        continue;
      }

      // ZWJ는 앞뒤를 한 글자로 잇는다(가족·직업 이모지). 다음 글자까지 함께 삼킨다.
      if (next === ZERO_WIDTH_JOINER && index + 2 < points.length) {
        index += 2;
        cluster += next + points[index];
        continue;
      }

      break;
    }

    clusters.push(cluster);
  }

  return clusters;
}

/** 보이는 글자 단위로 쪼갠다. */
function split(value: string): string[] {
  if (!segmenter) return splitFallback(value);
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
