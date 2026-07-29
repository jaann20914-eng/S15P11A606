import { Text, TextInput } from 'react-native';
import { colors } from '@/constants/theme';
import { pinCreateStyles as s } from '../styles';

export interface DetailLocationFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/** 상세 위치. "1층 창가 자리"처럼 장소 안에서의 위치를 적는 선택 입력이다. */
export function DetailLocationField({ value, onChange }: DetailLocationFieldProps) {
  return (
    <>
      <Text style={s.label}>상세 위치</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="선택 입력"
        placeholderTextColor={colors.gray400}
        style={s.detailInput}
      />
    </>
  );
}
