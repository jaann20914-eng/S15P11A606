import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DAYS_OF_WEEK, dayOfWeekLabel, type DayCrowdStat, type DayOfWeek } from '@/types/place';
import { colors, radius, spacing, type } from '@/constants/theme';

/**
 * 요일별 혼잡도 그래프.
 *
 * 장소 상세와 추천 상세가 함께 쓴다. 값은 `GET /api/v1/places/{placeId}`의
 * `weeklyCrowdStats`를 그대로 넘기면 된다 — 다른 화면도 같은 모양의 배열만 주면 된다.
 *
 * **요일 칩을 눌러 요일을 바꿔 볼 수 있다.** 처음에는 오늘이 골라져 있다. 일곱 요일 값이
 * `stats` 안에 이미 다 들어 있으므로 고를 때 다시 조회하지 않는다 — 목업이든 실서버든
 * 동작이 같고, 나중에 API가 붙어도 이 컴포넌트는 손댈 것이 없다.
 *
 * 배경은 기본으로 그리지 않는다. 이미 카드 안에 놓는 화면이 있어서다. 그래프만 한 장으로
 * 세울 때는 `surface`를 켜면 된다 — 그러면 안쪽 여백까지 `PLOT_INSET`이 전제하는 값으로
 * 맞춰지므로, 감싸는 쪽에서 여백을 따로 맞출 필요가 없다.
 *
 * 그리는 규칙은 셋이다.
 * - 요일 칸은 **늘 일곱**이다. 서버가 일부 요일을 빼고 주거나 빈 배열을 주더라도 순서표
 *   (`DAYS_OF_WEEK`)를 기준으로 자리를 맞춘다.
 * - 집계가 없는 요일은 점을 찍지 않고 선도 잇지 않는다. 건너뛰어 이으면 없는 값을 있는 것처럼
 *   보여주게 된다.
 * - 값이 하나도 없으면 그래프 대신 안내 문구만 보여준다.
 *
 * 선은 사각형 View를 회전시켜 잇는다. 이 프로젝트에는 `react-native-svg`가 없어서 곡선을
 * 그릴 수단이 없다. 시안의 부드러운 곡선과는 그만큼 차이가 있다.
 */

export interface CrowdChartProps {
  /** 요일별 평균 혼잡 단계. 빈 배열이면 안내만 보여준다. */
  stats: DayCrowdStat[];
  /** 처음 강조할 요일. 기본은 오늘이다. 이후에는 사용자가 요일 칩으로 바꾼다. */
  today?: DayOfWeek;
  /** 오른쪽 위 보조 문구. 기본값이 서버 집계 방식과 맞으므로 웬만하면 그대로 둔다. */
  caption?: string;
  /** 요일을 고를 때마다 알린다. 고른 요일을 화면이 따로 쓸 때만 넘기면 된다. */
  onSelectDay?: (day: DayOfWeek) => void;
  /**
   * 흰 카드 배경을 스스로 그릴지. 기본은 그리지 않는다.
   *
   * 이미 카드 안에 놓는 화면(추천 상세의 `infoCard`)이 있어서 기본을 켜 두면 카드가 겹친다.
   * 그래프만 따로 한 장으로 세우는 화면(장소 상세)이 켠다.
   *
   * 스스로 그리지 않을 때도 **감싸는 카드의 안쪽 여백은 `CARD_PADDING`이어야 한다.** 선을
   * 그릴 폭을 그 값으로 계산하기 때문이다(`PLOT_INSET`).
   */
  surface?: boolean;
}

/**
 * 오른쪽 위에 적는 집계 방식.
 *
 * 서버(`PlaceDetailService.loadWeeklyCrowdStats`)는 **요청 시각 ±30분의 시간대**만 잘라
 * 요일별로 평균을 낸다. 기간 제한은 없어서 쌓인 기록 전부가 들어간다.
 *
 * 그래서 이 그래프는 "수요일이 붐비는가"가 아니라 **"수요일 이맘때가 붐비는가"**를 말한다.
 * 예전 기본값이던 `최근 4주 평균`은 어느 쪽도 아니어서 읽는 사람을 잘못 이끈다.
 */
const DEFAULT_CAPTION = '이 시간대 기준';

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

/** 축 라벨(붐빔·여유) 칸 너비. 요일 칩을 점과 맞추려면 이만큼 밀어야 한다. */
const AXIS_WIDTH = 30;

/** 축 라벨과 그래프 사이 여유 칸. 글자가 선에 닿지 않을 만큼만 둔다. */
const AXIS_GAP = spacing.x2;

/** 요일 칩 지름. 점과 중심을 맞추려면 이 값의 절반만큼 왼쪽으로 당긴다. */
const DAY_CHIP_SIZE = 36;

/**
 * 첫 점과 마지막 점을 그래프 안쪽으로 들여놓는 거리.
 *
 * 점을 양 끝에 딱 붙이면 그 점에 걸린 요일 칩과 세로 띠가 **점을 중심으로** 그려지므로
 * 반지름만큼 그래프 밖으로 나간다. 왼쪽으로는 축 라벨을 덮고, 오른쪽으로는 `일` 칩이 카드를
 * 뚫고 나가 잘려 보였다.
 *
 * 가장 큰 것이 칩이므로 그 반지름만큼 들여놓으면 무엇도 밖으로 나가지 않는다.
 */
const DOT_INSET = DAY_CHIP_SIZE / 2;

/** 고른 요일을 짚는 세로 띠 너비. 점과 중심을 맞추려면 절반만큼 당긴다. */
const BAND_WIDTH = 28;

/** 말풍선 너비. 가장자리 요일에서 카드 밖으로 나가지 않도록 고정 폭으로 잡아 가둔다. */
const TOOLTIP_WIDTH = 60;

/** 그래프를 감싸는 카드의 안쪽 여백. `surface`를 켜면 이 값을 쓴다. */
const CARD_PADDING = spacing.x5;

/** 화면 좌우 여백. 시트 안쪽 gutter와 같다. */
const SCREEN_GUTTER = spacing.x4;

/**
 * 선을 그릴 폭은 화면 너비에서 여백을 뺀 값이다.
 *
 * 재서 쓰지 않는다. 탭 안에 있는 화면은 숨겨진 채로 마운트되는데, 그때 `onLayout`이 0으로
 * 오고 화면이 드러날 때 다시 오지 않아 선이 영영 그려지지 않는다.
 *
 * 값을 박지 않고 조각들로 더한다. 카드 여백이나 축 라벨 폭을 고치면 여기가 함께 따라온다.
 */
const PLOT_INSET = SCREEN_GUTTER * 2 + CARD_PADDING * 2 + AXIS_WIDTH + AXIS_GAP;

/** 원본과 같은 최대 폭. 넓은 화면에서 선이 지나치게 늘어나지 않게 한다. */
const PLOT_MAX_WIDTH = 292;

export function CrowdChart({
  stats,
  today = todayOfWeek(),
  caption = DEFAULT_CAPTION,
  onSelectDay,
  surface = false,
}: CrowdChartProps) {
  const { width } = useWindowDimensions();
  const plotWidth = Math.max(Math.min(width - PLOT_INSET, PLOT_MAX_WIDTH), 0);

  /*
    고른 요일은 화면 안에서만 바뀐다. 일곱 요일 값이 이미 `stats`에 다 들어 있어서
    다시 조회할 것이 없다 — 목업이든 실서버든 이 동작은 똑같다.
  */
  const [selected, setSelected] = useState<DayOfWeek>(today);

  // 서버가 빈 배열을 줄 수 있다. 요일 칸은 늘 일곱이라 순서표를 기준으로 값을 맞춘다.
  const levels = DAYS_OF_WEEK.map(
    (day) => stats.find((stat) => stat.dayOfWeek === day)?.averageCrowdLevel ?? null,
  );
  const hasAnyLevel = levels.some((level) => level !== null);

  /*
    점 사이 간격과 각 점의 x. 그래프 폭에서 양쪽 들여쓰기를 뺀 만큼을 여섯 칸으로 나눈다.
    요일 칩과 세로 띠도 같은 x를 쓰므로 셋이 늘 같은 자리에 선다.
  */
  const step = (plotWidth - DOT_INSET * 2) / (DAYS_OF_WEEK.length - 1);
  const dotX = (index: number) => DOT_INSET + index * step;

  const activeIndex = DAYS_OF_WEEK.indexOf(selected);
  const activeLevel = levels[activeIndex];

  const chooseDay = (day: DayOfWeek) => {
    setSelected(day);
    onSelectDay?.(day);
  };

  /*
    말풍선을 고른 점 위에 두되 그래프 밖으로는 내보내지 않는다. 월·일처럼 끝 요일에서는
    점을 기준으로만 놓으면 카드를 뚫고 나간다.
  */
  const tooltipLeft = Math.min(
    Math.max(dotX(activeIndex) - TOOLTIP_WIDTH / 2, 0),
    Math.max(plotWidth - TOOLTIP_WIDTH, 0),
  );

  return (
    <View style={[s.card, surface && s.surface]}>
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
              <Text numberOfLines={1} style={s.axisText}>
                붐빔
              </Text>
              <Text numberOfLines={1} style={s.axisText}>
                여유
              </Text>
            </View>

            <View style={[s.plot, { width: plotWidth, height: PLOT_HEIGHT }]}>
              {/* 가운데 점선이 여유와 붐빔의 경계다. */}
              <View style={[s.gridLine, { top: toY(WAGLE_FROM) }]} />

              {/*
                고른 요일 자리를 세로 띠로 짚어 준다. 아래 요일 칩과 같은 x에 놓인다.
                값이 없는 요일도 띠는 그린다 — 어디를 골랐는지는 보여야 한다.
              */}
              <View style={[s.activeBand, { left: dotX(activeIndex) - BAND_WIDTH / 2 }]} />

              <LinearGradient colors={['rgba(196,230,0,.24)', 'rgba(196,230,0,.02)']} style={s.fill} />

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
                        left: dotX(index),
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
                      { left: dotX(index) - DOT_SIZE / 2, top: toY(level) - DOT_SIZE / 2 },
                    ]}
                  />
                ),
              )}

              {/*
                고른 요일만 말풍선으로 읽어 준다. 일곱 개를 다 적으면 선이 보이지 않는다.
                말풍선은 점 위가 아니라 그래프 맨 위에 고정이라, 값이 없는 요일에도 띄울 수 있다.
              */}
              <View style={[s.tooltip, { left: tooltipLeft }]}>
                <Text style={s.tooltipText}>
                  {activeLevel === null ? '기록 없음' : activeLevel >= WAGLE_FROM ? '붐빔' : '여유'}
                </Text>
              </View>
            </View>
          </View>

          {/*
            칩을 점과 같은 x에 놓는다.

            예전에는 `space-between`으로 늘어놓았는데, 그러면 첫 칩의 **왼쪽 끝**과 마지막
            칩의 **오른쪽 끝**이 양 끝에 맞춰진다. 점은 중심이 양 끝에 있으므로 칩 반지름
            만큼 안쪽으로 밀려, 가운데 요일만 맞고 월·화·토·일이 어긋나 보였다.

            점과 같은 `dotX`로 자리를 잡고 칩 반지름만큼 당기면 중심이 정확히 겹친다. 축
            라벨 칸만큼 오른쪽으로 미는 것은 그래프가 그만큼 밀려 있기 때문이다.
          */}
          <View style={[s.dayRow, { width: plotWidth + AXIS_WIDTH + AXIS_GAP }]}>
            {DAYS_OF_WEEK.map((day, index) => (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityLabel={`${dayOfWeekLabel[day]}요일 혼잡도 보기`}
                accessibilityState={{ selected: day === selected }}
                onPress={() => chooseDay(day)}
                style={[
                  s.dayChip,
                  { left: AXIS_WIDTH + AXIS_GAP + dotX(index) - DAY_CHIP_SIZE / 2 },
                  day === selected && s.dayChipActive,
                ]}
              >
                <Text style={[s.dayText, day === selected && s.dayTextActive]}>{dayOfWeekLabel[day]}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {},
  /** `surface`를 켰을 때의 카드. 장소 상세의 영상핀 카드와 같은 모양으로 맞춘다. */
  surface: {
    padding: CARD_PADDING,
    borderRadius: radius.hero,
    backgroundColor: colors.white,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { ...type.label, fontWeight: '600', color: colors.dark },
  caption: { ...type.caption, color: colors.gray400 },
  empty: { ...type.caption, color: colors.gray400, marginTop: spacing.x4 },
  body: { flexDirection: 'row', alignItems: 'stretch', alignSelf: 'center', marginTop: spacing.x5 },
  // 글자가 줄어들지 않도록 폭을 고정하고, 그래프가 덮지 않도록 오른쪽에 여유 칸을 둔다.
  axisLabels: {
    width: AXIS_WIDTH,
    marginRight: AXIS_GAP,
    flexShrink: 0,
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
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
    width: BAND_WIDTH,
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
    // 폭을 고정한다. 내용에 따라 늘어나면 가장자리 요일에서 어디까지 나갈지 계산할 수 없다.
    width: TOOLTIP_WIDTH,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.dark,
  },
  tooltipText: { fontSize: 10, lineHeight: 14, fontWeight: '600', color: colors.white },
  /**
   * 칩을 좌표로 놓으므로 줄 자체는 높이만 차지한다.
   *
   * 양 끝 칩은 반지름만큼 줄 밖으로 나간다(점이 양 끝에 있으므로 당연하다). 카드 안쪽 여백
   * 20px 안에 들어가므로 잘려 보이지 않지만, 기본값에 기대지 않고 넘침을 적어 둔다.
   */
  dayRow: { height: DAY_CHIP_SIZE, alignSelf: 'center', marginTop: spacing.x4, overflow: 'visible' },
  dayChip: {
    position: 'absolute',
    top: 0,
    width: DAY_CHIP_SIZE,
    height: DAY_CHIP_SIZE,
    borderRadius: DAY_CHIP_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.gray200,
  },
  dayChipActive: { borderColor: colors.lime, backgroundColor: colors.lime },
  dayText: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: colors.gray600 },
  dayTextActive: { color: colors.dark, fontWeight: '700' },
});
