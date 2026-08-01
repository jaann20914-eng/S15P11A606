import { Tabs } from 'expo-router';
import { APP_TABS, AppTabBar } from '@/components/common';
import type { AppTab } from '@/components/common';

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
          // 네비게이터의 이동을 그대로 쓴다. 각 탭이 들고 있던 스택 위치가 유지된다.
          onTabPress={(tab) => navigation.navigate(tab)}
        />
      )}
    >
      {/* 화면 등록만 한다. 표시는 전부 AppTabBar가 맡는다. */}
      {APP_TABS.map(({ key, label }) => (
        <Tabs.Screen key={key} name={key} options={{ title: label }} />
      ))}
    </Tabs>
  );
}
