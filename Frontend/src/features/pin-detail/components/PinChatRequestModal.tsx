import { ActivityIndicator, Animated, Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing } from '@/constants/theme';
import { pinDetailStyles as s } from '../styles';
import { useSheetTransition } from '../hooks/useSheetTransition';

const CHAT_IMAGE = require('../../../../assets/images/chat-request-3d.png');

export interface PinChatRequestModalProps {
  visible: boolean;
  /** 요청 중이면 버튼을 잠근다. */
  busy?: boolean;
  /** 실패 문구. 시트를 닫지 않고 그 자리에 노출해 다시 시도하게 한다. */
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 채팅 요청 확인. 수락 시 크레딧이 이전되므로 요청 단계에서 한 번 확인받는다.
 *
 * 결제 시트와 같은 방식으로 아래에서 올라온다(`PinPurchaseModal` 주석 참고). 크레딧이 걸린
 * 확인이라는 점이 같으니 나타나는 자리와 닫는 몸짓도 같아야 한다.
 */
export function PinChatRequestModal({
  visible,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: PinChatRequestModalProps) {
  const { bottom } = useSafeAreaInsets();
  const { rendered, translateY, backdropOpacity, onSheetLayout, panHandlers } = useSheetTransition(
    visible,
    busy,
    onCancel,
  );

  if (!rendered) return null;

  return (
    <View style={s.sheetBackdrop}>
      <Animated.View pointerEvents="none" style={[s.sheetScrim, { opacity: backdropOpacity }]} />

      <Pressable
        accessibilityLabel="닫기"
        disabled={busy}
        onPress={onCancel}
        style={s.sheetDismissArea}
      />

      <Animated.View
        onLayout={onSheetLayout}
        style={[s.sheet, { paddingBottom: bottom + spacing.x6 }, { transform: [{ translateY }] }]}
      >
        <View {...panHandlers} style={s.sheetHandleArea}>
          <View style={s.sheetHandle} />
        </View>

        <Text style={s.sheetTitle}>채팅 요청</Text>
        <Text style={s.sheetCaption}>요청을 수락하면 크레딧이 상대에게 넘어갑니다</Text>

        <Image source={CHAT_IMAGE} style={s.chatIllustration} />

        {error && <Text style={s.chatRequestError}>{error}</Text>}

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onConfirm}
          style={[s.chatStart, s.payButton, busy && s.chatStartBusy]}
        >
          {busy ? (
            <ActivityIndicator color="#91A700" />
          ) : (
            <Text style={s.chatStartText}>5 크레딧 차감 후 채팅 시작하기</Text>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}
