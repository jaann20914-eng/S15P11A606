import { Tabs } from 'expo-router';
import { APP_TABS, TabBarIcon, appTabBarTheme } from '@/components/common';

/**
 * 탭 순서·아이콘·색은 `src/components/common/AppTabBar`가 단일 소스다.
 * 탭 그룹 밖 화면이 쓰는 `<AppTabBar/>`와 같은 정의를 공유하므로 여기서 따로 정의하지 않는다.
 */
export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: appTabBarTheme.activeTintColor,
        tabBarInactiveTintColor: appTabBarTheme.inactiveTintColor,
        tabBarStyle: appTabBarTheme.barStyle,
        tabBarLabelStyle: appTabBarTheme.labelStyle,
      }}
    >
      {APP_TABS.map(({ key, label }) => (
        <Tabs.Screen
          key={key}
          name={key}
          options={{
            title: label,
            tabBarLabelStyle:
              key === 'write' ? appTabBarTheme.captureLabelStyle : appTabBarTheme.labelStyle,
            tabBarIcon: ({ focused, color }) => <TabBarIcon tab={key} focused={focused} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
