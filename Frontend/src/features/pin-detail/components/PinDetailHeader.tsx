import { Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/common/ui';
import { colors } from '@/constants/theme';
import { goBackOrHome } from '@/utils/navigation';
import { pinDetailStyles as s } from '../styles';

export interface PinDetailHeaderProps {
  /** 내 핀일 때만 준다. 신고 대신 수정·삭제 메뉴 버튼이 뜬다. */
  menu?: { open: boolean; onToggle: () => void };
  /** 소유 여부를 모르는 로딩·오류 화면에서 오른쪽 슬롯을 비운다. */
  hideActions?: boolean;
}

/**
 * 게시글 상세 헤더.
 *
 * 높이·제목·뒤로 아이콘은 공용 헤더를 따른다. 이 화면만의 것은 오른쪽 자리다 —
 * 내 핀이면 메뉴, 남의 핀이면 신고, 아직 모르면 비운다.
 */
export function PinDetailHeader({ menu, hideActions }: PinDetailHeaderProps) {
  return (
    <ScreenHeader
      title="영상핀"
      back
      onBack={goBackOrHome}
      right={
        hideActions ? null : menu ? (
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
        )
      }
    />
  );
}
