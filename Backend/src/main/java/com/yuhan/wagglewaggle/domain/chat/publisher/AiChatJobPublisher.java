package com.yuhan.wagglewaggle.domain.chat.publisher;

import com.yuhan.wagglewaggle.domain.chat.message.AiChatAnalysisMessage;

/**
 * 채팅 분석 배치 메시지 발행기.
 */
public interface AiChatJobPublisher {

    void publish(AiChatAnalysisMessage message);
}
