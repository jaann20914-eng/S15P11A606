package com.yuhan.wagglewaggle.domain.chat.service;

import com.yuhan.wagglewaggle.domain.chat.dto.ChatReadRequest;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatReadResponse;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomMember;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatMessageRepository;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomMemberRepository;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 채팅방 읽음 위치(last_read_message_id) 갱신 유스케이스.
 *
 * <p>읽음 위치는 단조 증가하는 하한선이라, 전달된 id가 기존 값보다 클 때만 갱신하고 같거나 작으면
 * 오류 없이 현재 값을 유지·반환한다(멱등). 갱신 자체는 {@link ChatRoomMember#markRead(Long)}에
 * 캡슐화되어 있으며, 이 서비스는 방·참여자·메시지 소속을 검증한 뒤 대상 멤버 행을 로드한다.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatReadService {

    private final ChatRoomRepository chatRoomRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final ChatRoomMemberRepository chatRoomMemberRepository;

    /**
     * 현재 사용자의 읽음 위치를 갱신하고, 갱신 후 저장된 last_read_message_id를 반환한다.
     * 검증 실패 시 명세의 오류 코드로 {@link CustomException}을 던지며, 예기치 못한 오류는
     * {@link ErrorCode#CHAT_READ_UPDATE_FAILED}로 변환해 기존 읽음 상태를 유지한다.
     */
    @Transactional
    public ChatReadResponse updateLastRead(Long memberId, Long roomId, ChatReadRequest request) {
        Long lastReadMessageId = validateLastReadMessageId(request);
        try {
            // 방 존재(404) → 참여자(403) → 메시지 소속(404) 순으로 검증한다.
            if (!chatRoomRepository.existsById(roomId)) {
                throw new CustomException(ErrorCode.CHAT_ROOM_NOT_FOUND);
            }
            if (!chatRoomRepository.existsByIdAndParticipant(roomId, memberId)) {
                throw new CustomException(ErrorCode.CHAT_ROOM_ACCESS_DENIED);
            }
            if (!chatMessageRepository.existsByIdAndChatRoom_Id(lastReadMessageId, roomId)) {
                throw new CustomException(ErrorCode.CHAT_MESSAGE_NOT_FOUND);
            }

            // 참여자 검증을 통과했고 방에 메시지가 존재하므로(=수락된 방) 멤버 행이 존재한다.
            // 방어적으로 없으면 접근 권한 없음으로 처리한다.
            ChatRoomMember member = chatRoomMemberRepository
                    .findByChatRoom_IdAndMember_Id(roomId, memberId)
                    .orElseThrow(() -> new CustomException(ErrorCode.CHAT_ROOM_ACCESS_DENIED));

            member.markRead(lastReadMessageId);
            return new ChatReadResponse(roomId, member.getLastReadMessageId());
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("채팅 읽음 위치 갱신 실패 (memberId={}, roomId={}, lastReadMessageId={})",
                    memberId, roomId, lastReadMessageId, e);
            throw new CustomException(ErrorCode.CHAT_READ_UPDATE_FAILED);
        }
    }

    private Long validateLastReadMessageId(ChatReadRequest request) {
        if (request == null || request.lastReadMessageId() == null) {
            throw new CustomException(ErrorCode.INVALID_MESSAGE_ID);
        }
        return request.lastReadMessageId();
    }
}
