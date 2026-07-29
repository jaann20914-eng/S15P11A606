package com.yuhan.wagglewaggle.domain.chat.entity;

import com.yuhan.wagglewaggle.domain.user.entity.Member;
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
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.util.UUID;

@Getter
@Entity
@Table(
        name = "chat_messages",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_chat_messages_sender_id_client_message_id",
                columnNames = {"sender_id", "client_message_id"}
        )
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatMessage extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chat_room_id", nullable = false)
    private ChatRoom chatRoom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "sender_id", nullable = false)
    private Member sender;

    @Column(name = "client_message_id", nullable = false)
    private UUID clientMessageId;

    @Enumerated(EnumType.STRING)
    @Column(name = "type", nullable = false, length = 30)
    private ChatMessageType type;

    @Column(name = "content", columnDefinition = "text", nullable = false)
    private String content;

    @Column(name = "masked_content", columnDefinition = "text")
    private String maskedContent;

    private ChatMessage(ChatRoom chatRoom, Member sender, UUID clientMessageId,
                        ChatMessageType type, String content) {
        this.chatRoom = chatRoom;
        this.sender = sender;
        this.clientMessageId = clientMessageId;
        this.type = type;
        this.content = content;
    }

    public static ChatMessage create(ChatRoom chatRoom, Member sender, UUID clientMessageId,
                                     ChatMessageType type, String content) {
        return new ChatMessage(chatRoom, sender, clientMessageId, type, content);
    }
}
