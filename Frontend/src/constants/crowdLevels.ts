import { crowdPalette } from './theme';

/**
 * 혼잡도 4단계 (공통DESIGN §4.2).
 * 프로필 뷰 포인트 링, 이모지 반응 게이지, 크레딧 온도 게이지에 공통 적용한다.
 *
 * `level`(1~4)은 API 명세의 `crowdLevel` 값과 일치하고, `key`는 서버 enum과 이름을 맞췄다.
 * 링/게이지는 그라데이션이 아니라 `fill` 구간 단위로 채운다.
 */
export const crowdLevels = [
  {
    key: 'QUIET',
    level: 1,
    label: '유유자적',
    group: 'RELAXED',
    color: crowdPalette.quiet,
    fill: { from: 0, to: 30 },
  },
  {
    key: 'NOT_CROWDED',
    level: 2,
    label: '여유',
    group: 'RELAXED',
    color: crowdPalette.notCrowded,
    fill: { from: 30, to: 50 },
  },
  {
    key: 'CROWDED',
    level: 3,
    label: '와글',
    group: 'WAGLE',
    color: crowdPalette.crowded,
    fill: { from: 50, to: 80 },
  },
  {
    key: 'VERY_CROWDED',
    level: 4,
    label: '와글와글',
    group: 'WAGLE',
    color: crowdPalette.veryCrowded,
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

/** 채움 비율(0~100)이 속한 단계 색을 반환한다. 링/게이지 구간 채우기용. */
export function getCrowdColorByFill(percent: number): string {
  const clamped = Math.min(100, Math.max(0, percent));
  const matched = crowdLevels.find((item) => clamped >= item.fill.from && clamped < item.fill.to);
  return (matched ?? crowdLevels[crowdLevels.length - 1]).color;
}
