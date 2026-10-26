package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.ChargeAlertDecision;
import com.github.yildizmy.domain.entity.Transaction;
import com.github.yildizmy.domain.entity.Wallet;
import com.github.yildizmy.domain.enums.Status;
import com.github.yildizmy.domain.enums.TransactionSource;
import com.github.yildizmy.domain.enums.WalletSource;
import com.github.yildizmy.dto.response.ChargeAlertResponse;
import com.github.yildizmy.exception.WalletRuleException;
import com.github.yildizmy.repository.ChargeAlertDecisionRepository;
import com.github.yildizmy.repository.TransactionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Finds review-worthy patterns in the signed-in user's own imported withdrawals.
 * It never labels an event as fraud, never changes a bank transaction and never contacts the bank.
 */
@Service
@RequiredArgsConstructor
public class ChargeAlertService {

    static final int LOOKBACK_DAYS = 180;
    static final int DUPLICATE_WINDOW_HOURS = 48;
    static final int MIN_HISTORY_OCCURRENCES = 3;
    static final int MAX_ALERTS = 20;
    static final BigDecimal MIN_ABSOLUTE_INCREASE = new BigDecimal("20.00");
    static final BigDecimal UNUSUAL_AMOUNT_MULTIPLE = new BigDecimal("1.50");

    private static final Set<String> NON_CUSTOMER_TRANSFER_TYPES = Set.of(
            "TED", "DOC", "TEF", "TRANSFERENCIA_MESMA_INSTITUICAO",
            "INTERNAL_TRANSFER", "TRANSFER", "TRANSFERENCIA"
    );
    private static final Set<String> GENERIC_DESCRIPTIONS = Set.of(
            "pix", "pagamento", "compra", "debito", "cartao", "saque", "withdrawal",
            "purchase", "payment", "debit", "transferencia", "transfer", "boleto",
            "pagamento cartao", "compra cartao"
    );
    private static final Set<String> CLOSED_DECISIONS = Set.of("NOT_ANOMALOUS", "RESOLVED");

    private final TransactionRepository transactionRepository;
    private final ChargeAlertDecisionRepository decisionRepository;
    private final UserService userService;
    private final Clock clock;

    @Transactional(readOnly = true)
    public List<ChargeAlertResponse> findForUser(long userId) {
        List<DetectedAlert> candidates = discover(userId);
        if (candidates.isEmpty()) return List.of();

        List<Long> transactionIds = candidates.stream()
                .map(item -> item.transaction().getId())
                .distinct()
                .toList();
        Map<Long, ChargeAlertDecision> decisions = decisionRepository
                .findByUser_IdAndTransaction_IdIn(userId, transactionIds).stream()
                .collect(Collectors.toMap(item -> item.getTransaction().getId(), item -> item, (left, right) -> right));

        return candidates.stream()
                .filter(item -> {
                    ChargeAlertDecision decision = decisions.get(item.transaction().getId());
                    return decision == null || !CLOSED_DECISIONS.contains(decision.getDecision());
                })
                .map(item -> {
                    ChargeAlertDecision decision = decisions.get(item.transaction().getId());
                    ChargeAlertResponse response = item.response();
                    return new ChargeAlertResponse(
                            response.transactionId(), response.kind(), response.confidence(), response.description(),
                            response.walletName(), response.institutionName(), response.date(), response.amount(),
                            response.relatedTransactionId(), response.relatedDate(), response.baselineAmount(),
                            response.difference(), response.occurrences(),
                            decision == null ? null : decision.getDecision()
                    );
                })
                .sorted(Comparator.comparing(ChargeAlertResponse::date).reversed()
                        .thenComparing(ChargeAlertResponse::transactionId, Comparator.reverseOrder()))
                .limit(MAX_ALERTS)
                .toList();
    }

    @Transactional
    public void decide(long userId, long transactionId, String decisionValue) {
        if (decisionValue == null || !Set.of("REVIEW", "NOT_ANOMALOUS", "RESOLVED").contains(decisionValue)) {
            throw new WalletRuleException("INVALID_CHARGE_ALERT_DECISION");
        }

        DetectedAlert detected = discover(userId).stream()
                .filter(item -> item.transaction().getId().equals(transactionId))
                .findFirst()
                .orElseThrow(() -> new WalletRuleException("CHARGE_ALERT_NOT_FOUND"));

        ChargeAlertDecision decision = decisionRepository.findByUser_IdAndTransaction_Id(userId, transactionId)
                .orElseGet(ChargeAlertDecision::new);
        Instant now = clock.instant();
        if (decision.getId() == null) {
            decision.setUser(userService.getReferenceById(userId));
            decision.setTransaction(detected.transaction());
            decision.setCreatedAt(now);
        }
        decision.setDecision(decisionValue);
        decision.setUpdatedAt(now);
        decisionRepository.save(decision);
    }

    private List<DetectedAlert> discover(long userId) {
        Instant now = clock.instant();
        Instant since = now.minus(Duration.ofDays(LOOKBACK_DAYS));
        List<Transaction> transactions = transactionRepository.findAllByUserIdSince(userId, since).stream()
                .filter(transaction -> isEligibleWithdrawal(transaction, userId))
                .sorted(Comparator.comparing(Transaction::getCreatedAt)
                        .thenComparing(Transaction::getId))
                .toList();

        Map<String, List<Transaction>> byWalletAndDescription = new HashMap<>();
        for (Transaction transaction : transactions) {
            String descriptionKey = normalizeDescription(transaction.getDescription());
            if (descriptionKey.isEmpty() || GENERIC_DESCRIPTIONS.contains(descriptionKey)
                    || isLikelyInternalTransfer(transaction, descriptionKey)) {
                continue;
            }
            Wallet wallet = transaction.getFromWallet();
            String key = wallet.getId() + ":" + descriptionKey;
            byWalletAndDescription.computeIfAbsent(key, ignored -> new ArrayList<>()).add(transaction);
        }

        List<DetectedAlert> alerts = new ArrayList<>();
        for (List<Transaction> group : byWalletAndDescription.values()) {
            group.sort(Comparator.comparing(Transaction::getCreatedAt)
                    .thenComparing(Transaction::getId));
            // A suspicious row is not used as historical evidence for later rows: it must not teach the
            // detector that an accidentally repeated or abnormal amount is a normal charge.
            List<Transaction> cleanHistory = new ArrayList<>();
            for (Transaction current : group) {
                Transaction duplicate = cleanHistory.stream()
                        .filter(previous -> sameAmount(previous.getAmount(), current.getAmount()))
                        .filter(previous -> withinDuplicateWindow(previous.getCreatedAt(), current.getCreatedAt()))
                        .max(Comparator.comparing(Transaction::getCreatedAt))
                        .orElse(null);

                if (duplicate != null) {
                    long sameAmountCount = cleanHistory.stream()
                            .filter(previous -> sameAmount(previous.getAmount(), current.getAmount()))
                            .filter(previous -> withinDuplicateWindow(previous.getCreatedAt(), current.getCreatedAt()))
                            .count();
                    alerts.add(new DetectedAlert(current, toResponse(current, "POSSIBLE_DUPLICATE", "HIGH",
                            duplicate, null, null, (int) sameAmountCount + 1)));
                    continue;
                }

                if (cleanHistory.size() >= MIN_HISTORY_OCCURRENCES) {
                    BigDecimal median = median(cleanHistory.stream().map(Transaction::getAmount).toList());
                    BigDecimal difference = money(current.getAmount().subtract(median));
                    if (median.signum() > 0
                            && current.getAmount().compareTo(median.multiply(UNUSUAL_AMOUNT_MULTIPLE)) >= 0
                            && difference.compareTo(MIN_ABSOLUTE_INCREASE) >= 0) {
                        Transaction baseline = cleanHistory.get(cleanHistory.size() - 1);
                        alerts.add(new DetectedAlert(current, toResponse(current, "UNUSUAL_AMOUNT", "MEDIUM",
                                baseline, median, difference, cleanHistory.size())));
                        continue;
                    }
                }
                cleanHistory.add(current);
            }
        }
        return alerts;
    }

    private static boolean isEligibleWithdrawal(Transaction transaction, long userId) {
        if (transaction.getStatus() != Status.SUCCESS
                || transaction.getSource() != TransactionSource.OPEN_FINANCE
                || transaction.getAmount() == null
                || transaction.getAmount().signum() <= 0
                || transaction.getCreatedAt() == null
                || transaction.getFromWallet() == null
                || transaction.getFromWallet().getUser() == null
                || !Long.valueOf(userId).equals(transaction.getFromWallet().getUser().getId())
                || transaction.getFromWallet().getSource() != WalletSource.OPEN_FINANCE
                || transaction.getType() == null
                || transaction.getType().getName() == null
                || !"Withdrawal".equalsIgnoreCase(transaction.getType().getName())) {
            return false;
        }
        return normalizeDescription(transaction.getDescription()).length() >= 4;
    }

    private static boolean isLikelyInternalTransfer(Transaction transaction, String descriptionKey) {
        String paymentType = transaction.getPaymentType();
        if (paymentType != null && NON_CUSTOMER_TRANSFER_TYPES.contains(normalizeDescription(paymentType)
                .replace(" ", "_").toUpperCase(Locale.ROOT))) {
            return true;
        }
        return descriptionKey.contains("transferencia entre contas")
                || descriptionKey.contains("transferencia interna")
                || descriptionKey.contains("transferencia mesma titularidade")
                || descriptionKey.contains("entre minhas contas")
                || descriptionKey.contains("transferencia propria");
    }

    private static String normalizeDescription(String description) {
        if (description == null || description.isBlank()) return "";
        return Normalizer.normalize(description, Normalizer.Form.NFD)
                .replaceAll("\\p{M}+", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[^a-z0-9]+", " ")
                .trim();
    }

    private static boolean sameAmount(BigDecimal left, BigDecimal right) {
        return left != null && right != null && left.compareTo(right) == 0;
    }

    private static boolean withinDuplicateWindow(Instant previous, Instant current) {
        if (previous == null || current == null || current.isBefore(previous)) return false;
        Duration gap = Duration.between(previous, current);
        return !gap.isNegative() && gap.compareTo(Duration.ofHours(DUPLICATE_WINDOW_HOURS)) <= 0;
    }

    private static BigDecimal median(List<BigDecimal> values) {
        List<BigDecimal> sorted = values.stream().map(ChargeAlertService::money)
                .sorted().toList();
        int middle = sorted.size() / 2;
        if (sorted.size() % 2 == 1) return sorted.get(middle);
        return sorted.get(middle - 1).add(sorted.get(middle))
                .divide(new BigDecimal("2"), 2, RoundingMode.HALF_UP);
    }

    private static BigDecimal money(BigDecimal amount) {
        return amount.setScale(2, RoundingMode.HALF_UP);
    }

    private static ChargeAlertResponse toResponse(
            Transaction current,
            String kind,
            String confidence,
            Transaction related,
            BigDecimal baseline,
            BigDecimal difference,
            int occurrences) {
        Wallet wallet = current.getFromWallet();
        return new ChargeAlertResponse(
                current.getId(),
                kind,
                confidence,
                current.getDescription(),
                wallet.getName(),
                wallet.getInstitutionName(),
                LocalDate.ofInstant(current.getCreatedAt(), FutureService.ZONE),
                money(current.getAmount()),
                related == null ? null : related.getId(),
                related == null ? null : LocalDate.ofInstant(related.getCreatedAt(), FutureService.ZONE),
                baseline == null ? null : money(baseline),
                difference == null ? null : money(difference),
                occurrences,
                null
        );
    }

    private record DetectedAlert(Transaction transaction, ChargeAlertResponse response) {}
}
