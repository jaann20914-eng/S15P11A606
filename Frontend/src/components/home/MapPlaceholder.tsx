import { Image, StyleSheet, View } from 'react-native';
import { MapMarker, MyLocationMarker } from './MapMarker';
import { color, radius } from '@/constants/theme';
import type { CrowdFilter } from '@/constants/crowdLevels';

/** 지도 SDK 연동 전 목업 좌표. 실제 연동 시 장소 응답의 좌표로 대체한다. */
const markerLayout = {
  local: [
    { x: '30%', y: '25%' },
    { x: '57%', y: '43%' },
    { x: '69%', y: '20%' },
  ],
  wide: [
    { x: '15%', y: '30%' },
    { x: '48%', y: '25%' },
    { x: '70%', y: '43%' },
    { x: '35%', y: '61%' },
    { x: '76%', y: '69%' },
    { x: '57%', y: '53%' },
  ],
} as const;

export interface MapPlaceholderProps {
  local?: boolean;
  fullScreen?: boolean;
  /** 선택된 혼잡도 필터. 핀 색 계열이 이 값에 따라 전환된다. */
  filter?: CrowdFilter;
  onPin?: () => void;
}

export function MapPlaceholder({ local = false, fullScreen = false, filter = 'relaxed', onPin }: MapPlaceholderProps) {
  const markers = local ? markerLayout.local : markerLayout.wide;

  return (
    <View style={[s.map, fullScreen && s.fullMap]} accessibilityLabel="카카오맵이 표시될 지도 영역">
      <Image
        source={require('../../../assets/images/map-reference-latest.png')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      {markers.map((marker, index) => (
        <MapMarker
          key={`${marker.x}-${marker.y}`}
          filter={filter}
          selected={index === 0}
          onPress={onPin}
          style={{ left: marker.x, top: marker.y }}
        />
      ))}
      <MyLocationMarker style={s.currentLocation} />
    </View>
  );
}

const s = StyleSheet.create({
  map: {
    height: 260,
    position: 'relative',
    overflow: 'hidden',
    borderRadius: radius.hero,
    backgroundColor: color.bg.map,
  },
  fullMap: { ...StyleSheet.absoluteFillObject, height: undefined, borderRadius: 0 },
  currentLocation: { position: 'absolute', left: '49%', top: '48%' },
});
