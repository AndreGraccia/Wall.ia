package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.CategoryChoice;
import com.github.yildizmy.exception.WalletRuleException;
import com.github.yildizmy.repository.CategoryChoiceRepository;
import com.github.yildizmy.service.future.Categories;
import com.github.yildizmy.service.future.RecurrenceDetector.Movement;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;

/** "Para revisar": the category a person picks for a movement, and undoing it (ADR 0024). */
@Service
@RequiredArgsConstructor
public class CategoryService {

    private final FutureService futureService;
    private final CategoryChoiceRepository choices;
    private final UserService userService;
    private final Clock clock;

    /**
     * 404 TRANSACTION_NOT_FOUND when it is not a settled movement of this person's cash flow (someone else's, unknown,
     * or a transfer between their own accounts); 422 CATEGORY_NOT_ALLOWED when the category is of the other side.
     */
    @Transactional
    public void choose(long userId, long transactionId, String category) {
        userService.lockForUpdate(userId);
        Movement movement = movement(futureService.context(userId), transactionId);
        if (!Categories.allowed(movement.direction(), category)) throw new WalletRuleException("CATEGORY_NOT_ALLOWED");
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

    private static Movement movement(FutureService.Context context, long transactionId) {
        return FutureService.movements(context.transactions(), context.wallets()).stream()
                .filter(item -> item.id() == transactionId)
                .findFirst()
                .orElseThrow(() -> new WalletRuleException("TRANSACTION_NOT_FOUND"));
    }
}
