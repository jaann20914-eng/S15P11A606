package com.yuhan.wagglewaggle.global.config;

import com.yuhan.wagglewaggle.global.properties.JwtProperties;
import com.yuhan.wagglewaggle.global.properties.KakaoOAuthProperties;
import com.yuhan.wagglewaggle.global.properties.KakaoProperties;
import com.yuhan.wagglewaggle.global.properties.NaverOAuthProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties({
        KakaoProperties.class,
        JwtProperties.class,
        KakaoOAuthProperties.class,
        NaverOAuthProperties.class
})
public class RestClientConfig {

    @Bean
    public RestClient kakaoRestClient(KakaoProperties kakaoProperties) {
        return RestClient.builder()
                .baseUrl(kakaoProperties.baseUrl())
                .defaultHeader("Authorization", "KakaoAK " + kakaoProperties.restApiKey())
                .build();
    }

    @Bean
    public RestClient kakaoAuthRestClient(KakaoOAuthProperties kakaoOAuthProperties) {
        return RestClient.builder()
                .baseUrl(kakaoOAuthProperties.tokenUri())
                .build();
    }

    @Bean
    public RestClient kakaoApiRestClient(KakaoOAuthProperties kakaoOAuthProperties) {
        return RestClient.builder()
                .baseUrl(kakaoOAuthProperties.apiUri())
                .build();
    }

    @Bean
    public RestClient naverAuthRestClient(NaverOAuthProperties naverOAuthProperties) {
        return RestClient.builder()
                .baseUrl(naverOAuthProperties.tokenUri())
                .build();
    }

    @Bean
    public RestClient naverApiRestClient(NaverOAuthProperties naverOAuthProperties) {
        return RestClient.builder()
                .baseUrl(naverOAuthProperties.apiUri())
                .build();
    }
}
