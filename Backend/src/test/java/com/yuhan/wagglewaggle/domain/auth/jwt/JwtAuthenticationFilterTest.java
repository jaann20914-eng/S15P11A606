package com.yuhan.wagglewaggle.domain.auth.jwt;

import com.yuhan.wagglewaggle.domain.auth.entity.OAuthProvider;
import com.yuhan.wagglewaggle.global.properties.JwtProperties;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class JwtAuthenticationFilterTest {

    private static final String SECRET = "test-secret-key-that-is-at-least-32-bytes-long!!";

    private final JwtProvider jwtProvider =
            new JwtProvider(new JwtProperties(SECRET, "wagglewaggle-test", 3600, 1209600, 600));
    private final JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwtProvider);

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    private void doFilter(String authorizationHeader) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        if (authorizationHeader != null) {
            request.addHeader("Authorization", authorizationHeader);
        }
        filter.doFilter(request, new MockHttpServletResponse(), new MockFilterChain());
    }

    @Test
    void ACCESS_토큰이면_인증이_설정된다() throws Exception {
        String token = jwtProvider.createAccessToken(42L);

        doFilter("Bearer " + token);

        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        assertNotNull(authentication);
        assertEquals(42L, authentication.getPrincipal());
    }

    @Test
    void ONBOARDING_토큰이면_인증이_설정되지_않는다() throws Exception {
        String token = jwtProvider.createOnboardingToken(7L, OAuthProvider.KAKAO,
                "33333333-3333-3333-3333-333333333333");

        doFilter("Bearer " + token);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void REFRESH_토큰이면_인증이_설정되지_않는다() throws Exception {
        String token = jwtProvider.createRefreshToken(99L);

        doFilter("Bearer " + token);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void 토큰이_없으면_인증이_설정되지_않는다() throws Exception {
        doFilter(null);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }

    @Test
    void 잘못된_토큰이면_인증이_설정되지_않는다() throws Exception {
        doFilter("Bearer not-a-valid-jwt");

        assertNull(SecurityContextHolder.getContext().getAuthentication());
    }
}
