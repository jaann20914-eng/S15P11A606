import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { goBackOrHome } from '@/utils/navigation';
import { pinDetailStyles as s } from '../styles';

export interface PinDetailHeaderProps {
  /** 내 핀일 때만 준다. 신고 대신 수정·삭제 메뉴 버튼이 뜬다. */
  menu?: { open: boolean; onToggle: () => void };
  /** 소유 여부를 모르는 로딩·오류 화면에서 오른쪽 슬롯을 비운다. */
  hideActions?: boolean;
}

export function PinDetailHeader({ menu, hideActions }: PinDetailHeaderProps) {
  return (
    <View style={s.header}>
      <Pressable accessibilityLabel="뒤로 가기" onPress={goBackOrHome} style={s.headerButton}>
        <Ionicons name="chevron-back" size={25} color={colors.gray400} />
      </Pressable>

      <Text style={s.headerTitle}>영상핀</Text>

      {hideActions ? (
        <View style={s.reportButton} />
      ) : menu ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="게시물 메뉴"
          accessibilityState={{ expanded: menu.open }}
          onPress={menu.onToggle}
          style={s.headerButton}
        >
          <Ionicons name="menu" size={28} color={colors.gray600} />
        </Pressable>
      ) : (
        <Pressable accessibilityLabel="신고" style={s.reportButton}>
          <Ionicons name="notifications" size={18} color={colors.gray400} />
          <Text style={s.reportText}>신고</Text>
        </Pressable>
      )}
    </View>
  );
}
