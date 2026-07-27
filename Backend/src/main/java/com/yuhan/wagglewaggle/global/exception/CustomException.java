package com.yuhan.wagglewaggle.global.exception;

import lombok.Getter;

/**
 * throw new CustomException(ErrorCode.CHALLENGE_NOT_FOUND)
 * 이런식으로 사용
 * 공용으로 처리 CustomException을 만들기 위한 클래스
 */
@Getter
public class CustomException extends RuntimeException{

    private final ErrorCode errorCode;

    public CustomException(ErrorCode errorCode) {
        super(errorCode.getMessage());
        this.errorCode = errorCode;
    }
}
