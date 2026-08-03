package com.yuhan.wagglewaggle.domain.place.service;

import com.yuhan.wagglewaggle.domain.place.entity.PlaceCategory;

/**
 * 카카오 장소 부가 정보(그룹코드/그룹명/카테고리명)를 서비스 카테고리 {@link PlaceCategory}로 변환한다.
 *
 * <p>매핑 규칙(사용자 정책):
 * <ul>
 *   <li>CAFE/RESTAURANT/CULTURE_EXHIBITION/TOURIST_ATTRACTION 은 카카오 그룹코드(CE7/FD6/CT1/AT4)로 판정한다.</li>
 *   <li>SHOPPING_MALL 은 카카오 그룹코드가 대형마트로 잘못 잡히므로 그룹코드로 판정하지 않고,
 *       카테고리명에 "쇼핑몰"이 포함된 경우에만 판정한다.</li>
 *   <li>PARK 는 그룹코드/그룹명이 없고 카테고리명에만 값이 있어, 카테고리명에 "공원"이 포함되면 판정한다.</li>
 *   <li>그 외에는 ETC 로 분류하며 추천 후보에서 제외된다.</li>
 * </ul>
 */
public final class PlaceCategoryResolver {

    private PlaceCategoryResolver() {
    }

    public static PlaceCategory resolve(String categoryGroupCode, String categoryGroupName, String categoryName) {
        String code = (categoryGroupCode == null) ? "" : categoryGroupCode.trim().toUpperCase();

        // 1. 명확한 카카오 그룹코드 직접 매핑
        switch (code) {
            case "CE7":
                return PlaceCategory.CAFE;
            case "FD6":
                return PlaceCategory.RESTAURANT;
            case "CT1":
                return PlaceCategory.CULTURE_EXHIBITION;
            case "AT4":
                return PlaceCategory.TOURIST_ATTRACTION;
            default:
                break;
        }

        // 2. 카테고리명/그룹명 키워드 판정(그룹코드가 없거나 대형마트 등으로 잘못 잡힌 경우 보정)
        String text = ((categoryGroupName == null ? "" : categoryGroupName)
                + " " + (categoryName == null ? "" : categoryName));
        if (text.contains("쇼핑몰")) {
            return PlaceCategory.SHOPPING_MALL;
        }
        if (text.contains("공원")) {
            return PlaceCategory.PARK;
        }
        if (text.contains("카페")) {
            return PlaceCategory.CAFE;
        }
        if (text.contains("음식점")) {
            return PlaceCategory.RESTAURANT;
        }
        if (text.contains("문화")) {
            return PlaceCategory.CULTURE_EXHIBITION;
        }
        if (text.contains("관광")) {
            return PlaceCategory.TOURIST_ATTRACTION;
        }

        return PlaceCategory.ETC;
    }
}
