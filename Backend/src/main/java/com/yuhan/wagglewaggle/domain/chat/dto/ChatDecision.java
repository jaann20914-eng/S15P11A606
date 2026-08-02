package com.yuhan.wagglewaggle.domain.chat.dto;

import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;

/**
 * 채팅 요청에 대한 수신자의 결정. 요청 body의 {@code decision} 값에 대응한다.
 *
 * <p>각 결정은 DB에 저장할 {@link ChatRoomStatus}(targetStatus)와 응답으로 노출할
 * API 상태 문자열(apiStatus)을 함께 가진다. 저장값(ACTIVE/REFUSED/LEFT)과
 * 응답값(ACCEPTED/REJECTED/LEFT)이 다르므로 매핑을 이 enum에 모아둔다.</p>
 */
public enum ChatDecision {

    ACCEPT(ChatRoomStatus.ACTIVE, "ACCEPTED"),
    REJECT(ChatRoomStatus.REFUSED, "REJECTED"),
    LEFT(ChatRoomStatus.LEFT, "LEFT");

    private final ChatRoomStatus targetStatus;
    private final String apiStatus;

    ChatDecision(ChatRoomStatus targetStatus, String apiStatus) {
        this.targetStatus = targetStatus;
        this.apiStatus = apiStatus;
    }

    public ChatRoomStatus targetStatus() {
        return targetStatus;
    }

    public String apiStatus() {
        return apiStatus;
    }

    /**
     * 문자열 decision 값을 enum으로 파싱한다. null·공백·미허용 값은 {@code INVALID_CHAT_DECISION}.
     */
    public static ChatDecision from(String value) {
        if (value == null || value.isBlank()) {
            throw new CustomException(ErrorCode.INVALID_CHAT_DECISION);
        }
        try {
            return ChatDecision.valueOf(value.trim());
        } catch (IllegalArgumentException e) {
            throw new CustomException(ErrorCode.INVALID_CHAT_DECISION);
        }
    }
}
