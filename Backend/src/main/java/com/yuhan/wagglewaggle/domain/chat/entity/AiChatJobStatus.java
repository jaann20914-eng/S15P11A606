package com.yuhan.wagglewaggle.domain.chat.entity;

/**
 * AI 채팅 작업 상태.
 * PENDING(대기) → PROCESSING(처리중) → COMPLETED(완료) | FAILED(실패).
 */
public enum AiChatJobStatus {
    PENDING,
    PROCESSING,
    COMPLETED,
    FAILED
}
