package com.yuhan.wagglewaggle.domain.user.service;

import com.yuhan.wagglewaggle.domain.chat.filter.ProfanityFilter;
import com.yuhan.wagglewaggle.domain.user.dto.NicknameAvailabilityResponse;
import com.yuhan.wagglewaggle.domain.user.dto.NicknameUpdateRequest;
import com.yuhan.wagglewaggle.domain.user.dto.NicknameUpdateResponse;
import com.yuhan.wagglewaggle.domain.user.entity.AgeGroup;
import com.yuhan.wagglewaggle.domain.user.entity.Gender;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
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
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    private static final Long MEMBER_ID = 42L;

    @Mock
    private MemberRepository memberRepository;

    @Mock
    private ProfanityFilter profanityFilter;

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

    // ===== updateNickname =====

    @Test
    @DisplayName("유효한 새 닉네임이면 정규화 저장 후 변경된 닉네임을 반환한다")
    void 수정_성공() {
        Member member = member("와글러");
        given(memberRepository.findById(MEMBER_ID)).willReturn(Optional.of(member));
        given(profanityFilter.mask("새와글러")).willReturn("새와글러");
        given(memberRepository.existsByNickname("새와글러")).willReturn(false);

        NicknameUpdateResponse result = userService.updateNickname(MEMBER_ID, new NicknameUpdateRequest("새와글러"));

        assertThat(result.nickname()).isEqualTo("새와글러");
        assertThat(member.getNickname()).isEqualTo("새와글러");
        verify(memberRepository).saveAndFlush(member);
    }

    @Test
    @DisplayName("영문 대문자는 소문자로 정규화해 검증·저장·응답한다")
    void 수정_대문자_정규화() {
        Member member = member("oldnick");
        given(memberRepository.findById(MEMBER_ID)).willReturn(Optional.of(member));
        given(profanityFilter.mask("newnick")).willReturn("newnick");
        given(memberRepository.existsByNickname("newnick")).willReturn(false);

        NicknameUpdateResponse result = userService.updateNickname(MEMBER_ID, new NicknameUpdateRequest("NewNick"));

        assertThat(result.nickname()).isEqualTo("newnick");
        assertThat(member.getNickname()).isEqualTo("newnick");
    }

    @Test
    @DisplayName("정규화 결과가 현재 닉네임과 같으면 변경 없이 성공 처리한다")
    void 수정_현재와_동일하면_변경없음() {
        Member member = member("와글러");
        given(memberRepository.findById(MEMBER_ID)).willReturn(Optional.of(member));
        given(profanityFilter.mask("와글러")).willReturn("와글러");

        NicknameUpdateResponse result = userService.updateNickname(MEMBER_ID, new NicknameUpdateRequest("와글러"));

        assertThat(result.nickname()).isEqualTo("와글러");
        verify(memberRepository, never()).existsByNickname(anyString());
        verify(memberRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("형식 위반이면 INVALID_NICKNAME으로 실패하고 사용자 조회를 하지 않는다")
    void 수정_형식위반() {
        assertThatThrownBy(() -> userService.updateNickname(MEMBER_ID, new NicknameUpdateRequest("a")))
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_NICKNAME);

        verify(memberRepository, never()).findById(anyLong());
    }

    @Test
    @DisplayName("앞뒤 공백은 자동 제거하지 않고 INVALID_NICKNAME으로 실패한다")
    void 수정_공백_미제거() {
        assertThatThrownBy(() -> userService.updateNickname(MEMBER_ID, new NicknameUpdateRequest(" 와글러 ")))
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_NICKNAME);
    }

    @Test
    @DisplayName("요청 본문이 없으면 INVALID_NICKNAME으로 실패한다")
    void 수정_본문없음() {
        assertThatThrownBy(() -> userService.updateNickname(MEMBER_ID, null))
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_NICKNAME);
    }

    @Test
    @DisplayName("금칙어 닉네임이면 INVALID_NICKNAME으로 실패하고 사용자 조회를 하지 않는다")
    void 수정_금칙어() {
        given(profanityFilter.mask("나쁜말")).willReturn("***");

        assertThatThrownBy(() -> userService.updateNickname(MEMBER_ID, new NicknameUpdateRequest("나쁜말")))
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(ErrorCode.INVALID_NICKNAME);

        verify(memberRepository, never()).findById(anyLong());
    }

    @Test
    @DisplayName("사용자가 없으면 USER_NOT_FOUND로 실패한다")
    void 수정_사용자없음() {
        given(profanityFilter.mask("새와글러")).willReturn("새와글러");
        given(memberRepository.findById(MEMBER_ID)).willReturn(Optional.empty());

        assertThatThrownBy(() -> userService.updateNickname(MEMBER_ID, new NicknameUpdateRequest("새와글러")))
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(ErrorCode.USER_NOT_FOUND);
    }

    @Test
    @DisplayName("탈퇴한 사용자는 USER_NOT_FOUND로 실패한다")
    void 수정_탈퇴사용자() {
        Member withdrawn = member("와글러");
        ReflectionTestUtils.setField(withdrawn, "deletedAt", Instant.parse("2026-08-01T00:00:00Z"));
        given(profanityFilter.mask("새와글러")).willReturn("새와글러");
        given(memberRepository.findById(MEMBER_ID)).willReturn(Optional.of(withdrawn));

        assertThatThrownBy(() -> userService.updateNickname(MEMBER_ID, new NicknameUpdateRequest("새와글러")))
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(ErrorCode.USER_NOT_FOUND);
    }

    @Test
    @DisplayName("다른 사용자가 사용 중이면 NICKNAME_ALREADY_EXISTS로 실패하고 저장하지 않는다")
    void 수정_중복() {
        Member member = member("와글러");
        given(memberRepository.findById(MEMBER_ID)).willReturn(Optional.of(member));
        given(profanityFilter.mask("새와글러")).willReturn("새와글러");
        given(memberRepository.existsByNickname("새와글러")).willReturn(true);

        assertThatThrownBy(() -> userService.updateNickname(MEMBER_ID, new NicknameUpdateRequest("새와글러")))
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(ErrorCode.NICKNAME_ALREADY_EXISTS);

        verify(memberRepository, never()).saveAndFlush(any());
    }

    @Test
    @DisplayName("선제 검사 통과 후 동시 요청으로 UNIQUE 제약이 위반되면 NICKNAME_ALREADY_EXISTS로 처리한다")
    void 수정_동시_유니크위반() {
        Member member = member("와글러");
        given(memberRepository.findById(MEMBER_ID)).willReturn(Optional.of(member));
        given(profanityFilter.mask("새와글러")).willReturn("새와글러");
        given(memberRepository.existsByNickname("새와글러")).willReturn(false);
        given(memberRepository.saveAndFlush(member))
                .willThrow(new DataIntegrityViolationException("uq_member_nickname"));

        assertThatThrownBy(() -> userService.updateNickname(MEMBER_ID, new NicknameUpdateRequest("새와글러")))
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(ErrorCode.NICKNAME_ALREADY_EXISTS);
    }

    @Test
    @DisplayName("저장 중 예기치 못한 오류는 NICKNAME_UPDATE_FAILED로 매핑한다")
    void 수정_저장실패() {
        Member member = member("와글러");
        given(memberRepository.findById(MEMBER_ID)).willReturn(Optional.of(member));
        given(profanityFilter.mask("새와글러")).willReturn("새와글러");
        given(memberRepository.existsByNickname("새와글러")).willReturn(false);
        given(memberRepository.saveAndFlush(member)).willThrow(new RuntimeException("db down"));

        assertThatThrownBy(() -> userService.updateNickname(MEMBER_ID, new NicknameUpdateRequest("새와글러")))
                .isInstanceOf(CustomException.class)
                .extracting(e -> ((CustomException) e).getErrorCode())
                .isEqualTo(ErrorCode.NICKNAME_UPDATE_FAILED);
    }

    // ===== helpers =====

    private Member member(String nickname) {
        Member member = Member.create(nickname, AgeGroup.TWENTIES, Gender.FEMALE);
        ReflectionTestUtils.setField(member, "id", MEMBER_ID);
        return member;
    }
}
