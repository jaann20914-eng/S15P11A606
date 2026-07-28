package com.yuhan.wagglewaggle.domain.place.client;

import com.yuhan.wagglewaggle.domain.place.client.dto.KakaoKeywordResponse;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import static org.junit.jupiter.api.Assertions.assertNotNull;

/**
 * 실제 카카오 로컬 API를 호출해 KakaoLocalClient 동작/응답 매핑을 확인하는 검증 테스트.
 * KAKAO_REST_API_KEY 환경변수가 없으면 건너뛴다.
 */
class KakaoLocalClientManualTest {

    @Test
    void searchKeyword_realCall() {
        String apiKey = System.getenv("KAKAO_REST_API_KEY");
        Assumptions.assumeTrue(
                apiKey != null && !apiKey.isBlank(),
                "KAKAO_REST_API_KEY 환경변수가 없어 테스트를 건너뜁니다."
        );

        RestClient kakaoRestClient = RestClient.builder()
                .baseUrl("https://dapi.kakao.com")
                .defaultHeader("Authorization", "KakaoAK " + apiKey)
                .build();

        KakaoLocalClient client = new KakaoLocalClient(kakaoRestClient);

        KakaoKeywordResponse response = client.searchKeyword("카페", 37.5012, 127.0391, 20);

        assertNotNull(response);
        assertNotNull(response.documents());

        System.out.println("=== 카카오 응답 문서 개수: " + response.documents().size() + " ===");
        response.documents().forEach(d ->
                System.out.printf("[%s] %s | %s | x=%s y=%s dist=%sm%n",
                        d.id(), d.placeName(), d.addressName(), d.x(), d.y(), d.distance()));
    }
}
