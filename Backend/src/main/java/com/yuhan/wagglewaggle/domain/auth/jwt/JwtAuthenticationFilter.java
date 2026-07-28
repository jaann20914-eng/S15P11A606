package com.yuhan.wagglewaggle.domain.auth.jwt;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Collections;

/**
 * Access 토큰(purpose=ACCESS)만 인증으로 처리하는 필터.
 * ONBOARDING/REFRESH 등 다른 purpose나 유효하지 않은 토큰은 인증을 설정하지 않는다.
 * (SecurityConfig에서 직접 생성해 필터체인에만 등록한다. @Component로 두면 서블릿 필터에도 중복 등록됨)
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BEARER_PREFIX = "Bearer ";

    private final JwtProvider jwtProvider;

    public JwtAuthenticationFilter(JwtProvider jwtProvider) {
        this.jwtProvider = jwtProvider;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String token = resolveToken(request);
        if (token != null) {
            try {
                Claims claims = jwtProvider.parse(token);
                if (jwtProvider.getPurpose(claims) == TokenPurpose.ACCESS) {
                    Long memberId = Long.valueOf(claims.getSubject());
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(memberId, null, Collections.emptyList());
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
                // ACCESS가 아니면 인증을 설정하지 않는다 → 보호 경로에서 EntryPoint가 401 처리
            } catch (Exception e) {
                // 서명/만료/형식 오류 등 → 인증 미설정
                SecurityContextHolder.clearContext();
            }
        }
        filterChain.doFilter(request, response);
    }

    private String resolveToken(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header != null && header.startsWith(BEARER_PREFIX)) {
            return header.substring(BEARER_PREFIX.length());
        }
        return null;
    }
}
