import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * 지금 키보드가 차지하고 있는 높이(px). 닫혀 있으면 0.
 *
 * `KeyboardAvoidingView`를 쓰지 않는 이유가 있다. 그 컴포넌트는 안드로이드에서 창이 줄어드는
 * 것(`adjustResize`)에 기대는데, 이 앱은 화면 끝까지 그리는 방식(edge-to-edge)이라 창이 줄지
 * 않는다. 키보드가 화면 위를 덮을 뿐이어서 아무것도 밀려 올라가지 않고, 아래쪽 입력칸과 고정
 * 버튼이 키보드 뒤에 그대로 남는다.
 *
 * 그래서 높이를 직접 받아 쓰는 쪽이 두 플랫폼에서 모두 확실하다. 받은 값만큼 아래 여백을 주면
 * 그 안의 내용은 키보드 위 영역에서만 배치된다.
 *
 * iOS는 `will` 이벤트가 애니메이션과 함께 와서 부드럽고, 안드로이드는 `did`만 신뢰할 수 있다.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const shown = Keyboard.addListener(showEvent, (event) => {
      setHeight(event.endCoordinates.height);
    });
    const hidden = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return height;
}
