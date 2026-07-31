import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing } from '@/constants/theme';

/**
 * 하단 탭 바 단일 소스.
 *
 * 두 군데에서 쓴다.
 * - `app/(tabs)/_layout.tsx` — 진짜 탭 네비게이터. `APP_TABS`와 `appTabBarTheme`, `TabBarIcon`을 쓴다.
 * - 탭 그룹 밖 화면(핀 상세, 장소 상세 등) — `<AppTabBar/>`를 직접 그린다.
 *
 * 순서·아이콘·색을 바꿀 일이 생기면 이 파일만 고친다. 화면마다 복사하지 않는다.
 */

export type AppTab = 'home' | 'chat' | 'write' | 'recommend' | 'mypage';

export interface AppTabDefinition {
  key: AppTab;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
  /** 탭 밖 화면에서 눌렀을 때 이동할 경로. */
  href: string;
}

/** 표시 순서 그대로다. 홈 · 채팅 · 제보 · 추천 · 마이. */
export const APP_TABS: readonly AppTabDefinition[] = [
  { key: 'home', label: '홈', icon: 'map-outline', iconActive: 'map', href: '/(tabs)/home' },
  {
    key: 'chat',
    label: '채팅',
    icon: 'chatbubbles-outline',
    iconActive: 'chatbubbles',
    href: '/(tabs)/chat/sent',
  },
  { key: 'write', label: '제보', icon: 'add', iconActive: 'add', href: '/(tabs)/write' },
  {
    key: 'recommend',
    label: '추천',
    icon: 'sparkles-outline',
    iconActive: 'sparkles',
    href: '/(tabs)/recommend',
  },
  { key: 'mypage', label: '마이', icon: 'person-outline', iconActive: 'person', href: '/(tabs)/mypage' },
];

/** 시스템 내비게이션 바를 제외한 순수 탭 영역 높이. */
export const APP_TAB_BAR_HEIGHT = 72;

/**
 * 기기 하단 시스템 바(갤럭시 제스처 바·3버튼 바)만큼 바를 키우고 안쪽 여백을 준다.
 * 이 보정이 없으면 탭 아이콘이 시스템 바와 겹쳐 눌리지 않는다.
 */
export function useAppTabBarStyle() {
  const { bottom } = useSafeAreaInsets();

  return {
    ...appTabBarTheme.barStyle,
    height: APP_TAB_BAR_HEIGHT + bottom,
    paddingBottom: spacing.x2 + bottom,
  } as const;
}

/** 바텀바에 가려지지 않도록 스크롤 콘텐츠가 확보해야 하는 하단 여백. */
export function useAppTabBarHeight(): number {
  return APP_TAB_BAR_HEIGHT + useSafeAreaInsets().bottom;
}

/** 탭 네비게이터와 공용 바가 같은 값을 쓰도록 모아 둔 시각 토큰. */
export const appTabBarTheme = {
  activeTintColor: colors.dark,
  inactiveTintColor: colors.gray400,
  barStyle: {
    height: APP_TAB_BAR_HEIGHT,
    paddingTop: spacing.x2,
    paddingBottom: spacing.x2,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    backgroundColor: colors.white,
  },
  labelStyle: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600' as const,
    // 웹에서 React Navigation은 라벨에 `system-ui` 스택을, 일반 Text는 `-apple-system` 스택을 쓴다.
    // 같은 11px인데도 글자 폭이 달라져 두 바가 달라 보이므로 웹에서만 명시해 맞춘다.
    ...Platform.select({ web: { fontFamily: 'System' }, default: null }),
  },
  captureLabelStyle: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '600' as const,
    marginTop: spacing.x2,
    ...Platform.select({ web: { fontFamily: 'System' }, default: null }),
  },
};

/** 가운데 제보 버튼. 다른 탭과 달리 원형 CTA로 떠 있다. */
function CaptureIcon({ focused }: { focused: boolean }) {
  return (
    <View style={[s.captureButton, focused && s.captureButtonFocused]}>
      <Ionicons name="add" size={30} color={colors.dark} />
    </View>
  );
}

/** 탭 네비게이터의 `tabBarIcon`에 그대로 꽂아 쓴다. */
export function TabBarIcon({ tab, focused, color }: { tab: AppTab; focused: boolean; color: string }) {
  if (tab === 'write') return <CaptureIcon focused={focused} />;

  const definition = APP_TABS.find((item) => item.key === tab);
  const name = focused ? definition?.iconActive : definition?.icon;

  return <Ionicons name={name ?? 'ellipse'} size={22} color={color} />;
}

export interface AppTabBarProps {
  /** 강조할 탭. 상세 화면처럼 어느 탭에도 속하지 않으면 비운다. */
  active?: AppTab;
}

/**
 * 탭 그룹 밖 화면용 하단 바.
 * 화면 하단에 절대 배치되므로 스크롤 콘텐츠에 `useAppTabBarHeight()`만큼 여백을 줘야 가려지지 않는다.
 */
export function AppTabBar({ active }: AppTabBarProps) {
  const { bottom } = useSafeAreaInsets();

  return (
    <View style={[s.bar, { height: APP_TAB_BAR_HEIGHT + bottom, paddingBottom: spacing.x2 + bottom }]}>
      {APP_TABS.map(({ key, label, href }) => {
        const focused = key === active;
        const tint = focused ? appTabBarTheme.activeTintColor : appTabBarTheme.inactiveTintColor;

        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            /*
              push가 아니라 navigate다. push는 갈 때마다 화면을 쌓아서, 게시글에서 홈을 누르면
              홈으로 "돌아가는" 대신 홈이 하나 더 얹힌다. 뒤로 가기를 여러 번 눌러야 빠져나오게 된다.
              navigate는 이미 있는 화면으로 되돌아간다.
            */
            onPress={() => router.navigate(href as never)}
            style={s.item}
          >
            <TabBarIcon tab={key} focused={focused} color={tint} />
            <Text style={[s.label, { color: tint }, key === 'write' && s.captureLabel]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    ...appTabBarTheme.barStyle,
    flexDirection: 'row',
  },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // type.caption을 섞지 않는다. letterSpacing이 딸려와 탭 네비게이터 라벨과 자간이 달라진다.
  label: appTabBarTheme.labelStyle,
  captureLabel: { marginTop: spacing.x2 },
  captureButton: {
    width: 56,
    height: 56,
    marginTop: -20,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: colors.limeSoft,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 9,
  },
  captureButtonFocused: { backgroundColor: colors.lime },
});
