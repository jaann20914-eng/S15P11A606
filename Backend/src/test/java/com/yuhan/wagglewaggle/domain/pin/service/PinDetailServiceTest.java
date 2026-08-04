package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.pin.dto.ChatRequestState;
import com.yuhan.wagglewaggle.domain.pin.dto.PinDetail;
import com.yuhan.wagglewaggle.domain.pin.dto.PinDetailResponse;
import com.yuhan.wagglewaggle.domain.pin.dto.PinDetailView;
import com.yuhan.wagglewaggle.domain.pin.dto.PinViewerAccess;
import com.yuhan.wagglewaggle.domain.pin.dto.VideoAccessLevel;
import com.yuhan.wagglewaggle.domain.pin.entity.CrowdLevel;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import com.yuhan.wagglewaggle.global.s3.S3PresignedUrlGenerator;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class PinDetailServiceTest {

    @Mock private PinDetailQueryService pinDetailQueryService;
    @Mock private S3PresignedUrlGenerator s3PresignedUrlGenerator;

    private PinDetailService service;

    private static final UUID PIN_ID = UUID.fromString("15ab5bf8-3395-49ee-a046-32d51373ffab");
    private static final String PIN_ID_STR = PIN_ID.toString();
    private static final Long MEMBER_ID = 42L;
    private static final String BLURRED_KEY = "pins/blurred/42/blurred.mp4";
    private static final String THUMBNAIL_KEY = "pins/thumbnail/42/thumb.jpg";
    private static final String VIDEO_URL = "https://bucket.s3/blurred?sig=video";
    private static final String THUMBNAIL_URL = "https://bucket.s3/thumb?sig=thumb";

    @BeforeEach
    void setUp() {
        service = new PinDetailService(pinDetailQueryService, s3PresignedUrlGenerator);
    }

    /** 지정한 접근 정보를 갖는, 키가 정상인 상세 조회 결과를 만든다. */
    private PinDetailView view(PinViewerAccess access) {
        return view(access, BLURRED_KEY, THUMBNAIL_KEY);
    }

    private PinDetailView view(PinViewerAccess access, String blurredKey, String thumbnailKey) {
        PinDetail detail = new PinDetail(
                PIN_ID, java.math.BigDecimal.valueOf(90), "와글러", Instant.parse("2026-07-28T03:20:00Z"),
                1L, "1372855768", "바나프레소 테헤란로점", 37.501123, 127.039625,
                CrowdLevel.WAGLE, "2층 창가 좌석", "점심시간 기준",
                List.of("조용함", "콘센트"), blurredKey, thumbnailKey,
                Instant.parse("2026-07-28T04:20:00Z"));
        return new PinDetailView(detail, access);
    }

    private PinViewerAccess ownerAccess() {
        return new PinViewerAccess(VideoAccessLevel.OWNER, null, ChatRequestState.NONE, false);
    }

    private PinViewerAccess unlockedAccess() {
        return new PinViewerAccess(VideoAccessLevel.UNLOCKED, true, ChatRequestState.NONE, true);
    }

    private PinViewerAccess previewAccess() {
        return new PinViewerAccess(VideoAccessLevel.PREVIEW_BLURRED, null, ChatRequestState.NONE, false);
    }

    private void stubUrls() {
        lenient().when(s3PresignedUrlGenerator.createDownloadUrl(BLURRED_KEY)).thenReturn(VIDEO_URL);
        lenient().when(s3PresignedUrlGenerator.createDownloadUrl(THUMBNAIL_KEY)).thenReturn(THUMBNAIL_URL);
    }

    @Test
    void 잘못된_pinId_형식이면_INVALID_PIN_ID이고_조회하지_않는다() {
        assertThatThrownBy(() -> service.getPinDetail("not-a-uuid", MEMBER_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_PIN_ID);
        verifyNoInteractions(pinDetailQueryService);
        verifyNoInteractions(s3PresignedUrlGenerator);
    }

    @Test
    void 정상_조회시_응답_필드를_매핑하고_Presigned_URL을_발급한다() {
        given(pinDetailQueryService.getPinDetail(PIN_ID, MEMBER_ID)).willReturn(view(ownerAccess()));
        stubUrls();

        PinDetailResponse res = service.getPinDetail(PIN_ID_STR, MEMBER_ID);

        assertThat(res.pinId()).isEqualTo(PIN_ID);
        assertThat(res.authorViewAngle()).isEqualByComparingTo(java.math.BigDecimal.valueOf(90));
        assertThat(res.authorNickname()).isEqualTo("와글러");
        assertThat(res.createdAt()).isEqualTo(Instant.parse("2026-07-28T03:20:00Z"));
        assertThat(res.expiresAt()).isEqualTo(Instant.parse("2026-07-28T04:20:00Z"));
        assertThat(res.place().placeId()).isEqualTo(1L);
        assertThat(res.place().kakaoPlaceId()).isEqualTo("1372855768");
        assertThat(res.place().name()).isEqualTo("바나프레소 테헤란로점");
        assertThat(res.place().latitude()).isEqualTo(37.501123);
        assertThat(res.place().longitude()).isEqualTo(127.039625);
        assertThat(res.crowdLevel()).isEqualTo(CrowdLevel.WAGLE);
        assertThat(res.detailLocation()).isEqualTo("2층 창가 좌석");
        assertThat(res.memo()).isEqualTo("점심시간 기준");
        assertThat(res.tags()).containsExactly("조용함", "콘센트");
        assertThat(res.videoAccess()).isEqualTo(VideoAccessLevel.OWNER);
        assertThat(res.isEvaluated()).isNull();
        assertThat(res.videoUrl()).isEqualTo(VIDEO_URL);
        assertThat(res.thumbnailUrl()).isEqualTo(THUMBNAIL_URL);
        assertThat(res.canRequestChat()).isFalse();
        assertThat(res.chatRequestState()).isEqualTo(ChatRequestState.NONE);

        // videoUrl은 blurred key, thumbnailUrl은 thumbnail key로 발급한다.
        verify(s3PresignedUrlGenerator).createDownloadUrl(BLURRED_KEY);
        verify(s3PresignedUrlGenerator).createDownloadUrl(THUMBNAIL_KEY);
    }

    @Test
    void OWNER_UNLOCKED_PREVIEW_BLURRED_모두_동일한_블러_영상과_썸네일_URL을_발급한다() {
        stubUrls();
        for (PinViewerAccess access : List.of(ownerAccess(), unlockedAccess(), previewAccess())) {
            given(pinDetailQueryService.getPinDetail(PIN_ID, MEMBER_ID)).willReturn(view(access));

            PinDetailResponse res = service.getPinDetail(PIN_ID_STR, MEMBER_ID);

            assertThat(res.videoUrl()).isEqualTo(VIDEO_URL);
            assertThat(res.thumbnailUrl()).isEqualTo(THUMBNAIL_URL);
        }
    }

    @Test
    void detailLocation과_memo가_null이고_태그가_없으면_null과_빈배열로_응답한다() {
        PinDetail detail = new PinDetail(
                PIN_ID, java.math.BigDecimal.valueOf(90), "와글러", Instant.parse("2026-07-28T03:20:00Z"),
                1L, "1372855768", "바나프레소 테헤란로점", 37.501123, 127.039625,
                CrowdLevel.WAGLE, null, null,
                List.of(), BLURRED_KEY, THUMBNAIL_KEY,
                Instant.parse("2026-07-28T04:20:00Z"));
        given(pinDetailQueryService.getPinDetail(PIN_ID, MEMBER_ID))
                .willReturn(new PinDetailView(detail, ownerAccess()));
        stubUrls();

        PinDetailResponse res = service.getPinDetail(PIN_ID_STR, MEMBER_ID);

        assertThat(res.detailLocation()).isNull();
        assertThat(res.memo()).isNull();
        assertThat(res.tags()).isEmpty();
        // null·빈 값이어도 미디어 URL은 정상 발급된다.
        assertThat(res.videoUrl()).isEqualTo(VIDEO_URL);
        assertThat(res.thumbnailUrl()).isEqualTo(THUMBNAIL_URL);
    }

    @Test
    void 조회할_수_없는_핀이면_PIN_NOT_FOUND를_그대로_전파한다() {
        given(pinDetailQueryService.getPinDetail(PIN_ID, MEMBER_ID))
                .willThrow(new CustomException(ErrorCode.PIN_NOT_FOUND));

        assertThatThrownBy(() -> service.getPinDetail(PIN_ID_STR, MEMBER_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.PIN_NOT_FOUND);
        verifyNoInteractions(s3PresignedUrlGenerator);
    }

    @Test
    void blurredVideoKey가_누락되면_PIN_DETAIL_FETCH_FAILED이고_URL을_발급하지_않는다() {
        given(pinDetailQueryService.getPinDetail(PIN_ID, MEMBER_ID))
                .willReturn(view(ownerAccess(), null, THUMBNAIL_KEY));

        assertThatThrownBy(() -> service.getPinDetail(PIN_ID_STR, MEMBER_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.PIN_DETAIL_FETCH_FAILED);
        verify(s3PresignedUrlGenerator, never()).createDownloadUrl(anyString());
    }

    @Test
    void thumbnailKey가_누락되면_PIN_DETAIL_FETCH_FAILED이고_URL을_발급하지_않는다() {
        given(pinDetailQueryService.getPinDetail(PIN_ID, MEMBER_ID))
                .willReturn(view(ownerAccess(), BLURRED_KEY, "  "));

        assertThatThrownBy(() -> service.getPinDetail(PIN_ID_STR, MEMBER_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.PIN_DETAIL_FETCH_FAILED);
        verify(s3PresignedUrlGenerator, never()).createDownloadUrl(anyString());
    }

    @Test
    void 첫_URL_발급_실패면_MEDIA_URL_ISSUE_FAILED로_처리한다() {
        given(pinDetailQueryService.getPinDetail(PIN_ID, MEMBER_ID)).willReturn(view(ownerAccess()));
        given(s3PresignedUrlGenerator.createDownloadUrl(BLURRED_KEY))
                .willThrow(new RuntimeException("presign failed"));

        assertThatThrownBy(() -> service.getPinDetail(PIN_ID_STR, MEMBER_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.MEDIA_URL_ISSUE_FAILED);
    }

    @Test
    void 첫_URL_성공후_두번째_실패해도_부분응답없이_MEDIA_URL_ISSUE_FAILED로_처리한다() {
        given(pinDetailQueryService.getPinDetail(PIN_ID, MEMBER_ID)).willReturn(view(ownerAccess()));
        given(s3PresignedUrlGenerator.createDownloadUrl(BLURRED_KEY)).willReturn(VIDEO_URL);
        given(s3PresignedUrlGenerator.createDownloadUrl(THUMBNAIL_KEY))
                .willThrow(new RuntimeException("presign failed"));

        assertThatThrownBy(() -> service.getPinDetail(PIN_ID_STR, MEMBER_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.MEDIA_URL_ISSUE_FAILED);
    }

    @Test
    void 예기치_못한_오류는_PIN_DETAIL_FETCH_FAILED로_매핑한다() {
        given(pinDetailQueryService.getPinDetail(PIN_ID, MEMBER_ID))
                .willThrow(new IllegalStateException("boom"));

        assertThatThrownBy(() -> service.getPinDetail(PIN_ID_STR, MEMBER_ID))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.PIN_DETAIL_FETCH_FAILED);
    }
}
