package com.yuhan.wagglewaggle.domain.chat.entity;

import com.yuhan.wagglewaggle.global.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 채팅방에서 감지된 경고 기록. 하나의 채팅방에 여러 건이 쌓일 수 있다.
 */
@Getter
@Entity
@Table(name = "chat_warnings")
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatWarning extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chat_room_id", nullable = false)
    private ChatRoom chatRoom;

    @Enumerated(EnumType.STRING)
    @Column(name = "reason_code", nullable = false, length = 50)
    private WarningReasonCode reasonCode;

    private ChatWarning(ChatRoom chatRoom, WarningReasonCode reasonCode) {
        this.chatRoom = chatRoom;
        this.reasonCode = reasonCode;
    }

    public static ChatWarning create(ChatRoom chatRoom, WarningReasonCode reasonCode) {
        return new ChatWarning(chatRoom, reasonCode);
    }
}
