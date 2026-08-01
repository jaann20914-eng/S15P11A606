import { Image, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ViewAvatar } from '@/components/common';
import type { PlacePinCard } from '@/types/place';
import { formatRelativeTime } from '@/utils/datetime';
import { recommendStyles as s } from '../styles';

export interface RecommendPlacePinsProps {
  pins: PlacePinCard[];
  /** 빈 상태 안내에 쓰는 장소 이름. */
  placeName: string;
}

/** 카드의 각도 링 지름. 시안 기준이다. */
const ANGLE_RING_SIZE = 44;

/**
 * 메모를 접는 길이.
 *
 * 시안이 네 줄쯤에서 `… 더보기`로 접는다. `numberOfLines`로 자르면 말줄임표 뒤에 글자를 붙일
 * 수 없어 안내가 사라지므로, 글자 수로 잘라 직접 붙인다.
 */
const MEMO_PREVIEW_LENGTH = 82;

/** 썸네일이 아직 없을 때 쓰는 자리. 시안의 카드 색을 따른다. */
const THUMBNAIL_TINT = ['#A9D6CC', '#D9E9A8'] as const;

function PinCard({ pin }: { pin: PlacePinCard }) {
  const folded = pin.memo.length > MEMO_PREVIEW_LENGTH;
  const memo = folded ? `${pin.memo.slice(0, MEMO_PREVIEW_LENGTH).trimEnd()}... ` : pin.memo;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${pin.nickname}님의 영상핀 보기`}
      onPress={() => router.push(`/pin/${pin.pinId}`)}
      style={s.pinCard}
    >
      <View style={s.pinAuthor}>
        <ViewAvatar angle={pin.viewAngle} size={ANGLE_RING_SIZE} />
        <View style={s.pinAuthorCopy}>
          <Text style={s.pinAuthorName}>{pin.nickname}</Text>
          <Text style={s.pinTime}>{formatRelativeTime(pin.createdAt)}</Text>
        </View>
      </View>

      <View style={s.pinBody}>
        {/*
          열람하지 않은 핀도 썸네일은 블러 처리된 것이 온다(서버가 원본을 주지 않는다).
          아직 주소가 없으므로 지금은 색 자리만 둔다.
        */}
        {pin.thumbnailUrl === null ? (
          <LinearGradient colors={THUMBNAIL_TINT} style={s.pinThumbnail} />
        ) : (
          <Image source={{ uri: pin.thumbnailUrl }} style={s.pinThumbnail} />
        )}

        <View style={s.pinCopy}>
          <Text style={s.pinMemo}>
            {memo}
            {folded && <Text style={s.pinMore}>더보기</Text>}
          </Text>

          {pin.tags.length > 0 && (
            <View style={s.pinTags}>
              {pin.tags.map((tag) => (
                <View key={tag} style={s.pinTag}>
                  <Text numberOfLines={1} ellipsizeMode="tail" style={s.pinTagText}>
                    #{tag}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

/**
 * 영상핀 목록.
 *
 * 장소 상세가 활성 핀만 준다(삭제·만료 제외). 카드를 누르면 핀 상세로 간다.
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
        <PinCard key={pin.pinId} pin={pin} />
      ))}
    </View>
  );
}
