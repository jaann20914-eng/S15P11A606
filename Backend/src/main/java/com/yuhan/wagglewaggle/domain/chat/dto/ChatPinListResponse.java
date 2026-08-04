package com.yuhan.wagglewaggle.domain.chat.dto;

import java.util.List;

/**
 * 채팅 핀 목록 조회(요청받은 대화) 응답 데이터.
 *
 * <p>items는 결과가 없으면 빈 배열이다. nextCursor는 서버가 발급한 불투명 문자열이며 다음 페이지가 없으면
 * null이다. Front는 nextCursor 값을 해석하거나 수정하지 않고 그대로 다음 요청에 전달한다.</p>
 */
public record ChatPinListResponse(
        List<ChatPinListItem> items,
        String nextCursor
) {
}
