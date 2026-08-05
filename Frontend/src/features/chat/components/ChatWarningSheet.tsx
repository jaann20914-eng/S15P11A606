import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoView } from 'expo-video';
import { colors, radius, spacing, type } from '@/constants/theme';
import { useSheetTransition } from '@/features/pin-detail/hooks/useSheetTransition';
import { useAutoplayVideo } from '@/hooks/useAutoplayVideo';
import type { ChatWarning, WarningReasonCode } from '@/types/chat';

/** 경고 알람 영상. 원본(1.9MB · 1080p)을 표시 크기에 맞춰 줄여 둔 것(15KB · 480p). */
const ALARM_VIDEO = require('../../../../assets/videos/chat-warning-3d.mp4');

/**
 * 사유별 제목. 서버 안내 문구(`content`)는 문장이 길어 제목으로 쓰기 어렵다 —
 * 한눈에 읽히는 짧은 말을 화면이 정하고, 서버 문구는 그 아래 설명 줄이 맡는다.
 */
const titleByReason: Record<WarningReasonCode, string> = {
  EXTERNAL_MESSENGER_INDUCEMENT: '개인 연락처 교환은 주의하세요',
  FRAUD_SCAM: '사기 위험이 감지됐어요',
  ILLEGAL_GOODS_TRADE: '불법 거래가 의심돼요',
  ETC_SUSPICIOUS: '의심스러운 대화가 감지됐어요',
};

/** 사유별 강조 문구. 영상 아래에서 "그래서 어떻게 해야 하는지"를 두 줄로 말한다. */
const messageByReason: Record<WarningReasonCode, string> = {
  EXTERNAL_MESSENGER_INDUCEMENT: '외부 채널로 유도하는 사기가 있으니\n채팅에서 대화를 진행해주세요',
  FRAUD_SCAM: '선입금·계좌이체 요청에 응하기 전에\n거래 정보를 다시 확인해주세요',
  ILLEGAL_GOODS_TRADE: '불법 물품 거래는 법적 처벌 대상이\n될 수 있으니 유의해주세요',
  ETC_SUSPICIOUS: '대화 내용과 거래 상대를\n다시 한번 확인해주세요',
};

export interface ChatWarningSheetProps {
  /** 방금 도착한 경고. 없으면 시트가 닫혀 있다. */
  warning: ChatWarning | null;
  onClose: () => void;
}

/**
 * AI 경고 안내 시트.
 *
 * 뷰포인트 결제(`PinPurchaseModal`)와 같은 상호작용이다 — 아래에서 올라오고, 확인 버튼 ·
 * 손잡이 끌어내리기 · 바깥 누르기로 닫힌다. 가운데 상자 팝업으로 두었더니 위아래 여백이
 * 어수선하고 그림을 키울 자리가 없던 것도 그쪽과 같은 사정이라 같은 답을 쓴다.
 *
 * 잠금(`busy`)은 없다. 결제와 달리 기다릴 서버 작업이 없어 언제든 닫을 수 있다.
 */
export function ChatWarningSheet({ warning, onClose }: ChatWarningSheetProps) {
  const { bottom } = useSafeAreaInsets();
  const { rendered, translateY, backdropOpacity, onSheetLayout, panHandlers } = useSheetTransition(
    warning !== null,
    false,
    onClose,
  );

  /*
    내려가는 동안 보여줄 내용. 닫히는 순간 `warning`이 null이 되므로, 그대로 그리면 시트가
    빈 채로 내려간다. 마지막 경고를 들고 있다가 다 내려간 뒤에 함께 버린다.
  */
  const [shown, setShown] = useState(warning);

  useEffect(() => {
    if (warning !== null) setShown(warning);
  }, [warning]);

  if (!rendered || shown === null) return null;

  return (
    <View style={s.backdrop}>
      {/* 어두운 막. 누르는 것은 아래 빈 자리가 받으므로 이 막은 터치를 통과시킨다. */}
      <Animated.View pointerEvents="none" style={[s.scrim, { opacity: backdropOpacity }]} />

      <Pressable accessibilityLabel="닫기" onPress={onClose} style={s.dismissArea} />

      <Animated.View
        onLayout={onSheetLayout}
        style={[s.sheet, { paddingBottom: bottom + spacing.x6 }, { transform: [{ translateY }] }]}
      >
        {/* 손잡이. 여기를 아래로 끌면 닫힌다. */}
        <View {...panHandlers} style={s.handleArea}>
          <View style={s.handle} />
        </View>

        <Text style={s.title}>{titleByReason[shown.reasonCode]}</Text>
        {/* 서버 문구는 두 문장이 한 줄로 온다. 첫 문장("~가 감지되었습니다.") 뒤에서 줄을 바꾼다. */}
        <Text style={s.caption}>{shown.content.replace('. ', '.\n')}</Text>

        <AlarmVideo />

        <Text style={s.message}>{messageByReason[shown.reasonCode]}</Text>

        <Pressable accessibilityRole="button" onPress={onClose} style={s.confirmButton}>
          <Text style={s.confirmText}>확인했습니다</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

/**
 * 알람 영상. 시트가 그려질 때만 플레이어를 만들도록 컴포넌트를 갈랐다 —
 * 부모에 두면 방 화면이 사는 내내 쓰지 않는 플레이어가 남는다.
 */
function AlarmVideo() {
  const player = useAutoplayVideo(ALARM_VIDEO, { loop: true, muted: true });

  return (
    <VideoView
      player={player}
      style={s.video}
      /*
        원본이 16:9 가로 영상이라 contain으로 넣으면 상자 안에서 납작해진다(200 상자에
        200x112). 알람이 가운데 있으므로 양옆을 잘라 상자를 가득 채운다.
      */
      contentFit="cover"
      nativeControls={false}
      allowsPictureInPicture={false}
    />
  );
}

/* 결제 시트(`pin-detail/styles.ts`)와 같은 치수. 두 시트가 같은 물건으로 읽혀야 한다. */
const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(28,26,26,.5)' },
  dismissArea: { flex: 1 },
  sheet: {
    alignItems: 'center',
    paddingHorizontal: spacing.x6,
    borderTopLeftRadius: radius.hero,
    borderTopRightRadius: radius.hero,
    backgroundColor: colors.white,
  },
  handleArea: { alignSelf: 'stretch', alignItems: 'center', paddingVertical: spacing.x3 },
  handle: { width: 56, height: 5, borderRadius: radius.pill, backgroundColor: colors.gray200 },
  title: { ...type.h3, alignSelf: 'flex-start', color: colors.dark },
  caption: { ...type.small, alignSelf: 'flex-start', marginTop: spacing.x2, color: colors.gray400 },
  /** 다른 시트의 그림(200)보다 큰 것은 가로 영상을 잘라 쓰는 몫이다. 둥근 모서리로 잘린 티를 줄인다. */
  video: { width: 240, height: 240, marginTop: spacing.x6, borderRadius: radius.lg, overflow: 'hidden' },
  message: {
    ...type.body,
    marginTop: spacing.x6,
    marginBottom: spacing.x5,
    textAlign: 'center',
    fontWeight: '600',
    color: colors.dark,
  },
  confirmButton: {
    alignSelf: 'stretch',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.dark,
  },
  confirmText: { ...type.label, color: colors.lime, fontWeight: '600' },
});
