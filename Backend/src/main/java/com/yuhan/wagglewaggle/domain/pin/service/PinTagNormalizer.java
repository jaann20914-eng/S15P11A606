package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 핀 태그 정규화·검증 책임(등록·수정 공용).
 * 규칙: 앞뒤 공백 제거 → 각 태그는 1자 이상 30자 이하 → 정규화 후 중복 금지 → 최대 3개.
 * tags가 null이면 빈 목록으로 간주한다(선택 필드).
 * 위반 시 던질 오류 코드는 호출부가 지정한다(등록: INVALID_REQUEST, 수정: INVALID_PIN_UPDATE_REQUEST).
 */
@Component
public class PinTagNormalizer {

    private static final int MAX_TAG_COUNT = 3;
    private static final int MAX_TAG_LENGTH = 30;

    /** 등록 흐름 호환용. 위반 시 INVALID_REQUEST를 던진다. */
    public List<String> normalizeAndValidate(List<String> rawTags) {
        return normalizeAndValidate(rawTags, ErrorCode.INVALID_REQUEST);
    }

    /** 위반 시 지정한 오류 코드를 던진다. */
    public List<String> normalizeAndValidate(List<String> rawTags, ErrorCode errorCode) {
        if (rawTags == null || rawTags.isEmpty()) {
            return List.of();
        }
        if (rawTags.size() > MAX_TAG_COUNT) {
            throw new CustomException(errorCode);
        }

        Set<String> deduped = new LinkedHashSet<>();
        List<String> normalized = new ArrayList<>();
        for (String rawTag : rawTags) {
            if (rawTag == null) {
                throw new CustomException(errorCode);
            }
            String tag = rawTag.trim();
            if (tag.isEmpty() || tag.length() > MAX_TAG_LENGTH) {
                throw new CustomException(errorCode);
            }
            if (!deduped.add(tag)) {
                throw new CustomException(errorCode);
            }
            normalized.add(tag);
        }
        return List.copyOf(normalized);
    }
}
