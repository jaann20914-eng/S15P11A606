package com.yuhan.wagglewaggle.domain.chat.filter;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Locale;

/**
 * 사전 기반 1차 욕설 필터(기본 전략). 기동 시 앱 내부 리소스({@code chat/profanity-words.txt})의
 * 사전을 메모리에 로딩하고, 원문에서 사전 토큰을 같은 길이의 {@code *}로 마스킹한다.
 *
 * <p>매칭은 대소문자 무시 <b>부분일치</b>다. 문맥 판정이나 공백·숫자·자모 분리 등 우회 대응, 개인정보
 * 탐지는 이 구현의 범위가 아니다(정규화 강화·Aho-Corasick·AI 2차는 별도 구현/티켓).</p>
 *
 * <p>{@code chat.profanity.strategy}가 {@code dictionary}이거나 미설정이면 활성화된다.
 * 다른 전략 구현체를 추가하면 이 조건과 상호 배타적으로 등록해 한 번에 하나만 뜨게 한다.</p>
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "chat.profanity", name = "strategy",
        havingValue = "dictionary", matchIfMissing = true)
public class DictionaryProfanityFilter implements ProfanityFilter {

    private static final String DICTIONARY_PATH = "chat/profanity-words.txt";
    private static final char MASK_CHAR = '*';

    // 소문자 정규화된 욕설 토큰(공백/주석 제외). 불변.
    private final List<String> words;

    public DictionaryProfanityFilter() {
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

    @Override
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
