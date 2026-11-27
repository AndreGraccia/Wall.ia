package com.github.yildizmy.repository;

import com.github.yildizmy.domain.entity.CategoryRule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CategoryRuleRepository extends JpaRepository<CategoryRule, Long> {

    List<CategoryRule> findByUserIdOrderById(long userId);

    Optional<CategoryRule> findByIdAndUserId(long id, long userId);
}
