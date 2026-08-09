package com.yuhan.wagglewaggle.domain.pin.tag.service;

import org.springframework.stereotype.Component;

/**
 * 한글 문자열을 자모/초성 문자열로 변환하고, 검색어가 초성 전용 질의인지 판별한다.
 *
 * <p>Elasticsearch에는 (플러그인 없이) 자모/초성 tokenizer가 없으므로, 색인 side와 검색 side가
 * 이 컴포넌트로 미리 분해한 문자열을 각각 {@code tagJamo}/{@code tagChosung} 필드에 넣고 질의한다.
 * 색인과 검색이 반드시 같은 분해 규칙을 써야 매칭이 어긋나지 않으므로 로직을 한 곳에 모은다.</p>
 *
 * <ul>
 *   <li>{@link #decomposeToJamo(String)} : "카페" → "ㅋㅏㅍㅔ" (오탈자 매칭의 기반)</li>
 *   <li>{@link #extractChosung(String)} : "최애카페" → "ㅊㅇㅋㅍ" (초성 검색)</li>
 *   <li>{@link #isChosungQuery(String)} : "ㅋㅍ" → true (초성 모드 분기)</li>
 * </ul>
 *
 * <p>완성형 한글(U+AC00~U+D7A3)만 분해하고, 그 외 문자(영문·숫자·이미 분해된 자모·이모지 등)는
 * 그대로 통과시킨다. 겹받침(ㄳ, ㄵ 등)은 더 쪼개지 않고 호환 자모 1글자로 유지한다
 * (색인·검색이 동일 규칙을 쓰므로 매칭에는 문제없다).</p>
 */
@Component
public class HangulDecomposer {

    // 완성형 한글 음절 블록 경계
    private static final int SYLLABLE_BASE = 0xAC00; // '가'
    private static final int SYLLABLE_LAST = 0xD7A3; // '힣'
    private static final int MEDIAL_COUNT = 21;      // 중성 개수
    private static final int FINAL_COUNT = 28;       // 종성 개수(받침 없음 포함)
    private static final int MEDIAL_FINAL_COUNT = MEDIAL_COUNT * FINAL_COUNT; // 588

    // 초성 19자 (index → 호환 자모)
    private static final char[] INITIALS = {
            'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
            'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
    };

    // 중성 21자
    private static final char[] MEDIALS = {
            'ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ',
            'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'
    };

    // 종성 28자 (index 0 = 받침 없음)
    private static final char[] FINALS = {
            '\0', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ',
            'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ',
            'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'
    };

    // 자음 호환 자모 범위(ㄱ~ㅎ). 초성 전용 질의 판별에 쓴다(모음은 0x314F 이상이라 제외된다).
    private static final char CONSONANT_FIRST = 0x3131; // 'ㄱ'
    private static final char CONSONANT_LAST = 0x314E;  // 'ㅎ'
    // 자음 1글자는 완성 음절을 입력하다 만 상태와 구분되지 않으므로 초성 질의로 보지 않는다.
    private static final int CHOSUNG_MIN_LENGTH = 2;

    /** 완성형 한글을 초성+중성+(종성) 자모 문자열로 분해한다. 그 외 문자는 그대로 통과. */
    public String decomposeToJamo(String text) {
        if (text == null || text.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        text.codePoints().forEach(cp -> {
            if (isSyllable(cp)) {
                int index = cp - SYLLABLE_BASE;
                sb.append(INITIALS[index / MEDIAL_FINAL_COUNT]);
                sb.append(MEDIALS[(index % MEDIAL_FINAL_COUNT) / FINAL_COUNT]);
                int finalIndex = index % FINAL_COUNT;
                if (finalIndex != 0) {
                    sb.append(FINALS[finalIndex]);
                }
            } else {
                sb.appendCodePoint(cp);
            }
        });
        return sb.toString();
    }

    /** 각 완성형 음절의 초성만 추출한다. 그 외 문자는 그대로 통과. */
    public String extractChosung(String text) {
        if (text == null || text.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        text.codePoints().forEach(cp -> {
            if (isSyllable(cp)) {
                int index = cp - SYLLABLE_BASE;
                sb.append(INITIALS[index / MEDIAL_FINAL_COUNT]);
            } else {
                sb.appendCodePoint(cp);
            }
        });
        return sb.toString();
    }

    /** 자음 자모(ㄱ~ㅎ)로만 이루어진 2글자 이상이면 초성 전용 질의로 본다. */
    public boolean isChosungQuery(String text) {
        if (text == null || text.length() < CHOSUNG_MIN_LENGTH) {
            return false;
        }
        return text.chars().allMatch(c -> c >= CONSONANT_FIRST && c <= CONSONANT_LAST);
    }

    private boolean isSyllable(int codePoint) {
        return codePoint >= SYLLABLE_BASE && codePoint <= SYLLABLE_LAST;
    }
}
