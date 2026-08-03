package com.yuhan.wagglewaggle.domain.pin.service;

import com.yuhan.wagglewaggle.domain.pin.dto.TodayPinItem;
import com.yuhan.wagglewaggle.domain.pin.dto.TodayPinListResponse;
import com.yuhan.wagglewaggle.domain.pin.dto.TodayPinStatus;
import com.yuhan.wagglewaggle.domain.pin.entity.Pin;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;

/**
 * 오늘 등록 핀 목록 조회 서비스.
 * 현재 인증 사용자가 오늘(서비스 날짜 KST 04시 경계) 등록한 핀을 커서 페이지네이션으로 조회한다.
 * 소프트 삭제된 핀만 제외하고, 상태(PROCESSING·ACTIVE·RESHOOT·FAILED)와 만료 여부는 모두 포함한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class TodayPinService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    /** 서비스 날짜 경계: 매일 04시(KST). 04시 이전이면 전날의 서비스 날짜를 사용한다. */
    private static final int SERVICE_DAY_BOUNDARY_HOUR = 4;
    private static final int DEFAULT_LIMIT = 20;
    private static final int MIN_LIMIT = 1;
    private static final int MAX_LIMIT = 50;

    private final MemberRepository memberRepository;
    private final PinRepository pinRepository;
    private final Clock clock;

    /**
     * 오늘 등록 핀 목록을 조회한다.
     * cursor·limit 검증은 조회 이전에 수행하며, 잘못되면 조회하지 않고 INVALID_PAGINATION으로 실패한다.
     * 토큰의 사용자가 없거나 탈퇴 상태면 USER_NOT_FOUND, 조회 중 예기치 못한 오류는 TODAY_PINS_FETCH_FAILED로 처리한다.
     */
    @Transactional(readOnly = true)
    public TodayPinListResponse getMyTodayPins(Long memberId, String cursorRaw, String limitRaw) {
        // 페이지 조건 검증은 조회 이전에 수행한다(잘못되면 목록을 조회하지 않는다).
        int limit = parseLimit(limitRaw);
        TodayPinCursor cursor = parseCursor(cursorRaw);

        Instant start = todayStart();
        Instant end = start.plus(Duration.ofDays(1));

        try {
            // 토큰의 사용자가 존재하고 탈퇴하지 않았을 때만 조회한다.
            memberRepository.findById(memberId)
                    .filter(m -> m.getDeletedAt() == null)
                    .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

            // 다음 페이지 존재 여부 판단을 위해 limit + 1건을 조회한다.
            Pageable pageable = PageRequest.of(0, limit + 1);
            List<Pin> pins = (cursor == null)
                    ? pinRepository.findTodayPinsFirstPage(memberId, start, end, pageable)
                    : pinRepository.findTodayPinsAfterCursor(
                            memberId, start, end, cursor.createdAt(), cursor.id(), pageable);

            return buildResponse(pins, limit);
        } catch (CustomException e) {
            // USER_NOT_FOUND 등 도메인 오류는 그대로 전파한다.
            throw e;
        } catch (Exception e) {
            log.error("오늘 등록 핀 목록 조회 실패 (memberId={})", memberId, e);
            throw new CustomException(ErrorCode.TODAY_PINS_FETCH_FAILED);
        }
    }

    /**
     * limit을 파싱·검증한다. 미전달(null·공백)은 기본값 20, 1~50 범위를 벗어나거나 숫자가 아니면 INVALID_PAGINATION으로 실패한다.
     */
    private int parseLimit(String raw) {
        if (raw == null || raw.isBlank()) {
            return DEFAULT_LIMIT;
        }
        int limit;
        try {
            limit = Integer.parseInt(raw.trim());
        } catch (NumberFormatException e) {
            throw new CustomException(ErrorCode.INVALID_PAGINATION);
        }
        if (limit < MIN_LIMIT || limit > MAX_LIMIT) {
            throw new CustomException(ErrorCode.INVALID_PAGINATION);
        }
        return limit;
    }

    /**
     * cursor를 파싱한다. 미전달(null·공백)은 첫 페이지(null), 형식이 잘못되면 INVALID_PAGINATION으로 실패한다.
     */
    private TodayPinCursor parseCursor(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        return TodayPinCursor.decode(raw.trim());
    }

    /**
     * 현재 서비스 날짜의 시작 시각(KST 04시)을 Instant로 계산한다.
     * KST 시각에서 4시간을 뺀 날짜를 서비스 날짜로 삼고(예: KST 03:59는 전날), 그 날짜의 04시를 시작으로 한다.
     */
    private Instant todayStart() {
        LocalDate serviceDate = clock.instant().atZone(KST).minusHours(SERVICE_DAY_BOUNDARY_HOUR).toLocalDate();
        return serviceDate.atTime(SERVICE_DAY_BOUNDARY_HOUR, 0).atZone(KST).toInstant();
    }

    /**
     * limit + 1건 조회 결과에서 다음 페이지 존재 여부를 판단해 응답을 조립한다.
     * limit을 초과하면 마지막 노출 항목의 (createdAt, id)로 nextCursor를 발급하고, 아니면 nextCursor는 null이다.
     */
    private TodayPinListResponse buildResponse(List<Pin> pins, int limit) {
        boolean hasNext = pins.size() > limit;
        List<Pin> pagePins = hasNext ? pins.subList(0, limit) : pins;

        List<TodayPinItem> items = new ArrayList<>(pagePins.size());
        for (Pin pin : pagePins) {
            items.add(new TodayPinItem(
                    pin.getId(),
                    pin.getPlace().getId(),
                    pin.getPlace().getName(),
                    pin.getPlace().getAddressName(),
                    TodayPinStatus.from(pin.getVideoStatus()),
                    pin.getCreatedAt()));
        }

        String nextCursor = null;
        if (hasNext) {
            Pin last = pagePins.get(pagePins.size() - 1);
            nextCursor = new TodayPinCursor(last.getCreatedAt(), last.getId()).encode();
        }

        return new TodayPinListResponse(items, nextCursor);
    }
}
