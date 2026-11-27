package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.Wallet;
import com.github.yildizmy.domain.enums.WalletSource;
import com.github.yildizmy.dto.response.BillingRadarPriceImpact;
import com.github.yildizmy.dto.response.BillingRadarReport;
import com.github.yildizmy.repository.WalletRepository;
import com.github.yildizmy.service.future.RecurrenceDetector;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** The Radar report (ADR 0019): totals, counters, evidence mapping, the São Paulo day and late bank data (ADR 0020). */
class BillingRadarServiceTest {

    private static final long USER = 7L;
    // 02:00 UTC is still the previous day in São Paulo (UTC-3).
    private static final Instant NOW = Instant.parse("2026-11-01T02:00:00Z");

    private final FutureService futureService = mock(FutureService.class);
    private final WalletRepository walletRepository = mock(WalletRepository.class);
    private final BillingRadarService service =
            new BillingRadarService(futureService, walletRepository, Clock.fixed(NOW, ZoneOffset.UTC));

    private BillingRadarReport reportFor(List<Wallet> wallets, List<RecurrenceDetector.Movement> movements) {
        when(walletRepository.findByUserId(USER)).thenReturn(wallets);
        when(futureService.movements(USER, wallets)).thenReturn(movements);
        return service.report(USER);
    }

    @Test
    void projectedMonthlyTotalSumsTheLatestAmountOfRecurringChargesOnly() {
        BillingRadarReport report = reportFor(List.of(local()), List.of(
                out(1, "2026-08-05", "39.90", "Streaming Plus"),
                out(2, "2026-09-05", "39.90", "Streaming Plus"),
                out(3, "2026-10-05", "49.90", "Streaming Plus"),
                out(4, "2026-08-10", "19.90", "Video App"),
                out(5, "2026-09-10", "19.90", "Video App"),
                out(6, "2026-10-10", "19.90", "Video App"),
                // a one-off duplicate is a signal, but not a monthly commitment
                out(7, "2026-10-20", "42.00", "Mercado do Bairro"),
                out(8, "2026-10-20", "42.00", "Mercado do Bairro")));

        // 49.90 (latest, not the 39.90 baseline) + 19.90; the 42.00 duplicate stays out.
        assertEquals(new BigDecimal("69.80"), report.projectedMonthlyTotal());
    }

    @Test
    void eachCounterCountsItsOwnKindOfSignal() {
        // distinct expected counts (2 recurring, 1 increase, 3 duplicates) so a swapped counter cannot pass
        BillingRadarReport report = reportFor(List.of(local()), List.of(
                out(1, "2026-08-05", "39.90", "Streaming Plus"),
                out(2, "2026-09-05", "39.90", "Streaming Plus"),
                out(3, "2026-10-05", "49.90", "Streaming Plus"),
                out(4, "2026-08-10", "19.90", "Video App"),
                out(5, "2026-09-10", "19.90", "Video App"),
                out(6, "2026-10-10", "19.90", "Video App"),
                out(7, "2026-10-20", "42.00", "Mercado do Bairro"),
                out(8, "2026-10-20", "42.00", "Mercado do Bairro"),
                out(9, "2026-10-21", "15.00", "Farmácia São João"),
                out(10, "2026-10-21", "15.00", "Farmácia São João"),
                out(11, "2026-10-22", "8.50", "Padaria Pão Quente"),
                out(12, "2026-10-22", "8.50", "Padaria Pão Quente")));

        assertEquals(2, report.recurringCount());
        assertEquals(1, report.priceIncreaseCount());
        assertEquals(3, report.possibleDuplicateCount());
        assertEquals(5, report.items().size());
    }

    @Test
    void eachItemCarriesTheDetectorSignalAndItsEvidenceUnchanged() {
        BillingRadarReport report = reportFor(List.of(local()), List.of(
                out(11, "2026-08-05", "39.90", "Streaming Plus"),
                out(12, "2026-09-05", "39.90", "Streaming Plus"),
                out(13, "2026-10-05", "49.90", "Streaming Plus")));

        BillingRadarReport.Item item = report.items().get(0);
        assertEquals("Streaming Plus", item.counterparty());
        assertTrue(item.recurring());
        assertTrue(item.priceIncrease());
        assertFalse(item.possibleDuplicate());
        assertEquals(new BigDecimal("49.90"), item.latestAmount());
        assertEquals(new BigDecimal("39.90"), item.baselineAmount());
        assertEquals(new BigDecimal("10.00"), item.increaseAmount());
        assertEquals(LocalDate.parse("2026-10-05"), item.lastChargeDate());
        assertEquals(3, item.occurrences());
        // newest first, as the detector orders it
        assertEquals(List.of(13L, 12L, 11L), item.evidence().stream().map(BillingRadarReport.Occurrence::transactionId).toList());
        BillingRadarReport.Occurrence newest = item.evidence().get(0);
        assertEquals(LocalDate.parse("2026-10-05"), newest.date());
        assertEquals(new BigDecimal("49.90"), newest.amount());
        assertEquals("Conta principal", newest.accountName());
        assertEquals("Banco de teste", newest.institution());
    }

    @Test
    void duplicateItemKeepsDateAmountAndCount() {
        BillingRadarReport report = reportFor(List.of(local()), List.of(
                out(1, "2026-10-20", "42.00", "Mercado do Bairro"),
                out(2, "2026-10-20", "42.00", "Mercado do Bairro")));

        BillingRadarReport.Item item = report.items().get(0);
        assertTrue(item.possibleDuplicate());
        assertEquals(LocalDate.parse("2026-10-20"), item.duplicateDate());
        assertEquals(0, new BigDecimal("42.00").compareTo(item.duplicateAmount()));
        assertEquals(2, item.duplicateCount());
        assertEquals(0, report.recurringCount());
        assertEquals(new BigDecimal("0.00"), report.projectedMonthlyTotal());
    }

    @Test
    void withoutMovementsTheReportIsEmptyWithAZeroTotalInCents() {
        BillingRadarReport report = reportFor(List.of(), List.of());

        assertTrue(report.items().isEmpty());
        assertEquals(new BigDecimal("0.00"), report.projectedMonthlyTotal());
        assertEquals(0, report.accounts());
        assertNull(report.bankData(), "no Open Finance account: nothing to be late");
    }

    @Test
    void dataThroughIsTheDayInSaoPauloNotInUtc() {
        BillingRadarReport report = reportFor(List.of(local()), List.of());

        assertEquals(NOW, report.generatedAt());
        assertEquals(LocalDate.parse("2026-10-31"), report.dataThrough());
    }

    @Test
    void bankDataIsLateWhenTheOldestOpenFinanceAccountMissedTheDailySync() {
        List<Wallet> wallets = List.of(
                openFinance("Banco Aurora", NOW.minusSeconds(3_600)),
                openFinance("Banco Boreal", NOW.minusSeconds(37 * 3_600)),
                local());

        BillingRadarReport report = reportFor(wallets, List.of());

        assertTrue(report.bankData().stale());
        assertEquals("Banco Boreal", report.bankData().institution());
        assertEquals(3, report.accounts(), "every wallet of the user counts, not only the bank ones");
    }

    @Test
    void bankDataSyncedWithinTheLimitIsNotLate() {
        BillingRadarReport report = reportFor(List.of(openFinance("Banco Aurora", NOW.minusSeconds(35 * 3_600))), List.of());

        assertFalse(report.bankData().stale());
    }

    @Test
    void priceReversionSimulationIsTheCallersAndForTheRequestedSignal() {
        BillingRadarPriceImpact impact = mock(BillingRadarPriceImpact.class);
        when(futureService.simulatePriceReversion(USER, "streaming plus|conta")).thenReturn(impact);

        assertSame(impact, service.simulatePriceReversion(USER, "streaming plus|conta"));
        verify(futureService).simulatePriceReversion(USER, "streaming plus|conta");
    }

    private static RecurrenceDetector.Movement out(long id, String date, String amount, String counterparty) {
        return new RecurrenceDetector.Movement(id, LocalDate.parse(date), new BigDecimal(amount),
                RecurrenceDetector.Direction.OUT, counterparty, "Conta principal", "Banco de teste");
    }

    private static Wallet local() {
        Wallet wallet = new Wallet();
        wallet.setSource(WalletSource.LOCAL);
        return wallet;
    }

    private static Wallet openFinance(String institution, Instant syncedAt) {
        Wallet wallet = new Wallet();
        wallet.setSource(WalletSource.OPEN_FINANCE);
        wallet.setInstitutionName(institution);
        wallet.setLastSyncedAt(syncedAt);
        return wallet;
    }
}
