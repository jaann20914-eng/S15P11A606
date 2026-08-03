package com.yuhan.wagglewaggle.domain.user.service;

import com.yuhan.wagglewaggle.domain.credit.repository.CreditTransactionRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.DailyPinCountRow;
import com.yuhan.wagglewaggle.domain.pin.repository.PinEvaluationRepository;
import com.yuhan.wagglewaggle.domain.pin.repository.PinRepository;
import com.yuhan.wagglewaggle.domain.user.dto.ServiceAccess;
import com.yuhan.wagglewaggle.domain.user.dto.UserProfileResponse;
import com.yuhan.wagglewaggle.domain.user.entity.AgeGroup;
import com.yuhan.wagglewaggle.domain.user.entity.Gender;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class UserProfileServiceTest {

    @Mock private MemberRepository memberRepository;
    @Mock private PinRepository pinRepository;
    @Mock private CreditTransactionRepository creditTransactionRepository;
    @Mock private PinEvaluationRepository pinEvaluationRepository;

    private UserProfileService userProfileService;

    private static final Long MEMBER_ID = 1L;
    // 2026-08-03T05:00:00Z → KST 14:00 → -4h → 서비스 날짜 2026-08-03(현재 서비스 연월 2026-08)
    private final Clock clock = Clock.fixed(Instant.parse("2026-08-03T05:00:00Z"), ZoneOffset.UTC);

    @BeforeEach
    void setUp() {
        userProfileService = new UserProfileService(
                memberRepository, pinRepository, creditTransactionRepository, pinEvaluationRepository, clock);
    }

    @Test
    @DisplayName("연월 생략 시 현재 서비스 연월을 조회하고 월 전체 날짜를 0으로 채워 합계 불변식을 지킨다")
    void 기본연월_및_월전체_채움() {
        given(memberRepository.findById(MEMBER_ID)).willReturn(java.util.Optional.of(member("와글러", "92.5", 120)));
        given(pinRepository.countActiveVideoPinsByServiceDate(eq(MEMBER_ID), eq(LocalDate.of(2026, 8, 3))))
                .willReturn(2L);
        // 8월 중 두 날짜에만 활동
        given(pinRepository.findDailyActiveVideoPinCounts(eq(MEMBER_ID),
                eq(LocalDate.of(2026, 8, 1)), eq(LocalDate.of(2026, 9, 1))))
                .willReturn(List.of(row(LocalDate.of(2026, 8, 2), 2L), row(LocalDate.of(2026, 8, 10), 3L)));
        given(creditTransactionRepository.sumEarnedCreditByServiceMonth(eq(MEMBER_ID),
                eq(LocalDate.of(2026, 8, 1)), eq(LocalDate.of(2026, 9, 1)))).willReturn(220L);
        given(pinEvaluationRepository.countHelpfulEvaluationsByServiceMonth(eq(MEMBER_ID),
                eq(LocalDate.of(2026, 8, 1)), eq(LocalDate.of(2026, 9, 1)))).willReturn(97L);

        UserProfileResponse res = userProfileService.getMyProfile(MEMBER_ID, null, null);

        assertThat(res.userId()).isEqualTo(MEMBER_ID);
        assertThat(res.nickname()).isEqualTo("와글러");
        assertThat(res.viewReliability()).isEqualByComparingTo("92.5");
        assertThat(res.creditBalance()).isEqualTo(120);
        assertThat(res.todayVideoPinCount()).isEqualTo(2);
        assertThat(res.serviceAccess()).isEqualTo(ServiceAccess.ALLOWED);

        UserProfileResponse.MonthlyActivity m = res.monthlyActivity();
        assertThat(m.year()).isEqualTo(2026);
        assertThat(m.month()).isEqualTo(8);
        assertThat(m.days()).hasSize(31); // 8월 전체
        assertThat(m.days().get(0).date()).isEqualTo(LocalDate.of(2026, 8, 1));
        assertThat(m.days().get(0).videoPinCount()).isZero();
        assertThat(m.days().get(1).videoPinCount()).isEqualTo(2); // 8/2
        assertThat(m.days().get(9).videoPinCount()).isEqualTo(3); // 8/10
        // days 합계 == createdVideoPinCount 불변식
        int sum = m.days().stream().mapToInt(UserProfileResponse.DailyActivity::videoPinCount).sum();
        assertThat(m.summary().createdVideoPinCount()).isEqualTo(sum).isEqualTo(5);
        assertThat(m.summary().earnedCredit()).isEqualTo(220);
        assertThat(m.summary().helpfulEvaluationCount()).isEqualTo(97);
    }

    @Test
    @DisplayName("뷰 신뢰도가 0도면 serviceAccess는 BLOCKED다")
    void 뷰신뢰도_0_BLOCKED() {
        given(memberRepository.findById(MEMBER_ID)).willReturn(java.util.Optional.of(member("blocked", "0", 0)));
        given(pinRepository.countActiveVideoPinsByServiceDate(anyLong(), any())).willReturn(0L);
        given(pinRepository.findDailyActiveVideoPinCounts(anyLong(), any(), any())).willReturn(List.of());
        given(creditTransactionRepository.sumEarnedCreditByServiceMonth(anyLong(), any(), any())).willReturn(0L);
        given(pinEvaluationRepository.countHelpfulEvaluationsByServiceMonth(anyLong(), any(), any())).willReturn(0L);

        UserProfileResponse res = userProfileService.getMyProfile(MEMBER_ID, null, null);

        assertThat(res.serviceAccess()).isEqualTo(ServiceAccess.BLOCKED);
        assertThat(res.monthlyActivity().summary().createdVideoPinCount()).isZero();
    }

    @Test
    @DisplayName("연·월 중 하나만 전달하면 INVALID_YEAR_MONTH")
    void 한쪽만_전달_INVALID() {
        assertThatThrownBy(() -> userProfileService.getMyProfile(MEMBER_ID, "2026", null))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_YEAR_MONTH);
    }

    @Test
    @DisplayName("숫자가 아닌 연월은 INVALID_YEAR_MONTH")
    void 비숫자_INVALID() {
        assertThatThrownBy(() -> userProfileService.getMyProfile(MEMBER_ID, "abc", "7"))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_YEAR_MONTH);
    }

    @Test
    @DisplayName("범위를 벗어난 월은 INVALID_YEAR_MONTH")
    void 월범위_INVALID() {
        assertThatThrownBy(() -> userProfileService.getMyProfile(MEMBER_ID, "2026", "13"))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_YEAR_MONTH);
    }

    @Test
    @DisplayName("현재 서비스 연월보다 미래면 INVALID_YEAR_MONTH")
    void 미래연월_INVALID() {
        assertThatThrownBy(() -> userProfileService.getMyProfile(MEMBER_ID, "2026", "9"))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.INVALID_YEAR_MONTH);
    }

    @Test
    @DisplayName("과거 연월은 정상 조회된다")
    void 과거연월_정상() {
        given(memberRepository.findById(MEMBER_ID)).willReturn(java.util.Optional.of(member("와글러", "90", 10)));
        given(pinRepository.countActiveVideoPinsByServiceDate(anyLong(), any())).willReturn(0L);
        given(pinRepository.findDailyActiveVideoPinCounts(eq(MEMBER_ID),
                eq(LocalDate.of(2026, 7, 1)), eq(LocalDate.of(2026, 8, 1)))).willReturn(List.of());
        given(creditTransactionRepository.sumEarnedCreditByServiceMonth(anyLong(), any(), any())).willReturn(0L);
        given(pinEvaluationRepository.countHelpfulEvaluationsByServiceMonth(anyLong(), any(), any())).willReturn(0L);

        UserProfileResponse res = userProfileService.getMyProfile(MEMBER_ID, "2026", "7");

        assertThat(res.monthlyActivity().year()).isEqualTo(2026);
        assertThat(res.monthlyActivity().month()).isEqualTo(7);
        assertThat(res.monthlyActivity().days()).hasSize(31);
    }

    @Test
    @DisplayName("존재하지 않는 사용자는 USER_NOT_FOUND")
    void 사용자없음_NOT_FOUND() {
        given(memberRepository.findById(MEMBER_ID)).willReturn(java.util.Optional.empty());

        assertThatThrownBy(() -> userProfileService.getMyProfile(MEMBER_ID, null, null))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.USER_NOT_FOUND);
    }

    @Test
    @DisplayName("탈퇴한 사용자는 USER_NOT_FOUND")
    void 탈퇴사용자_NOT_FOUND() {
        Member withdrawn = member("gone", "90", 10);
        ReflectionTestUtils.setField(withdrawn, "deletedAt", Instant.parse("2026-08-01T00:00:00Z"));
        given(memberRepository.findById(MEMBER_ID)).willReturn(java.util.Optional.of(withdrawn));

        assertThatThrownBy(() -> userProfileService.getMyProfile(MEMBER_ID, null, null))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.USER_NOT_FOUND);
    }

    @Test
    @DisplayName("집계 조회 중 예기치 못한 오류는 USER_PROFILE_FETCH_FAILED로 매핑한다")
    void 집계실패_FETCH_FAILED() {
        given(memberRepository.findById(MEMBER_ID)).willReturn(java.util.Optional.of(member("와글러", "90", 10)));
        given(pinRepository.countActiveVideoPinsByServiceDate(anyLong(), any()))
                .willThrow(new RuntimeException("db down"));

        assertThatThrownBy(() -> userProfileService.getMyProfile(MEMBER_ID, null, null))
                .isInstanceOf(CustomException.class)
                .extracting("errorCode").isEqualTo(ErrorCode.USER_PROFILE_FETCH_FAILED);
    }

    // ===== helpers =====

    private Member member(String nickname, String viewAngle, int creditBalance) {
        Member member = Member.create(nickname, AgeGroup.TWENTIES, Gender.FEMALE);
        ReflectionTestUtils.setField(member, "id", MEMBER_ID);
        ReflectionTestUtils.setField(member, "viewAngle", new BigDecimal(viewAngle));
        ReflectionTestUtils.setField(member, "creditBalance", creditBalance);
        return member;
    }

    private static DailyPinCountRow row(LocalDate date, long count) {
        return new DailyPinCountRow() {
            @Override
            public LocalDate getServiceDate() {
                return date;
            }

            @Override
            public long getVideoPinCount() {
                return count;
            }
        };
    }
}
