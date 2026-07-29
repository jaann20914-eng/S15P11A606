import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, layout, radius, spacing, type } from '@/constants/theme';
import { useOAuthLogin } from '@/features/auth/hooks/useOAuthLogin';
import type { OAuthProvider } from '@/types/auth';

function LoginButton({
  brand,
  label,
  busy,
  disabled,
  onPress,
}: {
  brand: OAuthProvider;
  label: string;
  /** 이 버튼으로 시작한 로그인이 진행 중인지. 스피너로 바꿔 보여준다. */
  busy: boolean;
  /** 다른 버튼으로 로그인이 진행 중인지. 흐리게 처리하고 입력을 막는다. */
  disabled: boolean;
  onPress: () => void;
}) {
  const isKakao = brand === 'kakao';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ busy, disabled }}
      disabled={busy || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.loginButton,
        { backgroundColor: isKakao ? colors.kakao : colors.naver },
        pressed && styles.loginButtonPressed,
        disabled && styles.loginButtonDisabled,
      ]}
    >
      <View style={styles.brandIcon}>
        {isKakao ? (
          <View style={styles.kakaoBubble}>
            <Text style={styles.kakaoMark}>TALK</Text>
          </View>
        ) : (
          <Text style={styles.naverMark}>N</Text>
        )}
      </View>
      {busy ? (
        <ActivityIndicator color={isKakao ? colors.dark : colors.white} />
      ) : (
        <Text style={[styles.loginLabel, !isKakao && styles.naverLabel]}>{label}</Text>
      )}
      <View style={styles.brandIcon} />
    </Pressable>
  );
}

export default function Login() {
  const { pendingProvider, error, signIn } = useOAuthLogin();

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient
        colors={[colors.white, colors.sky, colors.limeSoft]}
        locations={[0, 0.55, 1]}
        style={styles.background}
      >
        <View style={styles.hero}>
          <Image
            accessibilityLabel="지금어때 로고"
            source={require('../../assets/images/brand-logo.png')}
            style={styles.logo}
          />
          <View style={styles.copy}>
            <Text style={styles.eyebrow}>지금, 여기는 어때?</Text>
            <Text style={styles.title}>도착하기 전에{`\n`}현장을 먼저 보세요</Text>
            <Text style={styles.description}>
              실시간 현장 영상으로 장소의 혼잡도를 확인하고{`\n`}더 나은 방문 시간을 선택해요.
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          {/* 실패 문구는 버튼 위에 남겨 둔다. 다시 누르면 사라진다. */}
          {error && (
            <Text accessibilityRole="alert" style={styles.error}>
              {error}
            </Text>
          )}
          <LoginButton
            brand="kakao"
            label="카카오로 로그인"
            busy={pendingProvider === 'kakao'}
            disabled={pendingProvider === 'naver'}
            onPress={() => signIn('kakao')}
          />
          <LoginButton
            brand="naver"
            label="네이버로 로그인"
            busy={pendingProvider === 'naver'}
            disabled={pendingProvider === 'kakao'}
            onPress={() => signIn('naver')}
          />
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  background: { flex: 1 },
  hero: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: layout.gutterLarge,
    paddingTop: spacing.x8,
  },
  logo: {
    width: 148,
    height: 148,
    marginBottom: spacing.x8,
    resizeMode: 'contain',
  },
  copy: { gap: spacing.x3 },
  eyebrow: { ...type.title, color: colors.gray600 },
  title: { ...type.display, color: colors.dark },
  description: { ...type.body, color: colors.gray600, marginTop: spacing.x2 },
  actions: {
    gap: spacing.x3,
    paddingHorizontal: layout.gutterLarge,
    paddingBottom: spacing.x12,
  },
  loginButton: {
    minHeight: layout.buttonHeight,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.x5,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  loginButtonPressed: { opacity: 0.76 },
  loginButtonDisabled: { opacity: 0.5 },
  error: { ...type.caption, color: colors.danger, textAlign: 'center' },
  brandIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  kakaoBubble: {
    minWidth: 42,
    height: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.dark,
  },
  kakaoMark: { fontSize: 10, lineHeight: 14, fontWeight: '700', color: colors.kakao },
  naverMark: { fontSize: 34, lineHeight: 40, fontWeight: '900', color: colors.white },
  loginLabel: { ...type.body, fontWeight: '700', color: colors.dark },
  naverLabel: { color: colors.white },
});
