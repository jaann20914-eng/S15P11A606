import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius } from '@/constants/theme';
export function ListGroup({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[s.group, style]}>{children}</View>;
}
export function RowDivider() {
  return <View style={s.divider} />;
}
const s = StyleSheet.create({
  group: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.gray200,
    overflow: 'hidden',
  },
  divider: { height: 1, backgroundColor: colors.gray100, marginLeft: 68 },
});
