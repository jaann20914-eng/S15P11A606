package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;
import java.util.UUID;

/**
 * 오늘 등록 핀 목록의 커서 값(정렬 기준 createdAt·pinId)을 담는 불투명 커서.
 *
 * <p>정렬은 createdAt 내림차순, pinId 내림차순이므로 커서는 마지막 항목의 (createdAt, pinId)를 담는다.
 * 직렬화 형식({@code epochSecond:nano:uuid})은 Base64URL(패딩 없음)로 인코딩해 Front에는 불투명 문자열로만 노출한다.
 * 형식이 잘못되었거나 해석할 수 없는 커서는 {@link ErrorCode#INVALID_PAGINATION}으로 거부한다.</p>
 */
public record TodayPinCursor(Instant createdAt, UUID id) {

    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();
    private static final String DELIMITER = ":";
    private static final int EXPECTED_PARTS = 3;
    private static final int MAX_NANO = 999_999_999;

    /**
     * 커서를 Base64URL 불투명 문자열로 인코딩한다.
     */
    public String encode() {
        String raw = createdAt.getEpochSecond() + DELIMITER + createdAt.getNano() + DELIMITER + id;
        return ENCODER.encodeToString(raw.getBytes(StandardCharsets.UTF_8));
    }

    /**
     * 불투명 커서 문자열을 파싱한다. 형식이 잘못되었거나 해석할 수 없으면 INVALID_PAGINATION으로 실패한다.
     */
    public static TodayPinCursor decode(String cursor) {
        try {
            String raw = new String(DECODER.decode(cursor), StandardCharsets.UTF_8);
            // uuid에는 ':'가 없으므로 정확히 3개로 분리된다.
            String[] parts = raw.split(DELIMITER);
            if (parts.length != EXPECTED_PARTS) {
                throw new CustomException(ErrorCode.INVALID_PAGINATION);
            }
            long epochSecond = Long.parseLong(parts[0]);
            int nano = Integer.parseInt(parts[1]);
            if (nano < 0 || nano > MAX_NANO) {
                throw new CustomException(ErrorCode.INVALID_PAGINATION);
            }
            UUID id = UUID.fromString(parts[2]);
            return new TodayPinCursor(Instant.ofEpochSecond(epochSecond, nano), id);
        } catch (CustomException e) {
            throw e;
        } catch (RuntimeException e) {
            // Base64 디코딩 실패·숫자 파싱 실패·UUID 형식 오류 등 모든 해석 불가 커서
            throw new CustomException(ErrorCode.INVALID_PAGINATION);
        }
    }
}
