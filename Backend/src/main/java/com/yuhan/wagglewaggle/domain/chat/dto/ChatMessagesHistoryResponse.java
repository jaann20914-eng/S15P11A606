package com.yuhan.wagglewaggle.domain.chat.dto;

import com.yuhan.wagglewaggle.domain.chat.entity.ChatMessage;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatWarning;
import com.yuhan.wagglewaggle.domain.chat.entity.WarningReasonCode;
import com.yuhan.wagglewaggle.domain.user.entity.Member;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/**
 * 채팅 메시지 이력 조회 응답. 채팅방 진입 시 방 컨텍스트(상태·장소·상대방)와 사용자 메시지·안전 경고
 * 이력을 한 번에 내려, 프론트가 추가 요청 없이 채팅 화면을 구성하도록 한다.
 *
 * <p>{@code messages}는 사용자 메시지, {@code warnings}는 별도 {@code chat_warnings}에 저장된
 * 시스템 안전 경고로 서로 다른 목록이며, 각각 생성 순서(id 오름차순)로 정렬한다.</p>
 */
public record ChatMessagesHistoryResponse(
        ChatRoomStatus status,
        String placeName,
        String address,
        BigDecimal otherUserViewTemperature,
        String otherUserNickname,
        List<MessageItem> messages,
        List<WarningItem> warnings
) {

    /** 메시지 발신자 구분. 현재 사용자가 보낸 메시지는 SELF, 상대방이 보낸 메시지는 OTHER. */
    public enum MessageSender {
        SELF,
        OTHER
    }

    public record MessageItem(
            Long messageId,
            MessageSender sender,
            String content,
            String maskedContent,
            Instant createdAt
    ) {
        /**
         * 메시지 엔티티를 응답 항목으로 변환한다. 발신자 식별자가 현재 사용자와 같으면 SELF,
         * 아니면 OTHER이며, 마스킹 대상이 없어 maskedContent가 null이면 원문(content)으로 대체한다.
         */
        static MessageItem of(ChatMessage message, Long memberId) {
            MessageSender sender = message.getSender().getId().equals(memberId)
                    ? MessageSender.SELF
                    : MessageSender.OTHER;
            String masked = message.getMaskedContent() != null
                    ? message.getMaskedContent()
                    : message.getContent();
            return new MessageItem(
                    message.getId(),
                    sender,
                    message.getContent(),
                    masked,
                    message.getCreatedAt());
        }
    }

    public record WarningItem(
            Long messageId,
            WarningReasonCode reasonCode,
            String content,
            Instant createdAt
    ) {
        /**
         * 안전 경고 엔티티를 응답 항목으로 변환한다. {@code messageId}는 정책상 "안전 경고 ID"로
         * ChatWarning의 식별자이며, {@code content}는 사유 코드에 매핑된 사용자 안내 문구다.
         */
        static WarningItem of(ChatWarning warning) {
            return new WarningItem(
                    warning.getId(),
                    warning.getReasonCode(),
                    warning.getReasonCode().getMessage(),
                    warning.getCreatedAt());
        }
    }

    /**
     * 방·상대방·메시지·경고를 조합해 응답을 만든다. {@code otherUser}는 현재 사용자가 아닌 참여자다.
     */
    public static ChatMessagesHistoryResponse of(
            ChatRoom room,
            Member otherUser,
            Long memberId,
            List<ChatMessage> messages,
            List<ChatWarning> warnings
    ) {
        List<MessageItem> messageItems = messages.stream()
                .map(message -> MessageItem.of(message, memberId))
                .toList();
        List<WarningItem> warningItems = warnings.stream()
                .map(WarningItem::of)
                .toList();
        return new ChatMessagesHistoryResponse(
                room.getStatus(),
                room.getPin().getPlace().getName(),
                room.getPin().getPlace().getAddressName(),
                otherUser.getViewAngle(),
                otherUser.getNickname(),
                messageItems,
                warningItems);
    }
}
