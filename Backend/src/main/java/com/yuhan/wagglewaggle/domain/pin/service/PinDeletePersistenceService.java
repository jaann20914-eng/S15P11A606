package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJob;
import com.yuhan.wagglewaggle.domain.blur.entity.AiBlurJobStatus;
import com.yuhan.wagglewaggle.domain.blur.repository.AiBlurJobRepository;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatRoomStatusChangedEvent;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
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
 * 핀 삭제 반영 트랜잭션 경계.
 *
 * <p>Pin 행을 비관적 잠금(deleted_at 조건 제외 전용 잠금 조회)으로 조회한 뒤,
 * {@code pins.deleted_at} 기록과 활성 채팅방의 종료(LEFT 전환)를
 * 하나의 트랜잭션으로 처리한다. 삭제 처리와 AI 결과 반영이 동시에 실행돼도 이 잠금으로 직렬화된다.</p>
 *
 * <p>스토리지 객체의 물리 삭제 실패가 소프트 삭제 트랜잭션을 롤백시키지 않도록,
 * 정리 대상 키만 수집해 반환하고 실제 등록·삭제는 커밋 이후 호출부에서 수행한다.</p>
 *
 * <p>삭제 시 {@code video_status}와 영상 키는 변경하지 않는다.</p>
 */
@Service
@RequiredArgsConstructor
public class PinDeletePersistenceService {

    // convertAndSendToUser가 /user prefix를 자동으로 붙이므로 send 시엔 prefix를 제외한다.
    // 구독 경로 /user/queue/chat-rooms(= StompAuthChannelInterceptor.USER_CHAT_ROOMS_DESTINATION)와 대응한다.
    private static final String USER_CHAT_ROOMS_SEND_DESTINATION = "/queue/chat-rooms";

    private final PinRepository pinRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final AiBlurJobRepository aiBlurJobRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final Clock clock;

    /** 상태 변경 push 대상(라우팅용 requester id + 방 id). */
    private record NotifyTarget(Long roomId, Long requesterId) {
    }

    /**
     * 검증된 pinId·요청자에 대해 삭제를 반영한다.
     * 존재 확인 → 작성자 권한 확인 → (미삭제면) 소프트 삭제·채팅방 종료 순으로 처리한다.
     * 이미 삭제된 핀이면 최초 삭제 시각을 유지하고 빈 종료 목록으로 멱등 응답을 만든다.
     */
    @Transactional
    public Result apply(UUID pinId, Long memberId) {
        // deleted_at 조건을 제외한 전용 잠금 조회. 이미 삭제된 핀도 함께 잠근다.
        Pin pin = pinRepository.findByIdForDelete(pinId)
                .orElseThrow(() -> new CustomException(ErrorCode.PIN_NOT_FOUND));

        // 핀 존재 확인 후 작성자 권한을 먼저 검증한다.
        if (memberId == null || !memberId.equals(pin.getMember().getId())) {
            throw new CustomException(ErrorCode.PIN_DELETE_FORBIDDEN);
        }

        // 재삭제: deleted_at을 갱신하지 않고 최초 삭제 시각을 반환한다. 채팅방·정리 대상은 이미 처리됐다.
        if (pin.isDeleted()) {
            return new Result(pin.getDeletedAt(), List.of(), List.of());
        }

        Instant deletedAt = clock.instant();
        pin.softDelete(deletedAt);

        List<Long> closedChatRoomIds = closeActiveChatRooms(pinId, memberId, deletedAt);
        List<String> cleanupKeys = collectCleanupKeys(pin, pinId);

        return new Result(deletedAt, closedChatRoomIds, cleanupKeys);
    }

    /** ACTIVE 채팅방만 종료(LEFT 전환)하고 실제로 전환된 방 ID를 반환한다(이미 종료·거절된 방은 대상 아님). */
    private List<Long> closeActiveChatRooms(UUID pinId, Long actorId, Instant changedAt) {
        List<ChatRoom> activeRooms =
                chatRoomRepository.findByPin_IdAndStatus(pinId, ChatRoomStatus.ACTIVE);
        List<Long> closedIds = new ArrayList<>(activeRooms.size());
        List<NotifyTarget> notifyTargets = new ArrayList<>(activeRooms.size());
        for (ChatRoom room : activeRooms) {
            room.close();
            closedIds.add(room.getId());
            notifyTargets.add(new NotifyTarget(room.getId(), room.getRequester().getId()));
        }
        // 종료된 방마다 상대(요청자)에게 커밋 이후 LEFT 상태 변경을 알린다.
        scheduleStatusChangedNotify(pinId, actorId, changedAt, notifyTargets);
        return closedIds;
    }

    /**
     * 종료된 방들에 대해 각 요청자의 개인 큐로 LEFT 상태 변경 이벤트를 커밋 이후 발행하도록 등록한다.
     * actor(핀 소유자 = 각 방의 recipient)에게는 보내지 않으므로 수신자는 항상 requester다.
     */
    private void scheduleStatusChangedNotify(UUID pinId, Long actorId, Instant changedAt,
            List<NotifyTarget> targets) {
        if (targets.isEmpty()) {
            return;
        }
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

    /**
     * 스토리지 정리 대상 키를 수집한다.
     * Pin에 저장된 영상 객체(원본·블러·썸네일)와, PENDING AI 작업의 후보 원본 영상 키를 모은다.
     * null·공백 키는 등록 단계에서 무시되므로 그대로 담는다.
     */
    private List<String> collectCleanupKeys(Pin pin, UUID pinId) {
        List<String> keys = new ArrayList<>();
        keys.add(pin.getOriginalVideoKey());
        keys.add(pin.getBlurredVideoKey());
        keys.add(pin.getThumbnailKey());

        for (AiBlurJob job : aiBlurJobRepository.findByPinIdAndStatus(pinId, AiBlurJobStatus.PENDING)) {
            keys.add(job.getOriginalVideoKey());
        }
        return keys;
    }

    /**
     * 삭제 반영 결과.
     *
     * @param deletedAt         최초 삭제 시각
     * @param closedChatRoomIds 이번 요청에서 종료(ACTIVE→LEFT)된 채팅방 ID(재삭제 시 빈 목록)
     * @param cleanupKeys       커밋 이후 삭제 대상으로 등록할 객체 키(재삭제 시 빈 목록)
     */
    public record Result(
            Instant deletedAt,
            List<Long> closedChatRoomIds,
            List<String> cleanupKeys
    ) {
    }
}
