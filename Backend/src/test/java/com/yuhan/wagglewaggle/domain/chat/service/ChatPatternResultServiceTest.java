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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ChatPatternResultServiceTest {

    @Mock private AiChatJobRepository aiChatJobRepository;
    @Mock private ChatRoomRepository chatRoomRepository;
    @Mock private ChatWarningRepository chatWarningRepository;
    @Mock private SimpMessagingTemplate messagingTemplate;
    @Captor private ArgumentCaptor<ChatWarning> warningCaptor;
    @Captor private ArgumentCaptor<ChatWarningEvent> eventCaptor;

    private ChatPatternResultService service;

    private static final UUID REQUEST_ID = UUID.fromString("4f7c19da-b64d-4bf5-8a9c-7689e59566ac");
    private static final Long ROOM_ID = 9001L;
    private static final Instant NOW = Instant.parse("2026-08-03T12:00:00Z");
    private static final Instant ANALYZED_AT = Instant.parse("2026-08-03T10:00:00Z");

    @BeforeEach
    void setUp() {
        Clock fixedClock = Clock.fixed(NOW, ZoneOffset.UTC);
        service = new ChatPatternResultService(
                aiChatJobRepository, chatRoomRepository, chatWarningRepository, messagingTemplate, fixedClock);
    }

    private AiChatJob processingJob() {
        AiChatJob job = AiChatJob.create(ROOM_ID, 1L, 5L);
        job.markProcessing();
        ReflectionTestUtils.setField(job, "requestId", REQUEST_ID);
        return job;
    }

    private ChatPatternResultRequest request(PatternResultStatus status, Boolean isRisky, WarningReasonCode reasonCode) {
        return new ChatPatternResultRequest(REQUEST_ID, ROOM_ID, isRisky, reasonCode, status, ANALYZED_AT);
    }

    @Test
    void 위험이면_경고를_저장하고_작업을_완료하며_방에_브로드캐스트한다() {
        AiChatJob job = processingJob();
        ChatRoom room = mock(ChatRoom.class);
        when(aiChatJobRepository.findById(REQUEST_ID)).thenReturn(Optional.of(job));
        when(chatRoomRepository.findById(ROOM_ID)).thenReturn(Optional.of(room));
        when(chatWarningRepository.save(any(ChatWarning.class))).thenAnswer(inv -> inv.getArgument(0));

        service.apply(request(PatternResultStatus.COMPLETED, true, WarningReasonCode.FRAUD_SCAM));

        verify(chatWarningRepository).save(warningCaptor.capture());
        assertThat(warningCaptor.getValue().getReasonCode()).isEqualTo(WarningReasonCode.FRAUD_SCAM);

        assertThat(job.getStatus()).isEqualTo(AiChatJobStatus.COMPLETED);
        assertThat(job.getCompletedAt()).isEqualTo(ANALYZED_AT);

        verify(messagingTemplate).convertAndSend(eq("/topic/chat/rooms/9001"), eventCaptor.capture());
        ChatWarningEvent event = eventCaptor.getValue();
        assertThat(event.eventType()).isEqualTo("WARNING_CREATED");
        assertThat(event.roomId()).isEqualTo(ROOM_ID);
        assertThat(event.occurredAt()).isEqualTo(NOW);
        // data: content = reasonCode 매핑 문구
        assertThat(event.data().reasonCode()).isEqualTo(WarningReasonCode.FRAUD_SCAM);
        assertThat(event.data().content()).isEqualTo(WarningReasonCode.FRAUD_SCAM.getMessage());
    }

    @Test
    void 안전이면_경고없이_작업만_완료한다() {
        AiChatJob job = processingJob();
        when(aiChatJobRepository.findById(REQUEST_ID)).thenReturn(Optional.of(job));

        service.apply(request(PatternResultStatus.COMPLETED, false, null));

        assertThat(job.getStatus()).isEqualTo(AiChatJobStatus.COMPLETED);
        verify(chatWarningRepository, never()).save(any());
        verifyNoInteractions(chatRoomRepository, messagingTemplate);
    }

    @Test
    void 분석실패면_경고없이_작업을_FAILED로_마감한다() {
        AiChatJob job = processingJob();
        when(aiChatJobRepository.findById(REQUEST_ID)).thenReturn(Optional.of(job));

        service.apply(request(PatternResultStatus.FAILED, null, null));

        assertThat(job.getStatus()).isEqualTo(AiChatJobStatus.FAILED);
        assertThat(job.getCompletedAt()).isEqualTo(ANALYZED_AT);
        verifyNoInteractions(chatRoomRepository, chatWarningRepository, messagingTemplate);
    }

    @Test
    void 작업이_없으면_예외를_던진다() {
        when(aiChatJobRepository.findById(REQUEST_ID)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.apply(request(PatternResultStatus.COMPLETED, false, null)))
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(ErrorCode.AI_CHAT_JOB_NOT_FOUND);
    }

    @Test
    void 이미_완료된_작업이면_중복콜백을_무시한다() {
        AiChatJob job = AiChatJob.create(ROOM_ID, 1L, 5L);
        job.markCompleted(Instant.parse("2026-08-03T09:00:00Z"));
        ReflectionTestUtils.setField(job, "requestId", REQUEST_ID);
        when(aiChatJobRepository.findById(REQUEST_ID)).thenReturn(Optional.of(job));

        service.apply(request(PatternResultStatus.COMPLETED, true, WarningReasonCode.FRAUD_SCAM));

        assertThat(job.getStatus()).isEqualTo(AiChatJobStatus.COMPLETED);
        verify(chatWarningRepository, never()).save(any());
        verifyNoInteractions(chatRoomRepository, messagingTemplate);
    }

    @Test
    void 완료인데_isRisky가_없으면_예외를_던진다() {
        AiChatJob job = processingJob();
        when(aiChatJobRepository.findById(REQUEST_ID)).thenReturn(Optional.of(job));

        assertThatThrownBy(() -> service.apply(request(PatternResultStatus.COMPLETED, null, null)))
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_CHAT_PATTERN_RESULT);
        verify(chatWarningRepository, never()).save(any());
    }

    @Test
    void 위험인데_reasonCode가_없으면_예외를_던진다() {
        AiChatJob job = processingJob();
        when(aiChatJobRepository.findById(REQUEST_ID)).thenReturn(Optional.of(job));

        assertThatThrownBy(() -> service.apply(request(PatternResultStatus.COMPLETED, true, null)))
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_CHAT_PATTERN_RESULT);
        verify(chatWarningRepository, never()).save(any());
    }
}
