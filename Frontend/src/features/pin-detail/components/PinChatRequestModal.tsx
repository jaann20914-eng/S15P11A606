import { ActivityIndicator, Image, Modal, Pressable, Text, View } from 'react-native';
import { MODAL_ANIMATION } from '@/components/common/modalAnimation';
import { pinDetailStyles as s } from '../styles';

const CHAT_IMAGE = require('../../../../assets/images/chat-request-3d.png');

export interface PinChatRequestModalProps {
  visible: boolean;
  /** 요청 중이면 버튼을 잠근다. */
  busy?: boolean;
  /** 실패 문구. 모달을 닫지 않고 그 자리에 노출해 다시 시도하게 한다. */
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/** 채팅 요청 확인. 수락 시 크레딧이 이전되므로 요청 단계에서 한 번 확인받는다. */
export function PinChatRequestModal({
  visible,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: PinChatRequestModalProps) {
  return (
    <Modal visible={visible} transparent animationType={MODAL_ANIMATION} onRequestClose={onCancel}>
      <View style={s.modalBackdrop}>
        <View style={s.chatModalCard}>
          <Text style={s.modalTitle}>채팅 요청</Text>
          <Image source={CHAT_IMAGE} style={s.chatIllustration} />
          {error && <Text style={s.chatRequestError}>{error}</Text>}
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onConfirm}
            style={[s.chatStart, busy && s.chatStartBusy]}
          >
            {busy ? (
              <ActivityIndicator color="#91A700" />
            ) : (
              <Text style={s.chatStartText}>5 크레딧 차감 후 채팅 시작하기</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
