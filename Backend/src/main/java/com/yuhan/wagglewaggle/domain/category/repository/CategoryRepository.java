package com.yuhan.wagglewaggle.domain.category.repository;

import com.yuhan.wagglewaggle.domain.category.entity.Category;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface CategoryRepository extends JpaRepository<Category, Long> {

    List<Category> findByCodeIn(Collection<String> codes);
}
