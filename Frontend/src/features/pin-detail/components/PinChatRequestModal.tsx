import { Image, Modal, Pressable, Text, View } from 'react-native';
import { MODAL_ANIMATION } from '@/components/common/modalAnimation';
import { pinDetailStyles as s } from '../styles';

const CHAT_IMAGE = require('../../../../assets/images/chat-request-3d.png');

export interface PinChatRequestModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** 채팅 요청 확인. 수락 시 크레딧이 이전되므로 요청 단계에서 한 번 확인받는다. */
export function PinChatRequestModal({ visible, onCancel, onConfirm }: PinChatRequestModalProps) {
  return (
    <Modal visible={visible} transparent animationType={MODAL_ANIMATION} onRequestClose={onCancel}>
      <View style={s.modalBackdrop}>
        <View style={s.chatModalCard}>
          <Text style={s.modalTitle}>채팅 요청</Text>
          <Image source={CHAT_IMAGE} style={s.chatIllustration} />
          <Pressable accessibilityRole="button" onPress={onConfirm} style={s.chatStart}>
            <Text style={s.chatStartText}>5 크레딧 차감 후 채팅 시작하기</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
