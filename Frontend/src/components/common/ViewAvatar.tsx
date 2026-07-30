import { Image, StyleSheet, Text, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors, type } from '@/constants/theme';
import { formatViewAngle, getViewAngleImage } from '@/utils/viewAngle';

export interface ViewAvatarProps {
  /** 뷰 각도. DB `member.view_angle` 기준으로 90~360이며 10도 단위 링 이미지로 표시된다. */
  angle: number;
  /** 지름(px). 링 이미지와 각도 글자 크기가 함께 따라간다. */
  size?: number;
  /** 각도 아래에 `VIEW` 라벨을 함께 보여줄지. 프로필 화면처럼 크게 쓸 때 켠다. */
  showLabel?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** 링 지름 대비 글자 크기. `92°`처럼 세 글자일 때의 기준이다. */
const FONT_RATIO = 0.275;

/** 기준 글자 수. 이보다 길어지면 폭이 늘어나므로 글자를 줄인다. */
const BASE_LABEL_LENGTH = 3;

/**
 * 링 안에 들어갈 글자 크기.
 *
 * 지름에 비례시키되 글자 수도 반영한다. `92.5°`는 `92°`보다 두 글자 길어 같은 비율로는
 * 링을 넘친다. 폭은 글자 수에 비례해 늘어나므로 제곱근만큼 줄여 넓이를 비슷하게 유지한다.
 */
function toFontSize(size: number, label: string): number {
  const lengthFactor = Math.sqrt(BASE_LABEL_LENGTH / Math.max(BASE_LABEL_LENGTH, label.length));
  return Math.round(size * FONT_RATIO * lengthFactor);
}

/**
 * 뷰 각도 링.
 *
 * 링은 각도별 PNG(`assets/images/view-angles-000-360`)를 쓰고 숫자는 그 위에 얹는다.
 * 채움 비율을 직접 그리지 않으므로 디자인 시안과 항상 일치한다.
 */
export function ViewAvatar({ angle, size = 48, showLabel = false, style }: ViewAvatarProps) {
  const label = formatViewAngle(angle);

  return (
    <View accessibilityLabel={`뷰 각도 ${label}`} style={[s.wrap, { width: size, height: size }, style]}>
      <Image source={getViewAngleImage(angle)} style={s.ring} />
      <Text style={[s.value, { fontSize: toFontSize(size, label) }]}>{label}</Text>
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
