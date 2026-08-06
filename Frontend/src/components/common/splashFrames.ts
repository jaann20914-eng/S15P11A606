import type { ImageSourcePropType } from 'react-native';

/**
 * 시작 화면의 링 프레임.
 *
 * 시안(`assets/View-Splash.html`)의 SVG를 10도 간격으로 미리 구워 둔 것이다. 호를 앱에서
 * 직접 그리려면 SVG가 필요하고 그건 네이티브 모듈이라 앱을 다시 빌드해야 한다 — 그림이
 * 고정이므로 미리 그려 두면 그럴 이유가 없다.
 *
 * 번들러가 정적 경로만 해석하므로 `require`를 펼쳐 둔다. 경로를 조립할 수 없다.
 */
const RING_FRAMES: readonly ImageSourcePropType[] = [
  require('../../../assets/images/splash/ring-000.png'),
  require('../../../assets/images/splash/ring-010.png'),
  require('../../../assets/images/splash/ring-020.png'),
  require('../../../assets/images/splash/ring-030.png'),
  require('../../../assets/images/splash/ring-040.png'),
  require('../../../assets/images/splash/ring-050.png'),
  require('../../../assets/images/splash/ring-060.png'),
  require('../../../assets/images/splash/ring-070.png'),
  require('../../../assets/images/splash/ring-080.png'),
  require('../../../assets/images/splash/ring-090.png'),
  require('../../../assets/images/splash/ring-100.png'),
  require('../../../assets/images/splash/ring-110.png'),
  require('../../../assets/images/splash/ring-120.png'),
  require('../../../assets/images/splash/ring-130.png'),
  require('../../../assets/images/splash/ring-140.png'),
  require('../../../assets/images/splash/ring-150.png'),
  require('../../../assets/images/splash/ring-160.png'),
  require('../../../assets/images/splash/ring-170.png'),
  require('../../../assets/images/splash/ring-180.png'),
  require('../../../assets/images/splash/ring-190.png'),
  require('../../../assets/images/splash/ring-200.png'),
  require('../../../assets/images/splash/ring-210.png'),
  require('../../../assets/images/splash/ring-220.png'),
];

/** 오른쪽 위에서 튀어나오는 도넛 점. */
export const SPLASH_DOT = require('../../../assets/images/splash/dot.png') as ImageSourcePropType;

/** 마지막 프레임의 번호. 이만큼 넘기면 링이 다 그려진다. */
export const LAST_RING_FRAME = RING_FRAMES.length - 1;

/** 프레임 한 장. 범위를 벗어나면 끝 프레임을 준다. */
export function ringFrame(index: number): ImageSourcePropType {
  return RING_FRAMES[Math.min(Math.max(0, index), LAST_RING_FRAME)];
}
