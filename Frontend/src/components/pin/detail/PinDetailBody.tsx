import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { crowdLevels } from '@/constants/crowdLevels';
import { formatRelativeTime } from '@/utils/datetime';
import type { PinDetail, PinRating } from '@/types/pin';
import { pinDetailStyles as s } from './styles';

/** 아직 Object Storage URL 규격이 없어 썸네일이 비어 있을 때 쓰는 디자인 시안 이미지. */
const PLACEHOLDER_THUMBNAIL = require('../../../../assets/images/video-pin-crowd.png');

function ViewRing({ temperature }: { temperature: number }) {
  return (
    <View style={s.viewRing}>
      <Text style={s.viewRingText}>{temperature}°</Text>
    </View>
  );
}

export interface PinDetailBodyProps {
  detail: PinDetail;
  onRequestChat: () => void;
  onRequestPurchase: () => void;
  onRate: (rating: PinRating) => void;
  onLeave: () => void;
}

export function PinDetailBody({
  detail,
  onRequestChat,
  onRequestPurchase,
  onRate,
  onLeave,
}: PinDetailBodyProps) {
  const { viewer, author } = detail;

  // 서버 enum이 아직 프론트 4단계 키와 다르다(DB `WAGLE_WAGLE/WAGLE/RELAXED/LEISURELY`).
  // 확정 전까지는 모르는 값이 와도 라벨만 비우고 화면은 살려 둔다.
  const crowd = crowdLevels.find((level) => level.key === detail.crowdLevel) ?? null;
  const uploadedAt = formatRelativeTime(detail.capturedAt);
  const thumbnail = detail.thumbnailUrl ? { uri: detail.thumbnailUrl } : PLACEHOLDER_THUMBNAIL;

  // 내 핀은 결제 없이 항상 원본을 본다.
  const unlocked = viewer.isMine || viewer.isPurchased;
  const chatPending = viewer.chatStatus === 'PENDING';

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
      <View style={s.videoFrame}>
        <Image source={thumbnail} blurRadius={unlocked ? 0 : 18} style={s.videoImage} />
      </View>

      <View style={s.detailSheet}>
        <View style={s.authorRow}>
          <ViewRing temperature={author.viewTemperature} />

          <View style={s.authorCopy}>
            <Text style={s.authorName}>{author.nickname}</Text>
            {author.trustPercentile !== null && (
              <Text style={s.authorTrust}>신뢰도 상위 {author.trustPercentile}%</Text>
            )}
            {uploadedAt !== '' && <Text style={s.authorMeta}>{uploadedAt} 업로드</Text>}
          </View>

          {!viewer.isMine && viewer.isPurchased && (
            <Pressable
              accessibilityRole="button"
              disabled={chatPending}
              onPress={onRequestChat}
              style={[s.chatButton, chatPending && s.chatPending]}
            >
              <Text style={s.chatText}>{chatPending ? '수락 대기' : '채팅 요청'}</Text>
            </Pressable>
          )}
        </View>

        <Text style={s.placeName}>{detail.placeName}</Text>
        <Text style={s.address}>{detail.address}</Text>

        {crowd && (
          <View style={[s.crowdChip, { backgroundColor: crowd.color }]}>
            <Text style={s.crowdChipText}>{crowd.label}</Text>
          </View>
        )}

        <View style={s.rule} />

        <Text style={s.memo}>{detail.memo}</Text>

        {detail.tags.length > 0 && (
          <View style={s.tags}>
            {detail.tags.map((tag) => (
              <Text key={tag} style={s.tag}>
                #{tag}
              </Text>
            ))}
          </View>
        )}

        {viewer.isMine ? (
          <OwnerFooter onLeave={onLeave} />
        ) : !viewer.isPurchased ? (
          <PurchasePrompt onPress={onRequestPurchase} />
        ) : (
          <RatingSection rating={viewer.myRating} onRate={onRate} />
        )}
      </View>
    </ScrollView>
  );
}

function OwnerFooter({ onLeave }: { onLeave: () => void }) {
  return (
    <View style={s.ownerFooter}>
      <Pressable accessibilityRole="button" onPress={onLeave} style={[s.footerButton, s.leaveButton]}>
        <Text style={s.leaveButtonText}>이미 떠났어요</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/(tabs)/chat/received')}
        style={[s.footerButton, s.goChatButton]}
      >
        <Text style={s.goChatButtonText}>채팅방으로 이동</Text>
      </Pressable>
    </View>
  );
}

function PurchasePrompt({ onPress }: { onPress: () => void }) {
  return (
    <View style={s.watchArea}>
      <Text style={s.watchTitle}>현장 영상을 확인할까요?</Text>
      <Text style={s.watchHint}>3크레딧을 사용하면 전체 블러가 해제돼요.</Text>
      <Pressable accessibilityRole="button" onPress={onPress} style={[s.primaryDark, s.watchButton]}>
        <Text style={s.primaryDarkText}>영상보기</Text>
      </Pressable>
    </View>
  );
}

function RatingSection({
  rating,
  onRate,
}: {
  rating: PinRating | null;
  onRate: (rating: PinRating) => void;
}) {
  if (rating) {
    return (
      <View style={s.ratingArea}>
        <Text style={s.selectedRating}>{rating === 'HELPFUL' ? '유익해요!' : '아쉬워요!'}</Text>
        <View style={s.reward}>
          <View style={s.rewardCoin}>
            <Ionicons name="leaf" size={24} color="#91A700" />
          </View>
          <View>
            <Text style={s.rewardTitle}>1크레딧을 받았어요</Text>
            <Text style={s.rewardText}>게시자의 뷰 신뢰도에도 반영했어요.</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={s.ratingArea}>
      <Text style={s.ratingTitle}>이 영상핀이 유익했나요?</Text>
      <Text style={s.ratingHint}>평가하면 1크레딧을 적립하고 게시자의 뷰에 반영해요.</Text>
      <View style={s.ratingButtons}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onRate('HELPFUL')}
          style={[s.ratingButton, s.helpfulButton]}
        >
          <Text style={s.helpfulText}>유익해요</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onRate('MISS')}
          style={[s.ratingButton, s.missButton]}
        >
          <Text style={s.missText}>아쉬워요</Text>
        </Pressable>
      </View>
    </View>
  );
}
