import { Tabs } from 'expo-router';
import { APP_TABS, TabBarIcon, appTabBarTheme, useAppTabBarStyle } from '@/components/common';

/**
 * 탭 순서·아이콘·색은 `src/components/common/AppTabBar`가 단일 소스다.
 * 탭 그룹 밖 화면이 쓰는 `<AppTabBar/>`와 같은 정의를 공유하므로 여기서 따로 정의하지 않는다.
 */
export default function TabLayout() {
  // 갤럭시 등 하단 시스템 바와 겹치지 않도록 기기별 inset을 반영한다.
  const tabBarStyle = useAppTabBarStyle();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: appTabBarTheme.activeTintColor,
        tabBarInactiveTintColor: appTabBarTheme.inactiveTintColor,
        tabBarStyle,
        tabBarLabelStyle: appTabBarTheme.labelStyle,
      }}
    >
      {APP_TABS.map(({ key, label }) => (
        <Tabs.Screen
          key={key}
          name={key}
          options={{
            title: label,
            tabBarLabelStyle: key === 'write' ? appTabBarTheme.captureLabelStyle : appTabBarTheme.labelStyle,
            tabBarAccessibilityLabel: key === 'write' ? '영상핀 제보' : label,
            tabBarIcon: ({ focused, color }) => <TabBarIcon tab={key} focused={focused} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
