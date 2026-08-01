import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DAYS_OF_WEEK, dayOfWeekLabel, type DayCrowdStat, type DayOfWeek } from '@/types/place';
import { colors, radius, spacing, type } from '@/constants/theme';

/**
 * 요일별 혼잡도 그래프.
 *
 * 원본은 장소 상세 화면(`app/place/[placeId]/index.tsx`)의 `CrowdChart`다. 모양·간격·색을
 * 그대로 옮기고 값만 고정 배열에서 서버 응답(`weeklyCrowdStats`)으로 바꿨다. 추천 상세도
 * 같은 그래프를 보여주므로 두 벌을 만들지 않으려고 공용으로 뺐다.
 *
 * **장소 상세 담당자에게**: 그 화면의 지역 `CrowdChart`를 지우고 이걸 import 하면 한 벌로
 * 합쳐진다. 값은 `GET /api/v1/places/{placeId}`의 `weeklyCrowdStats`를 그대로 넘기면 된다.
 */

export interface CrowdChartProps {
  /** 요일별 평균 혼잡 단계. 빈 배열이면 안내만 보여준다. */
  stats: DayCrowdStat[];
  /** 강조할 요일. 기본은 오늘이다. */
  today?: DayOfWeek;
  /** 오른쪽 위 보조 문구. */
  caption?: string;
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
 * 선을 그릴 폭은 화면 너비에서 여백을 뺀 값이다.
 *
 * 재서 쓰지 않는다. 탭 안에 있는 화면은 숨겨진 채로 마운트되는데, 그때 `onLayout`이 0으로
 * 오고 화면이 드러날 때 다시 오지 않아 선이 영영 그려지지 않는다.
 *
 * 화면 여백 16 × 2 + 카드 안쪽 여백 20 × 2 + 축 라벨 30 = 102.
 */
const PLOT_INSET = 102;

/** 원본과 같은 최대 폭. 넓은 화면에서 선이 지나치게 늘어나지 않게 한다. */
const PLOT_MAX_WIDTH = 292;

export function CrowdChart({ stats, today = todayOfWeek(), caption = '최근 4주 평균' }: CrowdChartProps) {
  const { width } = useWindowDimensions();
  const plotWidth = Math.max(Math.min(width - PLOT_INSET, PLOT_MAX_WIDTH), 0);

  // 서버가 빈 배열을 줄 수 있다. 요일 칸은 늘 일곱이라 순서표를 기준으로 값을 맞춘다.
  const levels = DAYS_OF_WEEK.map(
    (day) => stats.find((stat) => stat.dayOfWeek === day)?.averageCrowdLevel ?? null,
  );
  const hasAnyLevel = levels.some((level) => level !== null);

  const step = plotWidth / (DAYS_OF_WEEK.length - 1);
  const activeIndex = DAYS_OF_WEEK.indexOf(today);
  const activeLevel = levels[activeIndex];

  return (
    <View style={s.card}>
      <View style={s.head}>
        <Text style={s.title}>요일별 혼잡도</Text>
        <Text style={s.caption}>{caption}</Text>
      </View>

      {!hasAnyLevel ? (
        <Text style={s.empty}>아직 요일별 혼잡도를 계산할 만큼 기록이 쌓이지 않았어요</Text>
      ) : (
        <>
          <View style={s.body}>
            <View style={s.axisLabels}>
              <Text style={s.axisText}>붐빔</Text>
              <Text style={s.axisText}>여유</Text>
            </View>

            <View style={[s.plot, { width: plotWidth, height: PLOT_HEIGHT }]}>
              {/* 가운데 점선이 여유와 붐빔의 경계다. */}
              <View style={[s.gridLine, { top: toY(WAGLE_FROM) }]} />

              {/* 오늘 자리를 세로 띠로 짚어 준다. 아래 요일 칩과 같은 x에 놓인다. */}
              {activeLevel !== null && <View style={[s.activeBand, { left: activeIndex * step - 14 }]} />}

              <LinearGradient
                colors={['rgba(196,230,0,.24)', 'rgba(196,230,0,.02)']}
                style={s.fill}
              />

              {/*
                선분은 값이 있는 이웃한 두 요일 사이에만 긋는다. 사이에 빈 요일이 있으면
                건너뛰지 않고 끊는다 — 이어 버리면 없는 집계를 있는 것처럼 보여주게 된다.
              */}
              {levels.slice(0, -1).map((level, index) => {
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

              {levels.map((level, index) =>
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
              {activeLevel !== null && (
                <View style={[s.tooltip, { left: activeIndex * step - 23 }]}>
                  <Text style={s.tooltipText}>{activeLevel >= WAGLE_FROM ? '붐빔' : '여유'}</Text>
                </View>
              )}
            </View>
          </View>

          <View style={[s.dayRow, { width: plotWidth + 30 }]}>
            {DAYS_OF_WEEK.map((day) => (
              <View key={day} style={[s.dayChip, day === today && s.dayChipActive]}>
                <Text style={[s.dayText, day === today && s.dayTextActive]}>
                  {dayOfWeekLabel[day]}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {},
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...type.label, fontWeight: '600', color: colors.dark },
  caption: { ...type.caption, color: colors.gray400 },
  empty: { ...type.caption, color: colors.gray400, marginTop: spacing.x4 },
  body: { flexDirection: 'row', alignItems: 'stretch', marginTop: spacing.x5 },
  axisLabels: { width: 30, justifyContent: 'space-between', paddingVertical: 2 },
  axisText: { fontSize: 10, lineHeight: 14, color: colors.gray400 },
  plot: { position: 'relative', overflow: 'visible' },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderTopColor: colors.gray200,
  },
  /** 오늘 자리를 짚는 세로 띠. 아래 요일 칩과 이어 보이도록 아래로 조금 더 내려간다. */
  activeBand: {
    position: 'absolute',
    top: -6,
    bottom: -14,
    width: 28,
    borderRadius: radius.pill,
    backgroundColor: colors.limeSoft,
  },
  fill: { position: 'absolute', left: 0, right: 0, top: 24, bottom: 0 },
  segment: {
    position: 'absolute',
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.lime,
    transformOrigin: 'left center' as never,
  },
  dot: {
    position: 'absolute',
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: 6,
    borderWidth: 3,
    borderColor: colors.lime,
    backgroundColor: colors.white,
  },
  dotActive: {
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: colors.lime,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 4,
    elevation: 3,
  },
  tooltip: {
    position: 'absolute',
    top: -28,
    minWidth: 48,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.dark,
  },
  tooltipText: { fontSize: 10, lineHeight: 14, fontWeight: '600', color: colors.white },
  dayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.x4,
    paddingLeft: 30,
  },
  dayChip: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  dayChipActive: { borderColor: colors.lime, backgroundColor: colors.lime },
  dayText: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.gray600 },
  dayTextActive: { color: colors.dark, fontWeight: '700' },
});
