import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ApiError } from '@/api/client';
import { searchPlacesByTag } from '@/api/pin/tagSearch';
import { rememberPlaceMapData } from '@/api/place/coordinates';
import { ViewAvatar } from '@/components/common';
import { REVIEW_PIN_MAX_LEVEL } from '@/components/home/kakaoMapHtml';
import { toBoundsQuery, useMapStore } from '@/store/useMapStore';
import { createDevLogger, toRequestLine } from '@/utils/devLog';
import type { TaggedPlace } from '@/types/place';
import { colors, layout, radius, spacing, type } from '@/constants/theme';

/** 오류 코드별 안내. */
const messageByCode: Record<string, string> = {
  INVALID_TAG_NAME: '태그명이 올바르지 않아요.',
  INVALID_MAP_RANGE: '지도 범위가 올바르지 않아요.',
  UNAUTHORIZED: '로그인이 필요해요.',
  TAGGED_PINS_FETCH_FAILED: '핀을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
};

const log = createDevLogger('tag-confirm');

/** 링으로 보여줄 작성자 수. 넘치는 핀은 `+n`으로 적는다(홈 장소 카드와 같은 값). */
const ANGLE_PREVIEW_COUNT = 5;
const ANGLE_RING_SIZE = 30;

/**
 * 태그 검색 결과 — `POST /api/v1/pins/tags/search`
 *
 * 확정 호출을 검색 화면이 아니라 여기서 한다. 그 호출 하나가 결과 조회와 검색 이력 저장을
 * 겸하므로, 결과를 그리는 쪽이 부르면 값을 넘길 통로를 따로 만들지 않아도 된다.
 *
 * **이 조회는 DB를 읽는다**(`PinRepository.findActivePinsByTagWithinBounds`). 태그 자동완성이
 * 읽는 Elasticsearch 색인과 달라서, 방금 등록한 핀도 곧바로 여기서 찾힌다.
 *
 * **결과는 장소 단위다**(2026-08-05 재점검). 서버가 그 태그가 달린 활성 핀을 장소별로 묶어
 * 주고, 핀은 좌표와 뷰 각도만 온다 — 작성자·메모·썸네일이 없어 핀 카드로는 그릴 수 없다.
 * 그래서 장소 카드로 보여주고 누르면 그 장소 상세로 보낸다.
 *
 * **이 화면에는 지도를 두지 않지만, 홈 지도 위에 겹쳐 있다**(`transparentModal` — 홈 스택의
 * `_layout`에 이유를 적었다). 목록만 보여주면 되니 지도를 비추지는 않고 흰 배경으로 덮어 두고,
 * 위에 장소 상세가 올라오면 내용을 감춰 그 아래 홈 지도가 드러나게 한다. 상세 화면이 자기
 * 지도를 만들지 않기 때문에 이 구조가 아니면 상세에 지도가 없다.
 *
 * 결과는 검색한 순간의 지도 범위에 묶여 있다. 그래서 뒤로 가면 그 범위를 보고 있던 홈으로
 * 돌아간다(검색 화면은 `replace`로 대체된다).
 */
export default function TagSearchResult() {
  const { tag } = useLocalSearchParams<{ tag: string }>();
  const bounds = useMapStore((state) => state.bounds);
  const focusOn = useMapStore((state) => state.focusOn);

  const [places, setPlaces] = useState<TaggedPlace[]>([]);
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
      log('중단 — 지도 범위 없음', { tag });
      setLoading(false);
      setError('지도가 준비된 뒤에 태그를 검색할 수 있어요.');
      return;
    }

    const query = toBoundsQuery(current);
    const startedAt = Date.now();
    log('요청', { 재현: toRequestLine('POST', '/api/v1/pins/tags/search', { tag, ...query }) });

    searchPlacesByTag(tag, query)
      .then((found) => {
        log('응답', {
          tag: found.tag,
          장소: found.places.length,
          핀: found.places.reduce((total, place) => total + place.activePins.length, 0),
          소요: `${Date.now() - startedAt}ms`,
          // 자동완성과 달리 이쪽은 DB를 읽는다. 0건이면 이 지도 범위에 그 태그의 활성 핀이 없다.
          비고: found.places.length === 0 ? '0건 — 이 지도 범위에 해당 태그의 활성 핀이 없다' : undefined,
        });

        /*
          **받은 좌표를 지도 저장소에 기억해 둔다.**

          장소 상세는 좌표를 스스로 받을 수 없다 — 상세 응답에는 장소도 핀도 위경도가 없고
          (`PlaceSummary`·`PinCard`), 목록(`GET /places`)만 좌표를 준다. 그래서 상세는 홈이
          받아 둔 것을 꺼내 쓰는데, 이 경로로 들어온 장소는 홈이 보고 있던 범위 밖일 수 있어
          **꺼낼 것이 없으면 기본 중심 주변을 다시 훑는다**(`resolvePlaceMapData`). 거기서도
          못 찾으면 지도에 마커가 하나도 찍히지 않는다.

          이 응답에는 장소 좌표와 그 태그가 달린 활성 핀의 좌표가 함께 온다. 넣어 두면 상세가
          조회 없이 바로 마커를 찍는다 — 모자란 핀은 상세가 목록을 한 번 더 물어 채운다.
        */
        rememberPlaceMapData(found.places);

        setPlaces(found.places);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        log('실패', {
          tag,
          code: cause instanceof ApiError ? cause.code : 'unknown',
          statusCode: cause instanceof ApiError ? cause.statusCode : undefined,
          message: cause instanceof Error ? cause.message : String(cause),
          소요: `${Date.now() - startedAt}ms`,
        });

        setLoading(false);
        setError(
          cause instanceof ApiError ? (messageByCode[cause.code] ?? cause.message) : '핀을 불러오지 못했어요',
        );
      });
  }, [tag]);

  /**
   * 이 화면이 맨 위인지.
   *
   * **위에 장소 상세가 올라오면 내용을 감춘다.** 그 화면은 자기 지도가 없어 아래 홈 지도를
   * 비추는데, 이 목록이 그대로 남아 있으면 지도 자리를 흰 카드가 덮어 버린다 — 지도 없이
   * 스와이프 카드와 내 위치 버튼만 목록 위에 겹쳐 보였던 것이 이것이다.
   *
   * 감추기만 하고 떼어 내지 않는다. 스크롤 위치를 잃으면 돌아왔을 때 보던 자리가 아니다.
   * 홈이 상세에게, 상세가 그 위 화면에게 하는 것과 같은 처리다.
   */
  const [onTop, setOnTop] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setOnTop(true);
      return () => setOnTop(false);
    }, []),
  );

  /**
   * 장소 상세로 넘어간다. **넘어가면서 홈 지도를 그 장소로 옮긴다.**
   *
   * 상세는 자기 지도가 없으므로 이 화면이 지도를 맞춰 두어야 한다 — 그러지 않으면 검색 전에
   * 보고 있던 자리가 그대로 남아 엉뚱한 동네에 시트가 열린다. 홈이 카드 꺽새로 상세를 열 때
   * 하는 것과 같은 값(핀 축척)이다(`openPlace`).
   *
   * 이동은 홈이 실행한다(`focus` → `focusPlace`). 홈은 아래에 살아 있으므로 화면에 없어도
   * 명령을 받는다. 상세가 첫 게시물의 핀으로 중심을 다시 맞추지만 이미 같은 축척이라 그때는
   * 짧게 미끄러질 뿐이다.
   */
  const openPlace = (place: TaggedPlace) => {
    focusOn({
      coordinate: { latitude: place.latitude, longitude: place.longitude },
      name: place.name,
      level: REVIEW_PIN_MAX_LEVEL,
    });
    router.push(`/place/${place.placeId}`);
  };

  return (
    // 맨 위가 아니면 통째로 감춘다. `display`로 빼야 배치와 그리기까지 건너뛴다.
    <SafeAreaView edges={['top', 'left', 'right']} style={[s.safe, !onTop && s.covered]}>
      <View style={s.header}>
        <Pressable accessibilityLabel="뒤로 가기" onPress={() => router.back()} style={s.iconButton}>
          <Ionicons name="chevron-back" size={24} color={colors.dark} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="다시 검색하기"
          /*
            검색 화면은 이 화면 바로 아래 남아 있다(검색이 push로 열었다). 새로 열지 않고
            돌아가야 입력하던 검색어가 그대로 있고, 화면도 쌓이지 않는다.
          */
          onPress={() => router.back()}
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
            <ActivityIndicator size="small" color={colors.limeText} />
          </View>
        ) : error !== null ? (
          <View style={s.centered}>
            <Text accessibilityRole="alert" style={s.emptyTitle}>
              {error}
            </Text>
          </View>
        ) : places.length === 0 ? (
          <View style={s.centered}>
            <Text style={s.emptyTitle}>이 태그의 핀이 없어요</Text>
            <Text style={s.emptyText}>지도를 옮긴 뒤 다시 검색해 보세요.</Text>
          </View>
        ) : (
          <>
            <Text style={s.summary}>이 지도 범위에서 {places.length}곳을 찾았어요</Text>
            {/*
              **장소 카드로 그린다.** 서버가 그 태그의 활성 핀을 장소별로 묶어 주고, 핀 자체는
              좌표와 뷰 각도만 오기 때문이다(작성자·메모·썸네일이 없어 핀 카드를 그릴 수 없다).
              누르면 그 장소의 상세로 보내 거기서 핀을 넘겨 보게 한다.
            */}
            {places.map((place) => (
              <Pressable
                key={place.placeId}
                accessibilityRole="button"
                accessibilityLabel={`${place.name} 상세 보기`}
                onPress={() => openPlace(place)}
                style={s.placeCard}
              >
                <View style={s.placeTop}>
                  <View style={s.placeCopy}>
                    <Text numberOfLines={1} style={s.placeName}>
                      {place.name}
                    </Text>
                    <Text numberOfLines={1} style={s.placeAddress}>
                      {place.address}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={22} color={colors.gray400} />
                </View>

                <View style={s.placeRule} />

                <Text style={s.pinCount}>
                  #{tag} 핀 {place.activePins.length}개
                </Text>
                {/*
                  작성자마다 링 모양이 달라야 한다 — 각도별 채움이 다르게 그려진다. 홈·추천의
                  장소 카드와 같은 컴포넌트를 쓴다.
                */}
                <View style={s.angleRow}>
                  {place.activePins.slice(0, ANGLE_PREVIEW_COUNT).map((pin) => (
                    <ViewAvatar key={pin.pinId} angle={pin.viewAngle} size={ANGLE_RING_SIZE} />
                  ))}
                  {place.activePins.length > ANGLE_PREVIEW_COUNT && (
                    <Text style={s.morePins}>+{place.activePins.length - ANGLE_PREVIEW_COUNT}</Text>
                  )}
                </View>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  /**
   * 화면 전체. **흰 배경은 여기서 칠한다.**
   *
   * 씬 배경은 투명이다(홈 스택의 `_layout`) — 그래야 위에 상세가 올라와 이 상자를 감췄을 때
   * 아래 홈 지도가 드러난다. 배경을 씬에 맡기면 감춰도 흰 화면이 남는다.
   */
  safe: { flex: 1, backgroundColor: colors.white },
  /** 위에 다른 화면이 겹쳤을 때. 아래 홈 지도가 그 화면에 보여야 한다. */
  covered: { display: 'none' },
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
  /** 장소 한 곳. 홈 시트의 장소 카드와 같은 결로 둔다(흰 카드 + 옅은 그림자). */
  placeCard: {
    padding: spacing.x5,
    borderRadius: radius.card,
    backgroundColor: colors.white,
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  placeTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.x3 },
  placeCopy: { flex: 1, minWidth: 0 },
  placeName: { ...type.title, color: colors.dark },
  placeAddress: { ...type.caption, color: colors.gray400, marginTop: 1 },
  placeRule: { width: 56, height: 1, backgroundColor: colors.gray200, marginVertical: spacing.x3 },
  pinCount: { ...type.caption, color: colors.gray600 },
  angleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2, marginTop: spacing.x2 },
  morePins: { ...type.caption, color: colors.gray600, marginLeft: spacing.x1 },
  centered: { flex: 1, alignItems: 'center', paddingTop: 64 },
  emptyTitle: { ...type.label, color: colors.dark, textAlign: 'center' },
  emptyText: { ...type.small, color: colors.gray600, marginTop: spacing.x2 },
});
