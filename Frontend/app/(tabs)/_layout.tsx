import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '@/constants/theme';

const icons = {
  home: ['map-outline', 'map'],
  recommend: ['sparkles-outline', 'sparkles'],
  chat: ['chatbubbles-outline', 'chatbubbles'],
  mypage: ['person-outline', 'person'],
} as const;

function CaptureIcon({ focused }: { focused: boolean }) {
  return <View style={[s.captureButton, focused && s.captureButtonFocused]}><Ionicons name="add" size={30} color={colors.dark} /></View>;
}

export default function TabLayout() {
  return (
    <Tabs screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: colors.dark,
      tabBarInactiveTintColor: colors.gray400,
      tabBarStyle: s.tabBar,
      tabBarLabelStyle: s.label,
      tabBarIcon: ({ focused, color }) => route.name === 'write'
        ? <CaptureIcon focused={focused} />
        : <Ionicons name={icons[route.name as keyof typeof icons]?.[focused ? 1 : 0] ?? 'ellipse'} size={22} color={color} />,
    })}>
      <Tabs.Screen name="home" options={{ title: '홈' }} />
      <Tabs.Screen name="recommend" options={{ title: '추천' }} />
      <Tabs.Screen name="write" options={{ title: '제보', tabBarLabelStyle: s.captureLabel }} />
      <Tabs.Screen name="chat" options={{ title: '채팅' }} />
      <Tabs.Screen name="mypage" options={{ title: '마이' }} />
    </Tabs>
  );
}

const s = StyleSheet.create({
  tabBar: { height: 72, paddingTop: 8, paddingBottom: 8, borderTopWidth: 1, borderTopColor: colors.gray200, backgroundColor: colors.white },
  label: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  captureLabel: { fontSize: 11, lineHeight: 16, fontWeight: '600', marginTop: 8 },
  captureButton: {
    width: 56, height: 56, marginTop: -20, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.pill, borderWidth: 3, borderColor: colors.white, backgroundColor: colors.limeSoft,
    shadowColor: colors.dark, shadowOffset: { width: 0, height: 7 }, shadowOpacity: .2, shadowRadius: 10, elevation: 9,
  },
  captureButtonFocused: { backgroundColor: colors.lime },
});
