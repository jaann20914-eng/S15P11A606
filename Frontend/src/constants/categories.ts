export const categories = ['카페', '맛집', '쇼핑몰·복합몰', '전시·문화', '관광', '공원'] as const;

export type PlaceCategory = (typeof categories)[number];

/**
 * 온보딩 선호 카테고리 단일 소스.
 *
 * `code`는 백엔드 `categories` 시드(`V2__onboarding.sql`)와 **정확히 같아야 한다** —
 * 온보딩 완료 요청의 `preferredCategories`가 이 값을 그대로 보내고,
 * 서버는 code로 조회해 `category_preferences`에 저장한다.
 *
 * `label`은 와이어프레임 문구를 따르므로 백엔드 `name`과 다를 수 있다(표시 전용).
 * 예: `RESTAURANT`의 서버 이름은 "음식점"이지만 화면에는 "맛집"으로 보여준다.
 *
 * 위 `categories`(장소 도메인 표시용)와 개념은 겹치지만 쓰임이 다르다.
 * 이쪽은 서버로 보내는 값이라 문구를 바꿔도 code는 건드리면 안 된다.
 */
export const preferenceCategories = [
  { code: 'CAFE', label: '카페' },
  { code: 'RESTAURANT', label: '맛집' },
  { code: 'SHOPPING_MALL', label: '복합몰' },
  { code: 'CULTURE_EXHIBITION', label: '전시, 문화공간' },
  { code: 'TOURIST_ATTRACTION', label: '관광명소' },
  { code: 'PARK', label: '공원' },
] as const;

export type PreferenceCategoryCode = (typeof preferenceCategories)[number]['code'];

/** code로만 가진 곳(순위 안내 등)에서 표시 라벨을 얻는다. */
export function preferenceCategoryLabel(code: PreferenceCategoryCode): string {
  return preferenceCategories.find((category) => category.code === code)?.label ?? code;
}

/** 선호 카테고리 선택 개수 제한. `docs/UX-SPEC.md`의 "선호 장소 1~3개"를 따른다. */
export const MIN_PREFERENCES = 1;
export const MAX_PREFERENCES = 3;
