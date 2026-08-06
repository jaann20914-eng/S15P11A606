package com.yuhan.wagglewaggle.domain.chat.service;

import com.yuhan.wagglewaggle.domain.chat.entity.AiChatJob;
import com.yuhan.wagglewaggle.domain.chat.entity.AiChatJobStatus;
import com.yuhan.wagglewaggle.domain.chat.entity.ChatMessage;
import com.yuhan.wagglewaggle.domain.chat.message.AiChatAnalysisMessage;
import com.yuhan.wagglewaggle.domain.chat.repository.AiChatJobRepository;
import com.yuhan.wagglewaggle.domain.chat.repository.ChatMessageRepository;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.global.properties.AiChatRepublishProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AiChatJobServiceTest {

    @Mock private AiChatJobRepository aiChatJobRepository;
    @Mock private ChatMessageRepository chatMessageRepository;
    @Captor private ArgumentCaptor<AiChatJob> jobCaptor;

    private AiChatJobService service;

    private static final Instant NOW = Instant.parse("2026-08-03T09:12:34Z");
    private static final UUID REQUEST_ID = UUID.fromString("4f7c19da-b64d-4bf5-8a9c-7689e59566ac");

    private static final Duration STALE_THRESHOLD = Duration.ofSeconds(10);
    private static final Duration MAX_RETRY_AGE = Duration.ofMinutes(3);
    // NOW 기준 재발행 경계값. staleBefore = NOW-10s, giveUpBoundary = NOW-3m.
    private static final Instant STALE_BEFORE = NOW.minus(STALE_THRESHOLD);
    private static final Instant GIVE_UP_BOUNDARY = NOW.minus(MAX_RETRY_AGE);

    @BeforeEach
    void setUp() {
        Clock fixedClock = Clock.fixed(NOW, ZoneOffset.UTC);
        AiChatRepublishProperties republishProperties =
                new AiChatRepublishProperties(true, STALE_THRESHOLD, MAX_RETRY_AGE);
        service = new AiChatJobService(
                aiChatJobRepository, chatMessageRepository, republishProperties, fixedClock);
    }

    private ChatMessage message(long id, long senderId, String content) {
        ChatMessage m = mock(ChatMessage.class);
        Member sender = mock(Member.class);
        lenient().when(sender.getId()).thenReturn(senderId);
        lenient().when(m.getId()).thenReturn(id);
        lenient().when(m.getSender()).thenReturn(sender);
        lenient().when(m.getContent()).thenReturn(content);
        return m;
    }

    private AiChatJob job(UUID requestId, long roomId, long startId, long endId, AiChatJobStatus status) {
        AiChatJob job = AiChatJob.create(roomId, startId, endId);
        ReflectionTestUtils.setField(job, "requestId", requestId);
        switch (status) {
            case PROCESSING -> job.markProcessing();
            case FAILED -> job.markFailed(NOW.minusSeconds(30));
            case COMPLETED -> job.markCompleted(NOW.minusSeconds(30));
            case PENDING -> { /* create()가 이미 PENDING */ }
        }
        return job;
    }

    private void stubSaveAssigningRequestId() {
        when(aiChatJobRepository.save(any(AiChatJob.class))).thenAnswer(invocation -> {
            AiChatJob job = invocation.getArgument(0);
            ReflectionTestUtils.setField(job, "requestId", REQUEST_ID);
            return job;
        });
    }

    @Test
    void 새_메시지가_없으면_작업을_만들지_않고_비어있음을_반환한다() {
        when(aiChatJobRepository.findMaxEndMessageIdByChatRoomId(1L)).thenReturn(Optional.of(10L));
        when(chatMessageRepository.findByChatRoomIdAndIdGreaterThanOrderByIdAsc(1L, 10L))
                .thenReturn(List.of());

        Optional<AiChatAnalysisMessage> result = service.createJobForRoom(1L);

        assertThat(result).isEmpty();
        verify(aiChatJobRepository, never()).save(any());
    }

    @Test
    void 미분석_메시지가_있으면_시작끝_구간으로_PENDING_작업을_저장하고_배치를_반환한다() {
        List<ChatMessage> messages = List.of(
                message(5L, 2L, "카카오톡으로 연락해 주세요."),
                message(6L, 3L, "제 전화번호는..."),
                message(7L, 2L, "여기로 보내주세요."));
        when(aiChatJobRepository.findMaxEndMessageIdByChatRoomId(1L)).thenReturn(Optional.empty());
        when(chatMessageRepository.findByChatRoomIdAndIdGreaterThanOrderByIdAsc(1L, 0L))
                .thenReturn(messages);
        stubSaveAssigningRequestId();

        Optional<AiChatAnalysisMessage> result = service.createJobForRoom(1L);

        verify(aiChatJobRepository).save(jobCaptor.capture());
        AiChatJob saved = jobCaptor.getValue();
        assertThat(saved.getChatRoomId()).isEqualTo(1L);
        assertThat(saved.getStartMessageId()).isEqualTo(5L);
        assertThat(saved.getEndMessageId()).isEqualTo(7L);
        assertThat(saved.getStatus()).isEqualTo(AiChatJobStatus.PENDING);

        assertThat(result).isPresent();
        AiChatAnalysisMessage batch = result.get();
        assertThat(batch.requestId()).isEqualTo(REQUEST_ID);
        assertThat(batch.roomId()).isEqualTo(1L);
        assertThat(batch.sentAt()).isEqualTo(NOW);
        assertThat(batch.chatMessages()).hasSize(3);
        // 다중 발신자가 한 배치에 순서대로 담긴다
        assertThat(batch.chatMessages().get(0).senderId()).isEqualTo(2L);
        assertThat(batch.chatMessages().get(0).content()).isEqualTo("카카오톡으로 연락해 주세요.");
        assertThat(batch.chatMessages().get(1).senderId()).isEqualTo(3L);
        assertThat(batch.chatMessages().get(2).senderId()).isEqualTo(2L);
    }

    @Test
    void 이미_발행된_구간이_있으면_그_max_이후_메시지만_조회한다() {
        List<ChatMessage> messages = List.of(message(11L, 2L, "새 메시지"));
        when(aiChatJobRepository.findMaxEndMessageIdByChatRoomId(1L)).thenReturn(Optional.of(10L));
        when(chatMessageRepository.findByChatRoomIdAndIdGreaterThanOrderByIdAsc(1L, 10L))
                .thenReturn(messages);
        stubSaveAssigningRequestId();

        Optional<AiChatAnalysisMessage> result = service.createJobForRoom(1L);

        verify(chatMessageRepository).findByChatRoomIdAndIdGreaterThanOrderByIdAsc(eq(1L), eq(10L));
        verify(aiChatJobRepository).save(jobCaptor.capture());
        assertThat(jobCaptor.getValue().getStartMessageId()).isEqualTo(11L);
        assertThat(jobCaptor.getValue().getEndMessageId()).isEqualTo(11L);
        assertThat(result).isPresent();
        assertThat(result.get().chatMessages()).hasSize(1);
    }

    @Test
    void 재발행_대상을_stale_before와_give_up_경계로_조회한다() {
        service.prepareRepublishBatch();

        verify(aiChatJobRepository).findGiveUpTargets(
                eq(List.of(AiChatJobStatus.PENDING, AiChatJobStatus.PROCESSING)),
                eq(GIVE_UP_BOUNDARY));
        verify(aiChatJobRepository).findRepublishTargets(
                eq(List.of(AiChatJobStatus.PENDING, AiChatJobStatus.PROCESSING, AiChatJobStatus.FAILED)),
                eq(STALE_BEFORE),
                eq(GIVE_UP_BOUNDARY));
    }

    @Test
    void 포기_나이를_넘긴_미완료_작업은_FAILED로_마감한다() {
        AiChatJob pendingOld = job(REQUEST_ID, 1L, 5L, 7L, AiChatJobStatus.PENDING);
        AiChatJob processingOld = job(UUID.randomUUID(), 2L, 3L, 4L, AiChatJobStatus.PROCESSING);
        when(aiChatJobRepository.findGiveUpTargets(any(), eq(GIVE_UP_BOUNDARY)))
                .thenReturn(List.of(pendingOld, processingOld));

        service.prepareRepublishBatch();

        assertThat(pendingOld.getStatus()).isEqualTo(AiChatJobStatus.FAILED);
        assertThat(pendingOld.getCompletedAt()).isEqualTo(NOW);
        assertThat(processingOld.getStatus()).isEqualTo(AiChatJobStatus.FAILED);
        assertThat(processingOld.getCompletedAt()).isEqualTo(NOW);
    }

    @Test
    void FAILED_재발행_대상은_PENDING으로_되돌리고_구간_메시지로_배치를_재조립한다() {
        AiChatJob failed = job(REQUEST_ID, 1L, 5L, 7L, AiChatJobStatus.FAILED);
        List<ChatMessage> windowMessages = List.of(
                message(5L, 2L, "카카오톡으로 연락해 주세요."),
                message(6L, 3L, "제 전화번호는..."),
                message(7L, 2L, "여기로 보내주세요."));
        when(aiChatJobRepository.findRepublishTargets(any(), any(), any()))
                .thenReturn(List.of(failed));
        when(chatMessageRepository.findByChatRoomIdAndIdBetweenOrderByIdAsc(1L, 5L, 7L))
                .thenReturn(windowMessages);

        List<AiChatAnalysisMessage> result = service.prepareRepublishBatch();

        // FAILED → PENDING 리셋(콜백 terminal 무시 방지), 완료 시각도 비워진다.
        assertThat(failed.getStatus()).isEqualTo(AiChatJobStatus.PENDING);
        assertThat(failed.getCompletedAt()).isNull();

        assertThat(result).hasSize(1);
        AiChatAnalysisMessage batch = result.getFirst();
        assertThat(batch.requestId()).isEqualTo(REQUEST_ID);
        assertThat(batch.roomId()).isEqualTo(1L);
        assertThat(batch.sentAt()).isEqualTo(NOW);
        assertThat(batch.chatMessages()).hasSize(3);
        assertThat(batch.chatMessages().getFirst().senderId()).isEqualTo(2L);
        assertThat(batch.chatMessages().getFirst().content()).isEqualTo("카카오톡으로 연락해 주세요.");
    }

    @Test
    void PENDING_PROCESSING_재발행_대상은_상태를_바꾸지_않고_재조립한다() {
        AiChatJob pending = job(REQUEST_ID, 1L, 5L, 5L, AiChatJobStatus.PENDING);
        AiChatJob processing = job(UUID.randomUUID(), 2L, 8L, 8L, AiChatJobStatus.PROCESSING);
        List<ChatMessage> roomOneMessages = List.of(message(5L, 2L, "메시지 A"));
        List<ChatMessage> roomTwoMessages = List.of(message(8L, 3L, "메시지 B"));
        when(aiChatJobRepository.findRepublishTargets(any(), any(), any()))
                .thenReturn(List.of(pending, processing));
        when(chatMessageRepository.findByChatRoomIdAndIdBetweenOrderByIdAsc(1L, 5L, 5L))
                .thenReturn(roomOneMessages);
        when(chatMessageRepository.findByChatRoomIdAndIdBetweenOrderByIdAsc(2L, 8L, 8L))
                .thenReturn(roomTwoMessages);

        List<AiChatAnalysisMessage> result = service.prepareRepublishBatch();

        assertThat(pending.getStatus()).isEqualTo(AiChatJobStatus.PENDING);
        assertThat(processing.getStatus()).isEqualTo(AiChatJobStatus.PROCESSING);
        assertThat(result).hasSize(2);
    }

    @Test
    void 구간_메시지가_모두_사라진_대상은_재발행에서_스킵한다() {
        AiChatJob orphan = job(REQUEST_ID, 1L, 5L, 7L, AiChatJobStatus.PENDING);
        when(aiChatJobRepository.findRepublishTargets(any(), any(), any()))
                .thenReturn(List.of(orphan));
        when(chatMessageRepository.findByChatRoomIdAndIdBetweenOrderByIdAsc(1L, 5L, 7L))
                .thenReturn(List.of());

        List<AiChatAnalysisMessage> result = service.prepareRepublishBatch();

        assertThat(result).isEmpty();
    }

    @Test
    void 재발행_대상이_없으면_빈_리스트를_반환한다() {
        List<AiChatAnalysisMessage> result = service.prepareRepublishBatch();

        assertThat(result).isEmpty();
        verify(chatMessageRepository, never()).findByChatRoomIdAndIdBetweenOrderByIdAsc(any(), any(), any());
    }
}
