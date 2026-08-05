import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { pinDetailStyles as s } from '../styles';

export interface OwnerMenuProps {
  /**
   * 수정을 열 수 있는지. 공개가 끝난(만료) 글은 서버가 수정을 거절하므로 잠근다.
   *
   * 줄을 지우지 않고 잠그는 이유는 "원래 없는 기능"과 "지금은 안 되는 것"을 가르기 위해서다.
   * 삭제는 만료돼도 할 수 있어 그대로 둔다.
   */
  editable: boolean;
  onEdit: () => void;
  onDelete: () => void;
  /** 바깥을 누르면 닫는다. */
  onDismiss: () => void;
}

/**
 * 내 핀 헤더 메뉴.
 * 헤더 안에 넣으면 뒤따르는 형제 요소에 가려서, 헤더와 같은 층에 띄운다.
 */
export function OwnerMenu({ editable, onEdit, onDelete, onDismiss }: OwnerMenuProps) {
  return (
    <>
      <Pressable accessibilityLabel="메뉴 닫기" onPress={onDismiss} style={s.menuBackdrop} />

      <View style={s.menuPopover}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !editable }}
          accessibilityHint={editable ? undefined : '만료된 글은 수정할 수 없습니다'}
          disabled={!editable}
          onPress={onEdit}
          style={s.menuRow}
        >
          <Ionicons name="pencil" size={17} color={editable ? colors.gray600 : colors.gray400} />
          <View>
            <Text style={[s.menuText, !editable && s.menuTextDisabled]}>수정하기</Text>
            {!editable && <Text style={s.menuHint}>만료된 글이에요</Text>}
          </View>
        </Pressable>

        <View style={s.menuRule} />

        <Pressable accessibilityRole="button" onPress={onDelete} style={s.menuRow}>
          <Ionicons name="trash" size={17} color={colors.gray600} />
          <Text style={s.menuText}>삭제하기</Text>
        </Pressable>
      </View>
    </>
  );
}
