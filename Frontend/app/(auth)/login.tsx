import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Image, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

function LoginButton({
  brand,
  label,
  onPress,
}: {
  brand: 'kakao' | 'naver';
  label: string;
  onPress: () => void;
}) {
  const isKakao = brand === 'kakao';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.loginButton,
        { backgroundColor: isKakao ? colors.kakao : colors.naver },
        pressed && styles.loginButtonPressed,
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
      <Text style={[styles.loginLabel, !isKakao && styles.naverLabel]}>{label}</Text>
      <View style={styles.brandIcon} />
    </Pressable>
  );
}

export default function Login() {
  const startOnboarding = () => router.push('/(onboarding)/age');

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
            <Text style={styles.description}>실시간 현장 영상으로 장소의 혼잡도를 확인하고{`\n`}더 나은 방문 시간을 선택해요.</Text>
          </View>
        </View>

        <View style={styles.actions}>
          <LoginButton brand="kakao" label="카카오로 로그인" onPress={startOnboarding} />
          <LoginButton brand="naver" label="네이버로 로그인" onPress={startOnboarding} />
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
