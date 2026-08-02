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
     * 크레딧 잔액 변경 트랜잭션용 단일 회원 조회(비관적 쓰기 잠금).
     * 잔액은 "읽고 나서 변경"하므로 lost update를 막기 위해 이 행을 잠근 채 조회한다.
     * 요청자·수락자 두 회원을 함께 잠글 때는 데드락 방지를 위해 호출부에서 member id 오름차순으로 잠근다.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT m FROM Member m WHERE m.id = :id")
    Optional<Member> findByIdForUpdate(@Param("id") Long id);
}
