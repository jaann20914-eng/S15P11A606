import { TextInput } from 'react-native';
import { colors } from '@/constants/theme';
import { MAX_MEMO_LENGTH } from '@/types/pinCreate';
import { truncateGraphemes } from '@/utils/graphemes';
import { pinCreateStyles as s } from '../styles';

export interface MemoFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * 현장 설명 입력. 선택 입력이며 길이만 제한한다.
 *
 * `maxLength`를 쓰지 않는다. 그 값은 UTF-16 단위로 세어 이모지 하나를 2자로 취급한다.
 * 안내 문구의 "50자"와 실제 입력량을 맞추려면 보이는 글자 단위로 잘라야 한다.
 */
export function MemoField({ value, onChange }: MemoFieldProps) {
  return (
    <TextInput
      value={value}
      onChangeText={(text) => onChange(truncateGraphemes(text, MAX_MEMO_LENGTH))}
      multiline
      placeholder={`내용 입력 (최대 ${MAX_MEMO_LENGTH}자)`}
      placeholderTextColor={colors.gray400}
      style={s.memo}
    />
  );
}
