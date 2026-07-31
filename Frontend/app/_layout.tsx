import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';

export default function RootLayout() {
  // 저장된 세션 복원과 세션 만료 시 로그인 복귀를 담당한다.
  useAuthSession();

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      />
    </SafeAreaProvider>
  );
}
