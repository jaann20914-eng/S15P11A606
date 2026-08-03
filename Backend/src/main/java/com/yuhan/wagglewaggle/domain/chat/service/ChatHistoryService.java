package com.yuhan.wagglewaggle.domain.chat.service;

import com.yuhan.wagglewaggle.domain.chat.dto.ChatMessagesHistoryResponse;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatMessage;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatWarning;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatMessageRepository;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatWarningRepository;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 채팅 메시지 이력 조회 유스케이스.
 *
 * <p>참여자(요청자 또는 수신자)만 조회할 수 있으며, 종료(REFUSED/LEFT)된 방도 기존 메시지·경고·장소·
 * 참여자 정보는 조회 가능하다. 방 존재(404) → 참여자(403) 순으로 검증한 뒤, 사용자 메시지와 시스템
 * 안전 경고를 각각 생성 순서로 모아 하나의 응답으로 조립한다. 예기치 못한 오류는 부분 이력을 반환하지
 * 않고 {@link ErrorCode#CHAT_MESSAGES_FETCH_FAILED}로 변환한다.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatHistoryService {

    private final ChatRoomRepository chatRoomRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final ChatWarningRepository chatWarningRepository;

    @Transactional(readOnly = true)
    public ChatMessagesHistoryResponse getHistory(Long memberId, Long roomId) {
        try {
            // 방 존재(404) → 참여자(403) 순으로 검증한다.
            ChatRoom room = chatRoomRepository.findDetailById(roomId)
                    .orElseThrow(() -> new CustomException(ErrorCode.CHAT_ROOM_NOT_FOUND));

            Member otherUser = resolveOtherUser(room, memberId);

            List<ChatMessage> messages = chatMessageRepository.findByChatRoom_IdOrderByIdAsc(roomId);
            List<ChatWarning> warnings = chatWarningRepository.findByChatRoom_IdOrderByIdAsc(roomId);

            return ChatMessagesHistoryResponse.of(room, otherUser, memberId, messages, warnings);
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("채팅 메시지 이력 조회 실패 (memberId={}, roomId={})", memberId, roomId, e);
            throw new CustomException(ErrorCode.CHAT_MESSAGES_FETCH_FAILED);
        }
    }

    /**
     * 현재 사용자가 방의 참여자인지 검증하고 상대방 참여자를 반환한다.
     * 요청자면 수신자를, 수신자면 요청자를 상대방으로 보며, 둘 다 아니면 접근 권한이 없다.
     */
    private Member resolveOtherUser(ChatRoom room, Long memberId) {
        if (room.getRequester().getId().equals(memberId)) {
            return room.getRecipient();
        }
        if (room.getRecipient().getId().equals(memberId)) {
            return room.getRequester();
        }
        throw new CustomException(ErrorCode.CHAT_ROOM_ACCESS_DENIED);
    }
}
