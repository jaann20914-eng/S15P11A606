import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PlacePinCard } from '@/components/place';
import type { CrowdFilter } from '@/constants/crowdLevels';
import { colors } from '@/constants/theme';
import type { PlacePinCard as PlacePinCardData } from '@/types/place';
import { recommendStyles as s } from '../styles';

export interface RecommendPlacePinsProps {
  pins: PlacePinCardData[];
  /** 빈 상태 안내에 쓰는 장소 이름. */
  placeName: string;
  /** 핀 색 계열. 선택 테두리가 지도 핀과 같은 계열이어야 짝으로 읽힌다. */
  filter: CrowdFilter;
  /** 지도에서 골라 둔 핀. 그 카드에 계열 색 테두리를 두른다. */
  selectedPinId?: string | null;
  /**
   * 카드가 목록 안에서 어디에 놓였는지 알린다(목록 윗변 기준 y).
   *
   * 지도의 마커를 누르면 화면이 그 카드로 스크롤해야 하는데, 카드의 위치는 이 목록만 안다.
   * 화면은 이 값에 목록 자체의 위치를 더해 스크롤 지점을 만든다.
   */
  onCardPosition?: (pinId: string, y: number) => void;
  /**
   * 첫 카드의 실제 높이를 알린다.
   *
   * 추천 카드는 이 값으로 핀 칸의 높이를 정해 **한 장만** 보이게 한다. 계산값
   * (`PLACE_PIN_CARD_HEIGHT`)은 어림이라 실제와 몇 px 어긋나는데, 그만큼 다음 카드의
   * 윗머리가 삐져나와 잘린 카드처럼 보였다. 재서 맞추면 어긋날 일이 없다.
   */
  onFirstCardHeight?: (height: number) => void;
}

/**
 * 핀 목록.
 *
 * 카드는 장소 상세와 같은 공용 컴포넌트다(`components/place/PlacePinCard`). 두 화면이
 * 각자 만들면 한쪽만 고쳐져 서로 달라진다.
 */
export function RecommendPlacePins({
  pins,
  placeName,
  filter,
  selectedPinId = null,
  onCardPosition,
  onFirstCardHeight,
}: RecommendPlacePinsProps) {
  // 와글은 지도 핀과 같은 붉은 계열로 두른다. 여유는 기본(라임)이라 넘기지 않는다.
  const selectedColor = filter === 'wagle' ? colors.crowdedActive : undefined;

  if (pins.length === 0) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${placeName}에 핀 작성하기`}
        onPress={() => router.push('/(tabs)/write')}
        style={s.emptyPins}
      >
        <Text style={s.emptyPinsText}>아직 업로드된 핀이 없습니다</Text>
        <Text style={s.writeLink}>작성하러 가기 →</Text>
      </Pressable>
    );
  }

  return (
    <View style={s.pinList}>
      {pins.map((pin, index) => (
        <View
          key={pin.pinId}
          onLayout={(event) => {
            const { y, height } = event.nativeEvent.layout;

            onCardPosition?.(pin.pinId, y);
            if (index === 0) onFirstCardHeight?.(height);
          }}
        >
          <PlacePinCard
            pin={pin}
            selected={pin.pinId === selectedPinId}
            selectedColor={selectedColor}
            onPress={() => router.push(`/pin/${pin.pinId}`)}
          />
        </View>
      ))}
    </View>
  );
}
