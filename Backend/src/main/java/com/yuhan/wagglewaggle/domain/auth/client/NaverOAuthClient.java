package com.yuhan.wagglewaggle.domain.auth.client;

import com.yuhan.wagglewaggle.domain.auth.client.dto.NaverTokenResponse;
import com.yuhan.wagglewaggle.domain.auth.client.dto.NaverUserInfoResponse;
import com.yuhan.wagglewaggle.domain.auth.entity.OAuthProvider;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.properties.NaverOAuthProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Slf4j
@Component
public class NaverOAuthClient implements OAuthClient {

    private static final String TOKEN_PATH = "/oauth2.0/token";
    private static final String USER_INFO_PATH = "/v1/nid/me";
    private static final String NAVER_SUCCESS_CODE = "00";

    private final RestClient naverAuthRestClient;
    private final RestClient naverApiRestClient;
    private final NaverOAuthProperties properties;

    public NaverOAuthClient(RestClient naverAuthRestClient,
                            RestClient naverApiRestClient,
                            NaverOAuthProperties properties) {
        this.naverAuthRestClient = naverAuthRestClient;
        this.naverApiRestClient = naverApiRestClient;
        this.properties = properties;
    }

    @Override
    public OAuthProvider provider() {
        return OAuthProvider.NAVER;
    }

    @Override
    public String exchangeToken(String authorizationCode, String state) {
        try {
            NaverTokenResponse response = naverAuthRestClient.get()
                    .uri(uriBuilder -> uriBuilder
                            .path(TOKEN_PATH)
                            .queryParam("grant_type", "authorization_code")
                            .queryParam("client_id", properties.clientId())
                            .queryParam("client_secret", properties.clientSecret())
                            .queryParam("code", authorizationCode)
                            .queryParam("state", state)
                            .build())
                    .retrieve()
                    .body(NaverTokenResponse.class);

            if (response == null || !StringUtils.hasText(response.accessToken())) {
                throw new CustomException(ErrorCode.AUTH_OAUTH_FAILED);
            }
            return response.accessToken();
        } catch (RestClientException e) {
            log.error("네이버 토큰 교환 실패: {}", e.getMessage());
            throw new CustomException(ErrorCode.AUTH_OAUTH_FAILED);
        }
    }

    @Override
    public OAuthUserInfo getUserInfo(String providerAccessToken) {
        try {
            NaverUserInfoResponse response = naverApiRestClient.get()
                    .uri(USER_INFO_PATH)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + providerAccessToken)
                    .retrieve()
                    .body(NaverUserInfoResponse.class);

            if (response == null
                    || !NAVER_SUCCESS_CODE.equals(response.resultcode())
                    || response.response() == null
                    || !StringUtils.hasText(response.response().id())) {
                throw new CustomException(ErrorCode.AUTH_OAUTH_FAILED);
            }
            return new OAuthUserInfo(response.response().id(), response.response().email());
        } catch (RestClientException e) {
            log.error("네이버 사용자 정보 조회 실패: {}", e.getMessage());
            throw new CustomException(ErrorCode.AUTH_OAUTH_FAILED);
        }
    }
}
