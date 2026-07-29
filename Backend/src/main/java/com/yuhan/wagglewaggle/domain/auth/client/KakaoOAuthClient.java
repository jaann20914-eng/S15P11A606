package com.yuhan.wagglewaggle.domain.auth.client;

import com.yuhan.wagglewaggle.domain.auth.client.dto.KakaoTokenResponse;
import com.yuhan.wagglewaggle.domain.auth.client.dto.KakaoUserInfoResponse;
import com.yuhan.wagglewaggle.domain.auth.entity.OAuthProvider;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.properties.KakaoOAuthProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Slf4j
@Component
public class KakaoOAuthClient implements OAuthClient {

    private static final String TOKEN_PATH = "/oauth/token";
    private static final String USER_INFO_PATH = "/v2/user/me";

    private final RestClient kakaoAuthRestClient;
    private final RestClient kakaoApiRestClient;
    private final KakaoOAuthProperties properties;

    public KakaoOAuthClient(RestClient kakaoAuthRestClient,
                            RestClient kakaoApiRestClient,
                            KakaoOAuthProperties properties) {
        this.kakaoAuthRestClient = kakaoAuthRestClient;
        this.kakaoApiRestClient = kakaoApiRestClient;
        this.properties = properties;
    }

    @Override
    public OAuthProvider provider() {
        return OAuthProvider.KAKAO;
    }

    @Override
    public String exchangeToken(String authorizationCode, String state) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("grant_type", "authorization_code");
        form.add("client_id", properties.clientId());
        form.add("redirect_uri", properties.redirectUri());
        form.add("code", authorizationCode);
        if (StringUtils.hasText(properties.clientSecret())) {
            form.add("client_secret", properties.clientSecret());
        }

        try {
            KakaoTokenResponse response = kakaoAuthRestClient.post()
                    .uri(TOKEN_PATH)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(KakaoTokenResponse.class);

            if (response == null || !StringUtils.hasText(response.accessToken())) {
                throw new CustomException(ErrorCode.AUTH_OAUTH_FAILED);
            }
            return response.accessToken();
        } catch (RestClientException e) {
            log.error("카카오 토큰 교환 실패: {}", e.getMessage());
            throw new CustomException(ErrorCode.AUTH_OAUTH_FAILED);
        }
    }

    @Override
    public OAuthUserInfo getUserInfo(String providerAccessToken) {
        try {
            KakaoUserInfoResponse response = kakaoApiRestClient.get()
                    .uri(USER_INFO_PATH)
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + providerAccessToken)
                    .retrieve()
                    .body(KakaoUserInfoResponse.class);

            if (response == null || response.id() == null) {
                throw new CustomException(ErrorCode.AUTH_OAUTH_FAILED);
            }
            return new OAuthUserInfo(String.valueOf(response.id()), response.email());
        } catch (RestClientException e) {
            log.error("카카오 사용자 정보 조회 실패: {}", e.getMessage());
            throw new CustomException(ErrorCode.AUTH_OAUTH_FAILED);
        }
    }
}
