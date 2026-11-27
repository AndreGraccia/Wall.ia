package com.github.yildizmy.repository;

import com.github.yildizmy.domain.entity.CategoryChoice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CategoryChoiceRepository extends JpaRepository<CategoryChoice, Long> {

    List<CategoryChoice> findByUserId(long userId);

    Optional<CategoryChoice> findByUserIdAndTransactionId(long userId, long transactionId);
}
