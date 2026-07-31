package com.yuhan.wagglewaggle.domain.pin.tag.service;

import com.yuhan.wagglewaggle.domain.pin.dto.TaggedPinsResponse;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.pin.service.PinCardAssembler;
import com.yuhan.wagglewaggle.domain.place.dto.PinCard;
import com.yuhan.wagglewaggle.domain.search.entity.SearchHistory;
import com.yuhan.wagglewaggle.domain.search.entity.SearchType;
import com.yuhan.wagglewaggle.domain.search.repository.SearchHistoryRepository;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
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
import static org.mockito.ArgumentMatchers.anyDouble;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TaggedPinServiceTest {

    @Mock private PinRepository pinRepository;
    @Mock private MemberRepository memberRepository;
    @Mock private SearchHistoryRepository searchHistoryRepository;
    @Mock private PinCardAssembler pinCardAssembler;

    private TaggedPinService taggedPinService;

    private static final Long MEMBER_ID = 42L;
    // 유효한 지도 경계(남서 < 북동, 범위 내).
    private static final double SW_LAT = 37.49;
    private static final double SW_LNG = 127.02;
    private static final double NE_LAT = 37.51;
    private static final double NE_LNG = 127.04;

    private static final PinCard SAMPLE_CARD = new PinCard(
            UUID.fromString("00000000-0000-0000-0000-000000000001"),
            "준호", 92, Instant.parse("2026-07-31T05:00:00Z"),
            "메모", "pins/1/thumb.jpg", false, List.of("카페", "감성"));

    @BeforeEach
    void setUp() {
        // 정규화·경계 검증은 실제 TagQueryNormalizer로 수행해 검증 로직을 그대로 시험한다.
        taggedPinService = new TaggedPinService(
                pinRepository, memberRepository, searchHistoryRepository,
                pinCardAssembler, new TagQueryNormalizer());
    }

    // ===== 정상 흐름 =====

    @Test
    void 정상_조회시_정규화된_태그로_조회하고_검색기록을_저장한다() {
        Pin pin = mock(Pin.class);
        Member author = mock(Member.class);
        given(pin.getMember()).willReturn(author);
        given(author.getId()).willReturn(1L);

        given(pinRepository.findActivePinsByTagWithinBounds(
                eq("카페"), any(), anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willReturn(List.of(pin));
        given(memberRepository.findAllById(any())).willReturn(List.of(author));
        given(pinCardAssembler.assemble(anyList(), eq(MEMBER_ID), any()))
                .willReturn(List.of(SAMPLE_CARD));
        given(memberRepository.getReferenceById(MEMBER_ID)).willReturn(author);

        // 앞뒤 공백·선행 '#'이 있어도 정규화되어 "카페"로 조회되어야 한다.
        TaggedPinsResponse response = taggedPinService.searchPinsByTag(
                MEMBER_ID, "  #카페  ", SW_LAT, SW_LNG, NE_LAT, NE_LNG);

        assertThat(response.pins()).containsExactly(SAMPLE_CARD);
        verify(pinRepository).findActivePinsByTagWithinBounds(
                eq("카페"), any(), anyDouble(), anyDouble(), anyDouble(), anyDouble());

        // 검색기록: search_type=TAG, place=null, keyword=정규화된 태그.
        ArgumentCaptor<SearchHistory> captor = ArgumentCaptor.forClass(SearchHistory.class);
        verify(searchHistoryRepository).save(captor.capture());
        SearchHistory saved = captor.getValue();
        assertThat(saved.getSearchType()).isEqualTo(SearchType.TAG);
        assertThat(saved.getKeyword()).isEqualTo("카페");
        assertThat(saved.getPlace()).isNull();
        verify(memberRepository).getReferenceById(MEMBER_ID);
    }

    @Test
    void 조회결과가_없으면_빈목록을_반환하고_조립을_건너뛰지만_검색기록은_저장한다() {
        given(pinRepository.findActivePinsByTagWithinBounds(
                eq("카페"), any(), anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willReturn(List.of());

        TaggedPinsResponse response = taggedPinService.searchPinsByTag(
                MEMBER_ID, "카페", SW_LAT, SW_LNG, NE_LAT, NE_LNG);

        assertThat(response.pins()).isEmpty();
        verify(memberRepository, never()).findAllById(any());
        verify(pinCardAssembler, never()).assemble(any(), any(), any());
        verify(searchHistoryRepository).save(any(SearchHistory.class));
    }

    // ===== 태그 검증 =====

    @Test
    void 빈_태그면_INVALID_TAG_NAME이고_조회하지_않는다() {
        assertError(() -> taggedPinService.searchPinsByTag(
                MEMBER_ID, "#", SW_LAT, SW_LNG, NE_LAT, NE_LNG), ErrorCode.INVALID_TAG_NAME);

        verify(pinRepository, never()).findActivePinsByTagWithinBounds(
                any(), any(), anyDouble(), anyDouble(), anyDouble(), anyDouble());
        verify(searchHistoryRepository, never()).save(any());
    }

    @Test
    void 태그가_최대길이를_초과하면_INVALID_TAG_NAME이다() {
        String tooLong = "가".repeat(31); // pin_tags.tag 컬럼 길이(30) 초과

        assertError(() -> taggedPinService.searchPinsByTag(
                MEMBER_ID, tooLong, SW_LAT, SW_LNG, NE_LAT, NE_LNG), ErrorCode.INVALID_TAG_NAME);

        verify(pinRepository, never()).findActivePinsByTagWithinBounds(
                any(), any(), anyDouble(), anyDouble(), anyDouble(), anyDouble());
    }

    // ===== 지도 경계 검증 =====

    @Test
    void 지도경계가_범위를_벗어나면_INVALID_MAP_RANGE이고_조회하지_않는다() {
        assertError(() -> taggedPinService.searchPinsByTag(
                MEMBER_ID, "카페", -100, SW_LNG, NE_LAT, NE_LNG), ErrorCode.INVALID_MAP_RANGE);

        verify(pinRepository, never()).findActivePinsByTagWithinBounds(
                any(), any(), anyDouble(), anyDouble(), anyDouble(), anyDouble());
        verify(searchHistoryRepository, never()).save(any());
    }

    @Test
    void 남서가_북동보다_크거나_같으면_INVALID_MAP_RANGE이다() {
        // 남서 위도(NE_LAT) >= 북동 위도(SW_LAT) 로 순서가 뒤집힌 경우
        assertError(() -> taggedPinService.searchPinsByTag(
                MEMBER_ID, "카페", NE_LAT, SW_LNG, SW_LAT, NE_LNG), ErrorCode.INVALID_MAP_RANGE);
    }

    // ===== 실패 처리 =====

    @Test
    void 핀_조회에_실패하면_TAGGED_PINS_FETCH_FAILED이고_검색기록을_저장하지_않는다() {
        given(pinRepository.findActivePinsByTagWithinBounds(
                eq("카페"), any(), anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willThrow(new RuntimeException("DB 오류"));

        assertError(() -> taggedPinService.searchPinsByTag(
                MEMBER_ID, "카페", SW_LAT, SW_LNG, NE_LAT, NE_LNG), ErrorCode.TAGGED_PINS_FETCH_FAILED);

        verify(searchHistoryRepository, never()).save(any());
    }

    @Test
    void 검색기록_저장이_실패해도_핀목록은_정상_반환한다() {
        Pin pin = mock(Pin.class);
        Member author = mock(Member.class);
        given(pin.getMember()).willReturn(author);
        given(author.getId()).willReturn(1L);

        given(pinRepository.findActivePinsByTagWithinBounds(
                eq("카페"), any(), anyDouble(), anyDouble(), anyDouble(), anyDouble()))
                .willReturn(List.of(pin));
        given(memberRepository.findAllById(any())).willReturn(List.of(author));
        given(pinCardAssembler.assemble(anyList(), eq(MEMBER_ID), any()))
                .willReturn(List.of(SAMPLE_CARD));
        given(memberRepository.getReferenceById(MEMBER_ID)).willReturn(author);
        given(searchHistoryRepository.save(any())).willThrow(new RuntimeException("저장 실패"));

        TaggedPinsResponse response = taggedPinService.searchPinsByTag(
                MEMBER_ID, "카페", SW_LAT, SW_LNG, NE_LAT, NE_LNG);

        assertThat(response.pins()).containsExactly(SAMPLE_CARD);
    }

    // ===== 헬퍼 =====

    private void assertError(Runnable runnable, ErrorCode expected) {
        assertThatThrownBy(runnable::run)
                .isInstanceOf(CustomException.class)
                .extracting("errorCode")
                .isEqualTo(expected);
    }
}
