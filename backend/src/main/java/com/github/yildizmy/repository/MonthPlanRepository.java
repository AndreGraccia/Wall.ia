package com.github.yildizmy.repository;

import com.github.yildizmy.domain.entity.MonthPlan;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MonthPlanRepository extends JpaRepository<MonthPlan, Long> {

    Optional<MonthPlan> findByUserId(Long userId);
}
