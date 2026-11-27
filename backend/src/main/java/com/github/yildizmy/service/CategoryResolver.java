package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.CategoryRule;
import com.github.yildizmy.repository.CategoryChoiceRepository;
import com.github.yildizmy.repository.CategoryRuleRepository;
import com.github.yildizmy.service.future.Categories;
import com.github.yildizmy.service.future.MonthFlow;
import com.github.yildizmy.service.future.RecurrenceDetector;
import com.github.yildizmy.service.future.RecurrenceDetector.Movement;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * The categories the person decided for their movements (ADR 0024): the choice for one movement first, then the rule
 * for its counterparty. Computed on read: nothing is written to a bank transaction, so removing a choice or a rule
 * undoes its whole effect.
 */
@Component
@RequiredArgsConstructor
public class CategoryResolver {

    private final CategoryChoiceRepository choices;
    private final CategoryRuleRepository rules;

    /** Movement id to the decided category; movements nobody decided are absent. */
    public Map<Long, MonthFlow.Choice> resolve(long userId, List<Movement> movements) {
        Map<Long, String> chosen = new HashMap<>();
        choices.findByUserId(userId).forEach(row -> chosen.put(row.getTransactionId(), row.getCategory()));
        Map<String, CategoryRule> byCounterparty = new HashMap<>();
        rules.findByUserIdOrderById(userId).forEach(rule -> byCounterparty.put(
                key(rule.getDirection(), rule.getDescription()), rule));
        Map<Long, MonthFlow.Choice> result = new HashMap<>();
        for (Movement movement : movements) {
            String category = chosen.get(movement.id());
            if (Categories.allowed(movement.direction(), category)) {
                result.put(movement.id(), new MonthFlow.Choice(category, MonthFlow.Origin.CHOSEN));
                continue;
            }
            CategoryRule rule = byCounterparty.get(key(movement.direction(), movement.counterparty()));
            if (rule != null && (rule.getAppliesFrom() == null || !movement.date().isBefore(rule.getAppliesFrom()))) {
                result.put(movement.id(), new MonthFlow.Choice(rule.getCategory(), MonthFlow.Origin.RULE));
            }
        }
        return result;
    }

    /** What a rule matches: the side and the counterparty name without case, accents or punctuation. */
    static String key(RecurrenceDetector.Direction direction, String counterparty) {
        return direction + ":" + RecurrenceDetector.counterpartyKey(counterparty);
    }
}
