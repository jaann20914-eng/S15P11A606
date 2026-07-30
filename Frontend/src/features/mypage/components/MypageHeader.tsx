import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { goBackOrHome } from '@/utils/navigation';
import { mypageStyles as s } from '../styles';

export interface MypageHeaderProps {
  title: string;
}

/** 마이페이지 하위 화면 헤더. 뒤로 가기와 제목만 있고 오른쪽은 균형용 빈칸이다. */
export function MypageHeader({ title }: MypageHeaderProps) {
  return (
    <View style={s.header}>
      <Pressable accessibilityLabel="뒤로 가기" onPress={goBackOrHome} style={s.headerButton}>
        <Ionicons name="chevron-back" size={24} color={colors.gray400} />
      </Pressable>
      <Text style={s.headerTitle}>{title}</Text>
      <View style={s.headerButton} />
    </View>
  );
}
