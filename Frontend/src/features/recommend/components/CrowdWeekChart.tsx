import { Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DAYS_OF_WEEK, dayOfWeekLabel, type DayCrowdStat, type DayOfWeek } from '@/types/place';
import { recommendStyles as s } from '../styles';

export interface CrowdWeekChartProps {
  /** 요일별 평균 혼잡 단계. 빈 배열이면 안내만 보여준다. */
  stats: DayCrowdStat[];
  /** 강조할 요일. 기본은 오늘이다. */
  today?: DayOfWeek;
}

/** 꺾은선이 차지하는 높이(px). 위가 붐빔, 아래가 여유다. */
const PLOT_HEIGHT = 82;

/** 점 지름. 좌표에서 절반만큼 빼야 점의 중심이 값에 맞는다. */
const DOT_SIZE = 11;

/** 혼잡 단계 범위. 서버가 1~4로 관리한다. */
const MIN_LEVEL = 1;
const MAX_LEVEL = 4;

/** 붐빔으로 읽는 경계. 명세와 같이 3.0부터다. */
const WAGLE_FROM = 3;

/**
 * 꺾은선 좌우로 빠지는 폭(px). 화면 폭에서 이만큼 뺀 값이 선이 그려질 너비다.
 *
 * 화면 여백 16 × 2 + 카드 안쪽 여백 20 × 2 + 축 라벨 30 = 102.
 *
 * 재서 쓰지 않는 이유가 있다. 이 화면은 탭 안에 있어 처음에는 숨겨진 채로 마운트되는데,
 * 그때 `onLayout`이 0으로 오고 화면이 드러날 때 다시 오지 않는다. 그러면 선이 영영 그려지지
 * 않는다. 여백은 이 파일이 쓰는 스타일에서 정해지므로 계산이 어긋날 일도 없다.
 */
const PLOT_INSET = 102;

/** 자바스크립트 요일 번호(일=0) → 서버 요일 코드. */
const DAY_BY_INDEX: readonly DayOfWeek[] = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function todayOfWeek(): DayOfWeek {
  return DAY_BY_INDEX[new Date().getDay()];
}

/** 혼잡 단계를 꺾은선의 y 좌표로. 4단계가 맨 위(붐빔)다. */
function toY(level: number): number {
  const ratio = (level - MIN_LEVEL) / (MAX_LEVEL - MIN_LEVEL);
  return PLOT_HEIGHT - ratio * PLOT_HEIGHT;
}

/**
 * 요일별 혼잡도.
 *
 * 서버가 주는 값은 요일당 평균 단계 하나뿐이고, 집계가 없는 요일은 `null`로 온다. 그런 요일은
 * 점을 찍지 않고 선도 잇지 않는다 — 0으로 떨어뜨리면 "그날은 한산하다"는 없는 사실이 된다.
 *
 * 선을 그릴 폭은 화면 너비에서 여백을 뺀 값이다(`PLOT_INSET`).
 */
export function CrowdWeekChart({ stats, today = todayOfWeek() }: CrowdWeekChartProps) {
  const plotWidth = Math.max(useWindowDimensions().width - PLOT_INSET, 0);

  // 서버가 빈 배열을 줄 수 있다. 요일 칸은 늘 일곱이라 순서표를 기준으로 값을 맞춘다.
  const levels = DAYS_OF_WEEK.map(
    (day) => stats.find((stat) => stat.dayOfWeek === day)?.averageCrowdLevel ?? null,
  );
  const hasAnyLevel = levels.some((level) => level !== null);

  const step = plotWidth > 0 ? plotWidth / (DAYS_OF_WEEK.length - 1) : 0;
  const activeIndex = DAYS_OF_WEEK.indexOf(today);
  const activeLevel = levels[activeIndex];

  return (
    <View style={s.chart}>
      <View style={s.chartHead}>
        <Text style={s.chartTitle}>요일별 혼잡도</Text>
        <Text style={s.chartMeta}>최근 4주 평균</Text>
      </View>

      {hasAnyLevel ? (
        <>
          <View style={s.chartBody}>
            <View style={s.axisLabels}>
              <Text style={s.axisText}>붐빔</Text>
              <Text style={s.axisText}>여유</Text>
            </View>

            <View style={[s.plot, { width: plotWidth, height: PLOT_HEIGHT }]}>
              {/* 가운데 점선이 여유와 붐빔의 경계다. */}
              <View style={[s.gridLine, { top: toY(WAGLE_FROM) }]} />

              {/* 오늘 자리를 세로 띠로 짚어 준다. 아래 요일 칩과 같은 x에 놓인다. */}
              {step > 0 && activeLevel !== null && (
                <View style={[s.activeBand, { left: activeIndex * step - 14 }]} />
              )}

              <LinearGradient
                colors={['rgba(196,230,0,.24)', 'rgba(196,230,0,.02)']}
                style={s.plotFill}
              />

              {/*
                선분은 값이 있는 이웃한 두 요일 사이에만 긋는다. 사이에 빈 요일이 있으면
                건너뛰지 않고 끊는다 — 이어 버리면 없는 집계를 있는 것처럼 보여주게 된다.
              */}
              {step > 0 &&
                levels.slice(0, -1).map((level, index) => {
                  const next = levels[index + 1];
                  if (level === null || next === null) return null;

                  const from = toY(level);
                  const to = toY(next);
                  const length = Math.sqrt(step * step + (to - from) ** 2);
                  const angle = (Math.atan2(to - from, step) * 180) / Math.PI;

                  return (
                    <View
                      key={`segment-${index}`}
                      style={[
                        s.segment,
                        {
                          left: index * step,
                          top: from,
                          width: length,
                          transform: [{ rotate: `${angle}deg` }],
                        },
                      ]}
                    />
                  );
                })}

              {step > 0 &&
                levels.map((level, index) =>
                  level === null ? null : (
                    <View
                      key={`dot-${index}`}
                      style={[
                        s.dot,
                        index === activeIndex && s.dotActive,
                        { left: index * step - DOT_SIZE / 2, top: toY(level) - DOT_SIZE / 2 },
                      ]}
                    />
                  ),
                )}

              {/* 오늘의 값만 말풍선으로 읽어 준다. 일곱 개를 다 적으면 선이 보이지 않는다. */}
              {step > 0 && activeLevel !== null && (
                <View style={[s.tooltip, { left: activeIndex * step - 23 }]}>
                  <Text style={s.tooltipText}>{activeLevel >= WAGLE_FROM ? '붐빔' : '여유'}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={s.dayRow}>
            {DAYS_OF_WEEK.map((day) => (
              <View key={day} style={[s.dayChip, day === today && s.dayChipActive]}>
                <Text style={[s.dayText, day === today && s.dayTextActive]}>
                  {dayOfWeekLabel[day]}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <Text style={s.chartEmpty}>아직 요일별 혼잡도를 계산할 만큼 기록이 쌓이지 않았어요</Text>
      )}
    </View>
  );
}
