package com.yuhan.wagglewaggle.global.exception;


import com.yuhan.wagglewaggle.global.response.ErrorResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.BindException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;

@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * Bean Validation 오류 메시지 출력을 위한 메서드 - console에 출력
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidationException(
            MethodArgumentNotValidException e
    ) {

        e.getBindingResult()
                .getFieldErrors()
                .forEach(error ->
                        log.warn("{} : {}",
                                error.getField(),
                                error.getDefaultMessage()));

        return ResponseEntity
                .badRequest()
                .body(ErrorResponse.of(ErrorCode.INVALID_REQUEST));
    }
    /**
     * 직접 정의한 예외 처리
     */
    @ExceptionHandler(CustomException.class)
    public ResponseEntity<ErrorResponse> handleException(CustomException e) {
        ErrorCode errorCode = e.getErrorCode();

        return ResponseEntity
                .status(errorCode.getStatus())
                .body(ErrorResponse.of(errorCode));
    }

    /**
     * 클라이언트 요청 자체가 잘못됐을 때 - 400 Bad Request
     * BindException - @ModelAttribute나 쿼리 파라미터 바인딩 검증 실패
     * MissingServletRequestParameterException - 필수 요청 파라미터가 없을 때
     * MethodArgumentTypeMismatchException - 타입이 안 맞을 때
     * HttpMessageNotReadableException - JSON 요청 본문이 잘못됐을 때
     * ConstraintViolationException - Bean Validation 검증이 실패했을 때
     * HandlerMethodValidationException - 컨트롤러 메서드 파라미터 검증 실패
     */
    @ExceptionHandler({
            BindException.class,
            MissingServletRequestParameterException.class,
            MethodArgumentTypeMismatchException.class,
            HttpMessageNotReadableException.class,
            HandlerMethodValidationException.class
    })
    public ResponseEntity<ErrorResponse> handleInvalidRequestException(Exception e) {
        log.warn("Invalid request: {}", e.getMessage());

        return ResponseEntity
                .badRequest()
                .body(ErrorResponse.of(ErrorCode.INVALID_REQUEST));

    }

    /**
     * HTTP Method 오류
     */
    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    public ResponseEntity<ErrorResponse> handleMethodNotSupportedException(HttpRequestMethodNotSupportedException e) {
        log.warn("Method not supported: {}", e.getMessage());

        return ResponseEntity
                .badRequest()
                .body(ErrorResponse.of(ErrorCode.INVALID_REQUEST));
    }

    /**
     * 나머지 못잡는 예외
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleException(Exception e) {
        log.error("Unexpected server error", e);

        return ResponseEntity
                .internalServerError()
                .body(ErrorResponse.of(ErrorCode.INTERNAL_SERVER_ERROR));
    }
}
