package com.yuhan.wagglewaggle.domain.chat.service;

import com.yuhan.wagglewaggle.domain.chat.entity.AiChatJob;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatMessage;
import com.yuhan.wagglewaggle.domain.chat.message.AiChatAnalysisMessage;
import com.yuhan.wagglewaggle.domain.chat.message.AiChatAnalysisMessage.ChatMessagePayload;
import com.yuhan.wagglewaggle.domain.chat.repository.AiChatJobRepository;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatMessageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.List;
import java.util.Optional;

/**
 * 한 채팅방의 미분석 메시지(방별 max end_message_id 이후)를 윈도우로 묶어 AiChatJob(PENDING)으로 기록하고,
 * 발행할 배치 메시지를 조립해 반환한다. 실제 발행은 트랜잭션 커밋 이후 호출부(스케줄러)가 수행한다
 * (비동기 Publisher Confirm이 커밋 전에 도착해 상태 전환을 놓치는 레이스를 피하기 위함).
 */
@Service
@RequiredArgsConstructor
public class AiChatJobService {

    private final AiChatJobRepository aiChatJobRepository;
    private final ChatMessageRepository chatMessageRepository;
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
}
