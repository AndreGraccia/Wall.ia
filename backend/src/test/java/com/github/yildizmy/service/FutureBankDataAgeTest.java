package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.Wallet;
import com.github.yildizmy.domain.enums.WalletSource;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** The wallets side of B50: only Open Finance accounts count, and they bring their institution. */
class FutureBankDataAgeTest {

    private static final Instant NOW = Instant.parse("2026-09-25T12:00:00Z");

    private static Wallet wallet(WalletSource source, String institution, String syncedAt) {
        Wallet wallet = new Wallet();
        wallet.setSource(source);
        wallet.setInstitutionName(institution);
        wallet.setLastSyncedAt(syncedAt == null ? null : Instant.parse(syncedAt));
        return wallet;
    }

    @Test
    void theOldestBankAccountSaysHowOldTheBankDataIsAndFromWhichInstitution() {
        var status = FutureService.bankData(List.of(
                wallet(WalletSource.OPEN_FINANCE, "Banco Aurora", "2026-09-25T10:30:00Z"),
                wallet(WalletSource.OPEN_FINANCE, "Banco Boreal", "2026-09-24T10:30:00Z"),
                wallet(WalletSource.LOCAL, null, null)), NOW);

        assertEquals(Instant.parse("2026-09-24T10:30:00Z"), status.asOf());
        assertEquals("Banco Boreal", status.institution());
        assertFalse(status.stale(), "26 hours: one daily sync late at most");
    }

    @Test
    void anOpenFinanceAccountNeverSyncedIsLate() {
        // Before B50 was centralised the Future said "not late" here and the Radar said "late".
        assertTrue(FutureService.bankData(List.of(wallet(WalletSource.OPEN_FINANCE, "Banco Aurora", null)), NOW).stale());
    }

    @Test
    void withoutBankAccountsThereIsNoBankDataToBeOld() {
        assertNull(FutureService.bankData(List.of(wallet(WalletSource.LOCAL, null, null)), NOW));
    }
}
