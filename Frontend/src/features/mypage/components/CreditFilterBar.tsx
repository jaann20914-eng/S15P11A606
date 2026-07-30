import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { creditFilterLabel, creditPeriodLabel } from '@/types/mypage';
import type { CreditFilter, CreditPeriod } from '@/types/mypage';
import { mypageStyles as s } from '../styles';

export interface CreditFilterBarProps {
  filter: CreditFilter;
  period: CreditPeriod;
  periodOpen: boolean;
  onFilterChange: (filter: CreditFilter) => void;
  onPeriodChange: (period: CreditPeriod) => void;
  onTogglePeriod: () => void;
}

const filters: CreditFilter[] = ['ALL', 'SPENT', 'EARNED'];
const periods: CreditPeriod[] = ['TODAY', 'WEEK', 'MONTH'];

/**
 * 내역 필터.
 *
 * 종류는 칩으로 바로 고르고, 기간은 자리를 덜 차지하도록 펼침 목록으로 고른다.
 * 목록에는 지금 고른 기간을 빼고 보여준다.
 */
export function CreditFilterBar({
  filter,
  period,
  periodOpen,
  onFilterChange,
  onPeriodChange,
  onTogglePeriod,
}: CreditFilterBarProps) {
  return (
    <View style={s.filterBar}>
      <View style={s.typeFilters}>
        {filters.map((item) => {
          const active = filter === item;

          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onFilterChange(item)}
              style={[s.filterChip, active && s.filterChipActive]}
            >
              <Text style={[s.filterText, active && s.filterTextActive]}>{creditFilterLabel[item]}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={s.periodWrap}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="기간 선택"
          onPress={onTogglePeriod}
          style={s.periodButton}
        >
          <Text style={s.periodText}>{creditPeriodLabel[period]}</Text>
          <Ionicons name={periodOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.gray400} />
        </Pressable>

        {periodOpen && (
          <View style={s.periodMenu}>
            {periods
              .filter((item) => item !== period)
              .map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  onPress={() => onPeriodChange(item)}
                  style={s.periodOption}
                >
                  <Text style={s.periodOptionText}>{creditPeriodLabel[item]}</Text>
                </Pressable>
              ))}
          </View>
        )}
      </View>
    </View>
  );
}
