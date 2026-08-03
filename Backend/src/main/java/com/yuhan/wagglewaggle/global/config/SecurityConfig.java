package com.yuhan.wagglewaggle.global.config;

import com.yuhan.wagglewaggle.domain.auth.jwt.JwtAuthenticationFilter;
import com.yuhan.wagglewaggle.domain.auth.jwt.JwtProvider;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.properties.InternalApiProperties;
import com.yuhan.wagglewaggle.global.security.InternalSecretAuthFilter;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.MediaType;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(InternalApiProperties.class)
@RequiredArgsConstructor
public class SecurityConfig {

    private static final String[] PUBLIC_PATHS = {
            "/api/v1/auth/**",
            // 내부 시스템(AI Worker) 전용 콜백. JWT 대신 X-Internal-Secret 헤더로 InternalSecretAuthFilter가 검증한다.
            "/api/v1/internal/**",
            // 닉네임 중복 확인은 온보딩·닉네임 수정 전에 신원 없이 호출하므로 공개한다.
            // (/api/v1/users/** 전체가 아니라 이 엔드포인트만 연다.)
            "/api/v1/users/nickname-availability",
            // 온보딩 토큰(purpose=ONBOARDING)은 공용 JwtAuthenticationFilter가 인증하지 않으므로,
            // 경로를 permitAll로 열고 온보딩 서비스에서 토큰을 직접 검증한다.
            "/api/v1/onboarding",
            "/oauth/callback/**",
            // WebSocket 핸드셰이크(HTTP 업그레이드)는 서블릿 요청이지만 Authorization 헤더를 싣지 않는다.
            // 실제 인증은 STOMP CONNECT 프레임 단계(ChannelInterceptor)에서 수행하므로 핸드셰이크는 열어 둔다.
            "/ws/**"
    };

    private final JwtProvider jwtProvider;
    private final InternalApiProperties internalApiProperties;

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .csrf(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(PUBLIC_PATHS).permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(handler -> handler
                        .authenticationEntryPoint(authenticationEntryPoint())
                        .accessDeniedHandler(accessDeniedHandler()))
                .addFilterBefore(new JwtAuthenticationFilter(jwtProvider),
                        UsernamePasswordAuthenticationFilter.class)
                // 내부 콜백은 JWT 인증 전에 공유 시크릿으로 먼저 가린다.
                .addFilterBefore(new InternalSecretAuthFilter(internalApiProperties.secret()),
                        JwtAuthenticationFilter.class);

        return http.build();
    }

    private AuthenticationEntryPoint authenticationEntryPoint() {
        return (request, response, authException) -> writeError(response, ErrorCode.UNAUTHORIZED);
    }

    private AccessDeniedHandler accessDeniedHandler() {
        return (request, response, accessDeniedException) -> writeError(response, ErrorCode.FORBIDDEN);
    }

    /**
     * ErrorResponse와 동일한 JSON 형태로 직접 응답한다.
     * ({"statusCode":..,"message":"..","error":{"code":".."}})
     */
    private void writeError(HttpServletResponse response, ErrorCode errorCode) throws IOException {
        response.setStatus(errorCode.getStatus().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        String body = String.format(
                "{\"statusCode\":%d,\"message\":\"%s\",\"error\":{\"code\":\"%s\"}}",
                errorCode.getStatus().value(), errorCode.getMessage(), errorCode.name());
        response.getWriter().write(body);
    }
}
