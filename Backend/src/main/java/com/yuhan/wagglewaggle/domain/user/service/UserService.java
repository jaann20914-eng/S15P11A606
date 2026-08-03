package com.yuhan.wagglewaggle.domain.user.service;

import com.yuhan.wagglewaggle.domain.user.dto.NicknameAvailabilityResponse;
import com.yuhan.wagglewaggle.domain.user.dto.NicknameUpdateRequest;
import com.yuhan.wagglewaggle.domain.user.dto.NicknameUpdateResponse;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 회원 관련 서비스. 닉네임 중복 확인과 닉네임 수정을 담당한다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class UserService {

    private final MemberRepository memberRepository;
    private final ForbiddenNicknamePolicy forbiddenNicknamePolicy;

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

    /**
     * 현재 인증 사용자의 닉네임을 수정한다.
     * 형식·길이·금칙어 위반은 INVALID_NICKNAME으로 실패하고 기존 닉네임을 유지한다.
     * 앞뒤 공백은 자동 제거하지 않고 원문 그대로 검증하며, 영문은 소문자로 정규화한 뒤 검증·저장한다.
     * 정규화한 요청 닉네임이 현재 닉네임과 같으면 금칙어·중복 검사 없이 성공 처리하고 현재 닉네임을 반환한다.
     * 선제 중복 검사 이후의 동시 요청은 UNIQUE 제약 위반(NICKNAME_ALREADY_EXISTS)으로 함께 처리한다.
     */
    @Transactional
    public NicknameUpdateResponse updateNickname(Long memberId, NicknameUpdateRequest request) {
        String rawNickname = (request == null) ? null : request.nickname();
        if (!NicknamePolicy.isValid(rawNickname)) {
            throw new CustomException(ErrorCode.INVALID_NICKNAME);
        }
        String normalized = NicknamePolicy.normalize(rawNickname);
        try {
            Member member = memberRepository.findById(memberId)
                    .filter(m -> m.getDeletedAt() == null)
                    .orElseThrow(() -> new CustomException(ErrorCode.USER_NOT_FOUND));

            // 정규화 결과가 현재 닉네임과 같으면 금칙어·중복 검사 없이 성공 처리한다.
            if (normalized.equals(member.getNickname())) {
                return new NicknameUpdateResponse(member.getNickname());
            }

            // 금칙어 검증(닉네임을 실제로 변경하는 경우에만 수행)
            if (forbiddenNicknamePolicy.isForbidden(normalized)) {
                throw new CustomException(ErrorCode.INVALID_NICKNAME);
            }

            // 선제 중복 검사
            if (memberRepository.existsByNickname(normalized)) {
                throw new CustomException(ErrorCode.NICKNAME_ALREADY_EXISTS);
            }

            // 변경 후 flush 시점에 UNIQUE 제약으로 동시 선점을 최종 방어한다.
            member.updateNickname(normalized);
            try {
                memberRepository.saveAndFlush(member);
            } catch (DataIntegrityViolationException e) {
                throw new CustomException(ErrorCode.NICKNAME_ALREADY_EXISTS);
            }

            return new NicknameUpdateResponse(normalized);
        } catch (CustomException e) {
            throw e;
        } catch (Exception e) {
            log.error("닉네임 수정 실패: {}", e.getMessage());
            throw new CustomException(ErrorCode.NICKNAME_UPDATE_FAILED);
        }
    }
}
