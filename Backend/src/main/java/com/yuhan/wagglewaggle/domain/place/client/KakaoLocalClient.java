package com.yuhan.wagglewaggle.domain.place.client;

import com.yuhan.wagglewaggle.domain.place.client.dto.KakaoKeywordResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class KakaoLocalClient {

    private static final String KEYWORD_SEARCH_PATH = "/v2/local/search/keyword.json";

    private final RestClient kakaoRestClient;

    public KakaoLocalClient(RestClient kakaoRestClient) {
        this.kakaoRestClient = kakaoRestClient;
    }

    public KakaoKeywordResponse searchKeyword(String keyword, double latitude, double longitude, int radius) {
        return kakaoRestClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path(KEYWORD_SEARCH_PATH)
                        .queryParam("query", keyword)
                        .queryParam("x", longitude)
                        .queryParam("y", latitude)
                        .queryParam("radius", radius)
                        .queryParam("sort", "accuracy")
                        .build())
                .retrieve()
                .body(KakaoKeywordResponse.class);
    }

    /**
     * 좌표 없이 키워드만으로 검색한다(x/y/radius 미포함).
     * 장소 검색 확정에서 우리 DB에 없는 장소의 주소·전화번호를 kakaoPlaceId 매칭으로 얻기 위해 사용한다.
     */
    public KakaoKeywordResponse searchKeywordOnly(String query, int page, int size, String sort) {
        return kakaoRestClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path(KEYWORD_SEARCH_PATH)
                        .queryParam("query", query)
                        .queryParam("page", page)
                        .queryParam("size", size)
                        .queryParam("sort", sort)
                        .build())
                .retrieve()
                .body(KakaoKeywordResponse.class);
    }

    /**
     * 특정 좌표 주변을 정렬 기준(sort)과 페이지 조건을 지정해 키워드 검색한다.
     * 지도 장소 조회에서 장소별 주소·전화번호를 실시간으로 얻기 위해 사용한다.
     */
    public KakaoKeywordResponse searchNearby(
            String query, double longitude, double latitude, int radius, int page, int size, String sort) {
        return kakaoRestClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path(KEYWORD_SEARCH_PATH)
                        .queryParam("query", query)
                        .queryParam("x", longitude)
                        .queryParam("y", latitude)
                        .queryParam("radius", radius)
                        .queryParam("page", page)
                        .queryParam("size", size)
                        .queryParam("sort", sort)
                        .build())
                .retrieve()
                .body(KakaoKeywordResponse.class);
    }
}
