const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * ISO 8601 시각을 "40초 전" 형태의 상대 표현으로 바꾼다.
 * 미래 시각이거나 파싱할 수 없으면 빈 문자열을 반환해 호출부가 라벨을 통째로 숨길 수 있게 한다.
 */
export function formatRelativeTime(isoDate: string, now: number = Date.now()): string {
  const target = Date.parse(isoDate);
  if (Number.isNaN(target)) return '';

  const elapsed = now - target;
  if (elapsed < 0) return '';

  if (elapsed < MINUTE) return `${Math.max(1, Math.floor(elapsed / SECOND))}초 전`;
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}분 전`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}시간 전`;

  return `${Math.floor(elapsed / DAY)}일 전`;
}
