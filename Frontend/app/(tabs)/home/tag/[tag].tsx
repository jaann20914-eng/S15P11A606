import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '@/api/client';
import { searchPinsByTag } from '@/api/pin/tagSearch';
import { PlacePinCard } from '@/components/place';
import { toBoundsQuery, useMapStore } from '@/store/useMapStore';
import type { PlacePinCard as PlacePinCardData } from '@/types/place';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

/** 오류 코드별 안내. */
const messageByCode: Record<string, string> = {
  INVALID_TAG_NAME: '태그명이 올바르지 않아요.',
  INVALID_MAP_RANGE: '지도 범위가 올바르지 않아요.',
  UNAUTHORIZED: '로그인이 필요해요.',
  TAGGED_PINS_FETCH_FAILED: '영상핀을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
};

/**
 * 태그 검색 결과 — `POST /api/v1/pins/tags/search`
 *
 * 확정 호출을 검색 화면이 아니라 여기서 한다. 그 호출 하나가 결과 조회와 검색 이력 저장을
 * 겸하므로, 결과를 그리는 쪽이 부르면 값을 넘길 통로를 따로 만들지 않아도 된다.
 *
 * **이 조회는 DB를 읽는다**(`PinRepository.findActivePinsByTagWithinBounds`). 태그 자동완성이
 * 읽는 Elasticsearch 색인과 달라서, 방금 등록한 영상핀도 곧바로 여기서 찾힌다.
 *
 * **지도를 두지 않았다.** 시안에는 결과 위에 지도가 있지만 응답의 핀 카드에 좌표가 없어
 * (`PinCard`는 작성자·메모·태그만 준다) 마커를 찍을 수가 없다. 좌표를 주는 곳은 장소
 * 목록(`GET /api/v1/places`)뿐인데 그건 장소 단위라 태그로 고른 핀과 맞출 수 없다.
 *
 * 결과는 검색한 순간의 지도 범위에 묶여 있다. 그래서 뒤로 가면 그 범위를 보고 있던 홈으로
 * 돌아간다(검색 화면은 `replace`로 대체된다).
 */
export default function TagSearchResult() {
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const bounds = useMapStore((state) => state.bounds);

  const [pins, setPins] = useState<PlacePinCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /*
    확정은 검색 이력을 남기는 호출이다. 화면이 다시 그려질 때마다 부르면 같은 검색이 여러 번
    기록되므로 한 번만 부른다.
  */
  const requested = useRef(false);

  /** 들어온 시점의 경계로 고정한다. 조회를 다시 일으키지 않는다. */
  const boundsRef = useRef(bounds);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    const current = boundsRef.current;
    if (current === null) {
      setLoading(false);
      setError('지도가 준비된 뒤에 태그를 검색할 수 있어요.');
      return;
    }

    searchPinsByTag(tag, toBoundsQuery(current))
      .then((found) => {
        setPins(found);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        setLoading(false);
        setError(
          cause instanceof ApiError
            ? (messageByCode[cause.code] ?? cause.message)
            : '영상핀을 불러오지 못했어요',
        );
      });
  }, [tag]);

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.safe}>
      <View style={s.header}>
        <Pressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} style={s.iconButton}>
          <Ionicons name="chevron-back" size={24} color={colors.dark} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다시 검색하기"
          onPress={() => router.replace('/(tabs)/home/search')}
          style={s.searchField}
        >
          <Ionicons name="search" size={20} color={colors.gray600} />
          <Text numberOfLines={1} style={s.searchText}>
            #{tag}
          </Text>
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        {loading ? (
          <View style={s.centered}>
            <ActivityIndicator size="small" color={colors.gray600} />
          </View>
        ) : error !== null ? (
          <View style={s.centered}>
            <Text accessibilityRole="alert" style={s.emptyTitle}>
              {error}
            </Text>
          </View>
        ) : pins.length === 0 ? (
          <View style={s.centered}>
            <Text style={s.emptyTitle}>이 태그의 영상핀이 없어요</Text>
            <Text style={s.emptyText}>지도를 옮긴 뒤 다시 검색해 보세요.</Text>
          </View>
        ) : (
          <>
            <Text style={s.summary}>이 지도 범위에서 {pins.length}개를 찾았어요</Text>
            {pins.map((pin) => (
              <PlacePinCard key={pin.pinId} pin={pin} onPress={() => router.push(`/pin/${pin.pinId}`)} />
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.gutter,
    paddingTop: spacing.x3,
    paddingBottom: spacing.x2,
  },
  iconButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  searchField: {
    flex: 1,
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x3,
    paddingHorizontal: spacing.x4,
    borderRadius: radius.pill,
    backgroundColor: '#F1F3F5',
  },
  searchText: { ...type.label, flex: 1, color: colors.dark, fontWeight: '600' },
  content: { flexGrow: 1, gap: spacing.x3, paddingHorizontal: layout.gutter, paddingBottom: spacing.x10 },
  summary: { ...type.small, color: colors.gray600, marginTop: spacing.x2 },
  centered: { flex: 1, alignItems: 'center', paddingTop: 64 },
  emptyTitle: { ...type.label, color: colors.dark, textAlign: 'center' },
  emptyText: { ...type.small, color: colors.gray600, marginTop: spacing.x2 },
});
