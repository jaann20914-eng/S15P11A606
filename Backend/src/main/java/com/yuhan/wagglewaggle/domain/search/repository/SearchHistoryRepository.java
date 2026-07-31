package com.yuhan.wagglewaggle.domain.search.repository;

import com.yuhan.wagglewaggle.domain.search.entity.SearchHistory;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SearchHistoryRepository extends JpaRepository<SearchHistory, Long> {
}
