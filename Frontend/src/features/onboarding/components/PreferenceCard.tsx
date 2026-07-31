import { Image, Pressable, StyleSheet, Text } from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { colors, radius, spacing, type } from '@/constants/theme';

export interface PreferenceCardProps {
  label: string;
  selected: boolean;
  /**
   * 3D 에셋. 아직 파일이 없는 카테고리는 넘기지 않는다 —
   * 그때는 라벨을 가운데로 옮겨 빈 칸처럼 보이지 않게 한다.
   */
  image?: ImageSourcePropType;
  /** 최대 개수에 도달해 더 고를 수 없는 상태. 이미 고른 카드는 항상 누를 수 있다. */
  disabled?: boolean;
  onPress: () => void;
}

/**
 * 온보딩 선호 카테고리 카드.
 *
 * 공통 디자인의 "온보딩 버튼" 규격을 따른다 — 라벨이 위, 3D 에셋이 아래,
 * 기본은 연한 라임 배경이고 선택되면 진한 라임으로 바뀐다.
 * 선택 표시를 색으로만 하지 않도록 `accessibilityState`도 함께 넘긴다.
 */
export function PreferenceCard({ label, selected, image, disabled = false, onPress }: PreferenceCardProps) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.card,
        !image && s.cardLabelOnly,
        selected && s.cardSelected,
        pressed && s.pressed,
        disabled && s.disabled,
      ]}
    >
      <Text style={[s.label, selected && s.labelSelected]} numberOfLines={1}>
        {label}
      </Text>
      {image && <Image source={image} style={s.image} resizeMode="contain" />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    aspectRatio: 1,
    paddingTop: spacing.x2,
    paddingBottom: spacing.x1,
    paddingHorizontal: spacing.x1,
    alignItems: 'center',
    borderRadius: radius.lg,
    backgroundColor: colors.limeSoft,
    overflow: 'hidden',
  },
  // 에셋이 없을 때는 라벨을 가운데로 옮겨 빈 칸처럼 보이지 않게 한다.
  cardLabelOnly: { justifyContent: 'center' },
  cardSelected: { backgroundColor: colors.lime },
  pressed: { opacity: 0.76 },
  // 최대 개수에 걸린 카드. 누를 수 없다는 것만 알리고 완전히 감추지는 않는다.
  disabled: { opacity: 0.45 },
  /**
   * `caption`(12px)을 쓴다. 카드 폭이 좁아 가장 긴 "전시, 문화공간"이 기준이 되는데,
   * 14px에서는 360dp 기기에서 여유가 7px밖에 남지 않아 더 좁은 화면에서 잘릴 수 있다.
   */
  label: { ...type.caption, fontWeight: '600', color: colors.dark, textAlign: 'center' },
  labelSelected: { color: colors.dark },
  /**
   * 남은 높이를 모두 쓴다. 에셋이 정사각·투명이라 `contain`에서는 높이가 그리는 크기를 정한다 —
   * 아래 여백을 줄인 만큼 그림이 커진다.
   */
  image: { flex: 1, width: '100%' },
});
