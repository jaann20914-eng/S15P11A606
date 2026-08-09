import { color, colors, crowdPalette, crowdTextPalette } from './theme';

/**
 * 혼잡도 4단계 (공통DESIGN §4.2).
 * 프로필 뷰 포인트 링, 이모지 반응 게이지, 크레딧 온도 게이지에 공통 적용한다.
 *
 * `level`(1~4)은 API 명세의 `crowdLevel` 값과 일치하고, `key`는 서버 enum과 이름을 맞췄다.
 * 링/게이지는 그라데이션이 아니라 `fill` 구간 단위로 채운다.
 *
 * `color`는 칩·링을 **채우는** 파스텔이고, `textColor`는 같은 단계를 **글자로 쓸 때**의 농도다.
 * 흰 배경에서 파스텔로 글자를 쓰면 읽히지 않아 둘을 나눠 둔다(요일별 혼잡도 그래프가 쓴다).
 */
export const crowdLevels = [
  {
    key: 'QUIET',
    level: 1,
    label: '유유자적',
    group: 'RELAXED',
    color: crowdPalette.quiet,
    textColor: crowdTextPalette.quiet,
    fill: { from: 0, to: 30 },
  },
  {
    key: 'NOT_CROWDED',
    level: 2,
    label: '여유',
    group: 'RELAXED',
    color: crowdPalette.notCrowded,
    textColor: crowdTextPalette.notCrowded,
    fill: { from: 30, to: 50 },
  },
  {
    key: 'CROWDED',
    level: 3,
    label: '와글',
    group: 'WAGLE',
    color: crowdPalette.crowded,
    textColor: crowdTextPalette.crowded,
    fill: { from: 50, to: 80 },
  },
  {
    key: 'VERY_CROWDED',
    level: 4,
    label: '와글와글',
    group: 'WAGLE',
    color: crowdPalette.veryCrowded,
    textColor: crowdTextPalette.veryCrowded,
    fill: { from: 80, to: 100 },
  },
] as const;

export type CrowdLevel = (typeof crowdLevels)[number];
export type CrowdLevelKey = CrowdLevel['key'];
export type CrowdLevelValue = CrowdLevel['level'];
export type CrowdLevelLabel = CrowdLevel['label'];

/** 지도·추천 화면 상단 필터의 두 계열. API의 `filter` 쿼리 파라미터 값과 동일하다. */
export type CrowdFilter = 'relaxed' | 'wagle';

/** 필터 계열이 포함하는 단계 범위 (`relaxed` 1~2, `wagle` 3~4). */
export const crowdFilterRange: Record<CrowdFilter, { min: CrowdLevelValue; max: CrowdLevelValue }> = {
  relaxed: { min: 1, max: 2 },
  wagle: { min: 3, max: 4 },
};

/** 필터 토글에 노출하는 한글 라벨. */
export const crowdFilterLabel: Record<CrowdFilter, string> = {
  relaxed: '여유',
  wagle: '와글',
};

const byKey = new Map<CrowdLevelKey, CrowdLevel>(crowdLevels.map((item) => [item.key, item]));
const byLevel = new Map<CrowdLevelValue, CrowdLevel>(crowdLevels.map((item) => [item.level, item]));

export function getCrowdLevelByKey(key: CrowdLevelKey): CrowdLevel {
  const found = byKey.get(key);
  if (!found) throw new Error(`알 수 없는 혼잡도 단계입니다: ${key}`);
  return found;
}

/** 1~4 이외의 값이 오면 가장 가까운 단계로 보정한다 (평균 혼잡도의 소수점 대응). */
export function getCrowdLevelByValue(level: number): CrowdLevel {
  const rounded = Math.min(4, Math.max(1, Math.round(level))) as CrowdLevelValue;
  const found = byLevel.get(rounded);
  if (!found) throw new Error(`알 수 없는 혼잡도 단계입니다: ${level}`);
  return found;
}

/** 평균 혼잡 단계를 필터 계열로 분류한다. 집계할 핀이 없으면(null) 계열도 null. */
export function classifyCrowdFilter(averageLevel: number | null): CrowdFilter | null {
  if (averageLevel === null) return null;
  return averageLevel >= crowdFilterRange.wagle.min ? 'wagle' : 'relaxed';
}

/** 해당 단계가 선택된 필터 계열에 포함되는지 판정한다. */
export function matchesCrowdFilter(level: number, filter: CrowdFilter): boolean {
  const { min, max } = crowdFilterRange[filter];
  return level >= min && level <= max;
}

/**
 * 목록에서 **지금 고른 것**을 가리키는 색 한 벌.
 *
 * 카드 테두리와 그 카드 안의 컨트롤이 쓴다. 계열이 갈리는 자리라 라임 한 벌로는 모자란다 —
 * 와글 계열 장소를 골랐는데 테두리만 라임이면 지도의 자몽색 마커와 짝으로 읽히지 않는다.
 */
export interface CrowdAccent {
  /** 고른 카드의 테두리. **지도 마커의 선택 색과 같은 값이다.** */
  strong: string;
  /** 그 카드 안 컨트롤의 옅은 면(홈 카드의 상세 지름길 버튼). */
  soft: string;
  /** 그 컨트롤이 눌린 동안. 같은 계열에서 한 단계만 진해진다. */
  pressed: string;
}

/**
 * 계열별 색 한 벌.
 *
 * `strong`은 **지도 마커가 고른 핀에 쓰는 색을 그대로 본다**(`color.pin[계열].strong`). 카드와
 * 마커가 같은 장소를 가리키므로 두 색이 갈리면 짝이 아닌 것으로 보인다 — 마커 색을 바꾸면
 * 테두리가 함께 따라오도록 값을 나눠 쓰지 않고 한 곳에서 가져온다.
 *
 * `soft`·`pressed`는 계열마다 짝지어 둔 옅은 색이다(`limeSoft`↔`coralSoft`,
 * `limeControl`↔`crowded`).
 */
const accentByFilter: Record<CrowdFilter, CrowdAccent> = {
  relaxed: { strong: color.pin.relaxed.strong, soft: colors.limeSoft, pressed: colors.limeControl },
  wagle: { strong: color.pin.wagle.strong, soft: colors.coralSoft, pressed: colors.crowded },
};

/**
 * 평균 혼잡 단계가 정하는 색 한 벌.
 *
 * **상단 토글이 아니라 그 장소·핀이 실제로 붐비는 정도가 정한다.** 지금은 홈 목록이 토글로
 * 걸러져 있어 두 값이 같지만, 색의 근거를 토글에 두면 걸러지지 않는 카드가 생기는 순간
 * 거짓이 된다 — 마커가 같은 이유로 장소의 값을 싣는다(`MapMarker.tone`).
 *
 * 집계할 핀이 없어 계열을 말할 수 없으면(null) 기본인 라임을 쓴다. 근거 없이 자몽색으로
 * 칠하는 것은 "여기 붐빈다"는 잘못된 정보라 모를 때 택할 쪽이 아니다.
 */
export function getCrowdAccent(averageLevel: number | null): CrowdAccent {
  return accentByFilter[classifyCrowdFilter(averageLevel) ?? 'relaxed'];
}

/** 채움 비율(0~100)이 속한 단계 색을 반환한다. 링/게이지 구간 채우기용. */
export function getCrowdColorByFill(percent: number): string {
  const clamped = Math.min(100, Math.max(0, percent));
  const matched = crowdLevels.find((item) => clamped >= item.fill.from && clamped < item.fill.to);
  return (matched ?? crowdLevels[crowdLevels.length - 1]).color;
}
