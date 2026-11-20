package com.github.yildizmy.repository;

import com.github.yildizmy.domain.entity.ManualDebt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ManualDebtRepository extends JpaRepository<ManualDebt, Long> {

    List<ManualDebt> findByUserIdOrderById(Long userId);

    long countByUserId(Long userId);

    /** Scoped by user: a debt id from another account is simply not found. */
    Optional<ManualDebt> findByIdAndUserId(Long id, Long userId);
}
