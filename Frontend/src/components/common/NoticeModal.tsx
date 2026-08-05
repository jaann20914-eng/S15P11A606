import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, layout, radius, spacing, type } from '@/constants/theme';
import { MODAL_ANIMATION } from './modalAnimation';

export interface NoticeModalProps {
  visible: boolean;
  title: string;
  /** 줄바꿈은 `\n`으로 넣는다. */
  message: string;
  /**
   * 확인을 누른 뒤 무언가 진행 중인지.
   *
   * 참이면 버튼을 잠그고 스피너를 보여준다 — **모달은 닫지 않는다.** 화면을 옮기는 동안
   * 이 모달이 그대로 덮고 있어야 전환이 비쳐 보이지 않는다.
   */
  busy?: boolean;
  onConfirm: () => void;
  confirmLabel?: string;
}

/**
 * 알리기만 하는 모달. 버튼이 하나다.
 *
 * `ConfirmModal`과 역할이 다르다 — 그쪽은 되돌릴 수 없는 동작을 묻는 자리라 취소가 있고,
 * 이쪽은 이미 끝난 일을 알리는 자리라 되돌릴 것이 없다.
 *
 * 네이티브 `Alert`을 쓰지 않는 이유: 확인을 누르는 순간 OS가 곧바로 닫아 버려, 그 뒤에
 * 일어나는 화면 전환이 맨몸으로 드러난다. 등록을 마치고 상세로 가는 길은 여러 화면을
 * 거치는데(탭 교체 → 목록 → 상세) 그 과정이 그대로 보였다. 이 모달은 우리가 닫는 시점을
 * 정할 수 있어, 도착한 뒤에 걷어 전환을 덮어 준다.
 */
export function NoticeModal({
  visible,
  title,
  message,
  busy = false,
  onConfirm,
  confirmLabel = '확인',
}: NoticeModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType={MODAL_ANIMATION}
      /*
        뒤로 가기로 닫히지 않게 한다. 이동이 걸려 있는 자리라, 모달만 사라지고 화면은 그대로
        남으면 사용자가 어디로 가야 할지 알 수 없다.
      */
      onRequestClose={() => undefined}
    >
      <View style={s.backdrop}>
        <View style={s.card}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.message}>{message}</Text>

          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={onConfirm}
            style={[s.button, busy && s.buttonBusy]}
          >
            {busy ? (
              <ActivityIndicator color={colors.lime} />
            ) : (
              <Text style={s.buttonText}>{confirmLabel}</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

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
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 6,
  },
  title: { ...type.title, color: colors.dark },
  message: { ...type.small, color: colors.gray600, marginTop: spacing.x2 },
  button: {
    height: 48,
    marginTop: spacing.x4,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.dark,
  },
  buttonBusy: { opacity: 0.85 },
  buttonText: { ...type.label, color: '#D9ED76', fontWeight: '600' },
});
