import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { CrowdLevelBadge, ViewAvatar } from '@/components/common';
import { useAppTabBarHeight } from '@/components/common/AppTabBar';
import { colors, spacing } from '@/constants/theme';
import { getChatRooms } from '@/api/chat/rooms';
import { focusReceivedPin } from '@/features/chat/receivedFocus';
import { isOwnPin, isVideoUnlocked } from '@/types/pin';
import type { PinDetail, PinId, PinRating } from '@/types/pin';
import type { EvaluationState } from '../hooks/usePinDetailScreen';
import { formatRelativeTime } from '@/utils/datetime';
import { ACTION_FADE_DROP, pinDetailStyles as s } from '../styles';
import { PinDetailMedia } from './PinDetailMedia';
import { IllustrationVideo } from './IllustrationVideo';
import { useIllustrationCue, useIllustrationLoader } from '../illustrations';

/**
 * 사라짐 그라데이션의 시작 색.
 *
 * 를 쓰면 안드로이드에서 검은색이 섞여 회색 띠가 생긴다. 흰색의 알파만 0으로.
 */
const FADE_TRANSPARENT = 'rgba(255,255,255,0)';

/**
 * 사라짐 구간의 중간 색과 멈춤 위치.
 *
 * 투명에서 흰색으로 곧게 이으면 아래쪽 절반이 아직 반투명이라, 완전한 흰 바와 만나는 자리에
 * 단이 진다. 중간에 거의 흰색을 한 번 찍어 절반쯤에서 이미 흰색이 되게 하면 이어지는 곳이
 * 눈에 띄지 않는다.
 */
const FADE_NEAR_WHITE = 'rgba(255,255,255,0.96)';
const FADE_STOPS = [0, 0.55, 1] as const;

/** 나뭇잎이 다 떨어진 뒤의 모습. 영상의 마지막 프레임을 그대로 뽑아 둔 것이다. */
const LEAF_SETTLED = require('../../../../assets/images/credit-leaf-settled.png');

export interface PinDetailBodyProps {
  detail: PinDetail;
  evaluation: EvaluationState;
  onRequestChat: () => void;
  onRequestPurchase: () => void;
  onLeave: () => void;
  /** 이 핀에서 이미 떠났는지. 버튼을 잠근다. */
  left: boolean;
}

export function PinDetailBody({
  detail,
  evaluation,
  onRequestChat,
  onRequestPurchase,
  onLeave,
  left,
}: PinDetailBodyProps) {
  const own = isOwnPin(detail);
  const unlocked = isVideoUnlocked(detail);

  const showChatAction = !own && unlocked;
  const uploadedAt = formatRelativeTime(detail.createdAt);
  const tabBarHeight = useAppTabBarHeight();

  /** 아래 고정 영역이 본문 위에 겹쳐 있어, 가리는 만큼을 스크롤 여백으로 돌려준다. */
  const [actionBarHeight, setActionBarHeight] = useState(0);

  return (
    <View style={s.body}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingBottom: actionBarHeight + spacing.x4 }]}
      >
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
          {detail.detailLocation && <Text style={s.detailLocation}>{detail.detailLocation} 기준</Text>}

          {/*
            혼잡 단계는 **열람한 뒤에만** 보여준다. 결제 전에 붙이면 영상을 사지 않고도
            그 장소가 지금 붐비는지 알 수 있어, 열람할 이유가 사라진다.
          */}
          {unlocked && <CrowdLevelBadge level={detail.crowdLevel} style={s.crowdBadge} />}

          <View style={s.rule} />

          {detail.memo && <Text style={s.memo}>{detail.memo}</Text>}

          {/*
            내용이 없는 글의 안내. 메모는 선택 입력이라 실제로 이런 글이 있고, 자리가 그냥
            비어 있으면 잘못 불러온 것처럼 보인다. 태그 유무와 무관하게 같은 두 줄을 쓴다.
            글만 있고 태그가 없는 경우는 따로 알리지 않는다.
          */}
          {!detail.memo && (
            <Text style={s.emptyBody}>
              {'작성자가 따로 남긴 설명이 없어요.\n영상으로 현장을 확인해 보세요.'}
            </Text>
          )}

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
      {/* 내용이 바 밑으로 들어가며 사라지도록 짧게 덧칠한다. 선 하나보다 조용하다. */}
      <LinearGradient
        pointerEvents="none"
        colors={[FADE_TRANSPARENT, FADE_NEAR_WHITE, colors.white]}
        locations={FADE_STOPS}
        style={[s.actionFade, { bottom: actionBarHeight - ACTION_FADE_DROP }]}
      />

      <View
        onLayout={(event) => setActionBarHeight(event.nativeEvent.layout.height)}
        style={[s.actionBar, { paddingBottom: tabBarHeight + spacing.x4 }]}
      >
        {own ? (
          <OwnerFooter pinId={detail.pinId} left={left} onLeave={onLeave} />
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
 * 방이 이미 있으면(`ACTIVE` · `PENDING`) 목록이 아니라 **그 방으로** 들여보낸다. 대기 중에도
 * 요청자는 메시지를 보낼 수 있다(서버 정책). 상세 응답에 `roomId`가 없어 내 방 목록에서
 * 이 핀의 방을 찾는다 — (핀, 요청자) 조합은 방이 최대 하나라 어긋날 일이 없다.
 * 못 찾으면(목록 조회 실패 등) 채팅 목록으로 보낸다.
 */
function ChatAction({ detail, onRequestChat }: { detail: PinDetail; onRequestChat: () => void }) {
  const [opening, setOpening] = useState(false);

  const openMyRoom = async () => {
    if (opening) return;

    setOpening(true);

    try {
      const rooms = await getChatRooms();
      const room = rooms.find((item) => item.pinId === detail.pinId);

      if (room) {
        router.push({
          pathname: '/chat-room/[roomId]',
          params: { roomId: String(room.roomId), role: 'requester' },
        });
        return;
      }
    } catch {
      // 방을 못 찾으면 아래에서 목록으로 보낸다. 여기서 화면을 막을 이유가 없다.
    } finally {
      setOpening(false);
    }

    router.push('/(tabs)/chat/sent');
  };

  if (detail.chatRequestState === 'ACTIVE' || detail.chatRequestState === 'PENDING') {
    const waiting = detail.chatRequestState === 'PENDING';

    return (
      <Pressable accessibilityRole="button" disabled={opening} onPress={openMyRoom} style={s.chatButton}>
        {opening ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={s.chatText}>{waiting ? '수락 대기 · 대화 보기' : '채팅방 이동'}</Text>
        )}
      </Pressable>
    );
  }

  return (
    <ChatRequestButton disabled={!detail.canRequestChat} waiting={false} onRequestChat={onRequestChat} />
  );
}

/** 시트에 쓸 그림을 받은 뒤에 연다. 받는 동안에는 이 버튼에서 기다린다. */
function ChatRequestButton({
  disabled,
  waiting,
  onRequestChat,
}: {
  disabled: boolean;
  waiting: boolean;
  onRequestChat: () => void;
}) {
  const { trigger, pending } = useIllustrationCue('chat', onRequestChat);

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || pending}
      onPress={trigger}
      style={[s.chatButton, (disabled || pending) && s.chatPending]}
    >
      {pending ? (
        <ActivityIndicator color={colors.white} />
      ) : (
        <Text style={s.chatText}>{waiting ? '수락 대기' : '채팅 요청'}</Text>
      )}
    </Pressable>
  );
}

/**
 * 내 핀 하단. 떠났어요와 채팅방 이동이 나란히 있다.
 *
 * 떠난 뒤에는 버튼을 잠그고 문구를 바꾼다. 같은 모양으로 남겨 두면 처리가 됐는지 알 수 없어
 * 다시 누르게 되고, 서버는 멱등하게 받아 빈 결과만 돌려준다.
 */
function OwnerFooter({ pinId, left, onLeave }: { pinId: PinId; left: boolean; onLeave: () => void }) {
  return (
    <View style={s.ownerFooter}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: left }}
        disabled={left}
        onPress={onLeave}
        style={[s.footerButton, s.leaveButton, left && s.leaveButtonDone]}
      >
        <Text style={[s.leaveButtonText, left && s.leaveButtonTextDone]}>
          {left ? '떠난 핀이에요' : '이미 떠났어요'}
        </Text>
      </Pressable>
      {/*
        이 글의 방 목록까지 바로 들어가도록 핀을 남겨 두고 이동한다. 목록 첫 화면에 내려 두면
        어느 글의 대화인지 다시 찾아 들어가야 한다. param이 아니라 모듈 핸드오프를 쓰는 이유는
        `receivedFocus.ts`에 적어 두었다.
      */}
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          focusReceivedPin(pinId);
          router.push('/(tabs)/chat/received');
        }}
        style={[s.footerButton, s.goChatButton]}
      >
        <Text style={s.goChatButtonText}>채팅방으로 이동</Text>
      </Pressable>
    </View>
  );
}

function PurchasePrompt({ onPress }: { onPress: () => void }) {
  /*
    누른 뒤에 시트에 쓸 그림을 받는다. 다 받은 다음에 시트가 완성된 채로 올라오므로,
    기다리는 곳은 이 버튼 하나로 모인다.
  */
  const { trigger, pending } = useIllustrationCue('coin', onPress);

  return (
    <View style={s.watchArea}>
      <Text style={s.watchTitle}>현장 영상을 확인할까요?</Text>
      <Text style={s.watchHint}>와글 포인트 3개를 사용하면 전체 블러가 해제돼요.</Text>
      <Pressable
        accessibilityRole="button"
        disabled={pending}
        onPress={trigger}
        style={[s.primaryDark, s.watchButton, pending && s.primaryDarkBusy]}
      >
        {pending ? (
          <ActivityIndicator color={colors.lime} />
        ) : (
          <Text style={s.primaryDarkText}>영상보기</Text>
        )}
      </Pressable>
    </View>
  );
}

/**
 * 보상 자리의 나뭇잎.
 *
 * 방금 받았으면 떨어지는 장면을 한 번 재생하고, 다시 볼 때는 이미 떨어진 모습만 보여준다.
 * 매번 떨어지면 아무 일도 없었는데 무언가 일어난 것처럼 읽히고 들어올 때마다 시선을 뺏긴다.
 *
 * 떨어진 모습은 **영상이 아니라 마지막 프레임 그림**이다. 영상으로 마지막 장면을 세우려면
 * 붙이고 → 되감고 → 멈추는 과정을 거치는데, 그 사이 첫 프레임이 잠깐 보였다가 끝 프레임으로
 * 튄다. 어차피 움직이지 않는 화면이라 그림 한 장이면 충분하고, 다시 볼 때는 영상을 받을
 * 필요조차 없어진다.
 */
function RewardLeaf({ animate }: { animate: boolean }) {
  const loadIllustration = useIllustrationLoader();

  useEffect(() => {
    if (animate) loadIllustration('leaf');
  }, [animate, loadIllustration]);

  if (!animate) return <Image source={LEAF_SETTLED} style={s.rewardCoin} />;

  return <IllustrationVideo name="leaf" style={s.rewardCoin} />;
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
          <RewardLeaf animate={submitted !== null} />
          <View>
            <Text style={s.rewardTitle}>
              {rewardCredit === null ? '와글 포인트를 받았어요' : `와글 포인트 ${rewardCredit}개를 받았어요`}
            </Text>
            <Text style={s.rewardText}>게시자의 뷰에도 반영했어요.</Text>
          </View>
        </View>
      </View>
    );
  }

  const { busy, error, submit } = evaluation;

  /*
    평가를 누르면 보상 자리에 나뭇잎이 뜬다. 그 그림을 지금부터 받아 둔다 —
    서버 응답을 기다리는 동안 함께 받으므로 보상이 뜰 때는 대개 준비돼 있다.
  */
  const loadIllustration = useIllustrationLoader();
  const evaluate = (rating: PinRating) => {
    loadIllustration('leaf');
    submit(rating);
  };

  return (
    <View style={s.ratingArea}>
      <Text style={s.ratingTitle}>이 영상핀이 유익했나요?</Text>
      <Text style={s.ratingHint}>평가하면 와글 포인트 1개를 적립하고 게시자의 뷰에 반영해요.</Text>
      {error && <Text style={s.ratingError}>{error}</Text>}
      <View style={s.ratingButtons}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => evaluate('HELPFUL')}
          style={[s.ratingButton, s.helpfulButton, busy && s.ratingButtonBusy]}
        >
          {busy ? <ActivityIndicator color={colors.dark} /> : <Text style={s.helpfulText}>유익해요</Text>}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => evaluate('NOT_HELPFUL')}
          style={[s.ratingButton, s.missButton, busy && s.ratingButtonBusy]}
        >
          <Text style={s.missText}>아쉬워요</Text>
        </Pressable>
      </View>
    </View>
  );
}
