import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextStyle,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePlaceSearch } from '@/hooks/usePlaceSearch';
import { useMapStore } from '@/store/useMapStore';
import { MIN_PLACE_QUERY_LENGTH, WIDE_PLACE_SEARCH_RADIUS_M } from '@/types/place';
import type { PlaceSearchItem } from '@/types/place';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : undefined;

type RecentSearch = {
  id: number;
  label: string;
  date: string;
  kind: 'keyword' | 'place';
};

/**
 * 최근 검색은 이 화면이 살아 있는 동안만 남는다.
 *
 * 저장소에 남기려면 별도 작업이 필요하고 서버 API도 없다. 실제로 고른 장소만 쌓이도록
 * 비운 채 시작한다 — 꾸며 둔 기록을 두면 실제 검색 결과와 섞여 진짜처럼 보인다.
 */
const initialRecent: RecentSearch[] = [];

/** 최근 검색에 남길 날짜. 목록의 기존 표기(`07.22.`)를 따른다. */
function today(): string {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}.`;
}

/** 거리 표기. 1km 미만은 m로, 그 이상은 소수 한 자리 km로 보여준다. */
function formatDistance(meters: number): string {
  return meters < 1000 ? `${meters}m` : `${(meters / 1000).toFixed(1)}km`;
}

function LeadingIcon({ kind }: { kind: RecentSearch['kind'] }) {
  return (
    <View style={s.iconCircle}>
      <Ionicons name={kind === 'place' ? 'location' : 'search'} size={16} color={colors.gray400} />
    </View>
  );
}

function HighlightedName({ name, query }: { name: string; query: string }) {
  const start = name.indexOf(query);
  if (start < 0) return <Text style={s.placeName}>{name}</Text>;
  return (
    <Text style={s.placeName}>
      {name.slice(0, start)}
      <Text style={s.highlight}>{name.slice(start, start + query.length)}</Text>
      {name.slice(start + query.length)}
    </Text>
  );
}

export default function Search() {
  /*
    검색바는 "가려는 곳"을 찾는다. 서버 기본 반경 50m는 핀 등록용이라 여기서는 거의
    빈 결과가 되므로 넓은 반경을 직접 넘긴다.
  */
  const mapCenter = useMapStore((state) => state.center);
  const search = usePlaceSearch({
    radius: WIDE_PLACE_SEARCH_RADIUS_M,
    // 위치 권한이 없어도 검색은 되어야 한다. 지금 보고 있던 지도 중심을 기준으로 쓴다.
    fallbackCoordinate: mapCenter,
  });
  const [recent, setRecent] = useState(initialRecent);
  const focusOn = useMapStore((state) => state.focusOn);

  const normalizedQuery = search.keyword.trim();

  const submit = (value: string) => {
    search.setKeyword(value);
    Keyboard.dismiss();
  };

  /**
   * 고른 장소로 홈 지도를 옮긴다.
   *
   * 상세 화면으로 보내지 않는 이유는 `/places/search`가 카카오 장소만 주기 때문이다.
   * 상세가 필요로 하는 우리 `placeId`는 `GET /api/v1/places`(지도 범위 조회)에만 있어,
   * 지금 검색 결과만으로는 어떤 장소인지 서버에 물어볼 수 없다.
   */
  const choose = useCallback(
    (place: PlaceSearchItem) => {
      focusOn({
        coordinate: { latitude: place.latitude, longitude: place.longitude },
        name: place.name,
      });
      setRecent((current) => [
        { id: Date.now(), label: place.name, date: today(), kind: 'place' },
        ...current.filter((item) => item.label !== place.name),
      ]);
      router.back();
    },
    [focusOn],
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      <View style={s.searchWrap}>
        <View style={s.searchField}>
          <Pressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} style={s.iconButton}>
            <Ionicons name="chevron-back" size={24} color={colors.dark} />
          </Pressable>
          <TextInput
            value={search.keyword}
            onChangeText={search.setKeyword}
            onSubmitEditing={() => submit(search.keyword)}
            placeholder="장소명이나 태그를 입력하세요"
            placeholderTextColor={colors.gray600}
            returnKeyType="search"
            selectionColor={colors.blue}
            autoFocus
            style={[s.input, webNoOutline]}
          />
          {search.loading && <ActivityIndicator size="small" color={colors.gray600} />}
          {search.keyword.length > 0 && (
            <Pressable accessibilityLabel="검색어 지우기" onPress={search.clear} style={s.clearButton}>
              <Ionicons name="close" size={15} color={colors.white} />
            </Pressable>
          )}
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
      >
        {normalizedQuery ? (
          <View style={s.placeGroup}>
            {/* 두 글자부터 요청한다. 그 전에는 왜 결과가 없는지 알려 준다. */}
            {normalizedQuery.length < MIN_PLACE_QUERY_LENGTH && (
              <Text style={s.statusText}>{MIN_PLACE_QUERY_LENGTH}글자 이상 입력해 주세요.</Text>
            )}

            {search.error && (
              <View style={s.statusBlock}>
                <Text accessibilityRole="alert" style={s.statusText}>
                  {search.error}
                </Text>
                {/* 외부 장소 API 장애처럼 다시 시도할 값이 있을 때만 버튼을 준다. */}
                {search.retryable && (
                  <Pressable onPress={search.retry} style={s.retryButton}>
                    <Text style={s.retryText}>다시 시도</Text>
                  </Pressable>
                )}
              </View>
            )}

            {search.empty && <Text style={s.statusText}>검색 결과가 없어요.</Text>}

            {search.results.map((place) => (
              <Pressable key={place.kakaoPlaceId} onPress={() => choose(place)} style={s.placeRow}>
                <LeadingIcon kind="place" />
                <View style={s.placeCopy}>
                  <HighlightedName name={place.name} query={normalizedQuery} />
                  <Text style={s.placeAddress}>{place.address}</Text>
                  <Text style={s.placeMeta}>{formatDistance(place.distanceMeters)}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        ) : recent.length > 0 ? (
          <>
            <Text style={s.sectionTitle}>최근 검색</Text>
            <View style={s.titleRule} />
            {recent.map((item) => (
              <Pressable key={item.id} onPress={() => submit(item.label)} style={s.recentRow}>
                <LeadingIcon kind={item.kind} />
                <Text numberOfLines={1} style={s.recentLabel}>
                  {item.label}
                </Text>
                <Text style={s.date}>{item.date}</Text>
                <Pressable
                  accessibilityLabel={`${item.label} 검색 기록 삭제`}
                  hitSlop={10}
                  onPress={(event) => {
                    event.stopPropagation();
                    setRecent((current) => current.filter((recentItem) => recentItem.id !== item.id));
                  }}
                  style={s.deleteButton}
                >
                  <Ionicons name="close" size={19} color={colors.gray600} />
                </Pressable>
              </Pressable>
            ))}
          </>
        ) : (
          <View style={s.emptyState}>
            <View style={s.emptyIcon}>
              <Text style={s.emptyMark}>!</Text>
            </View>
            <Text style={s.emptyText}>최근 검색한 기록이 없습니다.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  searchWrap: { paddingHorizontal: layout.gutter, paddingTop: spacing.x3, paddingBottom: spacing.x2 },
  searchField: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.pill,
    backgroundColor: '#F1F3F5',
    paddingLeft: spacing.x1,
    paddingRight: spacing.x3,
  },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: {
    ...type.label,
    flex: 1,
    height: 52,
    paddingHorizontal: spacing.x1,
    borderWidth: 0,
    color: colors.dark,
  },
  clearButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#7D7F82',
  },
  content: { flexGrow: 1, paddingHorizontal: layout.gutter, paddingBottom: spacing.x10 },
  sectionTitle: { ...type.small, color: colors.gray600, marginTop: spacing.x2, marginBottom: spacing.x2 },
  titleRule: { height: 1, backgroundColor: colors.gray200 },
  recentRow: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F3F4F5',
  },
  recentLabel: { ...type.label, flex: 1, color: colors.dark },
  date: { ...type.caption, color: colors.gray400 },
  deleteButton: { width: 24, height: 44, alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', paddingTop: 64 },
  emptyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D5D8DC',
  },
  emptyMark: { fontSize: 22, lineHeight: 27, fontWeight: '700', color: colors.white },
  emptyText: { ...type.label, color: colors.dark, marginTop: spacing.x5 },
  highlight: { color: '#2F80ED', fontWeight: '600' },
  placeGroup: { marginTop: 0 },
  statusBlock: { alignItems: 'flex-start', gap: spacing.x2, paddingVertical: spacing.x4 },
  statusText: { ...type.small, color: colors.gray600, paddingVertical: spacing.x4 },
  retryButton: {
    paddingVertical: spacing.x2,
    paddingHorizontal: spacing.x4,
    borderRadius: radius.pill,
    backgroundColor: colors.gray100,
  },
  retryText: { ...type.small, color: colors.dark, fontWeight: '600' },
  placeRow: {
    minHeight: 92,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.x3,
    paddingVertical: spacing.x3,
    borderBottomWidth: 1,
    borderBottomColor: colors.gray200,
  },
  placeCopy: { flex: 1, minWidth: 0 },
  placeName: { ...type.label, color: colors.dark },
  placeAddress: { ...type.caption, color: colors.gray600, marginTop: 2 },
  placeMeta: { ...type.caption, color: colors.gray600 },
});
