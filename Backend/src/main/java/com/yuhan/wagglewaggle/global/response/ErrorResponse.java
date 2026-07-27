package com.yuhan.wagglewaggle.global.response;

import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.Builder;
import lombok.Getter;

/**
 * CustomException에 담긴 ErrorCode를 이용해서 클라이언트에게 보낼 에러 응답 객체를 만드는 역할
 */
@Getter
@Builder
public class ErrorResponse {

    private int statusCode;
    private String message;
    private ErrorDetail error;

    /**
     * 나중에 에러 정보를 더 넣고 싶을 수도 있기에
     * 확장성을 고려할 수 있고
     * {
     *   "error": {
     *     "code": "USER_NOT_FOUND"
     *   }
     * }
     * 이런식으로 error를 {} 로 묶어서 표현할 수 있기에 이렇게 이렇게 표현
     */
    @Getter
    @Builder
    public static class ErrorDetail {
        private String code;
    }

    /**
     * ErrorResponse {
     *     statusCode = 404,
     *     message = "존재하지 않는 챌린지입니다.",
     *     error = ErrorDetail {
     *         code = "CHALLENGE_NOT_FOUND"
     *     }
     * }
     * 이와 같은 모습으로 객체가 생성됨
     */
    public static ErrorResponse of(ErrorCode errorCode) {
        return ErrorResponse.builder()
                .statusCode(errorCode.getStatus().value())
                .message(errorCode.getMessage())
                .error(ErrorDetail.builder()
                        .code(errorCode.name())
                        .build())
                .build();
    }
}
