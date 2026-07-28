import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { color, shape } from '@/constants/theme';
import { crowdFilterLabel } from '@/constants/crowdLevels';
import type { CrowdFilter } from '@/constants/crowdLevels';

export interface CrowdFilterToggleProps {
  value: CrowdFilter;
  onChange: (next: CrowdFilter) => void;
  style?: StyleProp<ViewStyle>;
}

/**
 * 혼잡도 필터 토글 (여유 / 와글). on/off 2 라벨 고정형 (공통DESIGN §8.1).
 * 지도 홈 바텀시트와 추천 화면이 같은 컨트롤을 공유한다.
 */
export function CrowdFilterToggle({ value, onChange, style }: CrowdFilterToggleProps) {
  const relaxed = value === 'relaxed';

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={`혼잡도 필터 ${crowdFilterLabel[value]}`}
      accessibilityState={{ checked: relaxed }}
      onPress={() => onChange(relaxed ? 'wagle' : 'relaxed')}
      style={[s.touch, style]}
    >
      <LinearGradient
        colors={relaxed ? color.filter.relaxedTrack : color.filter.wagleTrack}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={s.track}
      >
        <Text
          style={[
            s.label,
            relaxed
              ? { left: 10, color: color.filter.relaxedLabel }
              : { right: 9, color: color.filter.wagleLabel },
          ]}
        >
          {crowdFilterLabel[value]}
        </Text>
        <View style={[s.thumb, relaxed ? s.thumbRight : s.thumbLeft]} />
      </LinearGradient>
    </Pressable>
  );
}

const s = StyleSheet.create({
  touch: { width: 70, height: 44, alignItems: 'center', justifyContent: 'center' },
  track: {
    width: 70,
    height: 35,
    borderRadius: shape.pill,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: color.surface.glassBorder,
    shadowColor: color.text.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.13,
    shadowRadius: 4,
    elevation: 2,
  },
  label: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -10 }],
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  thumb: {
    position: 'absolute',
    top: '50%',
    transform: [{ translateY: -12.5 }],
    width: 25,
    height: 25,
    borderRadius: shape.pill,
    backgroundColor: color.surface.base,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
    shadowColor: color.text.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  thumbRight: { right: 5 },
  thumbLeft: { left: 5 },
});
