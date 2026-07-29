package com.yuhan.wagglewaggle.domain.auth.controller;

import com.yuhan.wagglewaggle.domain.auth.dto.AuthStatus;
import com.yuhan.wagglewaggle.domain.auth.dto.OAuthLoginRequest;
import com.yuhan.wagglewaggle.domain.auth.dto.OAuthLoginResponse;
import com.yuhan.wagglewaggle.domain.auth.dto.TokenRefreshRequest;
import com.yuhan.wagglewaggle.domain.auth.dto.TokenRefreshResponse;
import com.yuhan.wagglewaggle.domain.auth.service.AuthService;
import com.yuhan.wagglewaggle.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;

    @PostMapping("/oauth/{provider}")
    public ApiResponse<OAuthLoginResponse> oauthLogin(
            @PathVariable String provider,
            @RequestBody OAuthLoginRequest request
    ) {
        OAuthLoginResponse data = authService.login(provider, request);
        String message = data.authStatus() == AuthStatus.AUTHENTICATED
                ? "OAuth 로그인이 완료되었습니다."
                : "온보딩이 필요합니다.";
        return ApiResponse.success(HttpStatus.OK.value(), message, data);
    }

    @PostMapping("/refresh")
    public ApiResponse<TokenRefreshResponse> refresh(
            @RequestBody(required = false) TokenRefreshRequest request
    ) {
        TokenRefreshResponse data = authService.refresh(request);
        return ApiResponse.success(
                HttpStatus.OK.value(),
                "액세스 토큰과 리프레시 토큰이 재발급되었습니다.",
                data);
    }
}
