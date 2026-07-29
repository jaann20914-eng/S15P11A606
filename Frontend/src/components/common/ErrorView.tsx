import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

export interface ErrorViewProps {
  title?: string;
  /** 서버가 준 문구를 그대로 넣는다. 없으면 호출부가 기본 문구를 정한다. */
  message: string;
  /** 버튼 라벨. 비우면 버튼을 숨긴다. */
  actionLabel?: string;
  onAction?: () => void;
  /** 보조 동작(예: 홈으로 이동). 라벨이 있어야 보인다. */
  secondaryLabel?: string;
  onSecondary?: () => void;
}

/**
 * 조회 실패·권한 없음 등 화면을 그릴 수 없을 때 쓰는 공통 오류 화면.
 * 헤더와 탭 바 사이 본문 영역을 채우는 용도라 자체 헤더는 갖지 않는다.
 */
export function ErrorView({
  title = '문제가 생겼어요',
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: ErrorViewProps) {
  return (
    <View style={s.wrap}>
      <View style={s.iconCircle}>
        <Ionicons name="alert-circle-outline" size={32} color={colors.gray400} />
      </View>
      <Text style={s.title}>{title}</Text>
      <Text style={s.message}>{message}</Text>
      {actionLabel && (
        <Pressable accessibilityRole="button" onPress={onAction} style={s.primary}>
          <Text style={s.primaryText}>{actionLabel}</Text>
        </Pressable>
      )}
      {secondaryLabel && (
        <Pressable accessibilityRole="button" onPress={onSecondary} style={s.secondary}>
          <Text style={s.secondaryText}>{secondaryLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.gutter,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.gray100,
  },
  title: { ...type.title, color: colors.dark, marginTop: spacing.x5 },
  message: { ...type.body, color: colors.gray400, textAlign: 'center', marginTop: spacing.x2 },
  primary: {
    alignSelf: 'stretch',
    height: 52,
    marginTop: spacing.x6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.dark,
  },
  primaryText: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.lime },
  secondary: { minHeight: layout.minTouch, justifyContent: 'center', marginTop: spacing.x1 },
  secondaryText: { ...type.label, color: colors.gray600, fontWeight: '600' },
});
