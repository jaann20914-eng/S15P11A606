package com.yuhan.wagglewaggle.domain.chat.service;

import com.yuhan.wagglewaggle.domain.chat.entity.AiChatJob;
import com.yuhan.wagglewaggle.domain.chat.entity.AiChatJobStatus;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatMessage;
import com.yuhan.wagglewaggle.domain.chat.message.AiChatAnalysisMessage;
import com.yuhan.wagglewaggle.domain.chat.message.AiChatAnalysisMessage.ChatMessagePayload;
import com.yuhan.wagglewaggle.domain.chat.repository.AiChatJobRepository;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatMessageRepository;
import com.yuhan.wagglewaggle.global.properties.AiChatRepublishProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * 한 채팅방의 미분석 메시지(방별 max end_message_id 이후)를 윈도우로 묶어 AiChatJob(PENDING)으로 기록하고,
 * 발행할 배치 메시지를 조립해 반환한다. 실제 발행은 트랜잭션 커밋 이후 호출부(스케줄러)가 수행한다
 * (비동기 Publisher Confirm이 커밋 전에 도착해 상태 전환을 놓치는 레이스를 피하기 위함).
 *
 * <p>또한 오래 미완료(PENDING/PROCESSING/FAILED)로 남은 작업을 재발행 대상으로 골라 배치를 재조립한다
 * ({@link #prepareRepublishBatch()}). 이 역시 상태 변경(포기·리셋)을 트랜잭션에서 커밋한 뒤 호출부가 발행한다.</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AiChatJobService {

    // 재발행 대상 상태(미완료). FAILED는 콜백이 terminal로 무시되므로 재발행 전 PENDING으로 되돌린다.
    private static final List<AiChatJobStatus> REPUBLISH_STATUSES =
            List.of(AiChatJobStatus.PENDING, AiChatJobStatus.PROCESSING, AiChatJobStatus.FAILED);
    // 포기(FAILED 마감) 대상 상태. 이미 FAILED인 작업은 재차 마감할 필요가 없다.
    private static final List<AiChatJobStatus> GIVE_UP_STATUSES =
            List.of(AiChatJobStatus.PENDING, AiChatJobStatus.PROCESSING);

    private final AiChatJobRepository aiChatJobRepository;
    private final ChatMessageRepository chatMessageRepository;
    private final AiChatRepublishProperties republishProperties;
    private final Clock clock;

    /**
     * 방의 미분석 메시지를 조회해 새 작업을 만든다. 새 메시지가 없으면 빈 Optional을 반환하고 아무것도 저장하지 않는다.
     * payload(senderId·원문 content)는 LAZY 연관 접근 문제를 피하기 위해 이 트랜잭션 안에서 조립한다.
     */
    @Transactional
    public Optional<AiChatAnalysisMessage> createJobForRoom(Long roomId) {
        long afterId = aiChatJobRepository.findMaxEndMessageIdByChatRoomId(roomId).orElse(0L);

        List<ChatMessage> messages =
                chatMessageRepository.findByChatRoomIdAndIdGreaterThanOrderByIdAsc(roomId, afterId);
        if (messages.isEmpty()) {
            return Optional.empty();
        }

        Long startMessageId = messages.getFirst().getId();
        Long endMessageId = messages.getLast().getId();

        AiChatJob job = aiChatJobRepository.save(AiChatJob.create(roomId, startMessageId, endMessageId));

        List<ChatMessagePayload> payloads = messages.stream()
                .map(m -> new ChatMessagePayload(m.getSender().getId(), m.getContent()))
                .toList();

        return Optional.of(new AiChatAnalysisMessage(job.getRequestId(), roomId, clock.instant(), payloads));
    }

    /**
     * 오래 미완료로 남은 작업을 재발행 대상으로 선별해 배치를 재조립한다.
     *
     * <ol>
     *   <li>최대 재시도 나이(maxRetryAge)를 넘긴 PENDING/PROCESSING 작업은 재발행을 포기하고 FAILED로 마감한다.</li>
     *   <li>생성된 지 staleThreshold 이상 지났고 아직 포기 나이를 넘지 않은 미완료 작업을 재발행 대상으로 고른다.</li>
     *   <li>FAILED 대상은 콜백이 terminal로 무시되지 않도록 PENDING으로 되돌린다.</li>
     *   <li>저장된 구간(start~end)의 메시지로 payload를 재조립해 배치 메시지를 만든다(구간 메시지가 없으면 스킵).</li>
     * </ol>
     *
     * <p>상태 변경(포기·리셋)은 이 트랜잭션에서 커밋되고, 실제 발행은 호출부(스케줄러)가 커밋 이후 수행한다.</p>
     */
    @Transactional
    public List<AiChatAnalysisMessage> prepareRepublishBatch() {
        Instant now = clock.instant();
        Instant staleBefore = now.minus(republishProperties.staleThreshold());
        Instant giveUpBoundary = now.minus(republishProperties.maxRetryAge());

        // 1. 포기: 최대 재시도 나이를 넘긴 미완료 작업을 FAILED로 마감한다.
        List<AiChatJob> giveUpTargets = aiChatJobRepository.findGiveUpTargets(GIVE_UP_STATUSES, giveUpBoundary);
        for (AiChatJob job : giveUpTargets) {
            job.markFailed(now);
            log.info("AI 채팅 작업 재발행 포기 → FAILED (requestId={}, createdAt={})",
                    job.getRequestId(), job.getCreatedAt());
        }

        // 2. 재발행 대상 선별: stale하고 아직 포기 나이가 아닌 미완료 작업.
        List<AiChatJob> targets =
                aiChatJobRepository.findRepublishTargets(REPUBLISH_STATUSES, staleBefore, giveUpBoundary);

        List<AiChatAnalysisMessage> messages = new ArrayList<>();
        for (AiChatJob job : targets) {
            // FAILED는 재발행 전에 PENDING으로 되돌려야 Worker 콜백이 반영된다.
            if (job.getStatus() == AiChatJobStatus.FAILED) {
                job.reopenToPending();
            }

            List<ChatMessage> windowMessages = chatMessageRepository
                    .findByChatRoomIdAndIdBetweenOrderByIdAsc(
                            job.getChatRoomId(), job.getStartMessageId(), job.getEndMessageId());
            if (windowMessages.isEmpty()) {
                // 구간 메시지가 모두 사라진 비정상 상황. 재발행할 내용이 없으므로 스킵한다.
                log.warn("AI 채팅 작업 재발행 구간 메시지가 없어 스킵 (requestId={}, roomId={}, start={}, end={})",
                        job.getRequestId(), job.getChatRoomId(), job.getStartMessageId(), job.getEndMessageId());
                continue;
            }

            List<ChatMessagePayload> payloads = windowMessages.stream()
                    .map(m -> new ChatMessagePayload(m.getSender().getId(), m.getContent()))
                    .toList();
            messages.add(new AiChatAnalysisMessage(job.getRequestId(), job.getChatRoomId(), now, payloads));
        }
        return messages;
    }
}
