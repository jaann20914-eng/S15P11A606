package com.yuhan.wagglewaggle.domain.chat.entity;

import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.global.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

    @Column(name = "content", columnDefinition = "text", nullable = false)
    private String content;

    @Column(name = "masked_content", columnDefinition = "text")
    private String maskedContent;

    private ChatMessage(ChatRoom chatRoom, Member sender, UUID clientMessageId,
                        String content, String maskedContent) {
        this.chatRoom = chatRoom;
        this.sender = sender;
        this.clientMessageId = clientMessageId;
        this.content = content;
        this.maskedContent = maskedContent;
    }

    /**
     * 채팅 메시지를 생성한다. {@code content}는 원문, {@code maskedContent}는 1차 욕설 필터로
     * 마스킹된 표시용 문자열이다(욕설이 없으면 원문과 동일한 값이 전달된다).
     */
    public static ChatMessage create(ChatRoom chatRoom, Member sender, UUID clientMessageId,
                                     String content, String maskedContent) {
        return new ChatMessage(chatRoom, sender, clientMessageId, content, maskedContent);
    }
}
