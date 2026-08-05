import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';

import { ScreenHeader } from '@/components/common';
import { RecommendPlaceInfo } from '@/features/recommend/components/RecommendPlaceInfo';
import { RecommendPlaceMap } from '@/features/recommend/components/RecommendPlaceMap';
import { RecommendPlacePins } from '@/features/recommend/components/RecommendPlacePins';
import { useRecommendPlaceDetail } from '@/features/recommend/hooks/useRecommendPlaceDetail';
import { usePinThumbnails } from '@/features/place-detail/hooks/usePinThumbnails';
import { recommendStyles as s } from '@/features/recommend/styles';
import type { CrowdFilter } from '@/constants/crowdLevels';
import { colors } from '@/constants/theme';

/**
 * 추천 장소 상세.
 *
 * 홈의 장소 상세(`app/place/[placeId]`)와 목적이 다르다. 그쪽은 홈 지도 위에 겹치는
 * 바텀시트라 아래에 홈이 깔려 있어야 성립하는데, 추천 목록에서 열면 배경이 목록과 어긋나고
 * 목록으로 돌아가는 길도 시트를 내리는 동작뿐이다.
 *
 * 그래서 추천 안에서는 제 화면으로 연다. 지도는 이 장소 한 점만 찍는 읽기 전용이고
 * (내 위치·검색 없음), 그 아래로 기본정보와 핀 목록이 이어진다.
 *
 * `(tabs)` 안에 있으므로 바텀바는 탭 네비게이터가 그린다. 화면에서 따로 그리면 겹친다.
 */
/**
 * "지금 보고 있는 카드"를 판정하는 화면 위쪽 기준선(px).
 *
 * 마커로 이동할 때 카드를 이 자리에 세우고, 스크롤을 훑을 때도 이 선을 지난 마지막 카드를
 * 보고 있는 것으로 본다. 두 곳이 같은 값을 써야 마커로 간 카드가 그대로 선택으로 읽힌다.
 */
const SCROLL_ANCHOR = 96;

export default function RecommendPlaceScreen() {
  const { placeId, latitude, longitude, filter } = useLocalSearchParams<{
    placeId: string;
    latitude?: string;
    longitude?: string;
    /** 어느 목록(여유·와글)에서 열었는지. 지도 핀 색이 이 값을 따른다. */
    filter?: string;
  }>();

  // 목록을 거치지 않고 들어오면 없다. 기본은 여유(라임)로 둔다.
  const pinFilter: CrowdFilter = filter === 'wagle' ? 'wagle' : 'relaxed';

  // 경로 파라미터는 문자열이다. 숫자가 아니면 조회하지 않고 바로 안내로 넘긴다.
  const parsed = Number(placeId);

  /*
    목록에서 넘겨준 장소 좌표. 지도를 그 자리로 만들고, 핀 좌표를 받아 올 때도 그 주변만
    물어본다. 목록을 거치지 않고 들어오면(주소로 바로 열기 등) 없으므로 훅이 알아서 찾는다.
  */
  const known = useMemo(() => {
    const lat = Number(latitude);
    const lng = Number(longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { latitude: lat, longitude: lng };
  }, [latitude, longitude]);

  const { detail, mapData, loading, error } = useRecommendPlaceDetail(
    Number.isInteger(parsed) ? parsed : null,
    known,
  );

  /*
    카드에 썸네일과 가림 여부를 채운다 — 홈의 장소 상세와 **같은 훅**이다. 상세 응답의
    썸네일은 그릴 수 없는 값(S3 키)이라 핀별로 발급 주소를 받아야 하고, `revealed`도 결제
    기록만 반영돼 있어 작성자 본인 핀이 흐리게 나온다. 이 훅이 둘 다 고친다
    (`usePinThumbnails` 주석 참고). 빼먹으면 추천에서만 썸네일이 비고 내 핀이 가려진다.
  */
  const pins = usePinThumbnails(detail?.pins);

  /*
    지도의 마커와 아래 카드를 잇는 선택 상태. 홈의 핀 선택과 같은 동선이다.

    마커를 누르면 그 마커가 뾰족한 핀으로 바뀌고 해당 카드에 라임 테두리가 둘리며, 스크롤이
    그 카드로 내려간다. 상세로 여는 것은 카드를 눌렀을 때만이다 — 지도에서 누르는 것은
    "이게 어느 영상인지 보자"이지 "열자"가 아니다.
  */
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  /** 핀 목록 묶음이 스크롤 내용 안에서 시작하는 위치. 카드 위치와 더해 스크롤 지점을 만든다. */
  const pinSectionYRef = useRef(0);
  /** 카드별 위치(목록 윗변 기준). 목록이 알려 준 값을 모아 둔다. */
  const cardPositionsRef = useRef<Record<string, number>>({});

  const rememberCardPosition = useCallback((pinId: string, y: number) => {
    cardPositionsRef.current[pinId] = y;
  }, []);

  /*
    처음에는 첫 카드를 골라 둔다. 홈의 핀 보기와 같은 규칙이다 — 화면이 열리면 지금 보고
    있는 핀이 지도에 뾰족한 핀으로 이미 서 있어야, 지도와 목록이 짝이라는 것이 바로 읽힌다.
  */
  useEffect(() => {
    const first = detail?.pins[0]?.pinId;

    if (first !== undefined) setSelectedPinId((current) => current ?? first);
  }, [detail]);

  /*
    카드 수와 마커 수가 어긋나면 개발 중에 알 수 있게 남긴다.

    두 목록의 출처가 다르다 — 카드는 장소 상세(검수 중 핀도 섞임), 마커는 장소 목록의
    활성 핀(ACTIVE·미만료만)이다. 그래서 "카드는 6장인데 마커는 5개"가 날 수 있고, 그건
    지도가 빠뜨린 게 아니라 나머지 하나가 아직 공개 전이거나 이미 만료됐다는 뜻이다.
  */
  useEffect(() => {
    if (!__DEV__ || detail === null || mapData === null) return;

    const cardIds = new Set(detail.pins.map((pin) => pin.pinId));
    const markerIds = new Set(mapData.activePins.map((pin) => pin.pinId));

    if (cardIds.size !== markerIds.size) {
      console.log('[recommend-detail] 카드·마커 수 어긋남', {
        카드: cardIds.size,
        마커: markerIds.size,
        마커없는카드: [...cardIds].filter((id) => !markerIds.has(id)),
        카드없는마커: [...markerIds].filter((id) => !cardIds.has(id)),
      });
    }
  }, [detail, mapData]);

  /**
   * 마커를 눌러 스크롤을 옮기는 동안은 스크롤 추적을 잠근다.
   *
   * 프로그램이 미는 스크롤도 같은 이벤트를 내므로, 잠그지 않으면 목표 카드까지 가는 길에
   * 지나치는 카드들이 차례로 선택돼 하이라이트가 튄다. 값은 잠금이 풀리는 시각이다.
   */
  const trackingPausedUntilRef = useRef(0);

  const selectPin = useCallback((pinId: string) => {
    setSelectedPinId(pinId);

    const cardY = cardPositionsRef.current[pinId];

    // 좌표가 있는데 카드가 없는 핀(집계 어긋남)일 수 있다. 그때는 표시만 하고 머문다.
    if (cardY === undefined) return;

    trackingPausedUntilRef.current = Date.now() + 700;
    scrollRef.current?.scrollTo({
      y: Math.max(0, pinSectionYRef.current + cardY - SCROLL_ANCHOR),
      animated: true,
    });
  }, []);

  /*
    스크롤을 훑는 동안 "지금 보고 있는 카드"를 따라간다. 홈의 목록 단계와 같은 규칙이다 —
    화면 위쪽 기준선을 지난 마지막 카드가 지금 보는 카드이고, 그 마커가 뾰족한 핀이 된다.
    아래로 내리면 한 칸씩 다음 카드로 넘어가고, 올리면 되돌아온다.
  */
  /**
   * 지금 스크롤 위치가 가리키는 카드를 고른다.
   *
   * 움직이는 동안(onScroll)과 **멈춘 순간**(드래그 끝 · 관성 끝)에 함께 불린다. onScroll은
   * 조절 간격(throttle) 때문에 마지막 위치의 이벤트가 빠질 수 있어, 멈춘 자리 기준의 판정이
   * 한 번은 반드시 돌게 한다 — 바닥 근처에서 멈췄는데 마지막 카드가 안 잡히던 원인이다.
   */
  const applyScrollSelection = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>, ignorePause = false) => {
      if (!ignorePause && Date.now() < trackingPausedUntilRef.current) return;

      const pins = detail?.pins ?? [];
      if (pins.length === 0) return;

      const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;

      /*
        아래쪽 카드는 기준선까지 올라올 만큼 스크롤이 남아 있지 않다 — 고정 기준선만 쓰면
        끝까지 내려도 선택이 마지막 몇 장에 못 닿는다. 그래서 그 부족분(마지막 카드가
        기준선에 닿으려면 더 필요한 거리)을 스크롤 진행률에 비례해 기준선에 얹는다. 바닥에
        닿는 순간 기준선이 마지막 카드에 정확히 닿고, 중간 카드들의 간격도 고르게 당겨진다.
      */
      const maxOffset = Math.max(1, contentSize.height - layoutMeasurement.height);

      /*
        바닥 근처는 곧장 마지막 카드다. 아래 비례식은 정확히 바닥(offset = maxOffset)에
        닿아야 마지막 카드에 닿는데, 손으로 살살 내리면 몇 px 앞에서 멈춰 못 닿는다.
      */
      if (maxOffset - contentOffset.y <= 80) {
        const last = pins[pins.length - 1].pinId;

        setSelectedPinId((previous) => (previous === last ? previous : last));
        return;
      }

      const lastCardY = cardPositionsRef.current[pins[pins.length - 1].pinId];
      const lastAbsoluteY = lastCardY === undefined ? 0 : pinSectionYRef.current + lastCardY;
      const shortfall = Math.max(0, lastAbsoluteY - (maxOffset + SCROLL_ANCHOR));
      const progress = Math.min(1, Math.max(0, contentOffset.y / maxOffset));

      const anchor = contentOffset.y + SCROLL_ANCHOR + progress * shortfall;

      let current = pins[0].pinId;

      for (const pin of pins) {
        const cardY = cardPositionsRef.current[pin.pinId];

        if (cardY === undefined) continue;
        if (pinSectionYRef.current + cardY <= anchor) current = pin.pinId;
        else break;
      }

      setSelectedPinId((previous) => (previous === current ? previous : current));
    },
    [detail],
  );

  const trackScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => applyScrollSelection(event),
    [applyScrollSelection],
  );

  /*
    멈춘 자리에서는 마커 이동 잠금도 무시한다. 잠금은 이동 **중**의 스침을 막기 위한 것이고,
    멈춘 자리는 사용자가 실제로 보고 있는 자리다.
  */
  const settleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => applyScrollSelection(event, true),
    [applyScrollSelection],
  );

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={s.detailSafe}>
      <ScreenHeader title="추천 장소" back onBack={router.back} />

      {detail === null ? (
        <View style={s.state}>
          {loading ? (
            <ActivityIndicator color={colors.gray400} />
          ) : (
            <Text style={s.stateText}>{error ?? '장소를 찾을 수 없어요'}</Text>
          )}
        </View>
      ) : (
        <>
          {/*
            지도는 스크롤 밖에 **고정**한다. 카드를 훑는 동안에도 어느 자리 이야기인지 계속
            보여야 하고, 마커로 고른 카드를 찾으러 내려갈 때 기준점이 함께 사라지면 안 된다.
            좌우 여백 없이 화면 폭을 그대로 쓴다(시안).
          */}
          <RecommendPlaceMap
            name={detail.place.name}
            mapData={mapData}
            filter={pinFilter}
            selectedPinId={selectedPinId}
            onSelectPin={selectPin}
          />

          <ScrollView
            ref={scrollRef}
            style={s.detailScroll}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.detail}
            onScroll={trackScroll}
            onScrollEndDrag={settleScroll}
            onMomentumScrollEnd={settleScroll}
            scrollEventThrottle={80}
          >
            <View style={s.detailBody}>
              {/*
                요일별 혼잡도 그래프와 핀 카드는 장소 상세와 같은 것을 쓴다
                (`src/components/place`). 그 화면에 있던 구현을 공용으로 뺀 것이라 두 화면의
                모양이 갈라지지 않는다.
              */}
              <RecommendPlaceInfo place={detail.place} weeklyCrowdStats={detail.weeklyCrowdStats} />
              <View
                onLayout={(event) => {
                  pinSectionYRef.current = event.nativeEvent.layout.y;
                }}
              >
                <RecommendPlacePins
                  pins={pins}
                  placeName={detail.place.name}
                  filter={pinFilter}
                  selectedPinId={selectedPinId}
                  onCardPosition={rememberCardPosition}
                />
              </View>
            </View>
          </ScrollView>
        </>
      )}
    </SafeAreaView>
  );
}
