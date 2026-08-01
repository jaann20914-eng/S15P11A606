package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * 핀 등록 태그 정규화·검증 책임.
 * 규칙: 앞뒤 공백 제거 → 각 태그는 1자 이상 30자 이하 → 정규화 후 중복 금지 → 최대 3개.
 * 위반 시 INVALID_REQUEST. tags가 null이면 빈 목록으로 간주한다(선택 필드).
 */
@Component
public class PinTagNormalizer {

    private static final int MAX_TAG_COUNT = 3;
    private static final int MAX_TAG_LENGTH = 30;

    public List<String> normalizeAndValidate(List<String> rawTags) {
        if (rawTags == null || rawTags.isEmpty()) {
            return List.of();
        }
        if (rawTags.size() > MAX_TAG_COUNT) {
            throw new CustomException(ErrorCode.INVALID_REQUEST);
        }

        Set<String> deduped = new LinkedHashSet<>();
        List<String> normalized = new ArrayList<>();
        for (String rawTag : rawTags) {
            if (rawTag == null) {
                throw new CustomException(ErrorCode.INVALID_REQUEST);
            }
            String tag = rawTag.trim();
            if (tag.isEmpty() || tag.length() > MAX_TAG_LENGTH) {
                throw new CustomException(ErrorCode.INVALID_REQUEST);
            }
            if (!deduped.add(tag)) {
                throw new CustomException(ErrorCode.INVALID_REQUEST);
            }
            normalized.add(tag);
        }
        return List.copyOf(normalized);
    }
}
