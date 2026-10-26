package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.Wallet;
import com.github.yildizmy.domain.enums.WalletSource;
import com.github.yildizmy.dto.response.BillingRadarReport;
import com.github.yildizmy.repository.WalletRepository;
import com.github.yildizmy.service.future.BillingRadarDetector;
import com.github.yildizmy.service.future.BillingRadarDetector.Signal;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/** Builds the user's billing radar exclusively from their own settled movements. */
@Service
public class BillingRadarService {

    private static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");

    private final FutureService futureService;
    private final WalletRepository walletRepository;
    private final Clock clock;

    public BillingRadarService(FutureService futureService, WalletRepository walletRepository, Clock clock) {
        this.futureService = futureService;
        this.walletRepository = walletRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public BillingRadarReport report(long userId) {
        List<Wallet> wallets = walletRepository.findByUserId(userId);
        List<Signal> signals = BillingRadarDetector.detect(futureService.movements(userId, wallets));

        Instant bankDataAsOf = wallets.stream()
                .filter(wallet -> wallet.getSource() == WalletSource.OPEN_FINANCE)
                .map(Wallet::getLastSyncedAt)
                .filter(Objects::nonNull)
                .min(Comparator.naturalOrder())
                .orElse(null);
        boolean hasOpenFinance = wallets.stream().anyMatch(wallet -> wallet.getSource() == WalletSource.OPEN_FINANCE);
        boolean anyOpenFinanceWithoutSync = wallets.stream()
                .filter(wallet -> wallet.getSource() == WalletSource.OPEN_FINANCE)
                .anyMatch(wallet -> wallet.getLastSyncedAt() == null);
        boolean stale = hasOpenFinance && (anyOpenFinanceWithoutSync || bankDataAsOf == null
                || bankDataAsOf.plus(FutureService.BANK_DATA_STALE_AFTER).isBefore(clock.instant()));

        BigDecimal projectedMonthly = signals.stream()
                .filter(Signal::recurring)
                .map(Signal::latestAmount)
                .reduce(BigDecimal.ZERO.setScale(2), BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);

        List<BillingRadarReport.Item> items = signals.stream()
                .map(signal -> new BillingRadarReport.Item(
                        signal.key(),
                        signal.counterparty(),
                        signal.recurring(),
                        signal.priceIncrease(),
                        signal.possibleDuplicate(),
                        signal.confidence(),
                        signal.latestAmount(),
                        signal.baselineAmount(),
                        signal.increaseAmount(),
                        signal.increasePercent(),
                        signal.lastChargeDate(),
                        signal.nextExpectedDate(),
                        signal.occurrences(),
                        signal.duplicateDate(),
                        signal.duplicateAmount(),
                        signal.duplicateCount(),
                        signal.evidence().stream()
                                .map(item -> new BillingRadarReport.Occurrence(
                                        item.transactionId(), item.date(), item.amount(),
                                        item.accountName(), item.institution()))
                                .toList()
                ))
                .toList();

        return new BillingRadarReport(
                clock.instant(),
                LocalDate.now(clock.withZone(ZONE)),
                bankDataAsOf,
                stale,
                wallets.size(),
                (int) signals.stream().filter(Signal::recurring).count(),
                (int) signals.stream().filter(Signal::priceIncrease).count(),
                (int) signals.stream().filter(Signal::possibleDuplicate).count(),
                projectedMonthly,
                items
        );
    }
}
