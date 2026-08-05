import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { DAYS_OF_WEEK, dayOfWeekLabel, type DayCrowdStat, type DayOfWeek } from '@/types/place';
import { getCrowdLevelByValue } from '@/constants/crowdLevels';
import { getResponsivePadding } from '@/hooks/useResponsivePadding';
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
 * 배경은 그리지 않는다. 두 화면 모두 장소 기본정보와 **한 카드**에 담기 때문이다. 그래프만
 * 한 장으로 세울 때는 `surface`를 켜면 된다.
 *
 * 그래프 폭은 **감싼 칸을 재서** 쓰므로 감싸는 쪽 여백이 얼마든 좌우가 맞는다
 * (`estimatePlotWidth`는 측정이 오기 전까지 버티는 어림값일 뿐이다).
 *
 * 고른 요일은 **혼잡도 4단계 이름**으로 읽어 준다(유유자적·여유·와글·와글와글). 배경을 두지
 * 않고 글자 자체를 단계 색으로 칠한다 — 단계별 농도는 `crowdLevels`의 `textColor`가 갖는다.
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
  /** 요일을 고를 때마다 알린다. 고른 요일을 화면이 따로 쓸 때만 넘기면 된다. */
  onSelectDay?: (day: DayOfWeek) => void;
  /**
   * 흰 카드 배경을 스스로 그릴지. 기본은 그리지 않는다.
   *
   * **지금은 두 화면 모두 켜지 않는다** — 추천 상세(`RecommendPlaceInfo`)와 장소 상세 둘 다
   * 장소 기본정보와 한 카드에 담기 때문이다. 그래프만 따로 한 장으로 세우는 화면이 생기면
   * 켜면 된다.
   *
   * 감싸는 카드의 여백이 `CARD_PADDING`과 달라도 된다 — 폭은 재서 쓴다. 다만 측정이 늦거나
   * 0으로 오는 동안 쓰는 어림값이 그 값을 전제하므로, 크게 다르면 첫 프레임만 폭이 어긋난다.
   */
  surface?: boolean;
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

/** 요일 칩 지름. 점과 중심을 맞추려면 이 값의 절반만큼 왼쪽으로 당긴다. */
const DAY_CHIP_SIZE = 36;

/**
 * 첫 점과 마지막 점을 그래프 안쪽으로 들여놓는 거리.
 *
 * 점을 양 끝에 딱 붙이면 그 점에 걸린 요일 칩과 세로 띠가 **점을 중심으로** 그려지므로
 * 반지름만큼 그래프 밖으로 나간다. 오른쪽으로는 `일` 칩이 카드를 뚫고 나가 잘려 보였다.
 *
 * 가장 큰 것이 칩이므로 그 반지름만큼 들여놓으면 무엇도 밖으로 나가지 않는다.
 */
const DOT_INSET = DAY_CHIP_SIZE / 2;

/** 고른 요일을 짚는 세로 띠 너비. 점과 중심을 맞추려면 절반만큼 당긴다. */
const BAND_WIDTH = 28;

/**
 * 단계 이름을 적는 칸의 너비.
 *
 * 가장 긴 이름이 네 글자(`유유자적`·`와글와글`)다. 폭을 고정해야 가장자리 요일에서 어디까지
 * 나갈지 계산해 가둘 수 있다 — 내용에 따라 늘어나면 그 계산이 불가능하다.
 */
const LABEL_WIDTH = 72;

/** 단계 이름 칸 높이. 그래프 위에 얼마를 비워 둘지 계산하는 데 함께 쓰인다. */
const LABEL_HEIGHT = 22;

/** 단계 이름 아래끝과 그래프 맨 위 사이 틈. */
const LABEL_GAP = 6;

/**
 * 그래프 위에 비워 두는 높이.
 *
 * 단계 이름은 그래프 바깥(위)으로 나가 있다. 예전에는 이 여백이 그보다 낮아 **이름이
 * 제목("요일별 혼잡도")을 덮었다** — 특히 월요일처럼 왼쪽 끝 요일을 골랐을 때 제목 위에
 * 그대로 얹혔다. 이름 칸 높이에서 출발해 여유를 더해 잡으므로 다시 겹칠 수 없다.
 */
const PLOT_TOP_SPACE = LABEL_HEIGHT + LABEL_GAP + spacing.x1;

/** 그래프를 감싸는 카드의 안쪽 여백. `surface`를 켜면 이 값을 쓴다. */
const CARD_PADDING = spacing.x5;

/**
 * 단계 이름이 그래프 폭 밖으로 나갈 수 있는 여유.
 *
 * 월·일처럼 **끝 요일에서는 이름을 점 중앙에 두면 그래프 폭을 조금 벗어난다.** 예전에는
 * 그래프 안으로 밀어 넣었는데, 그러면 그 두 요일만 점 위에 놓이지 않아 — 월은 오른쪽으로,
 * 일은 왼쪽으로 밀려 — 가운데 요일들과 어긋나 보였다.
 *
 * 그래프는 카드 안쪽 여백만큼 안으로 들어와 있으니 **그 여백까지는 내보내도 카드를 넘지
 * 않는다.** 필요한 여유는 `LABEL_WIDTH / 2 - DOT_INSET`(= 18)이고 카드 여백(20)이 그보다
 * 크므로, 화면 너비와 상관없이 일곱 요일 모두 점 중앙에 놓인다 — 점 들여쓰기와 이름 폭이
 * 둘 다 고정값이어서 화면이 넓든 좁든 이 차이는 변하지 않는다.
 */
const LABEL_OVERHANG = CARD_PADDING;

/**
 * 선을 그릴 폭의 어림값 — 화면 너비에서 좌우 여백을 뺀다.
 *
 * 실제로는 재서 쓴다(`onLayout`). 다만 탭 안에 있는 화면은 숨겨진 채로 마운트돼 첫 측정이
 * 0으로 올 수 있고, 그때 화면이 드러나도 다시 오지 않으면 선이 영영 그려지지 않는다.
 * 그래서 **측정이 0이면 이 값으로 버틴다.** 재는 쪽이 정확하고, 이 값은 안전망이다.
 *
 * 화면 좌우 여백은 화면들이 쓰는 것과 같은 함수로 구한다 — 예전에는 16으로 박아 뒀는데
 * 실제 여백은 화면 너비에 비례해(360dp에서 20, 최대 28) 커서, 그만큼 그래프가 카드보다
 * 넓게 잡혀 **좌우 여백이 달라 보였다.**
 */
function estimatePlotWidth(screenWidth: number): number {
  return Math.max(screenWidth - getResponsivePadding(screenWidth) * 2 - CARD_PADDING * 2, 0);
}

export function CrowdChart({ stats, today = todayOfWeek(), onSelectDay, surface = false }: CrowdChartProps) {
  const { width } = useWindowDimensions();

  /*
    그래프 폭은 **감싼 카드의 안쪽 폭을 재서** 쓴다. 그래야 좌우 여백이 카드와 정확히 같아진다.
    측정이 오기 전(또는 0으로 올 때)에는 어림값으로 버틴다.
  */
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const plotWidth = measuredWidth > 0 ? measuredWidth : estimatePlotWidth(width);

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

  /*
    고른 요일의 혼잡 단계.

    **네 단계 이름으로 읽어 준다** — 유유자적·여유·와글·와글와글. 예전에는 3.0을 경계로
    여유/붐빔 둘로만 갈랐는데, 서버가 1~4로 관리하는 값을 둘로 뭉개면 같은 "여유" 안에서
    유유자적과 여유의 차이가 사라진다. 단계·이름·색은 `crowdLevels`가 소유한다.

    평균이라 소수가 온다(예: 2.4). `getCrowdLevelByValue`가 가장 가까운 단계로 보정한다.
  */
  const activeStage = activeLevel === null ? null : getCrowdLevelByValue(activeLevel);

  const chooseDay = (day: DayOfWeek) => {
    setSelected(day);
    onSelectDay?.(day);
  };

  /*
    단계 이름을 고른 점 **중앙**에 둔다. 요일 칩도 같은 `dotX`를 쓰므로 점·칩·이름 셋의
    중심이 한 직선에 선다.

    가두는 것은 카드를 뚫고 나가는 것만 막기 위한 안전망이다 — 그래프 폭이 아니라 카드
    안쪽까지 허용한다(`LABEL_OVERHANG`). 지금 값들로는 걸리지 않지만, 이름이 더 길어지거나
    폭을 넓히면 여기서 잡힌다.
  */
  const labelLeft = Math.min(
    Math.max(dotX(activeIndex) - LABEL_WIDTH / 2, -LABEL_OVERHANG),
    Math.max(plotWidth - LABEL_WIDTH + LABEL_OVERHANG, -LABEL_OVERHANG),
  );

  return (
    <View style={[s.card, surface && s.surface]}>
      <Text style={s.title}>요일별 혼잡도</Text>

      {!hasAnyLevel ? (
        /*
          **"기록이 아직 적다"가 아니라 "지금 시각의 기록이 없다"다.**

          서버는 요일별 평균을 **요청 시각을 기준으로 ±30분 안에 올라온 핀만** 모아 낸다
          (`PlaceDetailService.STAT_HALF_WINDOW`). 요일별로 비교하는 값이라 시간대를 고정해야
          뜻이 통하기 때문이다. 그래서 핀이 여러 개 있는 장소도 **그 핀이 올라온 시각대를 벗어나
          들여다보면 빈 응답**이 온다 — 12시 40분에 올라온 핀은 13시 20분에 보면 창을 벗어난다.

          예전 문구("계산할 만큼 기록이 쌓이지 않았어요")는 그것을 데이터가 부족한 것으로 읽게
          해서, 방금 핀을 올려 둔 장소에서 그래프가 비면 고장으로 보였다. 조건을 그대로 적는다.
        */
        <Text style={s.empty}>지금 시간대에 올라온 기록이 아직 없어요</Text>
      ) : (
        <>
          {/* 안쪽 폭을 재는 칸. 카드 여백 안에서 좌우로 꽉 차므로 이 폭이 곧 그래프 폭이다. */}
          <View
            style={s.body}
            onLayout={(event) => setMeasuredWidth(Math.round(event.nativeEvent.layout.width))}
          >
            <View style={[s.plot, { width: plotWidth, height: PLOT_HEIGHT }]}>
              {/* 가운데 점선이 여유와 붐빔의 경계다. */}
              <View style={[s.gridLine, { top: toY(WAGLE_FROM) }]} />

              {/*
                고른 요일 자리를 세로 띠로 짚어 준다. 아래 요일 칩과 같은 x에 놓인다.
                값이 없는 요일도 띠는 그린다 — 어디를 골랐는지는 보여야 한다.
              */}
              <View
                style={[
                  s.activeBand,
                  {
                    left: dotX(activeIndex) - BAND_WIDTH / 2,
                    /*
                      **네 단계를 각자의 색으로 구분한다.**

                      예전에는 여유 계열·와글 계열 두 색뿐이어서, 유유자적과 여유가 같은
                      색으로 보였다. 단계마다 색이 있는데(공통DESIGN §4.2의 혼잡도 4색)
                      둘로 뭉개면 그래프에서 단계를 읽을 수 없다.
                    */
                    backgroundColor: activeStage?.color ?? colors.gray100,
                  },
                ]}
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
                고른 요일만 단계 이름으로 읽어 준다. 일곱 개를 다 적으면 선이 보이지 않는다.
                이름은 점 위가 아니라 그래프 맨 위에 고정이라, 값이 없는 요일에도 띄울 수 있다.

                **배경을 두지 않고 글자 자체를 단계 색으로 칠한다.** 예전에는 알약 모양 배경에
                흰 글씨였는데, 배경이 있으면 그래프 위에 또 하나의 덩어리가 생겨 시선을 끈다.
              */}
              <Text
                numberOfLines={1}
                style={[s.stageLabel, { left: labelLeft, color: activeStage?.textColor ?? colors.gray400 }]}
              >
                {activeStage?.label ?? '기록 없음'}
              </Text>
            </View>
          </View>

          {/*
            칩을 점과 같은 x에 놓는다.

            예전에는 `space-between`으로 늘어놓았는데, 그러면 첫 칩의 **왼쪽 끝**과 마지막
            칩의 **오른쪽 끝**이 양 끝에 맞춰진다. 점은 중심이 양 끝에 있으므로 칩 반지름
            만큼 안쪽으로 밀려, 가운데 요일만 맞고 월·화·토·일이 어긋나 보였다.

            점과 같은 `dotX`로 자리를 잡고 칩 반지름만큼 당기면 중심이 정확히 겹친다.
          */}
          <View style={[s.dayRow, { width: plotWidth }]}>
            {DAYS_OF_WEEK.map((day, index) => (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityLabel={`${dayOfWeekLabel[day]}요일 혼잡도 보기`}
                accessibilityState={{ selected: day === selected }}
                onPress={() => chooseDay(day)}
                style={[
                  s.dayChip,
                  { left: dotX(index) - DAY_CHIP_SIZE / 2 },
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
  title: { ...type.label, fontWeight: '600', color: colors.dark },
  empty: { ...type.caption, color: colors.gray400, marginTop: spacing.x4 },
  /**
   * 그래프가 놓이는 칸. **폭을 정하지 않는다** — 카드 안쪽에서 좌우로 꽉 차야 그 폭을 재서
   * 그래프에 그대로 쓸 수 있다(`measuredWidth`). 위 여백은 단계 이름이 제목을 덮지 않을
   * 만큼이다(`PLOT_TOP_SPACE`).
   */
  body: { marginTop: PLOT_TOP_SPACE },
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
  /**
   * 오늘 자리를 짚는 세로 띠. 아래 요일 칩과 이어 보이도록 아래로 조금 더 내려간다.
   * 색은 계열(여유/와글)에 따라 화면에서 얹는다.
   */
  activeBand: {
    position: 'absolute',
    top: -6,
    bottom: -14,
    width: BAND_WIDTH,
    borderRadius: radius.pill,
  },
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
  /**
   * 고른 요일의 단계 이름. 배경 없이 글자만 둔다.
   *
   * 폭을 고정한다 — 내용에 따라 늘어나면 가장자리 요일에서 어디까지 나갈지 계산할 수 없다.
   * 색은 단계에 따라 화면에서 얹는다(`crowdLevels`의 `textColor`).
   */
  stageLabel: {
    position: 'absolute',
    top: -(LABEL_HEIGHT + LABEL_GAP),
    width: LABEL_WIDTH,
    height: LABEL_HEIGHT,
    ...type.caption,
    lineHeight: LABEL_HEIGHT,
    fontWeight: '700',
    textAlign: 'center',
  },
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
