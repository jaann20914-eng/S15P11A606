import type { ImageSourcePropType } from 'react-native';

/**
 * 뷰 각도(0~360)에 대응하는 링 이미지를 고른다.
 *
 * 이미지는 10도 단위로만 있고 파일명은 구간의 위쪽 경계를 쓴다.
 * - `000` 0도
 * - `010` 1~10도
 * - `020` 11~20도
 * - ...
 * - `360` 351~360도
 *
 * 번들러가 정적 경로만 해석하므로 `require`를 미리 펼쳐 둔다. 경로를 조립할 수 없다.
 */
const VIEW_ANGLE_IMAGES: Record<number, ImageSourcePropType> = {
  0: require('../../assets/images/view-angles-000-360/view-angle-000.png'),
  10: require('../../assets/images/view-angles-000-360/view-angle-010.png'),
  20: require('../../assets/images/view-angles-000-360/view-angle-020.png'),
  30: require('../../assets/images/view-angles-000-360/view-angle-030.png'),
  40: require('../../assets/images/view-angles-000-360/view-angle-040.png'),
  50: require('../../assets/images/view-angles-000-360/view-angle-050.png'),
  60: require('../../assets/images/view-angles-000-360/view-angle-060.png'),
  70: require('../../assets/images/view-angles-000-360/view-angle-070.png'),
  80: require('../../assets/images/view-angles-000-360/view-angle-080.png'),
  90: require('../../assets/images/view-angles-000-360/view-angle-090.png'),
  100: require('../../assets/images/view-angles-000-360/view-angle-100.png'),
  110: require('../../assets/images/view-angles-000-360/view-angle-110.png'),
  120: require('../../assets/images/view-angles-000-360/view-angle-120.png'),
  130: require('../../assets/images/view-angles-000-360/view-angle-130.png'),
  140: require('../../assets/images/view-angles-000-360/view-angle-140.png'),
  150: require('../../assets/images/view-angles-000-360/view-angle-150.png'),
  160: require('../../assets/images/view-angles-000-360/view-angle-160.png'),
  170: require('../../assets/images/view-angles-000-360/view-angle-170.png'),
  180: require('../../assets/images/view-angles-000-360/view-angle-180.png'),
  190: require('../../assets/images/view-angles-000-360/view-angle-190.png'),
  200: require('../../assets/images/view-angles-000-360/view-angle-200.png'),
  210: require('../../assets/images/view-angles-000-360/view-angle-210.png'),
  220: require('../../assets/images/view-angles-000-360/view-angle-220.png'),
  230: require('../../assets/images/view-angles-000-360/view-angle-230.png'),
  240: require('../../assets/images/view-angles-000-360/view-angle-240.png'),
  250: require('../../assets/images/view-angles-000-360/view-angle-250.png'),
  260: require('../../assets/images/view-angles-000-360/view-angle-260.png'),
  270: require('../../assets/images/view-angles-000-360/view-angle-270.png'),
  280: require('../../assets/images/view-angles-000-360/view-angle-280.png'),
  290: require('../../assets/images/view-angles-000-360/view-angle-290.png'),
  300: require('../../assets/images/view-angles-000-360/view-angle-300.png'),
  310: require('../../assets/images/view-angles-000-360/view-angle-310.png'),
  320: require('../../assets/images/view-angles-000-360/view-angle-320.png'),
  330: require('../../assets/images/view-angles-000-360/view-angle-330.png'),
  340: require('../../assets/images/view-angles-000-360/view-angle-340.png'),
  350: require('../../assets/images/view-angles-000-360/view-angle-350.png'),
  360: require('../../assets/images/view-angles-000-360/view-angle-360.png'),
};

export const MIN_VIEW_ANGLE = 0;
export const MAX_VIEW_ANGLE = 360;

/**
 * 각도를 이미지가 있는 10도 단위로 올림한다.
 * 0은 그대로 0, 1~10은 10, 11~20은 20이 된다. 범위를 벗어나면 0~360으로 자른다.
 */
export function toViewAngleStep(angle: number): number {
  if (!Number.isFinite(angle)) return MIN_VIEW_ANGLE;

  const clamped = Math.min(MAX_VIEW_ANGLE, Math.max(MIN_VIEW_ANGLE, angle));
  return Math.ceil(clamped / 10) * 10;
}

/** 각도에 맞는 링 이미지. 링만 있고 숫자는 들어 있지 않아 호출부가 텍스트를 얹는다. */
export function getViewAngleImage(angle: number): ImageSourcePropType {
  return VIEW_ANGLE_IMAGES[toViewAngleStep(angle)] ?? VIEW_ANGLE_IMAGES[MIN_VIEW_ANGLE];
}

/**
 * 각도를 화면에 쓸 문자열로 만든다.
 *
 * 소수점 첫째 자리까지 보여주되 `.0`은 붙이지 않는다. 뷰 신뢰도는 소수가 있고
 * 게시글 작성자 각도는 정수라 한쪽만 맞추면 다른 쪽이 `92.0°`처럼 어색해진다.
 */
export function formatViewAngle(angle: number): string {
  if (!Number.isFinite(angle)) return '0°';

  const rounded = Math.round(angle * 10) / 10;
  return `${rounded}°`;
}
