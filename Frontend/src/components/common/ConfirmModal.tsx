import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, layout, radius, spacing, type } from '@/constants/theme';
import { MODAL_ANIMATION } from './modalAnimation';

export interface ConfirmModalProps {
  visible: boolean;
  title: string;
  /** 줄바꿈은 `\n`으로 넣는다. */
  message: string;
  /** 실행 버튼 라벨. 되돌릴 수 없는 동작이라 "확인"보다 동사를 쓴다. */
  confirmLabel: string;
  /** 요청 중이면 버튼을 잠그고 스피너를 보여준다. */
  busy?: boolean;
  /** 실패 문구. 모달을 닫지 않고 그 자리에 노출한다. */
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * 삭제·나가기처럼 되돌릴 수 없는 동작 앞에 세우는 확인 모달.
 * 실패해도 모달을 유지해 사용자가 바로 다시 시도할 수 있게 한다.
 */
export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel,
  busy = false,
  error = null,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  return (
    <Modal visible={visible} transparent animationType={MODAL_ANIMATION} onRequestClose={onCancel}>
      <View style={s.backdrop}>
        <View style={s.card}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.message}>{message}</Text>
          {error && <Text style={s.error}>{error}</Text>}

          <View style={s.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onCancel}
              style={[s.button, s.cancel]}
            >
              <Text style={s.cancelText}>취소</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={onConfirm}
              style={[s.button, s.confirm, busy && s.busy]}
            >
              {busy ? (
                <ActivityIndicator color={colors.danger} />
              ) : (
                <Text style={s.confirmText}>{confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const shadow = {
  shadowColor: colors.dark,
  shadowOffset: { width: 0, height: 5 },
  shadowOpacity: 0.16,
  shadowRadius: 12,
  elevation: 6,
};

const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: layout.gutter,
    backgroundColor: 'rgba(255,255,255,.68)',
  },
  card: {
    width: '100%',
    padding: spacing.x5,
    borderRadius: radius.md,
    backgroundColor: colors.white,
    ...shadow,
  },
  title: { ...type.label, color: colors.dark, fontWeight: '600' },
  message: { ...type.body, color: colors.gray600, marginTop: spacing.x3 },
  error: { ...type.caption, color: colors.danger, marginTop: spacing.x3 },
  actions: { flexDirection: 'row', gap: spacing.x2, marginTop: spacing.x5 },
  button: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  busy: { opacity: 0.6 },
  cancel: { backgroundColor: colors.gray100 },
  cancelText: { ...type.label, color: colors.gray600, fontWeight: '600' },
  confirm: { backgroundColor: '#FFF0F1' },
  confirmText: { ...type.label, color: colors.danger, fontWeight: '600' },
});
