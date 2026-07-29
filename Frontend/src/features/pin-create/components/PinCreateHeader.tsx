import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';
import { goBackOrHome } from '@/utils/navigation';
import { pinCreateStyles as s } from '../styles';

export interface PinCreateHeaderProps {
  /** 생성이면 "게시글 작성", 수정이면 "게시글 수정". */
  title: string;
}

/** 작성 화면 헤더. 제목만 진입 유형에 따라 달라진다. */
export function PinCreateHeader({ title }: PinCreateHeaderProps) {
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
