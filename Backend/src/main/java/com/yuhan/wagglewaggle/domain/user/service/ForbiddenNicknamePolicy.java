package com.yuhan.wagglewaggle.domain.user.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;

/**
 * 닉네임 금칙어 정책. 기동 시 앱 내부 리소스({@code user/forbidden-nicknames.txt})의 금칙어 목록을
 * 메모리에 로딩하고, 정규화(소문자)된 닉네임이 금칙어를 부분 포함하면 금칙어로 판정한다.
 *
 * <p>형식·길이 검증을 담당하는 {@link NicknamePolicy}와 짝을 이루는 닉네임 전용 정책이다.
 * 채팅 욕설 필터({@code domain.chat.filter})와는 목적·목록이 다르므로 재사용하지 않고 독립적으로 둔다.
 * 부분 포함(substring)으로 판정하는 이유는 금칙어를 부분 문자열로 감춘 우회 닉네임까지 막기 위함이다.</p>
 */
@Slf4j
@Component
public class ForbiddenNicknamePolicy {

    private static final String DICTIONARY_PATH = "user/forbidden-nicknames.txt";

    // 소문자 정규화된 금칙어 토큰(공백/주석 제외). 불변.
    private final List<String> words;

    public ForbiddenNicknamePolicy() {
        this.words = load();
        log.info("닉네임 금칙어 사전 로딩 완료: {}개 토큰 ({})", words.size(), DICTIONARY_PATH);
    }

    private List<String> load() {
        ClassPathResource resource = new ClassPathResource(DICTIONARY_PATH);
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(resource.getInputStream(), StandardCharsets.UTF_8))) {
            return reader.lines()
                    .map(String::trim)
                    .filter(line -> !line.isEmpty() && !line.startsWith("#"))
                    .map(word -> word.toLowerCase(Locale.ROOT))
                    .distinct()
                    .toList();
        } catch (IOException e) {
            throw new IllegalStateException("닉네임 금칙어 사전 로딩 실패: " + DICTIONARY_PATH, e);
        }
    }

    /**
     * 정규화된 닉네임에 금칙어가 부분 포함되면 true를 반환한다.
     * 호출부에서 소문자 정규화한 값을 전달한다.
     */
    public boolean isForbidden(String normalizedNickname) {
        if (normalizedNickname == null || normalizedNickname.isEmpty() || words.isEmpty()) {
            return false;
        }
        String lower = normalizedNickname.toLowerCase(Locale.ROOT);
        for (String word : words) {
            if (lower.contains(word)) {
                return true;
            }
        }
        return false;
    }
}
