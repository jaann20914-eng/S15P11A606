package com.yuhan.wagglewaggle.global.config;

import com.yuhan.wagglewaggle.global.properties.KakaoProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

@Configuration
@EnableConfigurationProperties(KakaoProperties.class)
public class RestClientConfig {

    @Bean
    public RestClient kakaoRestClient(KakaoProperties kakaoProperties) {
        return RestClient.builder()
                .baseUrl(kakaoProperties.baseUrl())
                .defaultHeader("Authorization", "KakaoAK " + kakaoProperties.restApiKey())
                .build();
    }
}
