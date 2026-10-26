package com.github.yildizmy.repository;

import com.github.yildizmy.domain.entity.ChargeAlertDecision;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ChargeAlertDecisionRepository extends JpaRepository<ChargeAlertDecision, Long> {

    Optional<ChargeAlertDecision> findByUser_IdAndTransaction_Id(Long userId, Long transactionId);

    List<ChargeAlertDecision> findByUser_IdAndTransaction_IdIn(Long userId, Collection<Long> transactionIds);
}
