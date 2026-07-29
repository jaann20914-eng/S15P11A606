import { Platform } from 'react-native';

/**
 * 모달 전환 방식.
 *
 * react-native-web의 `Modal`은 퇴장 CSS 애니메이션이 끝나야 DOM에서 내려간다.
 * 애니메이션 이벤트가 오지 않는 환경(백그라운드 탭, 렌더링이 멈춘 프리뷰 등)에서는
 * `visible`을 false로 바꿔도 화면에 그대로 남는다. 웹에서는 애니메이션을 끄고 즉시 내린다.
 */
export const MODAL_ANIMATION: 'none' | 'fade' = Platform.OS === 'web' ? 'none' : 'fade';
