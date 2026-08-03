package com.yuhan.wagglewaggle.domain.place.entity;

/**
 * 장소 카테고리. 추천 기능이 AI 추천점수 API에 넘기는 카테고리 분류와 1:1 대응한다.
 * CAFE~PARK 6종은 AI CategoryCode enum과 값이 동일하며, ETC는 6종에 해당하지 않는 장소로
 * 추천 후보에서 제외된다(AI는 6종만 허용한다).
 * DB에는 PostgreSQL enum 타입 category_type 으로 저장한다(V14 참고).
 */
public enum PlaceCategory {
    CAFE,
    RESTAURANT,
    SHOPPING_MALL,
    CULTURE_EXHIBITION,
    TOURIST_ATTRACTION,
    PARK,
    ETC
}
