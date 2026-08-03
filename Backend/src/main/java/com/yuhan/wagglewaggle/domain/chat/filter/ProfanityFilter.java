package com.yuhan.wagglewaggle.domain.chat.filter;

/**
 * 채팅 1차 욕설 필터. 메시지 원문에서 욕설로 판정된 구간을 마스킹한 표시용 문자열을 만든다.
 *
 * <p>구현 전략을 교체할 수 있도록 seam으로 둔 인터페이스다. 현재 기본 구현은
 * {@link DictionaryProfanityFilter}(사전 부분일치)이며, 향후 <b>LDNOOBW 목록 + Aho-Corasick +
 * 정규화(공백·특수문자 제거, 유니코드 정규화, 한글 자모 처리)</b> 구현체를 추가할 수 있다.
 * 교체는 새 구현체를 이 인터페이스로 등록하고 {@code chat.profanity.strategy} 값만 바꾸면 되며,
 * 이 인터페이스에 의존하는 {@code ChatMessageService}는 수정하지 않는다.</p>
 */
public interface ProfanityFilter {

    /**
     * 원문에서 욕설 구간을 마스킹한 문자열을 반환한다.
     * 마스킹할 것이 없으면 원문을 그대로 반환한다(참조 동일성 유지 권장).
     * {@code null}·빈 문자열은 그대로 반환한다.
     */
    String mask(String content);
}
