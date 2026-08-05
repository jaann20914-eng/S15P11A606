import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PlacePinCard } from '@/components/place';
import type { PlacePinCard as PlacePinCardData } from '@/types/place';
import { recommendStyles as s } from '../styles';

export interface RecommendPlacePinsProps {
  pins: PlacePinCardData[];
  /** 빈 상태 안내에 쓰는 장소 이름. */
  placeName: string;
  /** 지도에서 골라 둔 핀. 그 카드에 라임 테두리를 두른다. */
  selectedPinId?: string | null;
  /**
   * 카드가 목록 안에서 어디에 놓였는지 알린다(목록 윗변 기준 y).
   *
   * 지도의 마커를 누르면 화면이 그 카드로 스크롤해야 하는데, 카드의 위치는 이 목록만 안다.
   * 화면은 이 값에 목록 자체의 위치를 더해 스크롤 지점을 만든다.
   */
  onCardPosition?: (pinId: string, y: number) => void;
}

/**
 * 영상핀 목록.
 *
 * 카드는 장소 상세와 같은 공용 컴포넌트다(`components/place/PlacePinCard`). 두 화면이
 * 각자 만들면 한쪽만 고쳐져 서로 달라진다.
 */
export function RecommendPlacePins({
  pins,
  placeName,
  selectedPinId = null,
  onCardPosition,
}: RecommendPlacePinsProps) {
  if (pins.length === 0) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${placeName}에 영상핀 작성하기`}
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
      {pins.map((pin) => (
        <View key={pin.pinId} onLayout={(event) => onCardPosition?.(pin.pinId, event.nativeEvent.layout.y)}>
          <PlacePinCard
            pin={pin}
            selected={pin.pinId === selectedPinId}
            onPress={() => router.push(`/pin/${pin.pinId}`)}
          />
        </View>
      ))}
    </View>
  );
}
