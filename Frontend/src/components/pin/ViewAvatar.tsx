// 사용자 뷰 신뢰도 링. 공용 컴포넌트로 정의만 해 둔 상태이고 아직 쓰는 화면이 없다(DESIGN_GUIDE 9.1).
import { StyleSheet, Text, View } from 'react-native';
import { colors, type } from '@/constants/theme';

export function ViewAvatar({
  value = 84.5,
  size = 48,
  label = false,
}: {
  value?: number;
  size?: number;
  label?: boolean;
}) {
  const segments = 16;
  const active = Math.max(1, Math.round((Math.min(value, 360) / 360) * segments));
  return (
    <View style={[s.wrap, { width: size, height: size }]} accessibilityLabel={`뷰 신뢰도 ${value}도`}>
      {Array.from({ length: segments }, (_, i) => (
        <View
          key={i}
          style={[
            s.seg,
            {
              height: size * 0.1,
              width: size * 0.045,
              left: size / 2 - size * 0.0225,
              top: 0,
              transform: [{ rotate: `${i * 22.5}deg` }, { translateY: size * 0.02 }],
              backgroundColor: i < active ? colors.lime : '#DEDede',
            },
          ]}
        />
      ))}
      <View
        style={[
          s.core,
          {
            width: size * 0.72,
            height: size * 0.72,
            borderRadius: size * 0.36,
            left: size * 0.14,
            top: size * 0.14,
          },
        ]}
      >
        <Text style={[s.value, { fontSize: size * 0.22 }]}>{Math.round(value)}°</Text>
        {label && <Text style={s.label}>VIEW</Text>}
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  wrap: { position: 'relative' },
  seg: { position: 'absolute', borderRadius: 99, transformOrigin: '50% 500%' as any },
  core: {
    position: 'absolute',
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { fontWeight: '600', color: colors.gray600 },
  label: { ...type.caption, fontSize: 8, lineHeight: 9, color: colors.gray400 },
});
