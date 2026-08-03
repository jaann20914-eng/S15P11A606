package com.yuhan.wagglewaggle.global.security;

import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

/**
 * 내부 시스템 전용 경로(/api/v1/internal/**)에 대해 X-Internal-Secret 헤더를 검증하는 필터.
 * 값이 없거나 설정된 시크릿과 다르면 401을 직접 응답하고 체인을 중단한다(상수시간 비교).
 * 내부 경로가 아니면 아무 검증 없이 통과시킨다. JWT 필터보다 앞에 등록해 내부 호출을 먼저 가린다.
 */
public class InternalSecretAuthFilter extends OncePerRequestFilter {

    private static final String INTERNAL_PATH_PREFIX = "/api/v1/internal/";
    private static final String HEADER = "X-Internal-Secret";

    private final byte[] expectedSecret;

    public InternalSecretAuthFilter(String secret) {
        this.expectedSecret = secret == null ? new byte[0] : secret.getBytes(StandardCharsets.UTF_8);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        if (!request.getRequestURI().startsWith(INTERNAL_PATH_PREFIX)) {
            filterChain.doFilter(request, response);
            return;
        }

        if (!matchesSecret(request.getHeader(HEADER))) {
            writeUnauthorized(response);
            return;
        }

        filterChain.doFilter(request, response);
    }

    private boolean matchesSecret(String provided) {
        if (provided == null || expectedSecret.length == 0) {
            return false;
        }
        return MessageDigest.isEqual(expectedSecret, provided.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * SecurityConfig.writeError와 동일한 ErrorResponse JSON 형태로 직접 응답한다.
     */
    private void writeUnauthorized(HttpServletResponse response) throws IOException {
        ErrorCode errorCode = ErrorCode.INTERNAL_UNAUTHORIZED;
        response.setStatus(errorCode.getStatus().value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        String body = String.format(
                "{\"statusCode\":%d,\"message\":\"%s\",\"error\":{\"code\":\"%s\"}}",
                errorCode.getStatus().value(), errorCode.getMessage(), errorCode.name());
        response.getWriter().write(body);
    }
}
