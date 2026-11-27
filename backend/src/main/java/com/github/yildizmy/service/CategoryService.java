package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.CategoryChoice;
import com.github.yildizmy.domain.entity.CategoryRule;
import com.github.yildizmy.dto.response.CategoryResponses;
import com.github.yildizmy.exception.WalletRuleException;
import com.github.yildizmy.repository.CategoryChoiceRepository;
import com.github.yildizmy.repository.CategoryRuleRepository;
import com.github.yildizmy.service.future.Categories;
import com.github.yildizmy.service.future.RecurrenceDetector;
import com.github.yildizmy.service.future.RecurrenceDetector.Direction;
import com.github.yildizmy.service.future.RecurrenceDetector.Movement;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/** "Para revisar": the category a person picks for a movement, the rules made from it, and undoing both (ADR 0024). */
@Service
@RequiredArgsConstructor
public class CategoryService {

    static final int MAX_RULES = 100;
    static final int PREVIEW_ITEMS = 50;

    private final FutureService futureService;
    private final CategoryChoiceRepository choices;
    private final CategoryRuleRepository rules;
    private final UserService userService;
    private final Clock clock;

    /**
     * 404 TRANSACTION_NOT_FOUND when it is not a settled movement of this person's cash flow (someone else's, unknown,
     * or a transfer between their own accounts); 422 CATEGORY_NOT_ALLOWED when the category is of the other side.
     */
    @Transactional
    public void choose(long userId, long transactionId, String category) {
        userService.lockForUpdate(userId);
        allowed(movement(history(futureService.context(userId)), transactionId), category);
        Instant now = clock.instant();
        CategoryChoice row = choices.findByUserIdAndTransactionId(userId, transactionId).orElseGet(() -> {
            CategoryChoice created = new CategoryChoice();
            created.setUserId(userId);
            created.setTransactionId(transactionId);
            created.setCreatedAt(now);
            return created;
        });
        row.setCategory(category);
        row.setUpdatedAt(now);
        choices.save(row);
    }

    /** Back to the rule or the automatic category. Removing what does not exist changes nothing. */
    @Transactional
    public void clear(long userId, long transactionId) {
        choices.findByUserIdAndTransactionId(userId, transactionId).ifPresent(choices::delete);
    }

    /** What the rule would change, before saving it. Same errors as {@link #createRule}, saves nothing. */
    @Transactional(readOnly = true)
    public CategoryResponses.Preview preview(long userId, long transactionId, String category, boolean includePrevious) {
        FutureService.Context context = futureService.context(userId);
        List<Movement> history = history(context);
        Movement source = ruleSource(history, transactionId, category);
        String key = CategoryResolver.key(source.direction(), source.counterparty());
        Map<Long, String> chosen = choices.findByUserId(userId).stream()
                .collect(Collectors.toMap(CategoryChoice::getTransactionId, CategoryChoice::getCategory));
        List<Movement> inScope = history.stream()
                .filter(item -> key.equals(CategoryResolver.key(item.direction(), item.counterparty())))
                .filter(item -> includePrevious || !item.date().isBefore(context.today()))
                .toList();
        List<Movement> affected = inScope.stream()
                .filter(item -> !chosen.containsKey(item.id()))
                .sorted(Comparator.comparing(Movement::date).thenComparingLong(Movement::id).reversed())
                .toList();
        int kept = (int) inScope.stream()
                .filter(item -> chosen.containsKey(item.id()) && !chosen.get(item.id()).equals(category))
                .count();
        String replaces = matching(userId, key).stream().map(CategoryRule::getCategory).findFirst().orElse(null);
        return new CategoryResponses.Preview(source.counterparty(), category, affected.size(), kept, replaces,
                affected.stream().limit(PREVIEW_ITEMS)
                        .map(item -> new CategoryResponses.Entry(item.id(), item.date(), item.amount(), item.accountName()))
                        .toList());
    }

    /**
     * Saves "whenever it is this counterparty, use this category", taken from one of the person's movements; the client
     * never types the counterparty. A rule for the same counterparty and side is replaced. 404 TRANSACTION_NOT_FOUND;
     * 422 CATEGORY_NOT_ALLOWED or CATEGORY_RULE_NOT_ALLOWED (a name with nothing to match); 409 CATEGORY_RULE_LIMIT.
     */
    @Transactional
    public CategoryResponses.Rule createRule(long userId, long transactionId, String category, boolean includePrevious) {
        userService.lockForUpdate(userId);
        FutureService.Context context = futureService.context(userId);
        Movement source = ruleSource(history(context), transactionId, category);
        List<CategoryRule> replaced = matching(userId, CategoryResolver.key(source.direction(), source.counterparty()));
        if (replaced.isEmpty() && rules.findByUserIdOrderById(userId).size() >= MAX_RULES) {
            throw new WalletRuleException("CATEGORY_RULE_LIMIT");
        }
        rules.deleteAll(replaced);
        CategoryRule rule = new CategoryRule();
        rule.setUserId(userId);
        rule.setDirection(source.direction());
        rule.setDescription(source.counterparty());
        rule.setCategory(category);
        rule.setAppliesFrom(includePrevious ? null : context.today());
        rule.setCreatedAt(clock.instant());
        return response(rules.save(rule));
    }

    @Transactional(readOnly = true)
    public List<CategoryResponses.Rule> rules(long userId) {
        return rules.findByUserIdOrderById(userId).stream().map(CategoryService::response).toList();
    }

    /** Its whole effect goes with it. 404 CATEGORY_RULE_NOT_FOUND for an unknown rule or someone else's. */
    @Transactional
    public void deleteRule(long userId, long ruleId) {
        rules.delete(rules.findByIdAndUserId(ruleId, userId)
                .orElseThrow(() -> new WalletRuleException("CATEGORY_RULE_NOT_FOUND")));
    }

    // --- internals ---------------------------------------------------------------------------

    /** Compared in memory: the counterparty is encrypted in the database, so it cannot be a unique column. */
    private List<CategoryRule> matching(long userId, String key) {
        return rules.findByUserIdOrderById(userId).stream()
                .filter(rule -> key.equals(CategoryResolver.key(rule.getDirection(), rule.getDescription())))
                .toList();
    }

    private static List<Movement> history(FutureService.Context context) {
        return FutureService.movements(context.transactions(), context.wallets());
    }

    private static Movement movement(List<Movement> history, long transactionId) {
        Map<Long, Movement> byId = history.stream()
                .collect(Collectors.toMap(Movement::id, Function.identity(), (first, second) -> first));
        Movement movement = byId.get(transactionId);
        if (movement == null) throw new WalletRuleException("TRANSACTION_NOT_FOUND");
        return movement;
    }

    private static Movement ruleSource(List<Movement> history, long transactionId, String category) {
        Movement source = movement(history, transactionId);
        allowed(source, category);
        if (RecurrenceDetector.counterpartyKey(source.counterparty()).isEmpty()) {
            throw new WalletRuleException("CATEGORY_RULE_NOT_ALLOWED");
        }
        return source;
    }

    private static void allowed(Movement movement, String category) {
        if (!Categories.allowed(movement.direction(), category)) throw new WalletRuleException("CATEGORY_NOT_ALLOWED");
    }

    private static CategoryResponses.Rule response(CategoryRule rule) {
        return new CategoryResponses.Rule(rule.getId(), rule.getDescription(),
                rule.getDirection() == Direction.IN ? "income" : "spending", rule.getCategory(), rule.getAppliesFrom());
    }
}
