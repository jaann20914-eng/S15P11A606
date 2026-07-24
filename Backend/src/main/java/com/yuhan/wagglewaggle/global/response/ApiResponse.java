package com.yuhan.wagglewaggle.global.response;

import lombok.AllArgsConstructor;
import lombok.Getter;

/**
 * 공용 응답 처리 클래스
 */
@Getter
@AllArgsConstructor
public class ApiResponse<T> {

    private int statusCode;
    private String message;
    private T data;

    public static <T> ApiResponse<T> success(int statusCode, String message, T data) {
        return new ApiResponse<>(statusCode, message, data);
    }

    public static ApiResponse<Void> success(int statusCode, String message) {
        return new ApiResponse<>(statusCode, message, null);
    }
}
