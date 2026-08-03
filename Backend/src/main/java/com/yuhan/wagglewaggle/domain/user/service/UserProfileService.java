package com.yuhan.wagglewaggle.domain.user.service;

import com.yuhan.wagglewaggle.domain.credit.repository.CreditTransactionRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.DailyPinCountRow;
import com.yuhan.wagglewaggle.domain.pin.repository.PinEvaluationRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.user.dto.ServiceAccess;
import com.yuhan.wagglewaggle.domain.user.dto.UserProfileResponse;
import com.yuhan.wagglewaggle.domain.user.dto.UserProfileResponse.ActivitySummary;
import com.yuhan.wagglewaggle.domain.user.dto.UserProfileResponse.DailyActivity;
import com.yuhan.wagglewaggle.domain.user.dto.UserProfileResponse.MonthlyActivity;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 내 프로필·활동 요약 조회 서비스.
 * 현재 인증 사용자의 뷰 신뢰도·크레딧 잔액·오늘 영상핀 수와, 선택 월의 활동 히트맵·요약을 조립한다.
 * 서비스 날짜 경계는 Asia/Seoul 매일 04시이며, 연월을 생략하면 현재 서비스 날짜가 속한 연월을 조회한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserProfileService {

    private static final ZoneId KST = ZoneId.of("Asia/Seoul");
    /** 서비스 날짜 경계: 매일 04시(KST). 04시 이전이면 전날의 서비스 날짜를 사용한다. */
    private static final int SERVICE_DAY_BOUNDARY_HOUR = 4;
    /** 연도는 4자리여야 한다. */
    private static final int MIN_YEAR = 1000;
    private static final int MAX_YEAR = 9999;

    private final MemberRepository memberRepository;
    private final PinRepository pinRepository;
    private final CreditTransactionRepository creditTransactionRepository;
    private final PinEvaluationRepository pinEvaluationRepository;
    private final Clock clock;

    /**
     * 현재 인증 사용자의 프로필·활동 요약을 조회한다.
     * year·month는 함께 전달해야 하며, 생략 시 현재 서비스 연월을 사용한다.
     * 형식·범위 위반 또는 미래 연월은 집계를 수행하지 않고 INVALID_YEAR_MONTH로 실패한다.
     * 프로필·크레딧·활동 요약 중 하나라도 조회에 실패하면 부분 응답 없이 USER_PROFILE_FETCH_FAILED로 실패한다.
     */
    @Transactional(readOnly = true)
    public UserProfileResponse getMyProfile(Long memberId, Integer year, Integer month) {
        LocalDate currentServiceDate = toServiceDate(clock.instant());
        YearMonth currentServiceMonth = YearMonth.from(currentServiceDate);

        // 조회 연월 결정·검증은 집계 이전에 수행한다(잘못되면 집계하지 않는다).
        YearMonth target = resolveTargetMonth(year, month, currentServiceMonth);

        try {
            // 토큰의 사용자가 존재하고 탈퇴하지 않았을 때만 조회한다.
            Member member = memberRepository.findById(memberId)
                    .filter(m -> m.getDeletedAt() == null)
                    .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

            int todayVideoPinCount =
                    (int) pinRepository.countActiveVideoPinsByServiceDate(memberId, currentServiceDate);
            MonthlyActivity monthlyActivity = buildMonthlyActivity(memberId, target);

            return new UserProfileResponse(
                    member.getId(),
                    member.getNickname(),
                    member.getViewAngle(),
                    member.getCreditBalance(),
                    todayVideoPinCount,
                    resolveServiceAccess(member.getViewAngle()),
                    monthlyActivity);
        } catch (CustomException e) {
            // USER_NOT_FOUND 등 도메인 오류는 그대로 전파한다.
            throw e;
        } catch (Exception e) {
            log.error("내 프로필·활동 요약 조회 실패 (memberId={})", memberId, e);
            throw new CustomException(ErrorCode.USER_PROFILE_FETCH_FAILED);
        }
    }

    /**
     * 요청 연월을 확정한다. 둘 다 없으면 현재 서비스 연월, 하나만 있거나 범위를 벗어나거나
     * 현재 서비스 연월보다 미래이면 INVALID_YEAR_MONTH로 실패한다.
     */
    private YearMonth resolveTargetMonth(Integer year, Integer month, YearMonth currentServiceMonth) {
        if (year == null && month == null) {
            return currentServiceMonth;
        }
        if (year == null || month == null) {
            throw new CustomException(ErrorCode.INVALID_YEAR_MONTH);
        }
        if (year < MIN_YEAR || year > MAX_YEAR || month < 1 || month > 12) {
            throw new CustomException(ErrorCode.INVALID_YEAR_MONTH);
        }
        YearMonth target = YearMonth.of(year, month);
        if (target.isAfter(currentServiceMonth)) {
            throw new CustomException(ErrorCode.INVALID_YEAR_MONTH);
        }
        return target;
    }

    /**
     * 선택 월의 날짜별 활동(오름차순, 없는 날 0)과 월 요약을 조립한다.
     * createdVideoPinCount는 days 합계와 동일하도록 채움 과정에서 함께 누적한다.
     */
    private MonthlyActivity buildMonthlyActivity(Long memberId, YearMonth target) {
        LocalDate monthStart = target.atDay(1);
        LocalDate monthEndExclusive = target.plusMonths(1).atDay(1);

        Map<LocalDate, Integer> countByDate = new HashMap<>();
        for (DailyPinCountRow row :
                pinRepository.findDailyActiveVideoPinCounts(memberId, monthStart, monthEndExclusive)) {
            countByDate.put(row.getServiceDate(), (int) row.getVideoPinCount());
        }

        List<DailyActivity> days = new ArrayList<>();
        int createdVideoPinCount = 0;
        for (LocalDate date = monthStart; date.isBefore(monthEndExclusive); date = date.plusDays(1)) {
            int videoPinCount = countByDate.getOrDefault(date, 0);
            days.add(new DailyActivity(date, videoPinCount));
            createdVideoPinCount += videoPinCount;
        }

        int earnedCredit =
                (int) creditTransactionRepository.sumEarnedCreditByServiceMonth(memberId, monthStart, monthEndExclusive);
        int helpfulEvaluationCount =
                (int) pinEvaluationRepository.countHelpfulEvaluationsByServiceMonth(memberId, monthStart, monthEndExclusive);

        ActivitySummary summary =
                new ActivitySummary(createdVideoPinCount, earnedCredit, helpfulEvaluationCount);
        return new MonthlyActivity(target.getYear(), target.getMonthValue(), days, summary);
    }

    /**
     * 어떤 Instant가 속한 서비스 날짜를 구한다.
     * Asia/Seoul 기준 04시 경계이므로, KST 시각에서 4시간을 뺀 날짜를 서비스 날짜로 삼는다
     * (예: KST 03:59는 전날, 04:00은 당일).
     */
    private LocalDate toServiceDate(Instant instant) {
        return instant.atZone(KST).minusHours(SERVICE_DAY_BOUNDARY_HOUR).toLocalDate();
    }

    /**
     * 서비스 이용 가능 상태를 판정한다. 뷰 신뢰도(view_angle)가 0도이면 BLOCKED, 그 외에는 ALLOWED다.
     */
    private ServiceAccess resolveServiceAccess(BigDecimal viewAngle) {
        return viewAngle != null && viewAngle.compareTo(BigDecimal.ZERO) == 0
                ? ServiceAccess.BLOCKED
                : ServiceAccess.ALLOWED;
    }
}
