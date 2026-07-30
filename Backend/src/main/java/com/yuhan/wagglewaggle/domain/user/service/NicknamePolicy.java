package com.yuhan.wagglewaggle.domain.user.service;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * 닉네임 형식 검증·정규화 규칙을 한곳에 모은 공용 정책.
 * 온보딩과 닉네임 중복 확인 API가 동일한 규칙을 공유하도록 하기 위해 존재한다.
 * 에러 코드는 호출부마다 다르므로(온보딩=INVALID_ONBOARDING_REQUEST, 중복 확인=INVALID_NICKNAME)
 * 예외를 던지지 않고 검증 결과와 정규화 값만 제공한다.
 */
public final class NicknamePolicy {

    /** 숫자·영문·완성형 한글 2~12자. 공백·특수문자·자모 불가. */
    private static final Pattern NICKNAME_PATTERN = Pattern.compile("^[0-9A-Za-z가-힣]{2,12}$");

    private NicknamePolicy() {
    }

    public static boolean isValid(String nickname) {
        return nickname != null && NICKNAME_PATTERN.matcher(nickname).matches();
    }

    /** 영문은 소문자로 정규화한다. 중복 검사·저장은 이 값으로 수행한다. */
    public static String normalize(String nickname) {
        return nickname.toLowerCase(Locale.ROOT);
    }
}
