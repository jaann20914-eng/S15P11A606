package com.yuhan.wagglewaggle.domain.user.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * 내 프로필·활동 요약 조회 응답.
 * 현재 인증 사용자의 뷰 신뢰도·크레딧 잔액·오늘 영상핀 수와 선택 월의 활동 히트맵·요약을 담는다.
 */
public record UserProfileResponse(
        Long userId, // 현재 사용자 ID(액세스 토큰의 사용자)
        String nickname, // 현재 닉네임
        BigDecimal viewReliability, // 현재 뷰 신뢰도(각도 단위, 소수점 가능)
        int creditBalance, // 현재 보유 크레딧(크레딧 원장 현재 잔액)
        int todayVideoPinCount, // 오늘(현재 서비스 날짜) 정상 등록 완료된 영상핀 수
        ServiceAccess serviceAccess, // 서비스 이용 가능 상태(ALLOWED/BLOCKED)
        MonthlyActivity monthlyActivity // 선택 월 활동 정보
) {

    /**
     * 선택 월 활동 정보. 조회 월의 모든 날짜(오름차순)와 월 요약을 담는다.
     */
    public record MonthlyActivity(
            int year, // 실제 집계에 사용된 연도
            int month, // 실제 집계에 사용된 월
            List<DailyActivity> days, // 날짜별 활동 목록(오름차순, 활동 없는 날은 0)
            ActivitySummary summary // 선택 월 활동 요약
    ) {
    }

    /**
     * 날짜별 활동. 활동이 없으면 videoPinCount는 0이다.
     */
    public record DailyActivity(
            LocalDate date, // 서비스 날짜(YYYY-MM-DD)
            int videoPinCount // 해당 날짜에 정상 등록 완료된 영상핀 수
    ) {
    }

    /**
     * 선택 월 활동 요약. 집계 결과가 없어도 각 필드는 0이다.
     */
    public record ActivitySummary(
            int createdVideoPinCount, // 선택 월 작성 영상핀 수(days 합계와 동일)
            int earnedCredit, // 선택 월 적립 완료된 유효 크레딧 합계
            int helpfulEvaluationCount // 선택 월 도움됐어요(HELPFUL) 평가 수
    ) {
    }
}
