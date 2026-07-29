package com.yuhan.wagglewaggle.domain.auth.controller;

import com.yuhan.wagglewaggle.domain.auth.entity.OAuthProvider;
import com.yuhan.wagglewaggle.global.properties.AppOAuthProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.util.UriComponentsBuilder;

import java.net.URI;
import java.nio.charset.StandardCharsets;

/**
 * 웹 OAuth 콜백 브리지.
 * <p>
 * 카카오/네이버는 앱의 커스텀 스킴({@code waglewagle://})으로 직접 리다이렉트할 수 없어
 * https 콜백({@code /oauth/callback/{provider}})으로 인가 코드를 돌려준다. 이 컨트롤러는
 * 받은 {@code code}/{@code state}를 그대로 앱 스킴으로 302 리다이렉트하고, 실제 토큰 교환은
 * 앱이 {@code POST /api/v1/auth/oauth/{provider}} 로 수행한다(여기서는 교환하지 않는다).
 */
@Slf4j
@RestController
@RequiredArgsConstructor
@RequestMapping("/oauth/callback")
public class OAuthCallbackController {

    private final AppOAuthProperties appOAuthProperties;

    @GetMapping("/{provider}")
    public ResponseEntity<Void> callback(
            @PathVariable String provider,
            @RequestParam(required = false) String code,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String error,
            @RequestParam(name = "error_description", required = false) String errorDescription
    ) {
        // 지원 프로바이더만 허용하고 경로 표기를 소문자로 정규화한다(미지원 시 400 JSON).
        String normalizedProvider = OAuthProvider.from(provider).toLowerCase();

        UriComponentsBuilder builder = UriComponentsBuilder
                .fromUriString(appOAuthProperties.callbackScheme() + "://oauth/callback/" + normalizedProvider);

        if (StringUtils.hasText(code)) {
            builder.queryParam("code", code);
        }
        if (StringUtils.hasText(state)) {
            builder.queryParam("state", state);
        }
        if (StringUtils.hasText(error)) {
            builder.queryParam("error", error);
        }
        if (StringUtils.hasText(errorDescription)) {
            builder.queryParam("error_description", errorDescription);
        }
        // 정상 코드도 프로바이더 에러도 없는 비정상 콜백은 앱이 실패로 처리할 수 있게 표시한다.
        if (!StringUtils.hasText(code) && !StringUtils.hasText(error)) {
            builder.queryParam("error", "invalid_request");
        }

        URI location = builder.encode(StandardCharsets.UTF_8).build().toUri();
        log.info("OAuth 콜백 → 앱 스킴 리다이렉트: provider={}, hasCode={}, hasError={}",
                normalizedProvider, StringUtils.hasText(code), StringUtils.hasText(error));

        return ResponseEntity.status(HttpStatus.FOUND).location(location).build();
    }
}
