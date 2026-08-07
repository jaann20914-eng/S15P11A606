import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useMapStore } from '@/store/useMapStore';
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

/**
 * 표시 순서 그대로다. 홈 · 채팅 · 핀 · 추천 · 마이.
 *
 * 순서는 `DESIGN_GUIDE.md`의 `BottomNavigation`과 `docs/UX-SPEC.md`를 따른다.
 *
 * 탭 네비게이터(`app/(tabs)/_layout.tsx`)가 이 배열을 그대로 그리므로 순서는 여기서만 정한다.
 */
export const APP_TABS: readonly AppTabDefinition[] = [
  { key: 'home', label: '홈', icon: 'map-outline', iconActive: 'map', href: '/(tabs)/home' },
  {
    key: 'chat',
    label: '채팅',
    // 말풍선 하나다. chatbubbles(복수)는 두 개가 겹쳐 그려져 와이어프레임과 다르다.
    icon: 'chatbubble-outline',
    iconActive: 'chatbubble',
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
  /**
   * 화면 위에 떠 있는 배치인지. 기본은 `true`.
   *
   * 탭 네비게이터가 `tabBar`로 그릴 때는 바 슬롯이 이미 자리를 잡아 주므로 `false`를 준다.
   * 그때도 절대 배치를 하면 화면 밖으로 밀려 잘린다.
   */
  floating?: boolean;
  /**
   * 탭 전환 방법. 주지 않으면 경로로 이동한다.
   *
   * 탭 네비게이터는 자기 `navigation`을 넘겨 준다 — 그래야 각 탭이 들고 있던 스택 위치가
   * 유지된다. 경로로 이동하면 그 탭의 첫 화면으로 되돌아가 버린다.
   */
  onTabPress?: (tab: AppTab) => void;
}

/**
 * 앱 전체가 쓰는 단 하나의 하단 바.
 *
 * 탭 네비게이터(`app/(tabs)/_layout.tsx`)와 탭 밖 화면(장소·핀 상세)이 **같은 이 컴포넌트를**
 * 그린다. 예전에는 네비게이터가 React Navigation의 기본 렌더링을 쓰고 상세 화면만 이 바를
 * 그려서, 토큰은 공유하는데도 항목 간격과 라벨 배치가 미묘하게 달라 페이지마다 모양이 달랐다.
 *
 * 떠 있는 배치로 쓸 때는 스크롤 콘텐츠에 `useAppTabBarHeight()`만큼 여백을 줘야 가려지지 않는다.
 */
export function AppTabBar({ active, floating = true, onTabPress }: AppTabBarProps) {
  const { bottom } = useSafeAreaInsets();

  return (
    <View
      style={[
        s.bar,
        floating && s.barFloating,
        { height: APP_TAB_BAR_HEIGHT + bottom, paddingBottom: spacing.x2 + bottom },
      ]}
    >
      {APP_TABS.map(({ key, label, href }) => {
        const focused = key === active;
        const tint = focused ? appTabBarTheme.activeTintColor : appTabBarTheme.inactiveTintColor;

        return (
          <Pressable
            key={key}
            accessibilityRole="button"
            // 가운데 버튼은 글자를 두지 않으므로 읽어 줄 이름을 여기서만 준다.
            accessibilityLabel={key === 'write' ? '핀 제보' : label}
            accessibilityState={{ selected: focused }}
            /*
              기본 이동은 push가 아니라 navigate다. push는 갈 때마다 화면을 쌓아서, 게시글에서
              홈을 누르면 홈으로 "돌아가는" 대신 홈이 하나 더 얹힌다.

              홈 버튼은 "이번 복귀는 지도 축척 그대로"를 함께 올린다 — 상세를 거쳐 왔으면
              홈이 복귀하며 축척을 250m로 되돌리는데, 버튼으로 돌아온 홈은 보던 축척이 맞다
              (`useMapStore.keepMapLevelOnce`). 홈 화면 동작에만 쓰이는 값이라 다른 탭에는
              아무 영향이 없다. 홈에서 홈을 다시 누르는 경우(탭 바 안에서 이미 홈이 켜져
              있음)는 복귀가 아니므로 올리지 않는다 — 소비되지 않은 요청이 남으면 나중의
              정당한 축척 복원까지 건너뛴다.
            */
            onPress={() => {
              if (key === 'home' && (!onTabPress || active !== 'home')) {
                useMapStore.getState().requestKeepMapLevel();
              }
              if (onTabPress) onTabPress(key);
              else router.navigate(href as never);
            }}
            style={s.item}
          >
            <TabBarIcon tab={key} focused={focused} color={tint} />
            {/* 가운데 버튼에는 라벨을 두지 않는다(와이어프레임). 아이콘이 곧 의미다. */}
            {key !== 'write' && <Text style={[s.label, { color: tint }]}>{label}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const s = StyleSheet.create({
  bar: { ...appTabBarTheme.barStyle, flexDirection: 'row' },
  barFloating: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  item: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  // type.caption을 섞지 않는다. letterSpacing이 딸려와 라벨 자간이 달라진다.
  label: appTabBarTheme.labelStyle,
  /**
   * 가운데 핀 버튼.
   *
   * 크기·테두리·그림자는 `DESIGN_GUIDE.md` 10.6을 따른다. 모서리는 원이 아니라 둥근
   * 사각형이다 — pill을 쓰면 완전한 원이 되어 와이어프레임과 달라진다.
   */
  captureButton: {
    width: 56,
    height: 56,
    /*
      바 위로 떠오르는 깊이.

      -20에서는 흰 테두리가 바의 윗선과 거의 같은 자리에서 만나 둘이 뭉개져 보였다 —
      선이 끊긴 것도 이어진 것도 아닌 모양이었다(2026-08-06). 조금 더 올려 테두리가 선을
      가로지르게 하면, 흰 테두리가 선을 **끊고 그 위에 떠 있는** 것으로 읽힌다.
    */
    marginTop: -29,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.card,
    // 선을 끊을 만큼만 둔다. 더 두꺼우면 테두리가 버튼의 일부로 읽혀 무거워진다.
    borderWidth: 3,
    borderColor: colors.white,
    backgroundColor: colors.limeControl,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 7 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 9,
  },
  captureButtonFocused: { backgroundColor: colors.lime },
});
