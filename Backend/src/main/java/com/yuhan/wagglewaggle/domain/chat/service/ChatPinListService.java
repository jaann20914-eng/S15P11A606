package com.yuhan.wagglewaggle.domain.chat.service;

import com.yuhan.wagglewaggle.domain.chat.dto.ChatPinListItem;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatPinListResponse;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * 요청받은 채팅이 있는 핀 목록 조회 서비스(요청받은 대화 탭).
 * 현재 사용자가 수신자(recipient=핀 소유자)인 채팅방이 하나라도 있는 핀을 등록 시각 내림차순으로 커서 페이지네이션하여 조회한다.
 * 핀마다 파생된(내가 수신자인) 채팅방들의 안읽음 여부를 OR 집계하여 hasUnread로 내린다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatPinListService {

    private static final int DEFAULT_LIMIT = 20;
    private static final int MIN_LIMIT = 1;
    private static final int MAX_LIMIT = 50;

    private final PinRepository pinRepository;
    private final ChatRoomRepository chatRoomRepository;

    /**
     * 요청받은 채팅이 있는 핀 목록을 조회한다.
     * cursor·limit 검증은 조회 이전에 수행하며, 잘못되면 조회하지 않고 INVALID_PAGINATION으로 실패한다.
     * 조회 중 예기치 못한 오류는 CHAT_PINS_FETCH_FAILED로 처리하며 부분 목록을 반환하지 않는다.
     */
    @Transactional(readOnly = true)
    public ChatPinListResponse getMyReceivedChatPins(Long memberId, String cursorRaw, String limitRaw) {
        // 페이지 조건 검증은 조회 이전에 수행한다(잘못되면 목록을 조회하지 않는다).
        int limit = parseLimit(limitRaw);
        ChatPinCursor cursor = parseCursor(cursorRaw);

        try {
            // 다음 페이지 존재 여부 판단을 위해 limit + 1건을 조회한다.
            Pageable pageable = PageRequest.of(0, limit + 1);
            List<Pin> pins = (cursor == null)
                    ? pinRepository.findReceivedChatPinsFirstPage(memberId, pageable)
                    : pinRepository.findReceivedChatPinsAfterCursor(
                            memberId, cursor.createdAt(), cursor.pinId(), pageable);

            return buildResponse(pins, limit, memberId);
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("채팅 핀 목록 조회 실패 (memberId={})", memberId, e);
            throw new CustomException(ErrorCode.CHAT_PINS_FETCH_FAILED);
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
    private ChatPinCursor parseCursor(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return ChatPinCursor.decode(raw.trim());
    }

    /**
     * limit + 1건 조회 결과에서 다음 페이지 존재 여부를 판단해 응답을 조립한다.
     * 핀 단위 안읽음(hasUnread)은 페이지 핀 id 목록으로 "안읽음이 있는 핀 id"만 DB에서 한 번에 집계해(N+1·앱 메모리 부하 방지),
     * 그 집합에 포함되면 true로 매핑한다. limit을 초과하면 마지막 노출 핀의 (createdAt, id)로 nextCursor를 발급하고, 아니면 null이다.
     */
    private ChatPinListResponse buildResponse(List<Pin> pins, int limit, Long memberId) {
        boolean hasNext = pins.size() > limit;
        List<Pin> page = hasNext ? pins.subList(0, limit) : pins;

        if (page.isEmpty()) {
            return new ChatPinListResponse(List.of(), null);
        }

        List<UUID> pinIds = page.stream().map(Pin::getId).toList();
        Set<UUID> unreadPinIds = new HashSet<>(
                chatRoomRepository.findPinIdsWithUnreadForRecipient(pinIds, memberId));

        List<ChatPinListItem> items = new ArrayList<>(page.size());
        for (Pin pin : page) {
            items.add(new ChatPinListItem(
                    pin.getId(),
                    pin.getCreatedAt(),
                    pin.getPlace().getName(),
                    pin.getPlace().getAddressName(),
                    unreadPinIds.contains(pin.getId())));
        }

        String nextCursor = null;
        if (hasNext) {
            Pin last = page.get(page.size() - 1);
            nextCursor = new ChatPinCursor(last.getCreatedAt(), last.getId()).encode();
        }

        return new ChatPinListResponse(items, nextCursor);
    }
}
