import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import type { MonthlyActivityResponse } from '@/types/user';
import { toActivityLevel, toCalendarCells, toWeeks } from '@/utils/activityCalendar';
import type { ActivityLevel } from '@/utils/activityCalendar';
import { mypageStyles as s } from '../styles';

export interface ActivityCalendarCardProps {
  activity: MonthlyActivityResponse;
  /** 다른 달을 불러오는 중인지. 달력을 살짝 흐리게 해 바뀌는 중임을 알린다. */
  loading: boolean;
  /** 앞선 달을 볼 수 있는지. 가입한 달 이전은 기록이 없다. */
  canGoPrev: boolean;
  /** 다음 달을 볼 수 있는지. 오늘이 속한 달보다 미래는 볼 수 없다. */
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
}

/** 월요일 시작. 달력 칸 배열도 이 순서를 따른다. */
const weekdays = ['월', '화', '수', '목', '금', '토', '일'];

/** 농도 구간별 칸 색. */
const cellStyleByLevel: Record<ActivityLevel, object> = {
  0: s.cellEmpty,
  1: s.cellLow,
  2: s.cellMid,
  3: s.cellHigh,
};

/**
 * 이번 달 활동 달력.
 *
 * 서버는 그 달의 날짜만 순서대로 주므로 달력 칸과 색은 프론트가 만든다.
 * 갈 수 없는 방향의 화살표는 연하게 두어 눌러도 되지 않는다는 것을 먼저 알린다.
 */
export function ActivityCalendarCard({
  activity,
  loading,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
}: ActivityCalendarCardProps) {
  const weeks = useMemo(() => toWeeks(toCalendarCells(activity.days)), [activity.days]);

  const stats = [
    { label: '작성한 핀', value: `${activity.summary.createdVideoPinCount}개` },
    { label: '획득 와글 포인트', value: `${activity.summary.earnedCredit}` },
    { label: '도움됐어요', value: `${activity.summary.helpfulEvaluationCount}회` },
  ];

  return (
    <View style={[s.activityCard, loading && s.activityCardLoading]}>
      <View style={s.monthRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이전 달"
          accessibilityState={{ disabled: !canGoPrev }}
          disabled={!canGoPrev}
          onPress={onPrev}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={18} color={canGoPrev ? colors.gray400 : colors.gray200} />
        </Pressable>

        {/* 연도는 붙이지 않는다. 시안 기준이고, 갈 수 있는 달이 가입 이후로 좁아 헷갈릴 일이 적다. */}
        <Text style={s.month}>{activity.month}월</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다음 달"
          accessibilityState={{ disabled: !canGoNext }}
          disabled={!canGoNext}
          onPress={onNext}
          hitSlop={8}
        >
          <Ionicons name="chevron-forward" size={18} color={canGoNext ? colors.gray400 : colors.gray200} />
        </Pressable>
      </View>

      {/* 요일과 칸이 같은 열에 서야 하므로 한 덩어리로 묶어 가운데에 놓는다. */}
      <View style={s.calendar}>
        <View style={s.weekRow}>
          {weekdays.map((day) => (
            <Text key={day} style={s.weekday}>
              {day}
            </Text>
          ))}
        </View>

        <View style={s.heatmap}>
          {weeks.map((week, weekIndex) => (
            <View key={`week-${weekIndex}`} style={s.heatmapRow}>
              {week.map((cell, dayIndex) => (
                <View
                  key={cell?.date ?? `blank-${weekIndex}-${dayIndex}`}
                  style={[
                    s.cell,
                    cell === null ? s.cellBlank : cellStyleByLevel[toActivityLevel(cell.videoPinCount)],
                  ]}
                />
              ))}
            </View>
          ))}
        </View>
      </View>

      <View style={s.monthStats}>
        {stats.map((stat, index) => (
          <View
            key={stat.label}
            style={[
              s.monthStat,
              index === 0 && s.monthStatFirst,
              index === stats.length - 1 && s.monthStatLast,
            ]}
          >
            <Text style={s.monthStatLabel}>{stat.label}</Text>
            <Text style={s.monthStatValue}>{stat.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
