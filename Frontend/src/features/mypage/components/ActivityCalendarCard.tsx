import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import type { ActivityLevel, MonthlyActivity } from '@/types/mypage';
import { mypageStyles as s } from '../styles';

export interface ActivityCalendarCardProps {
  activity: MonthlyActivity;
}

/** 월요일 시작. 달력 칸 배열도 이 순서를 따른다. */
const weekdays = ['월', '화', '수', '목', '금', '토', '일'];

/** 활동량 구간별 칸 색. `null`은 그 달에 속하지 않는 빈칸이다. */
const cellStyleByLevel: Record<ActivityLevel, object> = {
  0: s.cellEmpty,
  1: s.cellLow,
  2: s.cellMid,
  3: s.cellHigh,
};

/**
 * 이번 달 활동 달력.
 *
 * 왼쪽은 날짜별 활동량을 색으로 보여주는 히트맵이고 오른쪽은 합계다.
 * 월 이동 화살표는 아직 동작하지 않는다. 지난달 데이터를 주는 API가 없다.
 */
export function ActivityCalendarCard({ activity }: ActivityCalendarCardProps) {
  return (
    <View style={s.activityCard}>
      <View style={s.calendar}>
        <View style={s.monthRow}>
          <Ionicons name="chevron-back" size={18} color={colors.gray400} />
          <Text style={s.month}>{activity.month}월</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
        </View>

        <View style={s.weekRow}>
          {weekdays.map((day) => (
            <Text key={day} style={s.weekday}>
              {day}
            </Text>
          ))}
        </View>

        <View style={s.heatmap}>
          {activity.cells.map((level, index) => (
            <View key={index} style={[s.cell, level === null ? s.cellBlank : cellStyleByLevel[level]]} />
          ))}
        </View>
      </View>

      <View style={s.monthStats}>
        <Text style={s.statsTitle}>이번 달 활동</Text>
        <Text style={s.statLine}>작성한 영상핀 · {activity.pinCount}개</Text>
        <Text style={s.statLine}>획득 크레딧 · {activity.earnedCredit}</Text>
        <Text style={s.statLine}>도움 열람 · {activity.viewCount}회</Text>
      </View>
    </View>
  );
}
