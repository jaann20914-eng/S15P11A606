package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.pin.dto.PinUnlockResponse;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.s3.S3PresignedUrlGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PinUnlockServiceTest {

    @Mock private PinUnlockPersistenceService pinUnlockPersistenceService;
    @Mock private S3PresignedUrlGenerator s3PresignedUrlGenerator;

    private PinUnlockService service;

    private static final Long MEMBER_ID = 42L;
    private static final String RAW_PIN_ID = "11111111-2222-3333-4444-555555555555";
    private static final UUID PIN_ID = UUID.fromString(RAW_PIN_ID);
    private static final String RAW_KEY = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
    private static final UUID KEY = UUID.fromString(RAW_KEY);
    private static final String BLURRED_KEY = "pins/blurred/key.mp4";
    private static final String VIDEO_URL = "https://bucket.s3/blurred?sig=v";

    @BeforeEach
    void setUp() {
        service = new PinUnlockService(pinUnlockPersistenceService, s3PresignedUrlGenerator);
    }

    @Test
    void 정상_잠금해제면_반영_결과와_새_URL로_응답을_조립한다() {
        given(pinUnlockPersistenceService.apply(PIN_ID, MEMBER_ID, KEY))
                .willReturn(new PinUnlockPersistenceService.Result(PIN_ID, 3, 7, BLURRED_KEY));
        given(s3PresignedUrlGenerator.createDownloadUrl(BLURRED_KEY)).willReturn(VIDEO_URL);

        PinUnlockResponse response = service.unlock(MEMBER_ID, RAW_PIN_ID, RAW_KEY);

        assertThat(response.pinId()).isEqualTo(PIN_ID);
        assertThat(response.creditCharged()).isEqualTo(3);
        assertThat(response.creditBalance()).isEqualTo(7);
        assertThat(response.videoUrl()).isEqualTo(VIDEO_URL);
        assertThat(response.accessGranted()).isTrue();
    }

    @Test
    void pinId_형식이_잘못되면_INVALID_PIN_ID이고_반영하지_않는다() {
        assertThatThrownBy(() -> service.unlock(MEMBER_ID, "not-a-uuid", RAW_KEY))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_PIN_ID);

        verify(pinUnlockPersistenceService, never()).apply(any(), any(), any());
    }

    @Test
    void 멱등성_키가_없으면_IDEMPOTENCY_KEY_REQUIRED이고_반영하지_않는다() {
        assertThatThrownBy(() -> service.unlock(MEMBER_ID, RAW_PIN_ID, null))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.IDEMPOTENCY_KEY_REQUIRED);

        verify(pinUnlockPersistenceService, never()).apply(any(), any(), any());
    }

    @Test
    void 멱등성_키가_빈값이면_IDEMPOTENCY_KEY_REQUIRED이다() {
        assertThatThrownBy(() -> service.unlock(MEMBER_ID, RAW_PIN_ID, "   "))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.IDEMPOTENCY_KEY_REQUIRED);

        verify(pinUnlockPersistenceService, never()).apply(any(), any(), any());
    }

    @Test
    void 멱등성_키_형식이_잘못되면_INVALID_IDEMPOTENCY_KEY이고_반영하지_않는다() {
        assertThatThrownBy(() -> service.unlock(MEMBER_ID, RAW_PIN_ID, "not-a-uuid"))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INVALID_IDEMPOTENCY_KEY);

        verify(pinUnlockPersistenceService, never()).apply(any(), any(), any());
    }

    @Test
    void 반영_중_CustomException은_그대로_전파한다() {
        given(pinUnlockPersistenceService.apply(PIN_ID, MEMBER_ID, KEY))
                .willThrow(new CustomException(ErrorCode.INSUFFICIENT_CREDIT));

        assertThatThrownBy(() -> service.unlock(MEMBER_ID, RAW_PIN_ID, RAW_KEY))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.INSUFFICIENT_CREDIT);

        verify(s3PresignedUrlGenerator, never()).createDownloadUrl(anyString());
    }

    @Test
    void 반영_중_예상치_못한_오류는_PIN_UNLOCK_FAILED로_매핑한다() {
        given(pinUnlockPersistenceService.apply(PIN_ID, MEMBER_ID, KEY))
                .willThrow(new RuntimeException("DB 오류"));

        assertThatThrownBy(() -> service.unlock(MEMBER_ID, RAW_PIN_ID, RAW_KEY))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.PIN_UNLOCK_FAILED);
    }

    @Test
    void 동시_유니크_충돌이면_reconcileExisting으로_결과를_확정한다() {
        given(pinUnlockPersistenceService.apply(PIN_ID, MEMBER_ID, KEY))
                .willThrow(new PinUnlockPersistenceService.ConcurrentUnlockException());
        given(pinUnlockPersistenceService.reconcileExisting(PIN_ID, MEMBER_ID, KEY))
                .willReturn(new PinUnlockPersistenceService.Result(PIN_ID, 0, 7, BLURRED_KEY));
        given(s3PresignedUrlGenerator.createDownloadUrl(BLURRED_KEY)).willReturn(VIDEO_URL);

        PinUnlockResponse response = service.unlock(MEMBER_ID, RAW_PIN_ID, RAW_KEY);

        assertThat(response.creditCharged()).isEqualTo(0);
        assertThat(response.creditBalance()).isEqualTo(7);
        assertThat(response.videoUrl()).isEqualTo(VIDEO_URL);
        assertThat(response.accessGranted()).isTrue();
        verify(pinUnlockPersistenceService).reconcileExisting(PIN_ID, MEMBER_ID, KEY);
    }

    @Test
    void 권한_확정_후_URL_발급_실패면_VIDEO_URL_ISSUE_FAILED이다() {
        given(pinUnlockPersistenceService.apply(PIN_ID, MEMBER_ID, KEY))
                .willReturn(new PinUnlockPersistenceService.Result(PIN_ID, 3, 7, BLURRED_KEY));
        given(s3PresignedUrlGenerator.createDownloadUrl(BLURRED_KEY))
                .willThrow(new RuntimeException("S3 오류"));

        assertThatThrownBy(() -> service.unlock(MEMBER_ID, RAW_PIN_ID, RAW_KEY))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.VIDEO_URL_ISSUE_FAILED);
    }

    @Test
    void 블러_영상_키가_비어_있으면_URL발급없이_VIDEO_URL_ISSUE_FAILED이다() {
        given(pinUnlockPersistenceService.apply(PIN_ID, MEMBER_ID, KEY))
                .willReturn(new PinUnlockPersistenceService.Result(PIN_ID, 3, 7, "  "));

        assertThatThrownBy(() -> service.unlock(MEMBER_ID, RAW_PIN_ID, RAW_KEY))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(ErrorCode.VIDEO_URL_ISSUE_FAILED);

        verify(s3PresignedUrlGenerator, never()).createDownloadUrl(anyString());
    }
}
