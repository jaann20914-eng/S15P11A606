import { CardPager } from '@/components/common';
import { PlacePinCard } from '@/components/place';
import type { PlacePinCard as PlacePinCardData } from '@/types/place';

/**
 * 영상핀 카드를 한 장씩 넘겨 보는 칸.
 *
 * 장소 상세 시트의 **"보통" 단계**에서만 쓴다. 그 단계는 높이가 "제목 + 카드 한 장"으로
 * 잡혀 있어 목록을 훑는 자리가 아니다.
 *
 * 넘기는 제스처는 홈 시트와 같은 것을 쓴다(`components/common/CardPager`). 두 화면이 각자
 * 만들면 손맛이 갈리므로 제스처는 그 한 벌만 두고, 이 파일은 **무엇을 넘길지**만 정한다.
 */

export interface PinCardPagerProps {
  pins: PlacePinCardData[];
  /** 카드를 눌렀을 때. 끌어서 넘기는 동작과 구분은 `CardPager`가 맡는다. */
  onSelect: (pin: PlacePinCardData) => void;
  /** 한 장씩 넘길지. 끄면 목록으로 그린다(확장 단계). */
  paging?: boolean;
  /** 한 칸의 높이. 시트의 "보통" 단계 높이를 이 값으로 정한다. */
  onSlotHeightChange?: (height: number) => void;
  /** 지금 지도 중앙에 정렬된 핀. 그 카드에 라임 테두리를 두른다. */
  selectedIndex?: number;
  /** 보고 있는 카드가 바뀔 때. 화면이 그 핀으로 지도를 옮긴다. */
  onIndexChange?: (index: number) => void;
  /**
   * 목록(확장 단계)에서 스크롤이 멈춘 자리. 이 칸의 윗변을 0으로 본 값이다.
   *
   * 확장 단계도 "지금 보고 있는 핀"이 지도와 맞아야 한다. 한 장씩 넘기는 단계는 칸이 그것을
   * 정해 주지만, 훑는 단계에서는 스크롤 위치가 정한다.
   */
  scrollOffset?: number;
}

export function PinCardPager({
  pins,
  onSelect,
  paging,
  onSlotHeightChange,
  selectedIndex,
  onIndexChange,
  scrollOffset,
}: PinCardPagerProps) {
  return (
    <CardPager
      paging={paging}
      onSlotHeightChange={onSlotHeightChange}
      onIndexChange={onIndexChange}
      scrollOffset={scrollOffset}
    >
      {pins.map((pin, index) => (
        <PlacePinCard
          key={pin.pinId}
          pin={pin}
          selected={index === selectedIndex}
          onPress={() => onSelect(pin)}
        />
      ))}
    </CardPager>
  );
}
