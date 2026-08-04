package com.yuhan.wagglewaggle.global.text;

import java.text.BreakIterator;

/**
 * 문자열의 "사람이 보는 글자 수"(자소 클러스터, grapheme cluster) 개수를 센다.
 *
 * <p>{@link String#length()}는 UTF-16 코드 유닛을 세므로 BMP 밖 이모지(😀)는 2, ZWJ 조합
 * 이모지(👨‍👩‍👧‍👦)나 피부색 조합은 더 크게 계산된다. 사용자가 화면에서 보는 글자 수 기준으로
 * 길이를 제한하려면 자소 클러스터 단위로 세야 한다.</p>
 *
 * <p>{@link BreakIterator#getCharacterInstance()}가 자소 클러스터 경계를 제공한다.</p>
 */
public final class GraphemeCounter {

    private GraphemeCounter() {
    }

    /**
     * 자소 클러스터(사람이 보는 글자) 개수를 반환한다. null·빈 문자열은 0.
     */
    public static int count(String text) {
        if (text == null || text.isEmpty()) {
            return 0;
        }
        BreakIterator iterator = BreakIterator.getCharacterInstance();
        iterator.setText(text);
        int count = 0;
        while (iterator.next() != BreakIterator.DONE) {
            count++;
        }
        return count;
    }
}
