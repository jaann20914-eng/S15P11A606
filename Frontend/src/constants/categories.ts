export const categories = ['카페', '맛집', '쇼핑몰·복합몰', '전시·문화', '관광', '공원'] as const;

export type PlaceCategory = (typeof categories)[number];
