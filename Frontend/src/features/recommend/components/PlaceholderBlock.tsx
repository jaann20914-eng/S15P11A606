import { Text, View } from 'react-native';
import { recommendStyles as s } from '../styles';

export interface PlaceholderBlockProps {
  /** 이 자리에 무엇이 들어올지. 화면에 그대로 보인다. */
  label: string;
  /** 누가 만드는 것을 가져다 쓸 것인지 등 한 줄 설명. */
  note: string;
  height: number;
}

/**
 * 아직 채우지 않은 자리.
 *
 * 다른 화면에서 만드는 공용 컴포넌트를 가져다 끼울 곳이다. 지금 우리 것을 따로 만들면
 * 나중에 두 벌이 되고, 그중 하나는 반드시 낡는다. 자리와 높이만 잡아 두고 실물이 나오면
 * 이 컴포넌트를 그것으로 바꾼다.
 */
export function PlaceholderBlock({ label, note, height }: PlaceholderBlockProps) {
  return (
    <View style={[s.placeholder, { height }]}>
      <Text style={s.placeholderLabel}>{label}</Text>
      <Text style={s.placeholderNote}>{note}</Text>
    </View>
  );
}
