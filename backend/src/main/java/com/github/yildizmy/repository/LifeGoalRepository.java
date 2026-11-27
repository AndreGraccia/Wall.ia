package com.github.yildizmy.repository;

import com.github.yildizmy.domain.entity.LifeGoal;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface LifeGoalRepository extends JpaRepository<LifeGoal, Long> {

    /** One query with the steps and the linked goal. */
    @EntityGraph(attributePaths = {"steps", "goal"})
    List<LifeGoal> findByUserIdOrderById(Long userId);

    long countByUserId(Long userId);

    /** Scoped by user: a life goal id from another account is simply not found. */
    Optional<LifeGoal> findByIdAndUserId(Long id, Long userId);
}
