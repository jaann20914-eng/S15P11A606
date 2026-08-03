package com.yuhan.wagglewaggle.domain.chat.service;

import com.yuhan.wagglewaggle.domain.chat.dto.ChatMessageCreatedEvent;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatMessageSendRequest;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatMessage;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;
import com.yuhan.wagglewaggle.domain.chat.filter.ProfanityFilter;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatMessageRepository;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.UUID;

/**
 * 채팅 메시지 전송 유스케이스(동기). STOMP로 받은 메시지를 검증·저장하고 방 토픽에 브로드캐스트한다.
 *
 * <p>발신 권한은 구독 검증과 별개로 SEND 시점에도 서버가 재확인한다(구독 없이 SEND하는 경우 방어).
 * 멱등성은 {@code (sender_id, client_message_id)} 유니크 제약으로 보장하며, 중복 전송은 저장 실패를
 * 잡아 재브로드캐스트 없이 조용히 종료한다.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatMessageService {

    // content는 DB에서 TEXT라 길이 제약이 없어 애플리케이션에서 상한을 강제한다.
    // 정책 확정 전 기본값(추후 조정 가능).
    static final int MAX_CONTENT_LENGTH = 1000;

    private static final String CHAT_ROOM_TOPIC_PREFIX = "/topic/chat/rooms/";

    private final ChatRoomRepository chatRoomRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final ProfanityFilter profanityFilter;
    private final SimpMessagingTemplate messagingTemplate;
    private final Clock clock;

    /**
     * 메시지를 저장하고 {@code MESSAGE_CREATED} 이벤트를 방 토픽으로 브로드캐스트한다.
     * 검증 실패 시 명세의 오류 코드로 {@link CustomException}을 던진다.
     */
    @Transactional
    public void send(Long senderId, Long roomId, ChatMessageSendRequest request) {
        String content = validateContent(request);
        UUID clientMessageId = validateClientMessageId(request);

        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new CustomException(ErrorCode.CHAT_ROOM_NOT_FOUND));
        if (room.getStatus() != ChatRoomStatus.ACTIVE) {
            throw new CustomException(ErrorCode.CHAT_ROOM_NOT_ACTIVE);
        }

        // 발신자는 방의 참여자(요청자 또는 수신자)여야 한다. 참여자 프록시를 그대로 sender로 사용해
        // 별도 회원 조회 없이 FK만 세팅한다(참여자가 아니면 발신 거부).
        Member sender = resolveSender(room, senderId);

        // 저장 직전 1차 욕설 필터를 적용한다. 욕설이 없으면 maskedContent = content(원문)이다.
        String maskedContent = profanityFilter.mask(content);
        ChatMessage message = ChatMessage.create(room, sender, clientMessageId, content, maskedContent);

        ChatMessage saved;
        try {
            // flush를 강제해 유니크 제약 위반을 이 지점에서 포착한다.
            saved = chatMessageRepository.saveAndFlush(message);
        } catch (DataIntegrityViolationException e) {
            // (sender_id, client_message_id) 유니크 위반 = 중복 전송. 멱등 처리로 조용히 종료한다.
            log.debug("중복 채팅 메시지 무시 (senderId={}, clientMessageId={})", senderId, clientMessageId);
            return;
        }

        ChatMessageCreatedEvent event = ChatMessageCreatedEvent.of(
                roomId,
                saved.getId(),
                senderId,
                saved.getContent(),
                saved.getMaskedContent(),
                saved.getCreatedAt(),
                Instant.now(clock));
        messagingTemplate.convertAndSend(CHAT_ROOM_TOPIC_PREFIX + roomId, event);
    }

    private String validateContent(ChatMessageSendRequest request) {
        if (request == null || request.content() == null || request.content().isBlank()) {
            throw new CustomException(ErrorCode.CHAT_MESSAGE_BLANK);
        }
        String content = request.content();
        if (content.length() > MAX_CONTENT_LENGTH) {
            throw new CustomException(ErrorCode.CHAT_MESSAGE_TOO_LONG);
        }
        return content;
    }

    private UUID validateClientMessageId(ChatMessageSendRequest request) {
        if (request == null || request.clientMessageId() == null) {
            throw new CustomException(ErrorCode.INVALID_REQUEST);
        }
        return request.clientMessageId();
    }

    /**
     * 발신자를 방 참여자에서 해석한다. 요청자·수신자 중 하나면 해당 프록시를 반환하고,
     * 어느 쪽도 아니면 발신 권한이 없다.
     */
    private Member resolveSender(ChatRoom room, Long senderId) {
        if (room.getRequester().getId().equals(senderId)) {
            return room.getRequester();
        }
        if (room.getRecipient().getId().equals(senderId)) {
            return room.getRecipient();
        }
        throw new CustomException(ErrorCode.CHAT_MESSAGE_SEND_FORBIDDEN);
    }
}
