import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { useAuthSession } from '@/features/auth/hooks/useAuthSession';
import { useChatSocketSession } from '@/features/chat/hooks/useChatSocketSession';

export default function RootLayout() {
  // 저장된 세션 복원과 세션 만료 시 로그인 복귀를 담당한다.
  useAuthSession();

  // 로그인해 있는 동안 채팅 소켓을 열어 둔다. 다른 탭에서도 새 메시지·요청을 받기 위해서다.
  useChatSocketSession();

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
          animation: 'slide_from_right',
        }}
      >
        {/*
          장소 상세는 화면을 바꾸지 않고 홈 지도 위에 겹친다.

          `transparentModal`이라 아래 홈 화면이 그대로 살아 있고, 그 지도가 계속 보인다.
          그래서 이 화면은 자기 지도를 만들지 않고 시트만 그린다 — 지도 재로드도, 옆에서
          밀려 들어오는 연출도 없이 시트 내용만 바뀐 것처럼 보인다.

          라우트 이름은 **`place/[placeId]/index`** 다. `app/place/[placeId]/index.tsx`에
          중첩 `_layout`이 없어 파일 경로가 그대로 이름이 된다. `place/[placeId]`로 적으면
          어느 라우트와도 맞지 않아 옵션이 조용히 무시된다.
        */}
        <Stack.Screen
          name="place/[placeId]/index"
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            animationDuration: 200,
            /*
              **이 줄이 없으면 홈 지도가 사라진다.**

              위 `screenOptions.contentStyle`이 모든 화면의 씬 배경을 흰색으로 칠한다.
              반투명 모달로 띄워도 씬 자체가 불투명하면 아래 화면을 그대로 덮어 버린다.
              안쪽 View의 배경만 비우는 것으로는 부족하고, 씬 배경까지 투명해야 한다.
            */
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
