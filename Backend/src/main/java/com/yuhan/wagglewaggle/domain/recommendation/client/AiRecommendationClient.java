package com.yuhan.wagglewaggle.domain.recommendation.client;

import com.yuhan.wagglewaggle.domain.recommendation.client.dto.ScoreRequest;
import com.yuhan.wagglewaggle.domain.recommendation.client.dto.ScoreResponse;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

/**
 * AI 추천점수 API(POST /api/v1/internal/recommendations/score) 동기 호출 클라이언트.
 * 타임아웃(read 2초)·5xx·4xx·응답 형식 오류·null은 모두 AI_RECOMMENDATION_FAILED(502)로 매핑한다.
 * 재시도나 폴백은 하지 않는다(스펙).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AiRecommendationClient {

    private static final String SCORE_PATH = "/api/v1/internal/recommendations/score";

    // RestClientConfig의 aiRecommendationRestClient 빈을 이름으로 주입받는다(타임아웃·내부키 헤더 적용됨).
    private final RestClient aiRecommendationRestClient;

    public ScoreResponse score(ScoreRequest request) {
        try {
            ScoreResponse response = aiRecommendationRestClient.post()
                    .uri(SCORE_PATH)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(ScoreResponse.class);

            if (response == null || response.relaxedList() == null || response.wagleList() == null) {
                log.error("AI 추천점수 응답이 유효하지 않습니다.");
                throw new CustomException(ErrorCode.AI_RECOMMENDATION_FAILED);
            }
            return response;
        } catch (CustomException e) {
            throw e;
        } catch (RestClientException e) {
            // 타임아웃(ResourceAccessException)·5xx·4xx(RestClientResponseException)·역직렬화 오류 등을 포괄한다.
            log.error("AI 추천점수 호출 실패: {}", e.getMessage());
            throw new CustomException(ErrorCode.AI_RECOMMENDATION_FAILED);
        }
    }
}
