import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { pinDetailStyles as s } from './styles';

export interface OwnerMenuProps {
  onEdit: () => void;
  onDelete: () => void;
  /** 바깥을 누르면 닫는다. */
  onDismiss: () => void;
}

/**
 * 내 핀 헤더 메뉴.
 * 헤더 안에 넣으면 뒤따르는 형제 요소에 가려서, 헤더와 같은 층에 띄운다.
 */
export function OwnerMenu({ onEdit, onDelete, onDismiss }: OwnerMenuProps) {
  return (
    <>
      <Pressable accessibilityLabel="메뉴 닫기" onPress={onDismiss} style={s.menuBackdrop} />

      <View style={s.menuPopover}>
        <Pressable accessibilityRole="button" onPress={onEdit} style={s.menuRow}>
          <Ionicons name="pencil" size={17} color={colors.gray600} />
          <Text style={s.menuText}>수정하기</Text>
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
