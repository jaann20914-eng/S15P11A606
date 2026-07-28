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
}
