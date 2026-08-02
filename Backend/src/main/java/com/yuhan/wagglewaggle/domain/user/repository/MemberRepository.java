package com.yuhan.wagglewaggle.domain.user.repository;

import com.yuhan.wagglewaggle.domain.user.entity.Member;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface MemberRepository extends JpaRepository<Member, Long> {

    boolean existsByNickname(String nickname);

    /**
     * 잔액(credit_balance)·온도(view_angle) 갱신 트랜잭션용 단일 회원 조회(비관적 쓰기 잠금).
     * 동시 평가로 인한 잔액·온도 갱신 유실(lost update)을 막기 위해 회원 행을 잠근 채 조회한다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT m FROM Member m WHERE m.id = :memberId")
    Optional<Member> findByIdForUpdate(@Param("memberId") Long memberId);
}
