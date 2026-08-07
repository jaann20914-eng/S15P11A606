import { useCallback, useRef } from 'react';
import { FlatList, View, useWindowDimensions } from 'react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

import type { CrowdFilter } from '@/constants/crowdLevels';
import type { RecommendedPlace } from '@/types/recommend';
import { recommendStyles as s } from '../styles';
import { RecommendPlaceCard } from './RecommendPlaceCard';

export interface RecommendPagerProps {
  /** 추천 장소. 최대 10곳까지 온다. */
  places: RecommendedPlace[];
  mode: CrowdFilter;
  /** 지금 보고 있는 장소의 자리. 화면이 들고 있어야 탭을 떠날 때 되감을 수 있다. */
  index: number;
  onIndexChange: (index: number) => void;
  /** 추천을 만든 시각(ISO 8601). 카드가 "N분전 업데이트"로 쓴다. */
  generatedAt: string | null;
  /** 값이 바뀌면 열려 있는 카드들이 내용을 다시 받는다. */
  reloadToken: number;
}

/**
 * 장소를 좌우로 넘겨 보는 캐러셀.
 *
 * 한 장이 장소 하나다(`RecommendPlaceCard`). 서버가 최대 10곳을 주므로 세로로 늘어놓으면
 * 한 장소를 보기 위해 계속 스크롤해야 하고, 카드마다 지도가 들어가 화면이 아주 길어진다.
 * 옆으로 넘기면 한 번에 한 장소에만 집중하게 된다.
 *
 * **한 장씩 딱 맞춰 선다**(`pagingEnabled`). 칸 너비를 화면 너비로 두어 넘긴 만큼이 곧
 * 한 장이 되게 한다 — 여백을 주려면 칸은 그대로 두고 카드 안쪽에서 준다.
 *
 * 아래 점은 지금 자리를 알린다. 장소가 하나뿐이면 점도 하나다 — 넘길 곳이 없다는 뜻이라
 * 숨기지 않고 그대로 보여준다.
 */
export function RecommendPager({
  places,
  mode,
  index,
  onIndexChange,
  generatedAt,
  reloadToken,
}: RecommendPagerProps) {
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<RecommendedPlace>>(null);

  /*
    넘긴 자리를 알린다.

    스크롤이 완전히 멈춘 뒤에만 센다(`onMomentumScrollEnd`). 움직이는 동안 세면 손가락을
    떼기 전의 중간 위치까지 자리로 잡혀, 지나가던 카드가 잠깐씩 "지금 보는 카드"가 된다 —
    그 카드가 조회를 시작해 버린다.
  */
  const handleMomentumEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const next = Math.round(event.nativeEvent.contentOffset.x / width);

      if (next !== index) onIndexChange(next);
    },
    [width, index, onIndexChange],
  );

  /*
    밖에서 자리를 되감으면(탭을 다녀오면 첫 장소) 목록도 그 자리로 옮긴다.

    스크롤 위치는 네이티브가 들고 있어 상태만 바꿔서는 화면이 따라오지 않는다. 옮기는 것은
    사용자가 넘긴 결과가 아니므로 애니메이션 없이 곧바로 세운다.
  */
  const lastIndexRef = useRef(index);

  if (lastIndexRef.current !== index) {
    lastIndexRef.current = index;
    listRef.current?.scrollToOffset({ offset: index * width, animated: false });
  }

  return (
    <View style={s.pagerArea}>
      <View style={s.dots}>
        {places.map((place, dotIndex) => (
          <View
            key={place.placeId}
            style={[s.dot, dotIndex === index && (mode === 'wagle' ? s.dotOnWagle : s.dotOn)]}
          />
        ))}
      </View>

      <FlatList
        ref={listRef}
        data={places}
        keyExtractor={(place) => String(place.placeId)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleMomentumEnd}
        /*
          칸 너비가 모두 같으므로 자리를 계산으로 알려 준다. 되감을 때 아직 그리지 않은
          칸으로도 곧장 갈 수 있다.
        */
        getItemLayout={(_data, itemIndex) => ({
          length: width,
          offset: width * itemIndex,
          index: itemIndex,
        })}
        renderItem={({ item, index: itemIndex }) => (
          <View style={[s.pagerSlot, { width }]}>
            <RecommendPlaceCard
              place={item}
              mode={mode}
              active={itemIndex === index}
              generatedAt={generatedAt}
              reloadToken={reloadToken}
            />
          </View>
        )}
      />
    </View>
  );
}
