import { ActivityIndicator, Animated, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '@/constants/theme';
import { pinDetailStyles as s } from '../styles';
import { useSheetTransition } from '../hooks/useSheetTransition';
import { IllustrationVideo } from './IllustrationVideo';

export interface PinPurchaseModalProps {
  visible: boolean;
  /** 요청 중이면 버튼을 잠근다. */
  busy?: boolean;
  /** 실패 문구. 시트를 닫지 않고 그 자리에 노출해 같은 키로 재시도하게 한다. */
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 영상 열람 결제 확인.
 *
 * 화면 가운데 뜨는 상자가 아니라 **아래에 붙는 시트**다. 가운데 상자는 위아래로 빈 공간이
 * 남아 어수선했고, 그 여백 때문에 그림을 키울 자리도 없었다. 아래에 붙이면 폭과 높이를
 * 그대로 쓸 수 있다.
 *
 * 닫는 방법도 손잡이를 아래로 끄는 것으로 바꿨다. 시트가 아래에 있으니 닫는 몸짓도 아래가
 * 자연스럽고, 위쪽 구석의 작은 X는 한 손으로 닿기 어렵다. 바깥을 눌러도 닫힌다.
 *
 * 결제가 진행 중일 때는 둘 다 막는다. 화면이 사라지면 사용자는 결제가 취소된 것으로 읽는다.
 */
export function PinPurchaseModal({
  visible,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: PinPurchaseModalProps) {
  const { bottom } = useSafeAreaInsets();
  const { rendered, translateY, backdropOpacity, onSheetLayout, panHandlers } = useSheetTransition(
    visible,
    busy,
    onCancel,
  );

  // 다 내려간 뒤에야 화면에서 뺀다. 그전까지는 내려가는 모습을 보여야 한다.
  if (!rendered) return null;

  return (
    <View style={s.sheetBackdrop}>
      {/*
        어두운 막. 흐림만으로는 뒤 화면이 밝게 남아 시트와 구분되지 않는다.
        누르는 것은 아래 빈 자리가 받으므로 이 막은 터치를 통과시킨다.
      */}
      <Animated.View pointerEvents="none" style={[s.sheetScrim, { opacity: backdropOpacity }]} />

      <Pressable accessibilityLabel="닫기" disabled={busy} onPress={onCancel} style={s.sheetDismissArea} />

      <Animated.View
        onLayout={onSheetLayout}
        style={[s.sheet, { paddingBottom: bottom + spacing.x6 }, { transform: [{ translateY }] }]}
      >
        {/* 손잡이. 여기를 아래로 끌면 닫힌다. */}
        <View {...panHandlers} style={s.sheetHandleArea}>
          <View style={s.sheetHandle} />
        </View>

        <Text style={s.sheetTitle}>와글 포인트 결제</Text>
        <Text style={s.sheetCaption}>결제된 영상에 대하여 포인트 환불이 불가합니다</Text>

        {/* 미리 받아 둔 영상이라 곧바로 뜬다. 열 때마다 처음부터 재생된다. */}
        <IllustrationVideo name="coin" style={s.coinVideo} />

        <Text style={s.payMessage}>영상 확인을 위해서는{'\n'}3 와글 포인트가 차감됩니다</Text>
        {error && <Text style={s.payError}>{error}</Text>}

        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={onConfirm}
          style={[s.primaryDark, s.payButton, busy && s.payButtonBusy]}
        >
          {busy ? (
            <ActivityIndicator color={colors.lime} />
          ) : (
            <Text style={s.primaryDarkText}>동의하고 결제하기</Text>
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}
