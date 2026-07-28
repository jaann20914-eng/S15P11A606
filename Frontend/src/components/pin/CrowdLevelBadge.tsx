// 혼잡도 4단계 뱃지. 공용 컴포넌트로 정의만 해 둔 상태이고 아직 쓰는 화면이 없다(DESIGN_GUIDE 9.1).
import { StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { color, shape, space, typography } from '@/constants/theme';
import { getCrowdLevelByKey, getCrowdLevelByValue } from '@/constants/crowdLevels';
import type { CrowdLevelKey } from '@/constants/crowdLevels';

export interface CrowdLevelBadgeProps {
  /** 혼잡도 단계. API의 숫자값(1~4) 또는 enum 키를 그대로 넘길 수 있다. */
  level: number | CrowdLevelKey;
  /** `solid`는 단계 색을 배경으로, `outline`은 색 점 + 흰 배경으로 표시한다. */
  variant?: 'solid' | 'outline';
  style?: StyleProp<ViewStyle>;
}

/** 혼잡도 4단계 뱃지 (유유자적/여유/와글/와글와글). */
export function CrowdLevelBadge({ level, variant = 'solid', style }: CrowdLevelBadgeProps) {
  const crowd = typeof level === 'number' ? getCrowdLevelByValue(level) : getCrowdLevelByKey(level);
  const solid = variant === 'solid';

  return (
    <View
      accessibilityLabel={`혼잡도 ${crowd.label}`}
      style={[s.badge, solid ? { backgroundColor: crowd.color } : s.outline, style]}
    >
      {solid ? null : <View style={[s.dot, { backgroundColor: crowd.color }]} />}
      <Text style={s.label}>{crowd.label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: {
    minHeight: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    borderRadius: shape.pill,
  },
  outline: {
    backgroundColor: color.surface.base,
    borderWidth: 1,
    borderColor: color.border.hairline,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { ...typography.label, color: color.text.primary },
});
