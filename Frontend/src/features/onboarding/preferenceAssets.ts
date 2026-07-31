import type { ImageSourcePropType } from 'react-native';
import type { PreferenceCategoryCode } from '@/constants/categories';

/**
 * 선호 카테고리 카드의 3D 에셋.
 *
 * `require`는 번들 시점에 정적으로 해석되므로 경로를 변수로 만들 수 없다.
 * 그래서 카테고리별 파일을 이 표 한 곳에 모아 두고 화면은 code로만 조회한다.
 *
 * 모두 배경이 투명한 정사각 PNG다. 카드가 `contain`으로 그리므로
 * 새 에셋을 넣을 때도 정사각·투명을 지키면 별도 조정이 필요 없다.
 *
 * 표에 없는 카테고리는 `PreferenceCard`가 라벨만 가운데 정렬해 보여준다.
 */
export const preferenceCategoryImages: Partial<Record<PreferenceCategoryCode, ImageSourcePropType>> = {
  CAFE: require('../../../assets/images/onboarding/category-cafe.png'),
  RESTAURANT: require('../../../assets/images/onboarding/category-restaurant.png'),
  SHOPPING_MALL: require('../../../assets/images/onboarding/category-shopping-mall.png'),
  CULTURE_EXHIBITION: require('../../../assets/images/onboarding/category-culture-exhibition.png'),
  TOURIST_ATTRACTION: require('../../../assets/images/onboarding/category-tourist-attraction.png'),
  PARK: require('../../../assets/images/onboarding/category-park.png'),
};
