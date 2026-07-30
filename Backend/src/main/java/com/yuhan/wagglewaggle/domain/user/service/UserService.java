package com.yuhan.wagglewaggle.domain.user.service;

import com.yuhan.wagglewaggle.domain.user.dto.NicknameAvailabilityResponse;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/**
 * 회원 관련 조회 서비스. 현재는 닉네임 중복 확인을 담당한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final MemberRepository memberRepository;

    /**
     * 닉네임 사용 가능 여부를 확인한다.
     * 형식이 유효하지 않으면 중복 조회를 수행하지 않고 INVALID_NICKNAME으로 실패한다.
     * 조회 자체가 실패하면 사용 가능 여부를 추정하지 않고 NICKNAME_AVAILABILITY_CHECK_FAILED로 실패한다.
     */
    public NicknameAvailabilityResponse checkNicknameAvailability(String rawNickname) {
        if (!NicknamePolicy.isValid(rawNickname)) {
            throw new CustomException(ErrorCode.INVALID_NICKNAME);
        }
        String normalized = NicknamePolicy.normalize(rawNickname);
        try {
            boolean available = !memberRepository.existsByNickname(normalized);
            return new NicknameAvailabilityResponse(normalized, available);
        } catch (Exception e) {
            log.error("닉네임 중복 확인 실패: {}", e.getMessage());
            throw new CustomException(ErrorCode.NICKNAME_AVAILABILITY_CHECK_FAILED);
        }
    }
}
