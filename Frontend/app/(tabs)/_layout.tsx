import { Tabs } from 'expo-router';
import { CaptureButton, NavIcon, navBarStyles, useNavBarStyle } from '@/components/common/BottomNav';
import type { NavTab } from '@/components/common/BottomNav';
import { colors } from '@/constants/theme';

export default function TabLayout() {
  // 갤럭시 등 하단 시스템 바와 겹치지 않도록 기기별 inset을 반영한다.
  const tabBarStyle = useNavBarStyle();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.dark,
        tabBarInactiveTintColor: colors.gray400,
        tabBarStyle,
        tabBarLabelStyle: navBarStyles.label,
        tabBarIcon: ({ focused }) =>
          route.name === 'write' ? (
            <CaptureButton focused={focused} />
          ) : (
            <NavIcon tab={route.name as NavTab} focused={focused} />
          ),
      })}
    >
      <Tabs.Screen name="home" options={{ title: '홈' }} />
      <Tabs.Screen name="recommend" options={{ title: '추천' }} />
      {/* 시안의 가운데 제보 버튼에는 라벨이 없다. */}
      <Tabs.Screen name="write" options={{ title: '', tabBarAccessibilityLabel: '영상핀 제보' }} />
      <Tabs.Screen name="chat" options={{ title: '채팅' }} />
      <Tabs.Screen name="mypage" options={{ title: '마이' }} />
    </Tabs>
  );
}
