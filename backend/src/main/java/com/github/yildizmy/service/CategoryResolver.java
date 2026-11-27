package com.github.yildizmy.service;

import com.github.yildizmy.repository.CategoryChoiceRepository;
import com.github.yildizmy.service.future.Categories;
import com.github.yildizmy.service.future.MonthFlow;
import com.github.yildizmy.service.future.RecurrenceDetector.Movement;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * The categories the person decided for their movements (ADR 0024). Computed on read: nothing is written to a bank
 * transaction, so removing a choice undoes its whole effect.
 */
@Component
@RequiredArgsConstructor
public class CategoryResolver {

    private final CategoryChoiceRepository choices;

    /** Movement id to the decided category; movements nobody decided are absent. */
    public Map<Long, MonthFlow.Choice> resolve(long userId, List<Movement> movements) {
        Map<Long, String> chosen = new HashMap<>();
        choices.findByUserId(userId).forEach(row -> chosen.put(row.getTransactionId(), row.getCategory()));
        Map<Long, MonthFlow.Choice> result = new HashMap<>();
        for (Movement movement : movements) {
            String category = chosen.get(movement.id());
            if (Categories.allowed(movement.direction(), category)) {
                result.put(movement.id(), new MonthFlow.Choice(category, MonthFlow.Origin.CHOSEN));
            }
        }
        return result;
    }
}
