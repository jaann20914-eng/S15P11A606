import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { color, shape, space, typography } from '@/constants/theme';
import { crowdFilterLabel } from '@/constants/crowdLevels';
import type { CrowdFilter } from '@/constants/crowdLevels';

const pinAssets = {
  relaxed: {
    selected: require('../../../assets/images/map-pin-primary-front.png'),
    default: require('../../../assets/images/map-pin-primary-circle.png'),
  },
  wagle: {
    selected: require('../../../assets/images/map-pin-crowded-front.png'),
    default: require('../../../assets/images/map-pin-crowded-circle.png'),
  },
} as const;

export interface MapMarkerProps {
  /**
   * 상단 혼잡도 필터 계열. `relaxed`는 라임 그린, `wagle`은 코럴/레드 핀으로 표시한다 (공통DESIGN §4.3).
   * 화면에서는 `useMapStore`의 `crowdFilter`를 그대로 넘긴다.
   */
  filter: CrowdFilter;
  /** 선택/포커스된 핀은 진한 톤의 물방울형, 나머지는 연한 톤의 원형으로 표시한다. */
  selected?: boolean;
  /** 핀 위에 얹는 짧은 텍스트(장소명, 핀 개수 등) */
  label?: string;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** 지도 위 장소 핀. 색 계열은 선택된 혼잡도 필터에 따라 전환된다. */
export function MapMarker({ filter, selected = false, label, onPress, style }: MapMarkerProps) {
  const tone = color.pin[filter];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${crowdFilterLabel[filter]} 장소${selected ? ' (선택됨)' : ''}${label ? ` ${label}` : ''}`}
      onPress={onPress}
      style={[s.marker, selected ? s.selected : s.circle, style]}
    >
      <Image source={pinAssets[filter][selected ? 'selected' : 'default']} style={s.image} resizeMode="contain" />
      {label ? (
        <View style={[s.label, { backgroundColor: selected ? tone.strong : tone.soft }]}>
          <Text numberOfLines={1} style={[s.labelText, { color: selected ? color.pin.wagle.label : tone.label }]}>
            {label}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

/**
 * 내 위치 마커. 핀과 형태를 다르게(원형 점 + 펄스) 유지해 혼동을 방지하고,
 * 색은 `color.location` 전용 토큰만 사용한다 (공통DESIGN §4.3, §8.9).
 */
export function MyLocationMarker({ size = 36, style }: { size?: number; style?: StyleProp<ViewStyle> }) {
  const dot = Math.round(size * 0.42);

  return (
    <View
      accessibilityLabel="현재 위치"
      style={[s.location, { width: size, height: size, borderRadius: size / 2 }, style]}
    >
      <View
        style={[
          s.locationDot,
          { width: dot, height: dot, borderRadius: dot / 2, borderWidth: Math.max(2, Math.round(size * 0.07)) },
        ]}
      />
    </View>
  );
}

const s = StyleSheet.create({
  marker: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  selected: { width: 54, height: 68 },
  circle: { width: 42, height: 42 },
  image: { width: '100%', height: '100%' },
  label: {
    position: 'absolute',
    top: '100%',
    maxWidth: 96,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: shape.pill,
  },
  labelText: { ...typography.label },
  location: { alignItems: 'center', justifyContent: 'center', backgroundColor: color.location.mePulse },
  locationDot: { backgroundColor: color.location.me, borderColor: color.location.meBorder },
});
