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
                <ActivityIndicator color={colors.lime} />
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

/*
  모양은 알림 모달(`NoticeModal`)을 따른다 — 같은 자리에서 같은 무게로 읽혀야 한다.
  뒤 화면은 연한 검정으로 눌러 카드가 떠 보이게 한다(흰 막을 깔았더니 카드와 배경이
  같은 색이라 경계가 사라졌다). 다른 점은 버튼이 둘이라는 것뿐이다.
*/
const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: layout.gutter,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  card: {
    width: '100%',
    padding: spacing.x5,
    borderRadius: radius.lg,
    backgroundColor: colors.white,
    ...shadow,
  },
  title: { ...type.title, color: colors.dark },
  message: { ...type.small, color: colors.gray600, marginTop: spacing.x2 },
  error: { ...type.caption, color: colors.danger, marginTop: spacing.x3 },
  actions: { flexDirection: 'row', gap: spacing.x2, marginTop: spacing.x4 },
  button: { flex: 1, height: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  busy: { opacity: 0.6 },
  cancel: { backgroundColor: colors.gray100 },
  cancelText: { ...type.label, color: colors.gray600, fontWeight: '600' },
  /*
    실행 버튼은 알림 모달의 확인 버튼과 같은 색을 쓴다(검정 바탕 · 연두 글자). 삭제라고
    붉게 칠했더니 이 모달만 다른 물건처럼 보였다 — 되돌릴 수 없다는 것은 색이 아니라 문구와
    취소 버튼이 알린다.
  */
  confirm: { backgroundColor: colors.dark },
  confirmText: { ...type.label, color: '#D9ED76', fontWeight: '600' },
});
