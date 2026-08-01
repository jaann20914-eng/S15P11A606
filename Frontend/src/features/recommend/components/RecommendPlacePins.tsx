import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { PlacePinCard } from '@/components/place';
import type { PlacePinCard as PlacePinCardData } from '@/types/place';
import { recommendStyles as s } from '../styles';

export interface RecommendPlacePinsProps {
  pins: PlacePinCardData[];
  /** 빈 상태 안내에 쓰는 장소 이름. */
  placeName: string;
}

/**
 * 영상핀 목록.
 *
 * 카드는 장소 상세와 같은 공용 컴포넌트다(`components/place/PlacePinCard`). 두 화면이
 * 각자 만들면 한쪽만 고쳐져 서로 달라진다.
 */
export function RecommendPlacePins({ pins, placeName }: RecommendPlacePinsProps) {
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
        <PlacePinCard key={pin.pinId} pin={pin} onPress={() => router.push(`/pin/${pin.pinId}`)} />
      ))}
    </View>
  );
}
