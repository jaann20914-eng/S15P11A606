package com.yuhan.wagglewaggle.domain.user.repository;

import com.yuhan.wagglewaggle.domain.user.entity.Member;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemberRepository extends JpaRepository<Member, Long> {
}
