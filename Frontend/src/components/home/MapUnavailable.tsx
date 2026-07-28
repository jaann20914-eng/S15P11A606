import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { color, colors, radius, spacing, type } from '@/constants/theme';

/** 실패 원인별 안내 문구. 원인을 감추면 목업 화면과 구분이 안 돼 디버깅이 어려워진다. */
const reasonText: Record<string, string> = {
  'missing-key': '.env의 EXPO_PUBLIC_KAKAOMAP_APPKEY가 비어 있어요.',
  'sdk-load-failed': '카카오맵 SDK를 내려받지 못했어요. 네트워크와 앱 키를 확인해 주세요.',
  'sdk-unavailable': '카카오맵 SDK가 초기화되지 않았어요. 앱 키를 확인해 주세요.',
  'webview-error': '지도 화면을 여는 데 실패했어요. 잠시 후 다시 시도해 주세요.',
};

export interface MapUnavailableProps {
  reason: string;
  fullScreen?: boolean;
  style?: StyleProp<ViewStyle>;
  onRetry?: () => void;
}

/** 지도를 못 띄웠을 때의 상태 화면. */
export function MapUnavailable({ reason, fullScreen = false, style, onRetry }: MapUnavailableProps) {
  return (
    <View style={[fullScreen ? s.full : s.inline, style]}>
      <Ionicons name="map-outline" size={40} color={colors.gray400} />
      <Text style={s.title}>지도를 불러올 수 없어요</Text>
      <Text style={s.detail}>{reasonText[reason] ?? '알 수 없는 이유로 지도를 불러오지 못했어요.'}</Text>
      {onRetry && (
        <Pressable accessibilityRole="button" onPress={onRetry} style={s.retry}>
          <Text style={s.retryText}>다시 시도</Text>
        </Pressable>
      )}
    </View>
  );
}

const base: ViewStyle = {
  alignItems: 'center',
  justifyContent: 'center',
  paddingHorizontal: spacing.x8,
  backgroundColor: color.bg.map,
};

const s = StyleSheet.create({
  inline: { ...base, height: 260, overflow: 'hidden', borderRadius: radius.hero },
  full: { ...base, ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  title: { ...type.title, color: colors.dark, marginTop: spacing.x4 },
  detail: { ...type.small, color: colors.gray600, textAlign: 'center', marginTop: spacing.x2 },
  retry: {
    marginTop: spacing.x5,
    paddingVertical: spacing.x3,
    paddingHorizontal: spacing.x6,
    borderRadius: radius.pill,
    backgroundColor: colors.lime,
  },
  retryText: { ...type.body, color: colors.dark, fontWeight: '600' },
});
