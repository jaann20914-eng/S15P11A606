// 앱 최초 진입점. 복원된 인증 상태에 따라 첫 화면을 고른다.
import { Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '@/constants/theme';
import { useAuthStore } from '@/store/useAuthStore';

export default function Index() {
  const hydrated = useAuthStore((state) => state.hydrated);
  const authStatus = useAuthStore((state) => state.authStatus);

  // secure store를 읽는 동안 로그인 화면을 먼저 보여주면 이미 로그인한 사용자에게 깜빡인다.
  if (!hydrated) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={colors.gray600} />
      </View>
    );
  }

  if (authStatus === 'AUTHENTICATED') {
    return <Redirect href="/(tabs)/home" />;
  }

  if (authStatus === 'ONBOARDING_REQUIRED') {
    return <Redirect href="/(onboarding)/age" />;
  }

  return <Redirect href="/(auth)/login" />;
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
});
