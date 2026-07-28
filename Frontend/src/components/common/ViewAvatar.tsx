import { Image, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors, type } from '@/constants/theme';
import { getViewAngleImage } from '@/utils/viewAngle';

export interface ViewAvatarProps {
  /** 뷰 각도. DB `member.view_angle` 기준으로 90~360이며 10도 단위 링 이미지로 표시된다. */
  angle: number;
  /** 지름(px). 링 이미지와 각도 글자 크기가 함께 따라간다. */
  size?: number;
  /** 각도 아래에 `VIEW` 라벨을 함께 보여줄지. 프로필 화면처럼 크게 쓸 때 켠다. */
  showLabel?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * 뷰 각도 링.
 *
 * 링은 각도별 PNG(`assets/images/view-angles-000-360`)를 쓰고 숫자는 그 위에 얹는다.
 * 채움 비율을 직접 그리지 않으므로 디자인 시안과 항상 일치한다.
 */
export function ViewAvatar({ angle, size = 48, showLabel = false, style }: ViewAvatarProps) {
  const rounded = Math.round(angle);

  return (
    <View
      accessibilityLabel={`뷰 각도 ${rounded}도`}
      style={[s.wrap, { width: size, height: size }, style]}
    >
      <Image source={getViewAngleImage(angle)} style={s.ring} />
      <Text style={[s.value, { fontSize: Math.round(size * 0.275) }]}>{rounded}°</Text>
      {showLabel && <Text style={s.label}>VIEW</Text>}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  ring: { position: 'absolute', width: '100%', height: '100%', resizeMode: 'contain' },
  value: { fontWeight: '600', color: colors.gray600 },
  label: { ...type.caption, fontSize: 8, lineHeight: 9, color: colors.gray400 },
});
