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
 * 와글 토글로 보고 있는데 테두리만 라임이면 화면 안에서 색이 어긋나 보인다.
 */
export interface CrowdAccent {
  /** 고른 카드의 테두리. 계열 색 중 가장 진한 값이다. */
  strong: string;
  /** 그 카드 안 컨트롤의 옅은 면(홈 카드의 상세 지름길 버튼). */
  soft: string;
  /** 그 컨트롤이 눌린 동안. 같은 계열에서 한 단계만 진해진다. */
  pressed: string;
}

/**
 * 계열별 색 한 벌.
 *
 * `strong`은 **지도 마커가 그 계열에 쓰는 가장 진한 색을 그대로 본다**(`color.pin[계열].strong`).
 * 값을 따로 적어 두면 마커 색을 바꿀 때 한쪽만 남아 갈린다.
 *
 * `soft`·`pressed`는 계열마다 짝지어 둔 옅은 색이다(`limeSoft`↔`coralSoft`,
 * `limeControl`↔`crowded`).
 */
const accentByFilter: Record<CrowdFilter, CrowdAccent> = {
  relaxed: { strong: color.pin.relaxed.strong, soft: colors.limeSoft, pressed: colors.limeControl },
  wagle: { strong: color.pin.wagle.strong, soft: colors.coralSoft, pressed: colors.crowded },
};

/**
 * 지금 보고 있는 계열의 색 한 벌.
 *
 * **상단 혼잡도 토글이 정한다**(2026-08-09 팀 결정). 이 색은 "이 장소가 얼마나 붐비는지"를
 * 알리는 정보가 아니라 **지금 어느 카드를 보고 있는지 짚어 주는 디자인 장치**라, 한 화면
 * 안에서 하나의 계열로 읽혀야 한다. 장소마다 제 혼잡도로 칠하면 같은 목록에서 테두리 색이
 * 갈려 고장난 것으로 보인다.
 *
 * **마커는 이 값을 쓰지 않는다.** 그쪽은 그 장소·핀이 실제로 붐비는 정도를 담은 정보라
 * 근거가 다르다(`MapMarker.tone`) — 예전에 마커를 토글로 칠했다가 여유한 장소가 자몽색으로
 * 그려진 적이 있다(2026-08-05).
 */
export function getCrowdAccent(filter: CrowdFilter): CrowdAccent {
  return accentByFilter[filter];
}

/** 채움 비율(0~100)이 속한 단계 색을 반환한다. 링/게이지 구간 채우기용. */
export function getCrowdColorByFill(percent: number): string {
  const clamped = Math.min(100, Math.max(0, percent));
  const matched = crowdLevels.find((item) => clamped >= item.fill.from && clamped < item.fill.to);
  return (matched ?? crowdLevels[crowdLevels.length - 1]).color;
}
