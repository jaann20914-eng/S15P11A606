package com.yuhan.wagglewaggle.domain.chat.entity;

import com.yuhan.wagglewaggle.global.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.util.UUID;

/**
 * AI 채팅 작업. 특정 채팅방의 메시지 구간(start~end)을 대상으로 하는 AI 처리 작업 1건을 저장한다.
 * chat_room_id는 참조용 raw FK 값으로 보관한다(chat_rooms FK 존재, 양방향 연관관계 미사용).
 */
@Getter
@Entity
@Table(name = "ai_chat_jobs")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AiChatJob extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "request_id")
    private UUID requestId;

    @Column(name = "chat_room_id", nullable = false)
    private Long chatRoomId;

    @Column(name = "start_message_id", nullable = false)
    private Long startMessageId;

    @Column(name = "end_message_id", nullable = false)
    private Long endMessageId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private AiChatJobStatus status;

    @Column(name = "completed_at")
    private Instant completedAt;

    private AiChatJob(Long chatRoomId, Long startMessageId, Long endMessageId) {
        this.chatRoomId = chatRoomId;
        this.startMessageId = startMessageId;
        this.endMessageId = endMessageId;
        this.status = AiChatJobStatus.PENDING;
    }

    /**
     * 새 AI 채팅 작업을 생성한다. 상태는 항상 PENDING으로 시작한다.
     */
    public static AiChatJob create(Long chatRoomId, Long startMessageId, Long endMessageId) {
        return new AiChatJob(chatRoomId, startMessageId, endMessageId);
    }

    /**
     * 작업을 처리중(PROCESSING) 상태로 전환한다.
     */
    public void markProcessing() {
        this.status = AiChatJobStatus.PROCESSING;
    }

    /**
     * 작업을 완료 처리한다. 상태를 COMPLETED로 바꾸고 완료 시각을 기록한다.
     */
    public void markCompleted(Instant completedAt) {
        this.status = AiChatJobStatus.COMPLETED;
        this.completedAt = completedAt;
    }

    /**
     * 작업을 실패 처리한다. 상태를 FAILED로 바꾸고 종료 시각을 기록한다.
     */
    public void markFailed(Instant completedAt) {
        this.status = AiChatJobStatus.FAILED;
        this.completedAt = completedAt;
    }
}
