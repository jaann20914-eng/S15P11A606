import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { color, colors, spacing } from '@/constants/theme';

/**
 * 하단 네비게이션 공통 규격 (공통 컴포넌트 시안 "바텀바").
 *
 * - 탭 4개(홈·추천·채팅·마이) + 가운데 제보 버튼
 * - 홈/추천/채팅은 선택 시 채워진 아이콘으로, 마이는 선 아이콘 그대로 색만 바뀐다
 * - 가운데 제보 버튼은 라벨이 없고, 라임 라운드 사각형 + 흰 테두리로 바 위에 떠 있다
 *
 * 탭 화면은 `app/(tabs)/_layout.tsx`가 이 규격을 쓰고,
 * 탭 밖 화면(장소 상세 등)은 `StaticBottomNav`로 같은 모양을 그린다.
 */

export type NavTab = 'home' | 'recommend' | 'chat' | 'mypage';

/** [비활성 아이콘, 활성 아이콘] — 마이는 시안대로 선 아이콘을 유지한다. */
export const navIcons: Record<
  NavTab,
  readonly [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]
> = {
  home: ['map-outline', 'map'],
  recommend: ['sparkles-outline', 'sparkles'],
  chat: ['chatbubble-outline', 'chatbubble'],
  mypage: ['person-outline', 'person-outline'],
};

export const navLabels: Record<NavTab, string> = {
  home: '홈',
  recommend: '추천',
  chat: '채팅',
  mypage: '마이',
};

/** 시스템 내비게이션 바를 제외한 순수 탭 영역 높이. */
export const navBarHeight = 72;

/**
 * 기기의 하단 시스템 바(갤럭시 제스처 바·3버튼 바)만큼 바를 키우고 안쪽 여백을 준다.
 * 이 보정이 없으면 탭 아이콘이 시스템 바와 겹쳐 눌리지 않는다.
 */
export function useNavBarStyle() {
  const { bottom } = useSafeAreaInsets();

  return {
    ...navBarStyles.bar,
    height: navBarHeight + bottom,
    paddingBottom: spacing.x2 + bottom,
  } as const;
}

/** 바텀바에 가려지지 않도록 스크롤 콘텐츠가 확보해야 하는 하단 여백. */
export function useNavBarHeight() {
  return navBarHeight + useSafeAreaInsets().bottom;
}

/** 가운데 제보 버튼. 눌린(활성) 상태에서 라임이 한 단계 진해진다. */
export function CaptureButton({ focused }: { focused: boolean }) {
  return (
    <View style={[s.capture, focused && s.captureFocused]}>
      <Ionicons name="add" size={30} color={colors.white} />
    </View>
  );
}

export function NavIcon({ tab, focused }: { tab: NavTab; focused: boolean }) {
  return (
    <Ionicons
      name={navIcons[tab][focused ? 1 : 0]}
      size={24}
      color={focused ? colors.dark : colors.gray400}
    />
  );
}

export const navBarStyles = StyleSheet.create({
  bar: {
    height: navBarHeight,
    paddingTop: spacing.x2,
    paddingBottom: spacing.x2,
    borderTopWidth: 1,
    borderTopColor: colors.gray200,
    backgroundColor: colors.white,
  },
  label: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
});

const s = StyleSheet.create({
  capture: {
    width: 58,
    height: 58,
    marginTop: -22,
    alignItems: 'center',
    justifyContent: 'center',
    // 시안의 가운데 버튼은 원이 아니라 모서리가 둥근 사각형이다.
    borderRadius: 20,
    borderWidth: 4,
    borderColor: colors.white,
    backgroundColor: color.primary.control,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 9,
  },
  captureFocused: { backgroundColor: colors.limeActive },
});

/**
 * 탭 밖 화면에서 쓰는 표시용 바텀바.
 * 실제 탭 전환은 `onPress`를 받은 화면이 라우팅으로 처리한다.
 */
export function StaticBottomNav({
  active,
  onPressTab,
  onPressCapture,
}: {
  active: NavTab;
  onPressTab: (tab: NavTab) => void;
  onPressCapture: () => void;
}) {
  const tabs: NavTab[] = ['home', 'recommend', 'chat', 'mypage'];
  const barStyle = useNavBarStyle();

  return (
    <View style={[st.wrap, barStyle]}>
      {tabs.slice(0, 2).map((tab) => (
        <NavCell key={tab} tab={tab} active={active} onPress={onPressTab} />
      ))}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="영상핀 제보"
        onPress={onPressCapture}
        style={st.cell}
      >
        <CaptureButton focused={false} />
      </Pressable>
      {tabs.slice(2).map((tab) => (
        <NavCell key={tab} tab={tab} active={active} onPress={onPressTab} />
      ))}
    </View>
  );
}

function NavCell({ tab, active, onPress }: { tab: NavTab; active: NavTab; onPress: (tab: NavTab) => void }) {
  const focused = tab === active;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      onPress={() => onPress(tab)}
      style={st.cell}
    >
      <NavIcon tab={tab} focused={focused} />
      <Text style={[navBarStyles.label, { color: focused ? colors.dark : colors.gray400, marginTop: 2 }]}>
        {navLabels[tab]}
      </Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
