package com.yuhan.wagglewaggle.domain.auth.entity;

import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;

/**
 * 지원하는 OAuth 제공자. DB의 social_provider_type에 대응한다.
 */
public enum OAuthProvider {
    KAKAO,
    NAVER;

    /**
     * Path 변수(kakao|naver)를 enum으로 변환한다.
     * 지원하지 않는 값이면 AUTH_PROVIDER_INVALID.
     */
    public static OAuthProvider from(String provider) {
        if (provider == null) {
            throw new CustomException(ErrorCode.AUTH_PROVIDER_INVALID);
        }
        return switch (provider.toLowerCase()) {
            case "kakao" -> KAKAO;
            case "naver" -> NAVER;
            default -> throw new CustomException(ErrorCode.AUTH_PROVIDER_INVALID);
        };
    }

    /**
     * JWT provider 클레임 등에 사용하는 소문자 표기.
     */
    public String toLowerCase() {
        return name().toLowerCase();
    }
}
