package com.yuhan.wagglewaggle.domain.auth.service;

import com.yuhan.wagglewaggle.domain.auth.client.OAuthUserInfo;
import com.yuhan.wagglewaggle.domain.auth.entity.OAuthProvider;
import com.yuhan.wagglewaggle.domain.auth.entity.SocialAccount;
import com.yuhan.wagglewaggle.domain.auth.repository.SocialAccountRepository;
import com.yuhan.wagglewaggle.domain.user.entity.Member;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 소셜 계정 조회·생성 및 온보딩 상태 판별을 담당하는 짧은 DB 트랜잭션.
 * Provider 외부 통신은 이 클래스 밖(AuthService)에서 수행된다.
 */
@Service
@RequiredArgsConstructor
public class SocialAccountService {

    private final SocialAccountRepository socialAccountRepository;

    /**
     * (provider, providerUserId)로 소셜 계정을 조회하고 없으면 생성한다.
     * 연결된 member 존재 여부(온보딩 완료 여부)를 함께 반환한다.
     */
    @Transactional
    public SocialAuthResult findOrCreate(OAuthProvider provider, OAuthUserInfo userInfo) {
        SocialAccount socialAccount = socialAccountRepository
                .findByProviderAndProviderUserId(provider, userInfo.providerUserId())
                .orElseGet(() -> socialAccountRepository.save(
                        SocialAccount.create(provider, userInfo.providerUserId(), userInfo.email())));

        Member member = socialAccount.getMember();
        Long memberId = (member == null) ? null : member.getId();
        return new SocialAuthResult(socialAccount.getId(), memberId);
    }
}
