import { StackActions } from '@react-navigation/native';
import { Tabs } from 'expo-router';
import { APP_TABS, AppTabBar } from '@/components/common';
import type { AppTab } from '@/components/common';

/**
 * 탭을 벗어나면 안에 쌓인 화면을 접고 첫 화면으로 돌아가는 탭.
 *
 * 마이페이지(크레딧·닉네임 수정)와 추천(장소 상세)은 다른 탭에 다녀온 사람이 "이어 보던
 * 깊은 화면"이 아니라 그 탭의 입구를 기대한다. 홈·채팅·작성은 손대지 않는다 — 홈의 검색
 * 스택과 채팅의 연결 상태는 탭을 오가도 이어져야 한다.
 */
const RESET_ON_LEAVE = new Set<AppTab>(['mypage', 'recommend']);

/**
 * 탭 네비게이터.
 *
 * 하단 바는 React Navigation의 기본 렌더링을 쓰지 않고 `AppTabBar`를 그대로 그린다.
 * 탭 밖 화면(장소·핀 상세)도 같은 컴포넌트를 쓰므로 **모든 페이지에서 한 가지 모양**이 된다.
 * 예전에는 두 렌더러가 토큰만 공유해, 항목 간격과 라벨 배치가 미묘하게 달랐다.
 *
 * 순서·아이콘·색은 `src/components/common/AppTabBar`가 단일 소스다.
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={({ state, navigation }) => (
        <AppTabBar
          // 바 슬롯이 이미 자리를 잡아 주므로 절대 배치를 끈다.
          floating={false}
          active={state.routes[state.index]?.name as AppTab}
          onTabPress={(tab) => {
            /*
              보고 있는 탭을 다시 누르면 그 탭의 첫 화면으로 접는다.

              추천 장소 상세를 보다가 추천 탭을 누르는 것은 "추천 처음으로"라는 뜻인데,
              기본 동작은 아무 일도 하지 않는다. 접기 대상은 벗어날 때 접히는 탭과 같은
              묶음이다 — 홈·채팅·작성의 동작은 그대로 둔다.
            */
            const currentRoute = state.routes[state.index];

            if (currentRoute?.name === tab && RESET_ON_LEAVE.has(tab)) {
              const childStackKey = currentRoute.state?.key;

              if (childStackKey !== undefined) {
                navigation.dispatch({ ...StackActions.popToTop(), target: childStackKey });
              }
              return;
            }

            // 네비게이터의 이동을 그대로 쓴다. 각 탭이 들고 있던 스택 위치가 유지된다.
            navigation.navigate(tab);
          }}
        />
      )}
    >
      {/* 화면 등록만 한다. 표시는 전부 AppTabBar가 맡는다. */}
      {APP_TABS.map(({ key, label }) => (
        <Tabs.Screen
          key={key}
          name={key}
          options={{
            title: label,
            // 벗어나면 첫 화면으로 접는 탭. 나머지 탭의 스택 위치는 그대로 유지된다.
            ...(RESET_ON_LEAVE.has(key) ? { popToTopOnBlur: true } : null),
          }}
        />
      ))}
    </Tabs>
  );
}
