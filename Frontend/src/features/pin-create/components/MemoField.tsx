import { Text, TextInput } from 'react-native';
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
    가득 찼는지. 테두리와 안내 문구를 켜고, 네이티브 입력을 잠그는 기준이다.
  */
  const atLimit = countGraphemes(value) >= MAX_MEMO_LENGTH;

  return (
    <>
      {/*
        안내 문구는 가득 찼을 때만 **글자를** 보여주고, 줄 자체는 늘 자리를 잡아 둔다.
        줄이 끼어들었다 빠지면 입력칸이 오르내리며 다시 그려져, 치던 글씨가 작아지는 것처럼
        보였다. 자리가 고정이면 바뀌는 것은 글자와 테두리 색뿐이다.
      */}
      <Text style={s.memoLimitNotice}>
        {atLimit ? `최대 ${MAX_MEMO_LENGTH}자까지 입력할 수 있어요` : ' '}
      </Text>
      <TextInput
        value={value}
        onChangeText={(text) => onChange(truncateGraphemes(text, MAX_MEMO_LENGTH))}
        onFocus={onFocus}
        multiline
        placeholder={`내용 입력 (선택 · 최대 ${MAX_MEMO_LENGTH}자)`}
        placeholderTextColor={colors.gray400}
        /*
          가득 찼으면 네이티브가 입력을 막는다(지우기·바꾸기는 된다).

          잘라내서 되돌리는 방식은 51번째 글자가 화면에 들어왔다 지워지는 왕복이 생기고, 그
          왕복 중에 조합 중이던 글자가 흔들려 크기가 변하는 것처럼 보였다. 애초에 들어오지
          못하게 하면 왕복이 없다. `maxLength`는 UTF-16 단위라 평소에는 걸지 않고(이모지를
          일찍 막는다), 가득 찬 순간에만 지금 길이로 잠근다. 잘라내기는 붙여넣기 초과분을
          위한 안전망으로 남는다.
        */
        maxLength={atLimit ? value.length : undefined}
        style={[s.memo, atLimit && s.memoAtLimit]}
      />
    </>
  );
}
