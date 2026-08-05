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
            /*
              지도가 당겨지는 동안 시트가 떠오르게 한다.

              홈이 이 화면을 띄우면서 지도를 영상핀 축척까지 한 단계씩 당긴다(`openPlace` →
              `zoomStepwise`). 200ms로 두면 시트가 먼저 자리를 잡은 뒤에 지도만 뒤늦게
              움직여 두 동작이 따로 논다. 확대에 걸리는 시간의 절반쯤에 맞춰 두면 시트가
              떠오르는 동안 배경이 계속 확대되어 하나의 전환으로 읽힌다.
            */
            animation: 'fade',
            animationDuration: 320,
            /*
              **이 줄이 없으면 홈 지도가 사라진다.**

              위 `screenOptions.contentStyle`이 모든 화면의 씬 배경을 흰색으로 칠한다.
              반투명 모달로 띄워도 씬 자체가 불투명하면 아래 화면을 그대로 덮어 버린다.
              안쪽 View의 배경만 비우는 것으로는 부족하고, 씬 배경까지 투명해야 한다.
            */
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />

        {/*
          영상핀이 없는 장소도 같은 방식으로 홈 지도 위에 겹친다.

          검색에서 고른 장소가 우리 DB에 없을 때 온다. 장소 상세와 화면 구성이 같아야 하므로
          (검색바 · 지도 · 카드) 겹치는 방식도 같게 두어야 한다 — 자기 지도를 만들면 그 화면만
          지도가 새로 로드되고, 검색에서 이미 옮겨 둔 자리도 잃는다.

          확대 연출은 없다. 그 장소에는 당겨 볼 영상핀이 없어 축척을 바꿀 이유가 없으므로,
          장소 상세보다 짧게 넘긴다.
        */}
        <Stack.Screen
          name="place/no-pins"
          options={{
            presentation: 'transparentModal',
            animation: 'fade',
            animationDuration: 200,
            // 이 줄이 없으면 씬 배경이 흰색으로 칠해져 아래 홈 지도가 사라진다(위 참고).
            contentStyle: { backgroundColor: 'transparent' },
          }}
        />
      </Stack>
    </SafeAreaProvider>
  );
}
