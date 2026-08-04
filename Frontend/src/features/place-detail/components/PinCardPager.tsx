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
}

export function PinCardPager({ pins, onSelect }: PinCardPagerProps) {
  return (
    <CardPager>
      {pins.map((pin) => (
        <PlacePinCard key={pin.pinId} pin={pin} onPress={() => onSelect(pin)} />
      ))}
    </CardPager>
  );
}
