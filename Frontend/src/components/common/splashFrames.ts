import type { ImageSourcePropType } from 'react-native';

/**
 * 시작 화면의 링 프레임.
 *
 * 시안(`assets/View-Splash.html`)의 SVG를 4도 간격으로 미리 구워 둔 것이다. 호를 앱에서
 * 직접 그리려면 SVG가 필요하고 그건 네이티브 모듈이라 앱을 다시 빌드해야 한다 — 그림이
 * 고정이므로 미리 그려 두면 그럴 이유가 없다. 간격이 곧 부드러움이라, 10도로 구웠을 때는
 * 넘어가는 단이 눈에 보였다(2026-08-06).
 *
 * 이 목록은 스크립트가 만든다(스크래치의 make-splash2.js — `_requires.txt`). 손으로 고치지
 * 말고 다시 구울 때 함께 뽑는다. 번들러가 정적 경로만 해석하므로 require를 펼쳐 둔다.
 */
const RING_FRAMES: readonly ImageSourcePropType[] = [
  require('../../../assets/images/splash/ring-000.png'),
  require('../../../assets/images/splash/ring-004.png'),
  require('../../../assets/images/splash/ring-008.png'),
  require('../../../assets/images/splash/ring-012.png'),
  require('../../../assets/images/splash/ring-016.png'),
  require('../../../assets/images/splash/ring-020.png'),
  require('../../../assets/images/splash/ring-024.png'),
  require('../../../assets/images/splash/ring-028.png'),
  require('../../../assets/images/splash/ring-032.png'),
  require('../../../assets/images/splash/ring-036.png'),
  require('../../../assets/images/splash/ring-040.png'),
  require('../../../assets/images/splash/ring-044.png'),
  require('../../../assets/images/splash/ring-048.png'),
  require('../../../assets/images/splash/ring-052.png'),
  require('../../../assets/images/splash/ring-056.png'),
  require('../../../assets/images/splash/ring-060.png'),
  require('../../../assets/images/splash/ring-064.png'),
  require('../../../assets/images/splash/ring-068.png'),
  require('../../../assets/images/splash/ring-072.png'),
  require('../../../assets/images/splash/ring-076.png'),
  require('../../../assets/images/splash/ring-080.png'),
  require('../../../assets/images/splash/ring-084.png'),
  require('../../../assets/images/splash/ring-088.png'),
  require('../../../assets/images/splash/ring-092.png'),
  require('../../../assets/images/splash/ring-096.png'),
  require('../../../assets/images/splash/ring-100.png'),
  require('../../../assets/images/splash/ring-104.png'),
  require('../../../assets/images/splash/ring-108.png'),
  require('../../../assets/images/splash/ring-112.png'),
  require('../../../assets/images/splash/ring-116.png'),
  require('../../../assets/images/splash/ring-120.png'),
  require('../../../assets/images/splash/ring-124.png'),
  require('../../../assets/images/splash/ring-128.png'),
  require('../../../assets/images/splash/ring-132.png'),
  require('../../../assets/images/splash/ring-136.png'),
  require('../../../assets/images/splash/ring-140.png'),
  require('../../../assets/images/splash/ring-144.png'),
  require('../../../assets/images/splash/ring-148.png'),
  require('../../../assets/images/splash/ring-152.png'),
  require('../../../assets/images/splash/ring-156.png'),
  require('../../../assets/images/splash/ring-160.png'),
  require('../../../assets/images/splash/ring-164.png'),
  require('../../../assets/images/splash/ring-168.png'),
  require('../../../assets/images/splash/ring-172.png'),
  require('../../../assets/images/splash/ring-176.png'),
  require('../../../assets/images/splash/ring-180.png'),
  require('../../../assets/images/splash/ring-184.png'),
  require('../../../assets/images/splash/ring-188.png'),
  require('../../../assets/images/splash/ring-192.png'),
  require('../../../assets/images/splash/ring-196.png'),
  require('../../../assets/images/splash/ring-200.png'),
  require('../../../assets/images/splash/ring-204.png'),
  require('../../../assets/images/splash/ring-208.png'),
  require('../../../assets/images/splash/ring-212.png'),
  require('../../../assets/images/splash/ring-216.png'),
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
