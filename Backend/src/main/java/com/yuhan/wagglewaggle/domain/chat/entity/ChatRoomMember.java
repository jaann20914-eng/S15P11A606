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

@Getter
@Entity
@Table(
        name = "chat_room_members",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_chat_room_members_chat_room_id_member_id",
                columnNames = {"chat_room_id", "member_id"}
        )
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatRoomMember extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "chat_room_id", nullable = false)
    private ChatRoom chatRoom;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id", nullable = false)
    private Member member;

    // 마지막으로 읽은 메시지 id. 미읽음 계산용 포인터라 id 값만 필요하다.
    @Column(name = "last_read_message_id")
    private Long lastReadMessageId;

    private ChatRoomMember(ChatRoom chatRoom, Member member) {
        this.chatRoom = chatRoom;
        this.member = member;
    }

    public static ChatRoomMember create(ChatRoom chatRoom, Member member) {
        return new ChatRoomMember(chatRoom, member);
    }

    /**
     * 읽음 위치를 단조 증가로 갱신한다. 기존 값이 없거나 전달된 id가 더 클 때만 갱신하며,
     * 같거나 더 작은 id는 무시한다(읽음 위치를 되돌리지 않음).
     *
     * @return 실제로 값이 갱신되면 {@code true}, 무시되면 {@code false}
     */
    public boolean markRead(Long messageId) {
        if (lastReadMessageId != null && messageId <= lastReadMessageId) {
            return false;
        }
        this.lastReadMessageId = messageId;
        return true;
    }
}
