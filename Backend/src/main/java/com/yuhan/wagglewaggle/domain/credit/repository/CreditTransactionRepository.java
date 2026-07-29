package com.yuhan.wagglewaggle.domain.credit.repository;

import com.yuhan.wagglewaggle.domain.credit.entity.CreditTransaction;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CreditTransactionRepository extends JpaRepository<CreditTransaction, Long> {
}
