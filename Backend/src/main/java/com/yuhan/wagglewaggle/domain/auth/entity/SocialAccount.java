package com.yuhan.wagglewaggle.domain.auth.entity;

import com.yuhan.wagglewaggle.domain.user.entity.Member;
import com.yuhan.wagglewaggle.global.entity.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 소셜 계정. (provider, providerUserId) 조합이 기존 회원 판별 키다.
 * id는 온보딩 토큰의 social_account_id로 사용된다.
 * 온보딩 완료 전에는 member가 null이며, 온보딩 완료 시(별도 티켓) member를 연결한다.
 */
@Getter
@Entity
@Table(
        name = "social_accounts",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_social_accounts_provider_provider_user_id",
                columnNames = {"provider", "provider_user_id"}
        )
)
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class SocialAccount extends BaseEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "provider", nullable = false)
    private OAuthProvider provider;

    @Column(name = "provider_user_id", nullable = false, length = 255)
    private String providerUserId;

    @Column(name = "email", length = 320)
    private String email;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "member_id")
    private Member member;

    private SocialAccount(OAuthProvider provider, String providerUserId, String email) {
        this.provider = provider;
        this.providerUserId = providerUserId;
        this.email = email;
    }

    public static SocialAccount create(OAuthProvider provider, String providerUserId, String email) {
        return new SocialAccount(provider, providerUserId, email);
    }

    /**
     * 온보딩 완료 시(별도 티켓) 생성된 member를 연결한다.
     */
    public void linkMember(Member member) {
        this.member = member;
    }
}
