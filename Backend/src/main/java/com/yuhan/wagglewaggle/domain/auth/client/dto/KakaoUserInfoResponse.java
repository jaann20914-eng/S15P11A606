package com.yuhan.wagglewaggle.domain.auth.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

@JsonIgnoreProperties(ignoreUnknown = true)
public record KakaoUserInfoResponse(
        Long id,
        @JsonProperty("kakao_account") KakaoAccount kakaoAccount
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record KakaoAccount(
            String email
    ) {
    }

    public String email() {
        return kakaoAccount == null ? null : kakaoAccount.email();
    }
}
