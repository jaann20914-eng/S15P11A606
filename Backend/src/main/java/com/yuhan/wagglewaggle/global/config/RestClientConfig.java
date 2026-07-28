package com.yuhan.wagglewaggle.global.config;

import com.yuhan.wagglewaggle.global.properties.KakaoProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.time.Duration;

@Configuration
@EnableConfigurationProperties(KakaoProperties.class)
public class RestClientConfig {

    @Bean
    public RestClient kakaoRestClient(KakaoProperties kakaoProperties) {
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofMillis(kakaoProperties.connectTimeoutMs()));
        requestFactory.setReadTimeout(Duration.ofMillis(kakaoProperties.readTimeoutMs()));

        return RestClient.builder()
                .baseUrl(kakaoProperties.baseUrl())
                .defaultHeader("Authorization", "KakaoAK " + kakaoProperties.restApiKey())
                .requestFactory(requestFactory)
                .build();
    }
}
