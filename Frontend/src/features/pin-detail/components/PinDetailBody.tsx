import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { CrowdLevelBadge, ViewAvatar } from '@/components/common';
import { useAppTabBarHeight } from '@/components/common/AppTabBar';
import { colors, spacing } from '@/constants/theme';
import { isOwnPin, isVideoUnlocked } from '@/types/pin';
import type { PinDetail } from '@/types/pin';
import type { EvaluationState } from '../hooks/usePinDetailScreen';
import { formatRelativeTime } from '@/utils/datetime';
import { pinDetailStyles as s } from '../styles';
import { PinDetailMedia } from './PinDetailMedia';
import { IllustrationVideo } from './IllustrationVideo';

export interface PinDetailBodyProps {
  detail: PinDetail;
  evaluation: EvaluationState;
  onRequestChat: () => void;
  onRequestPurchase: () => void;
  onLeave: () => void;
}

export function PinDetailBody({
  detail,
  evaluation,
  onRequestChat,
  onRequestPurchase,
  onLeave,
}: PinDetailBodyProps) {
  const own = isOwnPin(detail);
  const unlocked = isVideoUnlocked(detail);

  const showChatAction = !own && unlocked;
  const uploadedAt = formatRelativeTime(detail.createdAt);
  const tabBarHeight = useAppTabBarHeight();

  return (
    <View style={s.body}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.content}>
        <PinDetailMedia unlocked={unlocked} videoUrl={detail.videoUrl} previewUrl={detail.previewUrl} />

        <View style={s.detailSheet}>
          <View style={s.authorRow}>
            <ViewAvatar angle={detail.authorViewAngle} size={44} />
            <View style={s.authorCopy}>
              <Text style={s.authorName}>{detail.authorNickname}</Text>
              {uploadedAt !== '' && <Text style={s.authorMeta}>{uploadedAt} 업로드</Text>}
            </View>
            {showChatAction && <ChatAction detail={detail} onRequestChat={onRequestChat} />}
          </View>

          <Text style={s.placeName}>{detail.place.name}</Text>

          {/*
            상세 위치는 장소명 바로 아래 줄이다. 예전에는 작성자 옆에 업로드 시각과 함께
            "2층 창가석 기준 · 40초 전 업로드"로 붙어 있었는데, 그건 장소에 대한 설명이라
            장소명 밑이 맞다. 주소가 있던 자리이기도 하다 — 서버가 주소를 주지 않는다.
          */}
          {detail.detailLocation && (
            <Text style={s.detailLocation}>{detail.detailLocation} 기준</Text>
          )}

          {/*
            혼잡 단계는 **열람한 뒤에만** 보여준다. 결제 전에 붙이면 영상을 사지 않고도
            그 장소가 지금 붐비는지 알 수 있어, 열람할 이유가 사라진다.
          */}
          {unlocked && <CrowdLevelBadge level={detail.crowdLevel} style={s.crowdBadge} />}

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
        </View>
      </ScrollView>

      {/*
        할 일은 늘 화면에 보인다.

        예전에는 본문 끝에 있어서 스크롤을 내려야 나왔다. 처음 쓰는 사람은 영상보기 버튼이
        있다는 것조차 모른 채 화면을 떠날 수 있었다. 결제·평가·떠났어요는 이 화면에서 할 수
        있는 유일한 행동이라 아래에 고정한다.

        탭바가 떠 있는 만큼 띄운다. 그러지 않으면 버튼이 탭바 뒤로 들어간다.
      */}
      <View style={[s.actionBar, { paddingBottom: tabBarHeight + spacing.x4 }]}>
        {own ? (
          <OwnerFooter onLeave={onLeave} />
        ) : unlocked ? (
          <RatingSection evaluated={detail.isEvaluated === true} evaluation={evaluation} />
        ) : (
          <PurchasePrompt onPress={onRequestPurchase} />
        )}
      </View>
    </View>
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

function RatingSection({ evaluated, evaluation }: { evaluated: boolean; evaluation: EvaluationState }) {
  if (evaluated) {
    const { submitted, rewardCredit } = evaluation;

    return (
      <View style={s.ratingArea}>
        <Text style={s.selectedRating}>
          {submitted === null ? '평가를 남겼어요' : submitted === 'HELPFUL' ? '유익해요!' : '아쉬워요!'}
        </Text>
        <View style={s.reward}>
          {/* 방금 받은 경우에만 잎이 떨어진다. 다시 볼 때는 떨어진 채로 멈춰 있다. */}
          <IllustrationVideo name="leaf" mode={submitted === null ? 'end' : 'play'} style={s.rewardCoin} />
          <View>
            <Text style={s.rewardTitle}>
              {rewardCredit === null ? '크레딧을 받았어요' : `${rewardCredit}크레딧을 받았어요`}
            </Text>
            <Text style={s.rewardText}>게시자의 뷰에도 반영했어요.</Text>
          </View>
        </View>
      </View>
    );
  }

  const { busy, error, submit } = evaluation;

  return (
    <View style={s.ratingArea}>
      <Text style={s.ratingTitle}>이 영상핀이 유익했나요?</Text>
      <Text style={s.ratingHint}>평가하면 1크레딧을 적립하고 게시자의 뷰에 반영해요.</Text>
      {error && <Text style={s.ratingError}>{error}</Text>}
      <View style={s.ratingButtons}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => submit('HELPFUL')}
          style={[s.ratingButton, s.helpfulButton, busy && s.ratingButtonBusy]}
        >
          {busy ? <ActivityIndicator color={colors.dark} /> : <Text style={s.helpfulText}>유익해요</Text>}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => submit('NOT_HELPFUL')}
          style={[s.ratingButton, s.missButton, busy && s.ratingButtonBusy]}
        >
          <Text style={s.missText}>아쉬워요</Text>
        </Pressable>
      </View>
    </View>
  );
}
