package com.yuhan.wagglewaggle.domain.chat.entity;

import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
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
        name = "chat_rooms",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_chat_rooms_pin_id_requester_id",
                        columnNames = {"pin_id", "requester_id"}
                ),
                @UniqueConstraint(
                        name = "uk_chat_rooms_idempotency_key",
                        columnNames = {"idempotency_key"}
                )
        }
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ChatRoom extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pin_id", nullable = false)
    private Pin pin;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requester_id", nullable = false)
    private Member requester;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ChatRoomStatus status = ChatRoomStatus.ACTIVE;

    @Column(name = "idempotency_key", nullable = false)
    private UUID idempotencyKey;

    private ChatRoom(Pin pin, Member requester, UUID idempotencyKey) {
        this.pin = pin;
        this.requester = requester;
        this.idempotencyKey = idempotencyKey;
    }

    public static ChatRoom create(Pin pin, Member requester, UUID idempotencyKey) {
        return new ChatRoom(pin, requester, idempotencyKey);
    }

    /**
     * 채팅방을 종료한다. 핀 삭제 등으로 대화가 끝났을 때 호출하며 상태를 LEFT로 전환한다.
     * 종료 이후에는 기존 정보·메시지 조회만 허용하고 새 메시지는 차단한다.
     */
    public void close() {
        this.status = ChatRoomStatus.LEFT;
    }
}
