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

@Getter
@Entity
@Table(
        name = "chat_rooms",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_chat_rooms_pin_id_requester_id",
                columnNames = {"pin_id", "requester_id"}
        )
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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "recipient_id", nullable = false)
    private Member recipient;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private ChatRoomStatus status = ChatRoomStatus.PENDING;

    private ChatRoom(Pin pin, Member requester, Member recipient) {
        this.pin = pin;
        this.requester = requester;
        this.recipient = recipient;
    }

    public static ChatRoom create(Pin pin, Member requester, Member recipient) {
        return new ChatRoom(pin, requester, recipient);
    }

    /**
     * 채팅방을 종료한다. 핀 삭제 등으로 대화가 끝났을 때 호출하며 상태를 LEFT로 전환한다.
     * 종료 이후에는 기존 정보·메시지 조회만 허용하고 새 메시지는 차단한다.
     */
    public void close() {
        this.status = ChatRoomStatus.LEFT;
    }

    /**
     * 요청을 수락한다(PENDING → ACTIVE). PENDING 여부는 호출부에서 행 잠금 후 검증한다.
     */
    public void accept() {
        this.status = ChatRoomStatus.ACTIVE;
    }

    /**
     * 요청을 거절한다(PENDING → REFUSED).
     */
    public void reject() {
        this.status = ChatRoomStatus.REFUSED;
    }

    /**
     * 요청에서 나간다(PENDING → LEFT).
     */
    public void leave() {
        this.status = ChatRoomStatus.LEFT;
    }
}
