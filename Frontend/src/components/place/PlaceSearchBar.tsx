import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

/**
 * 지도 위에 뜨는 검색바 — **찾아 들어온 화면용**.
 *
 * 홈의 검색바와 두 가지가 다르다.
 * - 왼쪽이 돋보기가 아니라 **꺽새**다. 한 번 골라 들어온 화면이라 돌아갈 곳이 있고, 그 자리를
 *   뒤로 가기로 쓰면 검색 화면·태그 결과 화면과 같은 자리·같은 모양이 되어 배울 것이 없다.
 * - 검색어 자리에 **찾은 장소의 이름**이 남는다. 검색 화면에서 그 장소를 골라 들어온 것과
 *   다르지 않으므로, 고른 값이 그대로 있어야 무엇을 찾아본 결과인지 위에서 읽힌다.
 *
 * 장소 상세와 "핀이 없는 장소" 화면이 함께 쓴다. 두 화면이 각자 만들면 한쪽만 고쳐져
 * 같은 자리의 바가 서로 달라진다.
 */

export interface PlaceSearchBarProps {
  /**
   * 검색어 자리에 남길 이름. 아직 모르면(조회 중·실패) 비워 두면 안내 문구가 대신 놓인다.
   *
   * 빈 바를 두지 않는 이유는, 값을 지운 것처럼 보이기 때문이다.
   */
  keyword?: string | null;
}

export function PlaceSearchBar({ keyword = null }: PlaceSearchBarProps) {
  return (
    <View style={s.bar}>
      {/*
        꺽새만 따로 눌리게 둔다 — 바 전체와 겹쳐 두면 뒤로 가려다 검색 화면이 열린다.
        아이콘만으로는 손가락에 비해 좁아 눌리는 자리를 넓히되, 오른쪽은 두 요소 사이 간격
        안에서만 넓혀 검색 자리를 침범하지 않는다.
      */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="뒤로 가기"
        onPress={() => router.back()}
        hitSlop={{ top: spacing.x3, bottom: spacing.x3, left: spacing.x3, right: spacing.x2 }}
      >
        <Ionicons name="chevron-back" size={24} color={colors.dark} />
      </Pressable>

      {/*
        검색으로 갈 때 **쌓지 않고 걷어낸다**(`dismissTo`). push는 이 화면 위에 탭 그룹을
        통째로 복제해 얹어서, 검색을 이어서 할수록 화면이 한 겹씩 쌓이고 뒤로 가기가 지나온
        상세들을 전부 되짚었다. dismissTo는 위에 쌓인 상세들을 전부 닫고 홈 스택의 검색
        화면으로 돌아간다 — 검색에서 들어온 결과 화면이면 검색어가 남은 그 검색으로 되돌아오고,
        홈 카드에서 곧장 들어온 상세면 검색이 없으니 홈 위에 새로 연다. 어느 쪽이든 검색에서
        뒤로 가기는 홈이다.
      */}
      <Pressable onPress={() => router.dismissTo('/(tabs)/home/search')} style={s.field}>
        <Text numberOfLines={1} style={keyword === null ? s.placeholder : s.value}>
          {keyword ?? '장소명이나 태그를 검색해보세요'}
        </Text>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  /**
   * 검색바는 불투명한 흰색이다.
   *
   * 반투명(0.92)으로 두면 아래 지도가 배어 나오는데, 지도는 자리마다 색이 달라 **바 안에서
   * 흰 농도가 갈려 투톤으로 보였다.** 지도 위에 뜬 컨트롤이라 글자를 읽는 것이 먼저다.
   */
  bar: {
    // 시트가 확장될 때 이 바 아래에서 멈춘다. 그 계산도 같은 값을 쓰므로 토큰으로 둔다.
    height: layout.searchHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    paddingHorizontal: spacing.x4,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 7,
  },
  /**
   * 검색으로 가는 자리. 꺽새를 뺀 나머지 전부다.
   *
   * 높이를 바에 맞춰 늘려 둔다(`alignSelf: stretch`). 글자 높이만큼만 눌리면 바 안에서 위아래
   * 여백을 누를 때 아무 일도 일어나지 않아 먹통으로 읽힌다.
   */
  field: { flex: 1, alignSelf: 'stretch', justifyContent: 'center' },
  placeholder: { ...type.body, color: colors.gray600 },
  /** 찾아 들어온 장소 이름. 안내 문구와 달리 실제 값이라 본문색으로 둔다. */
  value: { ...type.body, color: colors.dark },
});
