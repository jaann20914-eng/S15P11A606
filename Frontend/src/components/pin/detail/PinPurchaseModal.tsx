import { Image, Modal, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { MODAL_ANIMATION } from '@/components/common/modalAnimation';
import { pinDetailStyles as s } from './styles';

const COIN_IMAGE = require('../../../../assets/images/credit-coin-3d.png');

export interface PinPurchaseModalProps {
  visible: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** 영상 열람 결제 확인. 크레딧 차감액은 확정되면 상수로 뺀다. */
export function PinPurchaseModal({ visible, onCancel, onConfirm }: PinPurchaseModalProps) {
  return (
    <Modal visible={visible} transparent animationType={MODAL_ANIMATION} onRequestClose={onCancel}>
      <View style={s.modalBackdrop}>
        <View style={s.modalCard}>
          <View style={s.modalHead}>
            <View>
              <Text style={s.modalTitle}>뷰포인트 결제</Text>
              <Text style={s.modalCaption}>결제된 영상에 대하여 포인트 환불이 불가합니다</Text>
            </View>
            <Pressable accessibilityLabel="닫기" onPress={onCancel} style={s.modalClose}>
              <Ionicons name="close" size={18} color={colors.white} />
            </Pressable>
          </View>

          <View style={s.payPanel}>
            <Image source={COIN_IMAGE} style={s.coinImage} />
            <Text style={s.payMessage}>영상 확인을 위해서는{'\n'}뷰포인트가 -3 차감됩니다</Text>
            <Pressable accessibilityRole="button" onPress={onConfirm} style={s.primaryDark}>
              <Text style={s.primaryDarkText}>동의하고 결제하기</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
