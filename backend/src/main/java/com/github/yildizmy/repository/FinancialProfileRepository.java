package com.github.yildizmy.repository;

import com.github.yildizmy.domain.entity.FinancialProfile;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface FinancialProfileRepository extends JpaRepository<FinancialProfile, Long> {

    Optional<FinancialProfile> findByUserId(Long userId);
}
