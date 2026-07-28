import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { crowdLevels } from '@/constants/crowdLevels';
import { isOwnPin, isVideoUnlocked } from '@/types/pin';
import type { PinDetail, PinRating } from '@/types/pin';
import { formatRelativeTime } from '@/utils/datetime';
import { getViewAngleImage } from '@/utils/viewAngle';
import { pinDetailStyles as s } from '../styles';

/** signed URL이 아직 없어 미디어가 비어 있을 때 쓰는 디자인 시안 이미지. */
const PLACEHOLDER_MEDIA = require('../../../../assets/images/video-pin-crowd.png');

export interface PinDetailBodyProps {
  detail: PinDetail;
  /** 방금 고른 평가. 서버는 유익/아쉬움을 구분해 주지 않아 이번 진입에서만 유지된다. */
  submittedRating: PinRating | null;
  onRequestChat: () => void;
  onRequestPurchase: () => void;
  onRate: (rating: PinRating) => void;
  onLeave: () => void;
}

export function PinDetailBody({
  detail,
  submittedRating,
  onRequestChat,
  onRequestPurchase,
  onRate,
  onLeave,
}: PinDetailBodyProps) {
  const own = isOwnPin(detail);
  const unlocked = isVideoUnlocked(detail);

  const crowd = crowdLevels.find((level) => level.key === detail.crowdLevel) ?? null;

  // 열람 전에는 블러 미리보기만 내려온다. 둘 다 비어 있으면 시안 이미지로 대체한다.
  const mediaUrl = unlocked ? detail.videoUrl : detail.previewUrl;
  const media = mediaUrl ? { uri: mediaUrl } : PLACEHOLDER_MEDIA;

  const showChatAction = !own && unlocked;

  // "2층 창가석 기준 · 40초 전 업로드". 없는 조각은 빠진 채로 조립된다.
  const uploadedAt = formatRelativeTime(detail.createdAt);
  const metaText = [
    detail.detailLocation && `${detail.detailLocation} 기준`,
    uploadedAt && `${uploadedAt} 업로드`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
      <View style={s.videoFrame}>
        <Image source={media} blurRadius={unlocked ? 0 : 18} style={s.videoImage} />
      </View>

      <View style={s.detailSheet}>
        <View style={s.authorRow}>
          <View style={s.viewRing}>
            <Image source={getViewAngleImage(detail.authorViewAngle)} style={s.viewRingImage} />
            <Text style={s.viewRingText}>{detail.authorViewAngle}°</Text>
          </View>
          <View style={s.authorCopy}>
            <Text style={s.authorName}>{detail.authorNickname}</Text>
            {metaText !== '' && <Text style={s.authorMeta}>{metaText}</Text>}
          </View>
          {showChatAction && <ChatAction detail={detail} onRequestChat={onRequestChat} />}
        </View>

        <Text style={s.placeName}>{detail.place.name}</Text>
        <Text style={s.address}>{detail.place.address}</Text>

        {crowd && (
          <View style={[s.crowdChip, { backgroundColor: crowd.color }]}>
            <Text style={s.crowdChipText}>{crowd.label}</Text>
          </View>
        )}

        <View style={s.rule} />

        {detail.memo && <Text style={s.memo}>{detail.memo}</Text>}

        {detail.tags.length > 0 && (
          <View style={s.tags}>
            {detail.tags.map((tag) => (
              <Text key={tag} style={s.tag}>
                #{tag}
              </Text>
            ))}
          </View>
        )}

        {own ? (
          <OwnerFooter onLeave={onLeave} />
        ) : unlocked ? (
          <RatingSection
            evaluated={detail.isEvaluated === true}
            submittedRating={submittedRating}
            onRate={onRate}
          />
        ) : (
          <PurchasePrompt onPress={onRequestPurchase} />
        )}
      </View>
    </ScrollView>
  );
}

/**
 * 채팅 버튼. 상태에 따라 요청 · 대기 · 입장으로 갈린다.
 *
 * `ACTIVE`일 때 이동할 `roomId`가 상세 응답에 없어 채팅 목록으로 보낸다.
 * 서버가 roomId를 내려주면 방으로 바로 보낼 수 있다.
 */
function ChatAction({ detail, onRequestChat }: { detail: PinDetail; onRequestChat: () => void }) {
  if (detail.chatRequestState === 'ACTIVE') {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/(tabs)/chat/sent')}
        style={s.chatButton}
      >
        <Text style={s.chatText}>채팅방 이동</Text>
      </Pressable>
    );
  }

  const waiting = detail.chatRequestState === 'PENDING';
  const disabled = waiting || !detail.canRequestChat;

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onRequestChat}
      style={[s.chatButton, disabled && s.chatPending]}
    >
      <Text style={s.chatText}>{waiting ? '수락 대기' : '채팅 요청'}</Text>
    </Pressable>
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
  evaluated,
  submittedRating,
  onRate,
}: {
  evaluated: boolean;
  submittedRating: PinRating | null;
  onRate: (rating: PinRating) => void;
}) {
  if (evaluated) {
    return (
      <View style={s.ratingArea}>
        <Text style={s.selectedRating}>
          {submittedRating === null
            ? '평가를 남겼어요'
            : submittedRating === 'HELPFUL'
              ? '유익해요!'
              : '아쉬워요!'}
        </Text>
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
