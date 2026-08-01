import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ViewAvatar } from '@/components/common';
import type { PlacePinCard as PlacePinCardData } from '@/types/place';
import { formatRelativeTime } from '@/utils/datetime';
import { colors, radius, spacing, type } from '@/constants/theme';

/**
 * 장소에 달린 영상핀 카드.
 *
 * 원본은 장소 상세 화면(`app/place/[placeId]/index.tsx`)의 `VideoCard`다. 레이아웃·간격·
 * 그림자를 그대로 옮기고, 고정 문구 대신 서버 응답(`pins[]`)을 받도록 바꿨다. 작성자 링만
 * 공용 `ViewAvatar`로 교체했다 — 각도마다 링 모양이 달라야 해서다.
 *
 * **장소 상세 담당자에게**: 그 화면의 지역 `VideoCard`를 지우고 이걸 import 하면 한 벌로
 * 합쳐진다. 값은 `GET /api/v1/places/{placeId}`의 `pins`를 그대로 넘기면 된다.
 */

export interface PlacePinCardProps {
  pin: PlacePinCardData;
  onPress: () => void;
}

/** 카드의 각도 링 지름. */
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

export function PlacePinCard({ pin, onPress }: PlacePinCardProps) {
  const folded = pin.memo.length > MEMO_PREVIEW_LENGTH;
  const memo = folded ? `${pin.memo.slice(0, MEMO_PREVIEW_LENGTH).trimEnd()}... ` : pin.memo;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${pin.nickname}님의 영상핀 보기`}
      onPress={onPress}
      style={s.card}
    >
      <View style={s.author}>
        <ViewAvatar angle={pin.viewAngle} size={ANGLE_RING_SIZE} />
        <View style={s.authorCopy}>
          <Text style={s.authorName}>{pin.nickname}</Text>
          <Text style={s.time}>{formatRelativeTime(pin.createdAt)}</Text>
        </View>
      </View>

      <View style={s.body}>
        {/*
          열람하지 않은 핀도 썸네일은 블러 처리된 것이 온다(서버가 원본을 주지 않는다).
          아직 주소가 없으므로 지금은 색 자리만 둔다.
        */}
        {pin.thumbnailUrl === null ? (
          <LinearGradient colors={THUMBNAIL_TINT} style={s.thumbnail} />
        ) : (
          <Image source={{ uri: pin.thumbnailUrl }} style={s.thumbnail} />
        )}

        <View style={s.copy}>
          <Text style={s.memo}>
            {memo}
            {folded && <Text style={s.more}>더보기</Text>}
          </Text>

          {pin.tags.length > 0 && (
            <View style={s.tags}>
              {pin.tags.map((tag) => (
                <View key={tag} style={s.tag}>
                  <Text numberOfLines={1} ellipsizeMode="tail" style={s.tagText}>
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

const s = StyleSheet.create({
  card: { padding: spacing.x4, borderRadius: radius.hero, backgroundColor: colors.white },
  author: { flexDirection: 'row', alignItems: 'center', gap: spacing.x2 },
  authorCopy: { flex: 1 },
  authorName: { ...type.label, fontWeight: '600', color: colors.dark },
  time: { ...type.caption, color: colors.gray400 },
  body: { flexDirection: 'row', alignItems: 'stretch', gap: spacing.x3, marginTop: spacing.x3 },
  thumbnail: { width: 128, minHeight: 128, borderRadius: radius.md },
  copy: { flex: 1, minWidth: 0 },
  memo: { ...type.small, color: colors.gray600 },
  more: { ...type.small, color: colors.gray400 },
  tags: { flexDirection: 'row', gap: spacing.x1, marginTop: spacing.x2, overflow: 'hidden' },
  tag: {
    maxWidth: '45%',
    height: 28,
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.x2,
    borderRadius: radius.pill,
    backgroundColor: colors.limeSoft,
  },
  tagText: { ...type.caption, flexShrink: 1, color: colors.gray600 },
});
