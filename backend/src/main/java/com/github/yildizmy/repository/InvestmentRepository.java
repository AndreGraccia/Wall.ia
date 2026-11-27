package com.github.yildizmy.repository;

import com.github.yildizmy.domain.entity.Investment;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

/** Only the wealth screen reads this: investments never reach the balance or the projection (ADR 0026). */
public interface InvestmentRepository extends JpaRepository<Investment, Long> {

    /** One query with the value history. */
    @EntityGraph(attributePaths = "values")
    List<Investment> findByUserIdOrderById(Long userId);

    long countByUserId(Long userId);

    /** Scoped by user: an investment id from another account is simply not found. */
    Optional<Investment> findByIdAndUserId(Long id, Long userId);
}
