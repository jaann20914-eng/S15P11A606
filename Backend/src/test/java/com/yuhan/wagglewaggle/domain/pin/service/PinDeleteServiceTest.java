package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.blur.service.VideoObjectCleanupPort;
import com.yuhan.wagglewaggle.domain.pin.dto.PinDeleteResponse;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PinDeleteServiceTest {

    @Mock private PinDeletePersistenceService pinDeletePersistenceService;
    @Mock private VideoObjectCleanupPort videoObjectCleanupPort;

    private PinDeleteService service;

    private static final Long MEMBER_ID = 42L;
    private static final String RAW_PIN_ID = "11111111-2222-3333-4444-555555555555";
    private static final UUID PIN_ID = UUID.fromString(RAW_PIN_ID);
    private static final Instant DELETED_AT = Instant.parse("2026-08-02T00:00:00Z");

    @BeforeEach
    void setUp() {
        service = new PinDeleteService(pinDeletePersistenceService, videoObjectCleanupPort);
    }

    @Test
    void 정상_삭제하면_DELETED_응답을_반환하고_커밋_이후_정리대상을_등록한다() {
        given(pinDeletePersistenceService.apply(PIN_ID, MEMBER_ID))
                .willReturn(new PinDeletePersistenceService.Result(
                        DELETED_AT, List.of(1L), List.of("key-a", "key-b")));

        PinDeleteResponse response = service.delete(MEMBER_ID, RAW_PIN_ID);

        assertThat(response.pinId()).isEqualTo(PIN_ID);
        assertThat(response.status()).isEqualTo("DELETED");
        assertThat(response.closedChatRoomIds()).containsExactly(1L);
        assertThat(response.deletedAt()).isEqualTo(DELETED_AT);

        // 반영(apply)이 정리 대상 등록보다 먼저 일어난다 — DB 커밋 후 등록.
        InOrder inOrder = inOrder(pinDeletePersistenceService, videoObjectCleanupPort);
        inOrder.verify(pinDeletePersistenceService).apply(PIN_ID, MEMBER_ID);
        inOrder.verify(videoObjectCleanupPort).registerForDeletion("key-a");
        inOrder.verify(videoObjectCleanupPort).registerForDeletion("key-b");
    }

    @Test
    void pinId_형식이_잘못되면_INVALID_PIN_ID이고_반영하지_않는다() {
        assertThatThrownBy(() -> service.delete(MEMBER_ID, "not-a-uuid"))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_PIN_ID);

        verify(pinDeletePersistenceService, never()).apply(any(), any());
    }

    @Test
    void 반영_중_CustomException은_그대로_전파한다() {
        given(pinDeletePersistenceService.apply(PIN_ID, MEMBER_ID))
                .willThrow(new CustomException(ErrorCode.PIN_DELETE_FORBIDDEN));

        assertThatThrownBy(() -> service.delete(MEMBER_ID, RAW_PIN_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PIN_DELETE_FORBIDDEN);

        verify(videoObjectCleanupPort, never()).registerForDeletion(any());
    }

    @Test
    void 반영_중_예상치_못한_오류는_PIN_DELETE_FAILED로_매핑한다() {
        given(pinDeletePersistenceService.apply(PIN_ID, MEMBER_ID))
                .willThrow(new RuntimeException("DB 오류"));

        assertThatThrownBy(() -> service.delete(MEMBER_ID, RAW_PIN_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PIN_DELETE_FAILED);
    }

    @Test
    void 정리대상_등록이_실패해도_삭제_응답을_반환한다() {
        given(pinDeletePersistenceService.apply(PIN_ID, MEMBER_ID))
                .willReturn(new PinDeletePersistenceService.Result(
                        DELETED_AT, List.of(), List.of("key-a")));
        org.mockito.BDDMockito.willThrow(new RuntimeException("storage down"))
                .given(videoObjectCleanupPort).registerForDeletion(eq("key-a"));

        PinDeleteResponse response = service.delete(MEMBER_ID, RAW_PIN_ID);

        assertThat(response.status()).isEqualTo("DELETED");
        assertThat(response.deletedAt()).isEqualTo(DELETED_AT);
    }
}
