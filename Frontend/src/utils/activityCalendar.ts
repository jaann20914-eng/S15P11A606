import type { ActivityDay } from '@/types/user';

/**
 * 날짜별 활동을 달력 칸으로 바꾼다.
 *
 * 서버는 그 달의 날짜만 순서대로 준다. 월요일 시작 달력에 그리려면 1일 앞의 빈칸과
 * 마지막 주를 채우는 뒤쪽 빈칸을 프론트가 만들어야 한다. 히트맵 농도도 프론트가 정한다.
 */

/** 달력 한 칸. `null`은 그 달에 속하지 않는 빈칸이다. */
export type CalendarCell = ActivityDay | null;

/** 연월. 달 이동 계산에 쓴다. */
export interface YearMonth {
  year: number;
  month: number;
}

/** 달을 앞뒤로 옮긴다. 12월에서 넘어가면 해가 바뀐다. */
export function shiftMonth({ year, month }: YearMonth, step: number): YearMonth {
  // 1~12를 0~11로 옮겨 계산한 뒤 되돌린다.
  const zeroBased = month - 1 + step;
  return { year: year + Math.floor(zeroBased / 12), month: (((zeroBased % 12) + 12) % 12) + 1 };
}

/** 두 연월의 앞뒤를 비교한다. 앞선 달이면 음수, 같으면 0, 뒤면 양수다. */
export function compareMonth(a: YearMonth, b: YearMonth): number {
  return a.year !== b.year ? a.year - b.year : a.month - b.month;
}

/** 히트맵 농도 구간. 0은 활동 없음이고 3이 가장 진하다. */
export type ActivityLevel = 0 | 1 | 2 | 3;

/** 한 주의 칸 수. 월요일 시작. */
const DAYS_IN_WEEK = 7;

/**
 * `videoPinCount`를 농도 구간으로 묶는다.
 *
 * 3개 이상은 모두 가장 진한 칸이다. 하루에 그보다 많이 올리는 경우가 드물어
 * 구간을 더 나누면 색 차이를 구분하기 어렵다.
 */
export function toActivityLevel(videoPinCount: number): ActivityLevel {
  if (videoPinCount <= 0) return 0;
  if (videoPinCount === 1) return 1;
  if (videoPinCount === 2) return 2;
  return 3;
}

/**
 * `YYYY-MM-DD`의 요일을 월요일 기준 0~6으로 돌려준다.
 *
 * 문자열을 직접 계산한다. `new Date('2026-07-01')`은 UTC로 해석돼 시간대에 따라
 * 하루씩 밀릴 수 있다.
 */
function toMondayFirstWeekday(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  // 로컬 자정으로 만들어 시간대 밀림을 피한다.
  const weekday = new Date(year, month - 1, day).getDay();
  // getDay는 일요일이 0이다. 월요일을 0으로 옮긴다.
  return (weekday + 6) % DAYS_IN_WEEK;
}

/**
 * 달력 칸 배열을 만든다.
 *
 * 앞쪽은 1일의 요일만큼, 뒤쪽은 마지막 주가 7칸이 되도록 빈칸을 채운다.
 */
export function toCalendarCells(days: ActivityDay[]): CalendarCell[] {
  if (days.length === 0) return [];

  const leading = toMondayFirstWeekday(days[0].date);
  const cells: CalendarCell[] = [...Array<CalendarCell>(leading).fill(null), ...days];

  const remainder = cells.length % DAYS_IN_WEEK;
  if (remainder > 0) cells.push(...Array<CalendarCell>(DAYS_IN_WEEK - remainder).fill(null));

  return cells;
}

/**
 * 달력 칸을 주 단위로 자른다.
 *
 * 한 줄에 7칸을 흘려보내는 대신 주마다 행을 만든다. 칸이 행 안에서 폭을 나눠 받아야
 * 앱에서도 정사각형으로 계산된다.
 */
export function toWeeks(cells: CalendarCell[]): CalendarCell[][] {
  const weeks: CalendarCell[][] = [];
  for (let index = 0; index < cells.length; index += DAYS_IN_WEEK) {
    weeks.push(cells.slice(index, index + DAYS_IN_WEEK));
  }
  return weeks;
}
