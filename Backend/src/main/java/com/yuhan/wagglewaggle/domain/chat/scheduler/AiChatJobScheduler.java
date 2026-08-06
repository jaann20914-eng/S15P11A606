package com.yuhan.wagglewaggle.domain.chat.scheduler;

import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoom;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatRoomStatus;
import com.yuhan.wagglewaggle.domain.chat.message.AiChatAnalysisMessage;
import com.yuhan.wagglewaggle.domain.chat.publisher.AiChatJobPublisher;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatRoomRepository;
import com.yuhan.wagglewaggle.domain.chat.service.AiChatJobService;
import com.yuhan.wagglewaggle.global.properties.AiChatAnalysisProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/**
 * AI 2차 분석 배치 스케줄러. 주기적으로 ACTIVE 채팅방을 순회하며 방별 미분석 메시지를 윈도우로 묶어 발행한다.
 * 방 단위 그룹핑으로 동일 발신자의 메시지 쪼개기(탐지 우회)를 완화한다.
 * 작업 생성(트랜잭션 커밋)과 발행을 분리해, 커밋 이후 발행함으로써 비동기 Publisher Confirm이 커밋 전 도착하는 레이스를 방지한다.
 * (단일 스케줄러 인스턴스 전제. 다중 인스턴스 중복 발행 방지는 별도 티켓.)
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AiChatJobScheduler {

    private final AiChatAnalysisProperties properties;
    private final ChatRoomRepository chatRoomRepository;
    private final AiChatJobService aiChatJobService;
    private final AiChatJobPublisher aiChatJobPublisher;

    @Scheduled(fixedDelayString = "${ai.chat.analysis.interval-ms:5000}")
    public void dispatchAnalysisBatches() {
        if (!properties.enabled()) {
            return;
        }

        List<ChatRoom> rooms = chatRoomRepository.findAllByStatus(ChatRoomStatus.ACTIVE);
        for (ChatRoom room : rooms) {
            try {
                // 작업 생성 트랜잭션이 커밋된 뒤 반환되므로, 이어지는 발행 시점엔 AiChatJob 행이 이미 커밋되어 있다.
                Optional<AiChatAnalysisMessage> message = aiChatJobService.createJobForRoom(room.getId());
                message.ifPresent(aiChatJobPublisher::publish);
            } catch (Exception e) {
                log.error("AI 채팅 분석 배치 처리 실패 (roomId={})", room.getId(), e);
            }
        }
    }
}
