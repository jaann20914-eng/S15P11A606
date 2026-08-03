package com.yuhan.wagglewaggle.domain.chat.service;

import com.yuhan.wagglewaggle.domain.chat.dto.ChatPatternResultRequest;
import com.yuhan.wagglewaggle.domain.chat.dto.ChatWarningEvent;
import com.yuhan.wagglewaggle.domain.chat.dto.PatternResultStatus;
import com.yuhan.wagglewaggle.domain.chat.entity.AiChatJob;
import com.yuhan.wagglewaggle.domain.chat.entity.AiChatJobStatus;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatWarning;
import com.yuhan.wagglewaggle.domain.chat.entity.WarningReasonCode;
import com.yuhan.wagglewaggle.domain.chat.repository.AiChatJobRepository;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatWarningRepository;
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

/**
 * AI Worker의 패턴 분석 결과 콜백을 반영하는 트랜잭션 서비스.
 *
 * <ol>
 *   <li>requestId로 AiChatJob을 조회한다(없으면 예외).</li>
 *   <li>이미 COMPLETED/FAILED면 중복 콜백으로 보고 추가 변경 없이 종료한다(멱등).</li>
 *   <li>status=FAILED → 작업을 FAILED로 마감(경고·push 없음).</li>
 *   <li>status=COMPLETED & isRisky=false → 작업을 COMPLETED로 마감(경고·push 없음).</li>
 *   <li>status=COMPLETED & isRisky=true → ChatWarning 저장 + 작업 COMPLETED + 커밋 이후 방 토픽에 경고 브로드캐스트.</li>
 * </ol>
 *
 * <p>메시지 자체는 차단·수정·삭제하지 않는다. roomId는 참고용이며 처리 로직은 작업의 chat_room_id를 기준으로 한다.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ChatPatternResultService {

    private static final String CHAT_ROOM_TOPIC_PREFIX = "/topic/chat/rooms/";

    private final AiChatJobRepository aiChatJobRepository;
    private final ChatRoomRepository chatRoomRepository;
    private final ChatWarningRepository chatWarningRepository;
    private final SimpMessagingTemplate messagingTemplate;
    private final Clock clock;

    @Transactional
    public void apply(ChatPatternResultRequest request) {
        AiChatJob job = aiChatJobRepository.findById(request.requestId())
                .orElseThrow(() -> new CustomException(ErrorCode.AI_CHAT_JOB_NOT_FOUND));

        if (isTerminal(job.getStatus())) {
            log.info("이미 처리된 AI 채팅 작업의 중복 콜백 무시 (requestId={}, status={})",
                    request.requestId(), job.getStatus());
            return;
        }

        warnIfRoomMismatch(request, job);

        Instant analyzedAt = request.analyzedAt() != null ? request.analyzedAt() : clock.instant();

        if (request.status() == PatternResultStatus.FAILED) {
            job.markFailed(analyzedAt);
            log.info("AI 채팅 분석 실패 콜백 반영 → FAILED (requestId={})", request.requestId());
            return;
        }

        // status == COMPLETED
        if (request.isRisky() == null) {
            throw new CustomException(ErrorCode.INVALID_CHAT_PATTERN_RESULT);
        }

        if (!request.isRisky()) {
            job.markCompleted(analyzedAt);
            return;
        }

        // 위험 감지 → 경고 저장 + 방 브로드캐스트
        if (request.reasonCode() == null) {
            throw new CustomException(ErrorCode.INVALID_CHAT_PATTERN_RESULT);
        }

        Long roomId = job.getChatRoomId();
        ChatRoom room = chatRoomRepository.findById(roomId)
                .orElseThrow(() -> new CustomException(ErrorCode.CHAT_ROOM_NOT_FOUND));
        WarningReasonCode reasonCode = request.reasonCode();

        ChatWarning warning = chatWarningRepository.save(ChatWarning.create(room, reasonCode));
        job.markCompleted(analyzedAt);
        log.info("AI 채팅 위험 패턴 감지 → 경고 저장 (requestId={}, roomId={}, reasonCode={})",
                request.requestId(), roomId, reasonCode);

        // content는 reasonCode에 매핑된 사용자 안내 문구를 싣는다.
        String content = reasonCode.getMessage();
        Instant warnedAt = warning.getCreatedAt();

        // 저장 커밋 이후에만 경고를 push한다(롤백 시 잘못된 경고 전송 방지).
        runAfterCommit(() -> messagingTemplate.convertAndSend(
                CHAT_ROOM_TOPIC_PREFIX + roomId,
                ChatWarningEvent.of(roomId, reasonCode, content, warnedAt, Instant.now(clock))));
    }

    private boolean isTerminal(AiChatJobStatus status) {
        return status == AiChatJobStatus.COMPLETED || status == AiChatJobStatus.FAILED;
    }

    private void warnIfRoomMismatch(ChatPatternResultRequest request, AiChatJob job) {
        if (request.roomId() != null && !request.roomId().equals(job.getChatRoomId())) {
            log.warn("콜백 roomId({})와 작업 chat_room_id({})가 다르다. 작업 기준으로 처리한다. (requestId={})",
                    request.roomId(), job.getChatRoomId(), request.requestId());
        }
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
}
