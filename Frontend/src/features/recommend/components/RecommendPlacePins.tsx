import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { PlacePinCard } from '@/types/place';
import { PlaceholderBlock } from './PlaceholderBlock';
import { recommendStyles as s } from '../styles';

export interface RecommendPlacePinsProps {
  pins: PlacePinCard[];
  /** 빈 상태 안내에 쓰는 장소 이름. */
  placeName: string;
}

/**
 * 영상핀 목록 자리.
 *
 * 핀 카드는 장소 상세(홈 쪽)와 완전히 같은 모양이라 그쪽 담당자가 만드는 공용 카드를
 * 가져다 쓰기로 했다. 여기서 따로 만들면 두 화면의 카드가 서로 어긋난다.
 *
 * === 끼우는 법 ===
 * - 데이터: `GET /api/v1/places/{placeId}` 응답의 `pins` (`PlacePinCard[]` — `types/place.ts`).
 *   닉네임 · 뷰 각도 · 등록 시각 · 메모 · 썸네일 · 태그 · 열람 여부가 모두 들어 있다.
 * - 카드를 누르면 `/pin/{pinId}`로 보내면 된다.
 * - 아래 `PlaceholderBlock`을 공용 카드 목록으로 바꾸면 끝난다. 핀이 없을 때의 안내
 *   (작성 유도)는 이 파일에 이미 있으니 그대로 두면 된다.
 *
 * 이전에 이 화면에서 쓰던 자체 카드 구현은 커밋 8b51582에 있다.
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
      <PlaceholderBlock
        label={`영상핀 ${pins.length}개`}
        note="장소 상세 담당자의 공용 핀 카드를 가져와 끼울 자리"
        height={220}
      />
    </View>
  );
}
