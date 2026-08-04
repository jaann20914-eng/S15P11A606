package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.chat.dto.ChatRoomStatusChangedEvent;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
import com.yuhan.wagglewaggle.domain.pin.dto.PinLeaveResponse;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 핀 제보자 떠남(POST /api/v1/pins/{pinId}/leave) 애플리케이션 서비스.
 *
 * <p>pinId 형식 검증 → 핀 행 비관적 잠금 조회·작성자 권한 확인 → 제보자 상태 전환(publisher_status → LEFT)과
 * 연결된 PENDING·ACTIVE·REFUSED 채팅방의 일괄 종료(LEFT 전환)를 하나의 트랜잭션으로 처리한다.
 * 핀 행을 잠근 채 처리하므로 모바일 재전송 등 중복 요청은 직렬화되어 멱등하게 처리된다.</p>
 *
 * <p>커밋 이후 부수효과(스토리지 정리·메시징)가 없어 핀 삭제와 달리 트랜잭션 경계를 분리하지 않는다.
 * 검증 예외(CustomException: INVALID_PIN_ID·PIN_NOT_FOUND·PIN_LEAVE_FORBIDDEN)는 그대로 전파하고,
 * 예상치 못한 처리 실패는 롤백 후 PIN_LEAVE_FAILED(500)로 매핑한다.</p>
 *
 * <p>이미 소프트 삭제된 핀은 연결 채팅방이 이미 종료 상태이므로 별도 차단 없이
 * 빈 목록으로 멱등 응답한다. leftAt은 저장하지 않고 서버 처리 시각을 응답에만 담는다.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PinPublisherLeaveService {

    private static final List<ChatRoomStatus> TARGET_STATUSES =
            List.of(ChatRoomStatus.PENDING, ChatRoomStatus.ACTIVE, ChatRoomStatus.REFUSED);

    // convertAndSendToUser가 /user prefix를 자동으로 붙이므로 send 시엔 prefix를 제외한다.
    // 구독 경로 /user/queue/chat-rooms(= StompAuthChannelInterceptor.USER_CHAT_ROOMS_DESTINATION)와 대응한다.
    private static final String USER_CHAT_ROOMS_SEND_DESTINATION = "/queue/chat-rooms";

    private final PinRepository pinRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final Clock clock;

    /** 상태 변경 push 대상(라우팅용 requester id + 방 id). */
    private record NotifyTarget(Long roomId, Long requesterId) {
    }

    @Transactional
    public PinLeaveResponse leave(Long memberId, String rawPinId) {
        UUID pinId = parsePinId(rawPinId);

        // deleted_at 조건을 제외한 전용 잠금 조회. 이미 삭제된 핀도 함께 잠근다(멱등 처리).
        Pin pin = pinRepository.findByIdForUpdate(pinId)
                .orElseThrow(() -> new CustomException(ErrorCode.PIN_NOT_FOUND));

        // 핀 존재 확인 후 작성자 권한을 먼저 검증한다.
        if (memberId == null || !memberId.equals(pin.getMember().getId())) {
            throw new CustomException(ErrorCode.PIN_LEAVE_FORBIDDEN);
        }

        try {
            pin.markPublisherLeft();
            List<Long> leftChatRoomIds = leaveActiveChatRooms(pinId, memberId);
            return PinLeaveResponse.of(pinId, leftChatRoomIds, clock.instant());
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("핀 제보자 떠남 처리 실패 (pinId={}, memberId={})", pinId, memberId, e);
            throw new CustomException(ErrorCode.PIN_LEAVE_FAILED);
        }
    }

    /** PENDING·ACTIVE·REFUSED 채팅방을 종료(LEFT 전환)하고 실제로 전환된 방 ID를 반환한다(이미 LEFT인 방은 대상 아님). */
    private List<Long> leaveActiveChatRooms(UUID pinId, Long actorId) {
        List<ChatRoom> targetRooms =
                chatRoomRepository.findByPin_IdAndStatusIn(pinId, TARGET_STATUSES);
        List<Long> leftIds = new ArrayList<>(targetRooms.size());
        List<NotifyTarget> notifyTargets = new ArrayList<>(targetRooms.size());
        for (ChatRoom room : targetRooms) {
            room.close();
            leftIds.add(room.getId());
            notifyTargets.add(new NotifyTarget(room.getId(), room.getRequester().getId()));
        }
        // 종료된 방마다 상대(요청자)에게 커밋 이후 LEFT 상태 변경을 알린다.
        scheduleStatusChangedNotify(pinId, actorId, notifyTargets);
        return leftIds;
    }

    /**
     * 종료된 방들에 대해 각 요청자의 개인 큐로 LEFT 상태 변경 이벤트를 커밋 이후 발행하도록 등록한다.
     * actor(핀 소유자 = 각 방의 recipient)에게는 보내지 않으므로 수신자는 항상 requester다.
     */
    private void scheduleStatusChangedNotify(UUID pinId, Long actorId, List<NotifyTarget> targets) {
        if (targets.isEmpty()) {
            return;
        }
        Instant changedAt = clock.instant();
        runAfterCommit(() -> {
            for (NotifyTarget target : targets) {
                messagingTemplate.convertAndSendToUser(
                        String.valueOf(target.requesterId()), USER_CHAT_ROOMS_SEND_DESTINATION,
                        ChatRoomStatusChangedEvent.of(target.roomId(), pinId, actorId,
                                ChatRoomStatus.LEFT, changedAt, clock.instant()));
            }
        });
    }

    /**
     * DB 커밋 이후 실행할 후속 처리를 등록한다. 활성 트랜잭션이 없으면 즉시 실행한다.
     */
    private void runAfterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    action.run();
                }
            });
        } else {
            action.run();
        }
    }

    private UUID parsePinId(String rawPinId) {
        if (rawPinId == null || rawPinId.isBlank()) {
            throw new CustomException(ErrorCode.INVALID_PIN_ID);
        }
        try {
            return UUID.fromString(rawPinId.trim());
        } catch (IllegalArgumentException e) {
            throw new CustomException(ErrorCode.INVALID_PIN_ID);
        }
    }
}
