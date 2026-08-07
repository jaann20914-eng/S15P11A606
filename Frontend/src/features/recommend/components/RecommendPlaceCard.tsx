import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import { colors } from '@/constants/theme';
import type { CrowdFilter } from '@/constants/crowdLevels';
import { usePinThumbnails } from '@/features/place-detail/hooks/usePinThumbnails';
import type { RecommendedPlace } from '@/types/recommend';
import { formatRelativeTime } from '@/utils/datetime';
import { useRecommendPlaceDetail } from '../hooks/useRecommendPlaceDetail';
import { recommendStyles as s } from '../styles';
import { RecommendPlaceMap } from './RecommendPlaceMap';
import { RecommendPlacePins } from './RecommendPlacePins';

export interface RecommendPlaceCardProps {
  place: RecommendedPlace;
  /** 핀 색 계열. 지도 마커와 카드 테두리가 같은 계열이어야 짝으로 읽힌다. */
  mode: CrowdFilter;
  /**
   * 지금 보고 있는 장인지.
   *
   * **거짓이면 조회하지 않는다.** 최대 10곳이 한 화면에 실리는데 전부 미리 받으면 상세와
   * 썸네일을 수십 번 부르게 된다. 한 번 열린 카드는 그대로 두어(아래 `opened`) 되돌아왔을 때
   * 다시 기다리지 않게 한다.
   */
  active: boolean;
  /** 추천을 만든 시각(ISO 8601). 카드 오른쪽 위 "N분전 업데이트"에 쓴다. */
  generatedAt: string | null;
  /**
   * 값이 바뀌면 이 장소를 다시 받는다.
   *
   * 핀 상세에서 내 핀을 고치거나 지우고 돌아오는 경우다. 화면이 초점을 되찾을 때 올린다.
   */
  reloadToken: number;
}

/**
 * "지금 보고 있는 핀"을 판정하는 목록 위쪽 기준선(px).
 *
 * 마커로 이동할 때 카드를 이 자리에 세우고, 스크롤을 훑을 때도 이 선을 지난 마지막 카드를
 * 보고 있는 것으로 본다. 두 곳이 같은 값을 써야 마커로 간 카드가 그대로 선택으로 읽힌다.
 */
const SCROLL_ANCHOR = 24;

/** 바닥에 이만큼 가까우면 곧장 마지막 카드로 본다. 손으로 살살 내리면 정확히 바닥에 닿지 않는다. */
const BOTTOM_SLACK = 80;

/**
 * 추천 캐러셀 한 장 — 장소 하나.
 *
 * 예전에는 목록에서 장소 카드를 누르면 상세 화면으로 들어가야 핀을 볼 수 있었다. 그 두 단계를
 * 한 장에 합쳤다. 위에서부터 장소 이름 · 지도 · 핀 목록이고, 지도의 마커와 아래 핀 카드는
 * 서로를 가리킨다 — 마커를 누르면 그 핀 카드로 내려가고, 핀 목록을 훑으면 그 마커가 뾰족한
 * 핀으로 선다(홈의 장소 상세와 같은 동선).
 *
 * 핀을 누르면 핀 상세로 간다. 그건 이 화면 밖(`/pin/{pinId}`)이라 뒤로 가면 이 자리로 돌아온다.
 */
export function RecommendPlaceCard({
  place,
  mode,
  active,
  generatedAt,
  reloadToken,
}: RecommendPlaceCardProps) {
  /*
    한 번 열린 카드는 계속 열린 것으로 둔다. 옆으로 넘어갔다 돌아올 때마다 다시 받으면
    같은 것을 반복해서 묻고, 그동안 카드가 로딩으로 덮인다.
  */
  const [opened, setOpened] = useState(active);

  useEffect(() => {
    if (active) setOpened(true);
  }, [active]);

  /** 목록이 넘겨준 장소 좌표. 있으면 그 자리 주변만 물어보므로 지도가 정확하다. */
  const coordinate = useMemo(
    () =>
      place.latitude === undefined || place.longitude === undefined
        ? null
        : { latitude: place.latitude, longitude: place.longitude },
    [place.latitude, place.longitude],
  );

  const { detail, mapData, loading, error } = useRecommendPlaceDetail(
    opened ? place.placeId : null,
    coordinate,
    reloadToken,
  );

  /*
    카드에 썸네일과 가림 여부를 채운다 — 홈의 장소 상세와 **같은 훅**이다. 상세 응답의
    썸네일은 그릴 수 없는 값(S3 키)이라 핀별로 발급 주소를 받아야 하고, `revealed`도 결제
    기록만 반영돼 있어 작성자 본인 핀이 흐리게 나온다. 이 훅이 둘 다 고친다.
  */
  const pins = usePinThumbnails(detail?.pins);

  /*
    지도의 마커와 아래 카드를 잇는 선택 상태.

    마커를 누르면 그 마커가 뾰족한 핀으로 바뀌고 해당 카드에 계열 색 테두리가 둘리며, 목록이
    그 카드로 내려간다. 상세로 여는 것은 카드를 눌렀을 때만이다 — 지도에서 누르는 것은
    "이게 어느 영상인지 보자"이지 "열자"가 아니다.
  */
  const [selectedPinId, setSelectedPinId] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView>(null);
  /** 핀 카드별 위치(목록 윗변 기준). 목록이 알려 준 값을 모아 둔다. */
  const cardPositionsRef = useRef<Record<string, number>>({});

  const rememberCardPosition = useCallback((pinId: string, y: number) => {
    cardPositionsRef.current[pinId] = y;
  }, []);

  /*
    처음에는 첫 핀을 골라 둔다. 카드가 열리면 지금 보고 있는 핀이 지도에 뾰족한 핀으로 이미
    서 있어야, 지도와 목록이 짝이라는 것이 바로 읽힌다.
  */
  useEffect(() => {
    const first = detail?.pins[0]?.pinId;

    if (first !== undefined) setSelectedPinId((current) => current ?? first);
  }, [detail]);

  /**
   * 마커를 눌러 목록을 옮기는 동안은 스크롤 추적을 잠근다.
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
    scrollRef.current?.scrollTo({ y: Math.max(0, cardY - SCROLL_ANCHOR), animated: true });
  }, []);

  /**
   * 지금 스크롤 위치가 가리키는 핀을 고른다.
   *
   * 움직이는 동안(onScroll)과 **멈춘 순간**(드래그 끝 · 관성 끝)에 함께 불린다. onScroll은
   * 조절 간격 때문에 마지막 위치의 이벤트가 빠질 수 있어, 멈춘 자리 기준의 판정이 한 번은
   * 반드시 돌게 한다 — 바닥 근처에서 멈췄는데 마지막 카드가 안 잡히던 원인이다.
   */
  const applyScrollSelection = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>, ignorePause = false) => {
      if (!ignorePause && Date.now() < trackingPausedUntilRef.current) return;

      const list = detail?.pins ?? [];
      if (list.length === 0) return;

      const { contentOffset, layoutMeasurement, contentSize } = event.nativeEvent;
      const maxOffset = Math.max(1, contentSize.height - layoutMeasurement.height);

      // 바닥 근처는 곧장 마지막 카드다. 아래 비례식은 정확히 바닥에 닿아야 마지막에 닿는다.
      if (maxOffset - contentOffset.y <= BOTTOM_SLACK) {
        const last = list[list.length - 1].pinId;

        setSelectedPinId((previous) => (previous === last ? previous : last));
        return;
      }

      /*
        아래쪽 카드는 기준선까지 올라올 만큼 스크롤이 남아 있지 않다 — 고정 기준선만 쓰면
        끝까지 내려도 선택이 마지막 몇 장에 못 닿는다. 그 부족분을 스크롤 진행률에 비례해
        기준선에 얹어, 바닥에 닿는 순간 마지막 카드에 정확히 닿게 한다.
      */
      const lastCardY = cardPositionsRef.current[list[list.length - 1].pinId] ?? 0;
      const shortfall = Math.max(0, lastCardY - (maxOffset + SCROLL_ANCHOR));
      const progress = Math.min(1, Math.max(0, contentOffset.y / maxOffset));
      const anchor = contentOffset.y + SCROLL_ANCHOR + progress * shortfall;

      let current = list[0].pinId;

      for (const pin of list) {
        const cardY = cardPositionsRef.current[pin.pinId];

        if (cardY === undefined) continue;
        if (cardY <= anchor) current = pin.pinId;
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

  const updated = generatedAt === null ? '' : formatRelativeTime(generatedAt);

  return (
    <View style={s.pageCard}>
      {/*
        장소 이름과 주소. 지도 위에 두어 "어디 이야기인지"가 먼저 읽히게 한다.
        업데이트 시각은 추천 전체의 기준 시각이라 카드마다 같은 값이다.
      */}
      <View style={s.pageHead}>
        <View style={s.pageHeadRow}>
          <Text numberOfLines={1} style={s.pageName}>
            {place.name}
          </Text>
          {updated !== '' && (
            <View style={s.updateMeta}>
              <View style={s.updateDot} />
              <Text style={s.updateText}>{updated} 업데이트</Text>
            </View>
          )}
        </View>
        <Text numberOfLines={1} style={s.pageAddress}>
          {place.address}
        </Text>
      </View>

      {/*
        지도는 목록 밖에 **고정**한다. 핀을 훑는 동안에도 어느 자리 이야기인지 계속 보여야
        하고, 마커로 고른 핀을 찾으러 내려갈 때 기준점이 함께 사라지면 안 된다.
      */}
      <RecommendPlaceMap
        name={place.name}
        mapData={mapData}
        filter={mode}
        selectedPinId={selectedPinId}
        onSelectPin={selectPin}
      />

      {detail === null ? (
        <View style={s.pageState}>
          {loading || !opened ? (
            <ActivityIndicator color={colors.gray400} />
          ) : (
            <Text style={s.stateText}>{error ?? '장소를 찾을 수 없어요'}</Text>
          )}
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={s.pagePins}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.pagePinsContent}
          nestedScrollEnabled
          onScroll={trackScroll}
          onScrollEndDrag={settleScroll}
          onMomentumScrollEnd={settleScroll}
          scrollEventThrottle={80}
        >
          <RecommendPlacePins
            pins={pins}
            placeName={place.name}
            filter={mode}
            selectedPinId={selectedPinId}
            onCardPosition={rememberCardPosition}
          />
        </ScrollView>
      )}
    </View>
  );
}
