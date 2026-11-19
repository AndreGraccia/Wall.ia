package com.github.yildizmy.service.future;

import com.github.yildizmy.service.future.BankDataFreshness.Source;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** One rule for "the bank data is late" on every screen that shows Open Finance data (B50, ADR 0020). */
class BankDataFreshnessTest {

    private static final Instant NOW = Instant.parse("2026-09-25T12:00:00Z");

    private static Source source(String institution, String syncedAt) {
        return new Source(institution, syncedAt == null ? null : Instant.parse(syncedAt));
    }

    @Test
    void theOldestSyncSaysHowOldTheDataIsAndWhichInstitutionHoldsItBack() {
        var status = BankDataFreshness.of(List.of(
                source("Banco Aurora", "2026-09-25T10:30:00Z"),
                source("Banco Boreal", "2026-09-24T10:30:00Z")), NOW);

        assertEquals("Banco Boreal", status.institution());
        assertEquals(Instant.parse("2026-09-24T10:30:00Z"), status.asOf());
        assertFalse(status.stale(), "26 hours: one daily sync late at most");
        assertEquals(36, status.staleAfterHours());
    }

    @Test
    void moreThan36HoursMeansAtLeastOneDailySyncFailed() {
        assertTrue(BankDataFreshness.of(List.of(source("Banco Aurora", "2026-09-23T23:59:00Z")), NOW).stale());
        assertFalse(BankDataFreshness.of(List.of(source("Banco Aurora", "2026-09-24T00:01:00Z")), NOW).stale());
    }

    @Test
    void anAccountThatNeverSyncedIsLateEvenIfTheOthersAreFresh() {
        // The Future screen used to say "not late" here while the Radar said "late": one rule now.
        var status = BankDataFreshness.of(List.of(
                source("Banco Aurora", "2026-09-25T10:30:00Z"),
                source("Banco Boreal", null)), NOW);

        assertTrue(status.stale());
        assertNull(status.asOf());
        assertEquals("Banco Boreal", status.institution());
    }

    @Test
    void withoutBankAccountsThereIsNoBankDataToBeOld() {
        assertNull(BankDataFreshness.of(List.of(), NOW));
    }
}
