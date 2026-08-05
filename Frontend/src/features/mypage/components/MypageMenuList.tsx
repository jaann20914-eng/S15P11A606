import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { mypageStyles as s } from '../styles';

/** 마이페이지에서 들어갈 수 있는 하위 화면. */
const menus = [
  { label: '오늘 작성한 핀', path: '/(tabs)/mypage/activity', icon: 'videocam-outline' },
  { label: '와글 포인트 내역', path: '/(tabs)/mypage/credits', icon: 'diamond-outline' },
] as const;

/** 내 정보와 활동 메뉴. 항목이 늘어나면 위 배열에만 추가한다. */
export function MypageMenuList() {
  return (
    <>
      <Text style={s.sectionTitle}>내 정보와 활동</Text>
      <View style={s.menuList}>
        {menus.map((item, index) => (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            onPress={() => router.push(item.path)}
            style={[s.menu, index < menus.length - 1 && s.menuBorder]}
          >
            <View style={s.menuIcon}>
              <Ionicons name={item.icon} size={18} color={colors.gray600} />
            </View>
            <Text style={s.menuText}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.gray400} />
          </Pressable>
        ))}
      </View>
    </>
  );
}
