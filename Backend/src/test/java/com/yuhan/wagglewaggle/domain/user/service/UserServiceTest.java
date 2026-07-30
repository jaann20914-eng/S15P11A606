package com.yuhan.wagglewaggle.domain.user.service;

import com.yuhan.wagglewaggle.domain.user.dto.NicknameAvailabilityResponse;
import com.yuhan.wagglewaggle.domain.user.repository.MemberRepository;
import com.yuhan.wagglewaggle.global.exception.CustomException;
import com.yuhan.wagglewaggle.global.exception.ErrorCode;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private MemberRepository memberRepository;

    @InjectMocks
    private UserService userService;

    @Test
    @DisplayName("유효하고 사용되지 않은 닉네임이면 available=true를 반환한다")
    void 사용가능한_닉네임() {
        given(memberRepository.existsByNickname("와글러")).willReturn(false);

        NicknameAvailabilityResponse result = userService.checkNicknameAvailability("와글러");

        assertThat(result.nickname()).isEqualTo("와글러");
        assertThat(result.available()).isTrue();
    }

    @Test
    @DisplayName("이미 사용 중인 닉네임이면 available=false를 반환한다")
    void 사용중인_닉네임() {
        given(memberRepository.existsByNickname("와글러")).willReturn(true);

        NicknameAvailabilityResponse result = userService.checkNicknameAvailability("와글러");

        assertThat(result.nickname()).isEqualTo("와글러");
        assertThat(result.available()).isFalse();
    }

    @Test
    @DisplayName("대문자 입력은 소문자로 정규화해 조회·응답한다")
    void 대문자_정규화() {
        ArgumentCaptor<String> captor = ArgumentCaptor.forClass(String.class);
        given(memberRepository.existsByNickname("waggle")).willReturn(false);

        NicknameAvailabilityResponse result = userService.checkNicknameAvailability("WaGGle");

        verify(memberRepository).existsByNickname(captor.capture());
        assertThat(captor.getValue()).isEqualTo("waggle");
        assertThat(result.nickname()).isEqualTo("waggle");
        assertThat(result.available()).isTrue();
    }

    @Test
    @DisplayName("형식이 올바르지 않으면 INVALID_NICKNAME으로 실패하고 중복 조회를 하지 않는다")
    void 형식_위반() {
        assertThatThrownBy(() -> userService.checkNicknameAvailability("a"))
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_NICKNAME);

        verify(memberRepository, never()).existsByNickname(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    @DisplayName("null 파라미터는 INVALID_NICKNAME으로 실패한다")
    void null_파라미터() {
        assertThatThrownBy(() -> userService.checkNicknameAvailability(null))
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_NICKNAME);
    }

    @Test
    @DisplayName("중복 조회가 실패하면 NICKNAME_AVAILABILITY_CHECK_FAILED로 실패한다")
    void 조회_실패() {
        given(memberRepository.existsByNickname("와글러"))
                .willThrow(new RuntimeException("db down"));

        assertThatThrownBy(() -> userService.checkNicknameAvailability("와글러"))
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(ErrorCode.NICKNAME_AVAILABILITY_CHECK_FAILED);
    }
}
