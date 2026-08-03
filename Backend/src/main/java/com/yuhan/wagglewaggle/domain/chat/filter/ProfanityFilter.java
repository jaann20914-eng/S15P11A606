package com.yuhan.wagglewaggle.domain.chat.filter;

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
 * 채팅 1차 욕설 필터. 기동 시 앱 내부 리소스({@code chat/profanity-words.txt})의 사전을 메모리에 로딩하고,
 * 메시지 원문에서 사전에 등록된 토큰을 같은 길이의 {@code *}로 마스킹한다.
 *
 * <p>매칭은 대소문자 무시 부분일치다. 문맥 기반 판정이나 전화번호·계좌 등 개인정보 탐지는 이 필터의
 * 대상이 아니며 AI 2차 분석(별도 티켓)에서 다룬다. 사전은 불변 리스트로 보관한다.</p>
 */
@Slf4j
@Component
public class ProfanityFilter {

    private static final String DICTIONARY_PATH = "chat/profanity-words.txt";
    private static final char MASK_CHAR = '*';

    // 소문자 정규화된 욕설 토큰(공백/주석 제외). 불변.
    private final List<String> words;

    public ProfanityFilter() {
        this.words = load();
        log.info("욕설 사전 로딩 완료: {}개 토큰 ({})", words.size(), DICTIONARY_PATH);
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
            throw new IllegalStateException("욕설 사전 로딩 실패: " + DICTIONARY_PATH, e);
        }
    }

    /**
     * 원문에서 사전 토큰과 일치하는 구간을 같은 길이의 {@code *}로 치환한 문자열을 반환한다.
     * 일치하는 토큰이 없으면 원문을 그대로 반환한다(참조 동일성 유지).
     */
    public String mask(String content) {
        if (content == null || content.isEmpty() || words.isEmpty()) {
            return content;
        }

        String lower = content.toLowerCase(Locale.ROOT);
        // 일부 유니코드는 소문자 변환 시 길이가 달라질 수 있다. 인덱스 정합이 깨지면 원문 기준으로 매칭한다.
        String haystack = (lower.length() == content.length()) ? lower : content;

        boolean[] masked = new boolean[content.length()];
        boolean matched = false;
        for (String word : words) {
            int from = 0;
            int index;
            while ((index = haystack.indexOf(word, from)) >= 0) {
                for (int i = index; i < index + word.length(); i++) {
                    masked[i] = true;
                }
                matched = true;
                from = index + word.length();
            }
        }

        if (!matched) {
            return content;
        }

        StringBuilder sb = new StringBuilder(content.length());
        for (int i = 0; i < content.length(); i++) {
            sb.append(masked[i] ? MASK_CHAR : content.charAt(i));
        }
        return sb.toString();
    }
}
