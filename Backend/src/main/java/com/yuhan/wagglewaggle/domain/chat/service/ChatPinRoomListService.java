package com.yuhan.wagglewaggle.domain.chat.service;

import com.yuhan.wagglewaggle.domain.chat.dto.ChatRoomListItem;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatRoomListResponse;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatRoomSummaryStatus;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatMessage;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatMessageRepository;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatMessageRepository.RoomOtherMessageId;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomMemberRepository;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomMemberRepository.RoomReadPointer;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * 특정 핀의 채팅방 목록 조회 서비스(요청받은 핀 → 방 드릴다운).
 * 지정 핀에 속하고 현재 사용자가 참여한(요청자 또는 수신자) 채팅방을 최근 활동 시각 내림차순으로 커서 페이지네이션하여 조회한다.
 * 응답 계약은 내가 보낸 채팅방 목록(ChatRoomListService)과 동일하며, 상대방은 방마다 "내가 아닌 참여자"로 판별한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatPinRoomListService {

    private static final int DEFAULT_LIMIT = 20;
    private static final int MIN_LIMIT = 1;
    private static final int MAX_LIMIT = 50;

    private final ChatRoomRepository chatRoomRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final ChatRoomMemberRepository chatRoomMemberRepository;

    /**
     * 특정 핀의 채팅방 목록을 조회한다.
     * cursor·limit 검증은 조회 이전에 수행하며, 잘못되면 조회하지 않고 INVALID_PAGINATION으로 실패한다.
     * 현재 사용자가 참여하지 않았거나 없는 핀이면 빈 배열이며, 조회 중 예기치 못한 오류는 CHAT_ROOMS_FETCH_FAILED로 처리한다.
     */
    @Transactional(readOnly = true)
    public ChatRoomListResponse getPinChatRooms(Long memberId, UUID pinId, String cursorRaw, String limitRaw) {
        // 페이지 조건 검증은 조회 이전에 수행한다(잘못되면 목록을 조회하지 않는다).
        int limit = parseLimit(limitRaw);
        ChatRoomCursor cursor = parseCursor(cursorRaw);

        try {
            // 다음 페이지 존재 여부 판단을 위해 limit + 1건을 조회한다.
            Pageable pageable = PageRequest.of(0, limit + 1);
            List<ChatRoom> rooms = (cursor == null)
                    ? chatRoomRepository.findPinRoomsFirstPage(pinId, memberId, pageable)
                    : chatRoomRepository.findPinRoomsAfterCursor(
                            pinId, memberId, cursor.lastActivityAt(), cursor.roomId(), pageable);

            return buildResponse(rooms, limit, memberId);
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("특정 핀 채팅방 목록 조회 실패 (memberId={}, pinId={})", memberId, pinId, e);
            throw new CustomException(ErrorCode.CHAT_ROOMS_FETCH_FAILED);
        }
    }

    /**
     * limit을 파싱·검증한다. 미전달(null·공백)은 기본값 20, 1~50 범위를 벗어나거나 숫자가 아니면 INVALID_PAGINATION으로 실패한다.
     */
    private int parseLimit(String raw) {
        if (raw == null || raw.isBlank()) {
            return DEFAULT_LIMIT;
        }
        int limit;
        try {
            limit = Integer.parseInt(raw.trim());
        } catch (NumberFormatException e) {
            throw new CustomException(ErrorCode.INVALID_PAGINATION);
        }
        if (limit < MIN_LIMIT || limit > MAX_LIMIT) {
            throw new CustomException(ErrorCode.INVALID_PAGINATION);
        }
        return limit;
    }

    /**
     * cursor를 파싱한다. 미전달(null·공백)은 첫 페이지(null), 형식이 잘못되면 INVALID_PAGINATION으로 실패한다.
     */
    private ChatRoomCursor parseCursor(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return ChatRoomCursor.decode(raw.trim());
    }

    /**
     * limit + 1건 조회 결과에서 다음 페이지 존재 여부를 판단해 응답을 조립한다.
     * 최근 메시지·안읽음 여부·읽음 포인터는 페이지 방 id 목록으로 배치 조회하여 N+1을 방지한다.
     * limit을 초과하면 마지막 노출 항목의 (최근 활동 시각, roomId)로 nextCursor를 발급하고, 아니면 null이다.
     */
    private ChatRoomListResponse buildResponse(List<ChatRoom> rooms, int limit, Long memberId) {
        boolean hasNext = rooms.size() > limit;
        List<ChatRoom> page = hasNext ? rooms.subList(0, limit) : rooms;

        if (page.isEmpty()) {
            return new ChatRoomListResponse(List.of(), null);
        }

        List<Long> roomIds = page.stream().map(ChatRoom::getId).toList();

        // 방별 마지막 메시지(최근 미리보기), 상대 발신 최대 메시지 id(안읽음 계산), 내 읽음 포인터를 배치 로드한다.
        Map<Long, ChatMessage> lastMessageByRoom = chatMessageRepository.findLastMessagesByRoomIds(roomIds).stream()
                .collect(Collectors.toMap(m -> m.getChatRoom().getId(), Function.identity()));
        Map<Long, Long> maxOtherIdByRoom = chatMessageRepository.findMaxOtherSenderMessageIds(roomIds, memberId).stream()
                .collect(Collectors.toMap(RoomOtherMessageId::getRoomId, RoomOtherMessageId::getMaxOtherMessageId));
        Map<Long, Long> lastReadByRoom = chatRoomMemberRepository.findReadPointers(roomIds, memberId).stream()
                .filter(p -> p.getLastReadMessageId() != null)
                .collect(Collectors.toMap(RoomReadPointer::getRoomId, RoomReadPointer::getLastReadMessageId));

        List<ChatRoomListItem> items = new ArrayList<>(page.size());
        for (ChatRoom room : page) {
            ChatMessage lastMessage = lastMessageByRoom.get(room.getId());
            items.add(toItem(room, memberId, lastMessage, maxOtherIdByRoom.get(room.getId()), lastReadByRoom.get(room.getId())));
        }

        String nextCursor = null;
        if (hasNext) {
            ChatRoom last = page.get(page.size() - 1);
            Instant activityAt = lastActivityAt(last, lastMessageByRoom.get(last.getId()));
            nextCursor = new ChatRoomCursor(activityAt, last.getId()).encode();
        }

        return new ChatRoomListResponse(items, nextCursor);
    }

    /**
     * 방·마지막 메시지·안읽음 정보를 목록 항목으로 변환한다. 상대방은 방의 참여자 중 현재 사용자가 아닌 쪽이며,
     * 최근 메시지는 마스킹된 표시용 문자열(없으면 원문)을 사용한다. 메시지가 없으면 lastMessage/lastMessageAt은 null이다.
     * hasUnread는 상대 발신 최대 메시지 id가 내 읽음 포인터보다 클 때(또는 읽은 적 없을 때) true다.
     */
    private ChatRoomListItem toItem(ChatRoom room, Long memberId, ChatMessage lastMessage,
                                    Long maxOtherMessageId, Long lastReadMessageId) {
        Member other = resolveOtherUser(room, memberId);

        String lastMessageContent = null;
        Instant lastMessageAt = null;
        if (lastMessage != null) {
            lastMessageContent = lastMessage.getMaskedContent() != null
                    ? lastMessage.getMaskedContent()
                    : lastMessage.getContent();
            lastMessageAt = lastMessage.getCreatedAt();
        }

        boolean hasUnread = maxOtherMessageId != null
                && (lastReadMessageId == null || maxOtherMessageId > lastReadMessageId);

        return new ChatRoomListItem(
                room.getId(),
                ChatRoomSummaryStatus.from(room.getStatus()),
                room.getPin().getId(),
                room.getPin().getPlace().getName(),
                other.getNickname(),
                other.getViewAngle(),
                lastMessageContent,
                lastMessageAt,
                hasUnread);
    }

    /**
     * 방의 상대방(현재 사용자가 아닌 참여자)을 반환한다. 내가 요청자면 수신자를, 수신자면 요청자를 상대방으로 본다.
     */
    private Member resolveOtherUser(ChatRoom room, Long memberId) {
        return room.getRequester().getId().equals(memberId) ? room.getRecipient() : room.getRequester();
    }

    /**
     * 방의 최근 활동 시각을 계산한다. 마지막 메시지가 있으면 그 생성 시각, 없으면 방 생성 시각을 사용한다.
     * (리포지토리 정렬 기준 COALESCE(MAX(message.createdAt), room.createdAt)와 동일해야 커서가 일관된다.)
     */
    private Instant lastActivityAt(ChatRoom room, ChatMessage lastMessage) {
        return lastMessage != null ? lastMessage.getCreatedAt() : room.getCreatedAt();
    }
}
