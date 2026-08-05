import { TextInput } from 'react-native';
import { colors } from '@/constants/theme';
import { MAX_MEMO_LENGTH } from '@/types/pinCreate';
import { countGraphemes, truncateGraphemes } from '@/utils/graphemes';
import { pinCreateStyles as s } from '../styles';

export interface MemoFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** 키보드가 이 칸을 가리지 않도록 화면이 스크롤을 맞출 때 쓴다. */
  onFocus?: () => void;
}

/**
 * 현장 설명 입력. 선택 입력이며 길이만 제한한다.
 *
 * `maxLength`를 쓰지 않는다. 그 값은 UTF-16 단위로 세어 이모지 하나를 2자로 취급한다.
 * 안내 문구의 "50자"와 실제 입력량을 맞추려면 보이는 글자 단위로 잘라야 한다.
 */
export function MemoField({ value, onChange, onFocus }: MemoFieldProps) {
  /*
    한도에 닿으면 테두리 색으로 알린다. 잘라내기만 하면 더 쳐도 아무 일도 일어나지 않아
    입력기가 고장 난 것처럼 보인다 — 글자 수를 세어 가며 쓰는 사람은 없으니 칸이 말해 줘야
    한다. 잘라내기가 있으므로 이 상태는 "가득 찼다"는 뜻이지 "넘쳤다"가 아니다.
  */
  const atLimit = countGraphemes(value) >= MAX_MEMO_LENGTH;

  return (
    <TextInput
      value={value}
      onChangeText={(text) => onChange(truncateGraphemes(text, MAX_MEMO_LENGTH))}
      onFocus={onFocus}
      multiline
      placeholder={`내용 입력 (선택 · 최대 ${MAX_MEMO_LENGTH}자)`}
      placeholderTextColor={colors.gray400}
      style={[s.memo, atLimit && s.memoAtLimit]}
    />
  );
}
