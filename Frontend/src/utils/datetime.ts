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

/** 두 시각이 같은 날인지. 로컬 기준으로 본다. */
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** `오후 2:14`. 24시간제를 12시간제로 바꾸고 정오·자정은 12로 적는다. */
function formatClock(date: Date): string {
  const hours = date.getHours();
  const meridiem = hours < 12 ? '오전' : '오후';
  const hour = hours % 12 === 0 ? 12 : hours % 12;

  return `${meridiem} ${hour}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** `26.07.23`. 연도는 뒤 두 자리만 쓴다. */
function formatShortDate(date: Date): string {
  const year = String(date.getFullYear() % 100).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}.${month}.${day}`;
}

/**
 * `14:05`. 24시간제로 시각만 남긴다.
 *
 * 모두 오늘 건인 목록에서 쓴다. 날짜가 같으니 시각만으로 순서를 읽을 수 있고, 좁은 자리에
 * 넣기에도 `오후 2:05`보다 짧다.
 *
 * 파싱할 수 없으면 빈 문자열을 반환한다.
 */
export function formatTimeOfDay(isoDate: string): string {
  const target = Date.parse(isoDate);
  if (Number.isNaN(target)) return '';

  const date = new Date(target);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * 거래 시각을 목록 표기로 바꾼다. 오늘은 `오늘 오후 2:14`, 그 밖은 `26.07.23 오후 7:03`.
 *
 * 상대 표현(`2시간 전`)을 쓰지 않는다. 크레딧 내역은 언제 얼마가 오갔는지 확인하는 화면이라
 * 정확한 시각이 필요하다.
 *
 * `Intl`을 쓰지 않고 직접 만든다. 안드로이드 Hermes는 ICU가 빠진 빌드가 있어 로케일 포맷이
 * 기기에 따라 달라진다.
 *
 * 파싱할 수 없으면 빈 문자열을 반환해 호출부가 라벨을 통째로 숨길 수 있게 한다.
 */
export function formatTransactionTime(isoDate: string, now: number = Date.now()): string {
  const target = Date.parse(isoDate);
  if (Number.isNaN(target)) return '';

  const date = new Date(target);
  const clock = formatClock(date);

  return isSameDay(date, new Date(now)) ? `오늘 ${clock}` : `${formatShortDate(date)} ${clock}`;
}
