import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, layout, radius, spacing, type } from '@/constants/theme';
import { isOAuthLoginInFlight } from '@/features/auth/hooks/useOAuthLogin';

/**
 * App Link 복귀 주소(`/oauth/callback/kakao|naver`)를 받아 두는 자리.
 *
 * 정상 흐름에서는 인가 코드를 이 화면이 처리하지 않는다. `useOAuthLogin`이 열어 둔
 * `openAuthSessionAsync`가 복귀 URL을 먼저 가로채 브라우저를 닫고 다음 화면으로 보낸다.
 * 그동안 이 화면이 잠깐 스칠 수 있으므로 스피너만 보여주고 아무 이동도 하지 않는다 —
 * 여기서 이동하면 훅의 이동과 경합한다.
 *
 * 처리 중인 로그인이 없다면 앱이 종료된 상태에서 복귀한 것이다. 그때는 `state`가
 * 메모리에서 사라져 검증할 수 없다. 인가 코드를 그대로 서버에 넘기면 CSRF 검증을
 * 스스로 포기하는 것이므로, 처음부터 다시 하도록 안내만 한다.
 */
export default function OAuthCallback() {
  if (isOAuthLoginInFlight()) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={colors.gray600} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>로그인을 마치지 못했어요</Text>
      <Text style={styles.message}>로그인 도중 앱이 종료됐어요.{`\n`}처음부터 다시 시도해 주세요.</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.replace('/(auth)/login')}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonLabel}>로그인 화면으로</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.gutter,
    backgroundColor: colors.bg,
  },
  title: { ...type.label, color: colors.dark, fontWeight: '600' },
  message: { ...type.body, color: colors.gray600, marginTop: spacing.x3, textAlign: 'center' },
  button: {
    marginTop: spacing.x6,
    minHeight: layout.buttonHeight,
    paddingHorizontal: spacing.x6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
  },
  buttonPressed: { opacity: 0.76 },
  buttonLabel: { ...type.label, color: colors.dark, fontWeight: '600' },
});
