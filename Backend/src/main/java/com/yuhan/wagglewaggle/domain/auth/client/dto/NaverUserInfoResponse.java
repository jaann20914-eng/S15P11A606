package com.yuhan.wagglewaggle.domain.auth.client.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record NaverUserInfoResponse(
        String resultcode,
        String message,
        Response response
) {
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record Response(
            String id,
            String email
    ) {
    }
}
