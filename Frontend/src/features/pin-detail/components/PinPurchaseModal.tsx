import { ActivityIndicator, Image, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { MODAL_ANIMATION } from '@/components/common/modalAnimation';
import { pinDetailStyles as s } from '../styles';

const COIN_IMAGE = require('../../../../assets/images/credit-coin-3d.png');

export interface PinPurchaseModalProps {
  visible: boolean;
  /** 요청 중이면 버튼을 잠근다. */
  busy?: boolean;
  /** 실패 문구. 모달을 닫지 않고 그 자리에 노출해 같은 키로 재시도하게 한다. */
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/** 영상 열람 결제 확인. 크레딧 차감액은 확정되면 상수로 뺀다. */
export function PinPurchaseModal({
  visible,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: PinPurchaseModalProps) {
  return (
    <Modal visible={visible} transparent animationType={MODAL_ANIMATION} onRequestClose={onCancel}>
      <View style={s.modalBackdrop}>
        <View style={s.modalCard}>
          <View style={s.modalHead}>
            <View>
              <Text style={s.modalTitle}>뷰포인트 결제</Text>
              <Text style={s.modalCaption}>결제된 영상에 대하여 포인트 환불이 불가합니다</Text>
            </View>
            <Pressable accessibilityLabel="닫기" disabled={busy} onPress={onCancel} style={s.modalClose}>
              <Ionicons name="close" size={18} color={colors.white} />
            </Pressable>
          </View>

          <View style={s.payPanel}>
            <Image source={COIN_IMAGE} style={s.coinImage} />
            <Text style={s.payMessage}>영상 확인을 위해서는{'\n'}뷰포인트가 -3 차감됩니다</Text>
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
          </View>
        </View>
      </View>
    </Modal>
  );
}
