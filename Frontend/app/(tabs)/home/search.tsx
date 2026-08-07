import { useCallback, useMemo, useState } from 'react';
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

import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { usePlaceSearch } from '@/hooks/usePlaceSearch';
import { FillButton, HighlightedText, SearchRow } from '@/features/place-search/components';
import { usePlaceConfirm } from '@/features/place-search/hooks/usePlaceConfirm';
import { useRecentSearches } from '@/features/place-search/hooks/useRecentSearches';
import { useTagSuggestions } from '@/features/place-search/hooks/useTagSuggestions';
import { expandBounds, toBoundsQuery, useMapStore } from '@/store/useMapStore';
import { MIN_PLACE_QUERY_LENGTH, TAG_SEARCH_MIN_SPAN_M, WIDE_PLACE_SEARCH_RADIUS_M } from '@/types/place';
import type { PlaceSearchItem, RecentSearch } from '@/types/place';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

const webNoOutline = Platform.OS === 'web' ? ({ outlineStyle: 'none' } as unknown as TextStyle) : undefined;

/** 최근 검색 목록의 날짜 표기(`07.22.`). 서버는 UTC로 주므로 현지 시각으로 읽는다. */
function formatDate(isoString: string): string {
  const at = new Date(isoString);
  if (Number.isNaN(at.getTime())) return '';

  return `${String(at.getMonth() + 1).padStart(2, '0')}.${String(at.getDate()).padStart(2, '0')}.`;
}

/** 거리 표기. 1km 미만은 m로, 그 이상은 소수 한 자리 km로 보여준다. */
function formatDistance(meters: number): string {
  return meters < 1000 ? `${meters}m` : `${(meters / 1000).toFixed(1)}km`;
}

/** 태그는 앞의 `#`을 떼고 다룬다. 서버도 같은 정규화를 한다(`TagQueryNormalizer`). */
function toTagName(value: string): string {
  return value.trim().replace(/^#+/, '');
}

/**
 * 태그 줄 뒤에 붙는 안내말. `#데이트 태그로 검색`이 된다.
 *
 * 입력한 값을 확정하는 줄과 추천 줄이 **같은 문구를 쓴다.** 한 곳에 두어 한쪽만 바뀌는 일을
 * 막는다 — 나란히 서는 줄이라 문구가 갈리면 다른 기능으로 읽힌다.
 */
const TAG_ROW_SUFFIX = ' 태그로 검색';

export default function Search() {
  /*
    검색바는 "가려는 곳"을 찾는다. 서버 기본 반경 50m는 핀 등록용이라 여기서는 거의
    빈 결과가 되므로 넓은 반경을 직접 넘긴다.
  */
  const mapCenter = useMapStore((state) => state.center);
  const bounds = useMapStore((state) => state.bounds);

  const places = usePlaceSearch({
    radius: WIDE_PLACE_SEARCH_RADIUS_M,
    // 위치 권한이 없어도 검색은 되어야 한다. 지금 보고 있던 지도 중심을 기준으로 쓴다.
    fallbackCoordinate: mapCenter,
  });

  /*
    경계는 지도가 멈출 때마다 새 객체가 된다. 그대로 넘기면 훅이 매번 다른 값으로 보므로
    네 숫자가 실제로 바뀔 때만 새로 만든다.

    **화면 그대로가 아니라 넓혀서 보낸다.** 서버는 이 경계 안의 활성 핀에 달린 태그만 후보로
    삼는데, 20m까지 당겨 본 상태의 화면은 사방 50m라 옆 가게의 태그도 빠진다
    (`TAG_SEARCH_MIN_SPAN_M`). 결과 화면도 같은 값으로 넓힌다.
  */
  const boundsQuery = useMemo(
    () => (bounds === null ? null : toBoundsQuery(expandBounds(bounds, TAG_SEARCH_MIN_SPAN_M))),
    [bounds],
  );

  // `#`을 뗀 값을 보낸다. 서버도 떼지만, 보내는 쪽에서 맞춰야 로그와 실제 질의가 같아진다.
  const tags = useTagSuggestions(toTagName(places.keyword), boundsQuery);
  const recent = useRecentSearches();
  const confirm = usePlaceConfirm();

  /**
   * 이 화면이 맨 위인지.
   *
   * **결과 화면(장소 상세·태그·미등록 장소)이 올라와도 이 화면은 닫히지 않고 아래 남는다** —
   * 그래야 결과에서 뒤로 가기가 이 화면으로 돌아온다. 남는 동안은 내용을 감춘다. 그 화면들은
   * 아래 홈 지도를 비추는 반투명 화면이라, 이 목록이 남아 있으면 지도 자리를 흰 화면이 덮는다.
   * 태그 결과가 장소 상세에게 하는 것과 같은 처리다.
   *
   * 감추기만 하고 떼어 내지 않으므로 검색어와 결과 목록이 그대로 살아, 돌아오면 보던 검색이
   * 남아 있다.
   */
  const [onTop, setOnTop] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setOnTop(true);
      return () => {
        setOnTop(false);
        /*
          가려지는 순간 키보드를 내린다. 장소를 고르는 경로는 각자 내리지만(`openPlace` 등)
          최근 검색 재실행처럼 빠뜨린 경로가 있었다 — 입력 중에 결과로 넘어가면 키보드가
          결과 화면의 지도를 덮은 채 남았다. 화면을 떠나는 모든 길이 여기를 지나므로 한 곳에서
          막는다.
        */
        Keyboard.dismiss();
      };
    }, []),
  );

  const query = places.keyword.trim();
  const tagName = toTagName(places.keyword);
  const searching = query.length > 0;
  /*
    `#`으로 시작하면 태그를 찾겠다는 뜻으로 읽어 장소 구역을 접는다. 요청 자체는
    `usePlaceSearch`가 보내지 않는다(장소명은 `#`으로 시작하지 않는다).
  */
  const tagOnly = query.startsWith('#');
  const loading = places.loading || tags.loading;

  /**
   * 추천에 이미 같은 태그가 있는지. 없으면 "입력한 값으로 검색" 줄을 따로 보여준다.
   *
   * **대소문자를 무시하고 견준다.** 서버는 검색어를 소문자로 정규화해 맞추고 결과는 원래
   * 표기로 돌려주므로(`TagSuggestion`), 표기 그대로 비교하면 `CAFE`를 입력했을 때 추천
   * `Cafe`와 다른 태그로 보고 같은 태그가 두 줄로 선다.
   *
   * 추천이 비어 있어도 이 줄이 검색을 끝내는 길이다 — 색인 반영 전의 핀(배포 이전 등록)은
   * 추천에 없지만 확정(POST)은 DB를 읽으므로 찾아낸다.
   */
  const suggested = tags.results.some((tag) => tag.name.toLowerCase() === tagName.toLowerCase());

  /** 태그를 고르면 결과 화면으로 넘어간다. 확정 호출과 이력 저장은 그 화면이 맡는다. */
  const openTag = (name: string) => {
    const normalized = toTagName(name);
    if (normalized.length === 0) return;

    Keyboard.dismiss();
    // push라 결과에서 뒤로 가면 검색어가 남아 있는 이 화면으로 돌아온다. 장소 결과와 같은 규칙이다.
    router.push(`/(tabs)/home/tag/${encodeURIComponent(normalized)}`);
  };

  const openPlace = (place: PlaceSearchItem) => {
    Keyboard.dismiss();
    confirm.confirm(place.kakaoPlaceId, place.name, {
      latitude: place.latitude,
      longitude: place.longitude,
    });
  };

  /**
   * 최근 기록을 다시 실행한다.
   *
   * 이미 한 번 확정한 검색이므로 입력창에 되돌리지 않고 곧바로 결과로 간다(요구사항의
   * "키워드·태그 검색 기록 재실행").
   *
   * 장소 기록에는 좌표가 없다 — 서버가 `kakaoPlaceId`까지만 준다. 그래서 지도 이동 없이
   * 상세만 연다.
   */
  const rerun = (item: RecentSearch) => {
    if (item.type === 'TAG') {
      openTag(item.keyword);
      return;
    }

    if (item.kakaoPlaceId !== null) {
      confirm.confirm(item.kakaoPlaceId, item.keyword);
      return;
    }

    // 장소인데 카카오 식별자가 없으면 확정할 수 없다. 검색어만 되살려 다시 고르게 한다.
    places.setKeyword(item.keyword);
  };

  return (
    // 맨 위가 아니면 통째로 감춘다. `display`로 빼야 배치와 그리기까지 건너뛴다.
    <SafeAreaView edges={['top', 'left', 'right']} style={[s.safe, !onTop && s.covered]}>
      <View style={s.searchWrap}>
        <View style={s.searchField}>
          <Pressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} style={s.iconButton}>
            <Ionicons name="chevron-back" size={24} color={colors.dark} />
          </Pressable>
          <TextInput
            value={places.keyword}
            onChangeText={places.setKeyword}
            // 엔터는 태그 확정으로 읽는다. 장소는 목록에서 골라야 어느 지점인지 확정된다.
            onSubmitEditing={() => openTag(places.keyword)}
            placeholder="장소명이나 태그를 검색해보세요"
            placeholderTextColor={colors.gray600}
            returnKeyType="search"
            selectionColor={colors.blue}
            autoFocus
            style={[s.input, webNoOutline]}
          />
          {loading && <ActivityIndicator size="small" color={colors.limeText} />}
          {places.keyword.length > 0 && (
            <Pressable accessibilityLabel="검색어 지우기" onPress={places.clear} style={s.clearButton}>
              <Ionicons name="close" size={15} color={colors.white} />
            </Pressable>
          )}
        </View>
      </View>

      {/* 확정 실패·안내는 목록 위 한자리에서 읽힌다. 어떤 줄을 눌렀든 같은 곳에 뜬다. */}
      {confirm.notice !== null && (
        <Pressable accessibilityLabel="안내 닫기" onPress={confirm.dismissNotice} style={s.notice}>
          <Ionicons name="information-circle" size={16} color={colors.gray600} />
          <Text accessibilityRole="alert" style={s.noticeText}>
            {confirm.notice}
          </Text>
        </Pressable>
      )}

      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.content}
      >
        {searching ? (
          <>
            <View style={s.section}>
              <Text style={s.sectionTitle}>태그</Text>

              {/*
                **왜 추천이 없는지 적는다.** 예전에는 실패해도 목록만 비워서 "요청을 못 보냈다"
                ·"실패했다"·"후보가 0건이다"가 화면에서 똑같이 보였다. 아래 확정 줄이 있어
                검색은 이어 갈 수 있으므로 안내는 한 줄로만 둔다(장소 칸과 같은 모양).
              */}
              {tags.error !== null && (
                <Text accessibilityRole="alert" style={s.status}>
                  {tags.error}
                </Text>
              )}

              {/*
                후보가 0건인 경우. **조건을 그대로 알려 준다** — 서버는 지금 지도 범위 안의
                `활성 핀`에 달린 태그만 추천하고, 핀은 공개 1시간 뒤 만료된다(`Pin` TTL).
                그래서 어제 올린 핀의 태그는 아무리 정확히 입력해도 추천에 오르지 않는다.
                이 줄이 없으면 그것을 고장으로 읽는다(2026-08-07 실기기).
              */}
              {tags.error === null && tags.empty && (
                <Text style={s.status}>
                  최근 1시간 안에 올라온 주변 핀의 태그만 추천해요. 아래 줄로 바로 검색할 수 있어요.
                </Text>
              )}

              {/*
                입력한 값을 그대로 태그로 확정하는 줄. 추천에 같은 태그가 있으면 겹치지 않게 뺀다.
                추천이 비어 있어도 검색을 끝낼 수 있는 유일한 길이라 늘 위에 둔다.
              */}
              {!suggested && tagName.length > 0 && (
                <SearchRow
                  icon="keyword"
                  accessibilityLabel={`${tagName} 태그로 검색`}
                  onPress={() => openTag(tagName)}
                  trailing={<Ionicons name="chevron-forward" size={18} color={colors.gray400} />}
                >
                  <HighlightedText text={`#${tagName}`} query={tagName} suffix={TAG_ROW_SUFFIX} />
                </SearchRow>
              )}

              {/*
                서버가 준 후보를 **전부** 줄로 세운다. 자동완성이라 부분일치가 섞여 온다 —
                `카페`를 입력하면 `카페`·`카페라떼`·`예쁜카페`가 함께 온다(백엔드 설계, 2026-08-07
                협의). 어느 줄을 눌러도 그 태그의 결과로 간다.

                **글자는 위 줄과 같은 컴포넌트로 그린다.** 두 줄이 나란히 서는데 모양이 갈리면
                하는 일이 다른 줄로 읽힌다 — 예전에는 위만 `#데이트 태그로 검색`이고 추천은
                `#데이트`뿐이어서, 추천 줄이 눌리는 줄로 보이지 않았다.
              */}
              {tags.results.map((tag) => (
                <SearchRow
                  key={tag.name}
                  icon="keyword"
                  accessibilityLabel={`${tag.name} 태그로 검색`}
                  onPress={() => openTag(tag.name)}
                  trailing={
                    <FillButton
                      label={`${tag.name} 검색창에 넣기`}
                      onPress={() => places.setKeyword(tag.name)}
                    />
                  }
                >
                  <HighlightedText text={`#${tag.name}`} query={tagName} suffix={TAG_ROW_SUFFIX} />
                </SearchRow>
              ))}
            </View>

            {!tagOnly && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>장소</Text>

                {/* 두 글자부터 요청한다. 그 전에는 왜 결과가 없는지 알려 준다. */}
                {query.length < MIN_PLACE_QUERY_LENGTH && (
                  <Text style={s.status}>{MIN_PLACE_QUERY_LENGTH}글자 이상 입력해 주세요.</Text>
                )}

                {places.error !== null && (
                  <View style={s.statusBlock}>
                    <Text accessibilityRole="alert" style={s.status}>
                      {places.error}
                    </Text>
                    {/* 외부 장소 API 장애처럼 다시 시도할 값이 있을 때만 버튼을 준다. */}
                    {places.retryable && (
                      <Pressable onPress={places.retry} style={s.retryButton}>
                        <Text style={s.retryText}>다시 시도</Text>
                      </Pressable>
                    )}
                  </View>
                )}

                {places.empty && <Text style={s.status}>이름이 일치하는 장소가 없어요.</Text>}

                {places.results.map((place) => (
                  <SearchRow
                    key={place.kakaoPlaceId}
                    icon="place"
                    accessibilityLabel={`${place.name} 장소 보기`}
                    onPress={() => openPlace(place)}
                    pending={confirm.pendingId === place.kakaoPlaceId}
                  >
                    <HighlightedText text={place.name} query={query} />
                    <Text numberOfLines={1} style={s.placeAddress}>
                      {place.address}
                    </Text>
                    <Text style={s.placeMeta}>{formatDistance(place.distanceMeters)}</Text>
                  </SearchRow>
                ))}
              </View>
            )}
          </>
        ) : recent.loading ? (
          <View style={s.centered}>
            <ActivityIndicator size="small" color={colors.limeText} />
          </View>
        ) : recent.error !== null ? (
          <View style={s.statusBlock}>
            <Text accessibilityRole="alert" style={s.status}>
              {recent.error}
            </Text>
            <Pressable onPress={recent.reload} style={s.retryButton}>
              <Text style={s.retryText}>다시 시도</Text>
            </Pressable>
          </View>
        ) : recent.items.length > 0 ? (
          <>
            <Text style={s.sectionTitle}>최근 검색</Text>
            <View style={s.titleRule} />
            {/*
              시안에는 항목마다 ✕가 있으나 두지 않았다. 개별·전체 삭제 API가 아직 없어
              눌러도 다음 조회에서 그대로 되살아난다. API가 생기면 여기에 붙인다.
            */}
            {recent.items.map((item) => (
              <SearchRow
                key={item.searchId}
                icon={item.type === 'PLACE' ? 'place' : 'keyword'}
                accessibilityLabel={`${item.keyword} 다시 검색`}
                onPress={() => rerun(item)}
                /* 태그와 미등록 장소 기록은 식별자가 없다. null끼리 맞아 표시가 켜지지 않게 한다. */
                pending={item.kakaoPlaceId !== null && confirm.pendingId === item.kakaoPlaceId}
                trailing={<Text style={s.date}>{formatDate(item.createdAt)}</Text>}
              >
                <Text numberOfLines={1} style={s.recentLabel}>
                  {item.type === 'TAG' ? `#${item.keyword}` : item.keyword}
                </Text>
              </SearchRow>
            ))}
          </>
        ) : (
          <View style={s.centered}>
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
  /** 위에 결과 화면이 겹쳤을 때. 반투명한 그 화면 밑에서 지도를 가리지 않게 한다. */
  covered: { display: 'none' },
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
    borderRadius: radius.pill,
    backgroundColor: '#7D7F82',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.x2,
    marginHorizontal: layout.gutter,
    marginBottom: spacing.x2,
    paddingVertical: spacing.x3,
    paddingHorizontal: spacing.x4,
    borderRadius: radius.md,
    backgroundColor: colors.gray100,
  },
  noticeText: { ...type.caption, flex: 1, color: colors.gray600 },
  content: { flexGrow: 1, paddingHorizontal: layout.gutter, paddingBottom: spacing.x10 },
  section: { marginTop: spacing.x2 },
  sectionTitle: { ...type.small, color: colors.gray600, marginTop: spacing.x2, marginBottom: spacing.x2 },
  titleRule: { height: 1, backgroundColor: colors.gray200 },
  status: { ...type.small, color: colors.gray600, paddingVertical: spacing.x4 },
  statusBlock: { alignItems: 'flex-start', gap: spacing.x2, paddingVertical: spacing.x4 },
  retryButton: {
    paddingVertical: spacing.x2,
    paddingHorizontal: spacing.x4,
    borderRadius: radius.pill,
    backgroundColor: colors.gray100,
  },
  retryText: { ...type.small, color: colors.dark, fontWeight: '600' },
  placeAddress: { ...type.caption, color: colors.gray600, marginTop: 2 },
  placeMeta: { ...type.caption, color: colors.gray600 },
  recentLabel: { ...type.label, color: colors.dark },
  date: { ...type.caption, color: colors.gray400 },
  centered: { flex: 1, alignItems: 'center', paddingTop: 64 },
  emptyIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#D5D8DC',
  },
  emptyMark: { fontSize: 22, lineHeight: 27, fontWeight: '700', color: colors.white },
  emptyText: { ...type.label, color: colors.dark, marginTop: spacing.x5 },
});
