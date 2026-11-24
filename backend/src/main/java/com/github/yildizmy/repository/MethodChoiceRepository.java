package com.github.yildizmy.repository;

import com.github.yildizmy.domain.entity.MethodChoice;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MethodChoiceRepository extends JpaRepository<MethodChoice, Long> {

    /** Newest first; the first one is the current method. */
    List<MethodChoice> findTop20ByUserIdOrderByChosenAtDescIdDesc(Long userId);

    long countByUserId(Long userId);
}
