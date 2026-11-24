package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.Transaction;
import com.github.yildizmy.domain.entity.Type;
import com.github.yildizmy.domain.entity.Wallet;
import com.github.yildizmy.domain.enums.Status;
import com.github.yildizmy.domain.enums.TransactionSource;
import com.github.yildizmy.domain.enums.WalletSource;
import com.github.yildizmy.service.future.RecurrenceDetector.Movement;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Open Finance imports each side of a move between the user's own accounts on its own: a Withdrawal in one
 * wallet and a Deposit in the other. Cash movements (Futuro and the billing radar) must not see that pair as an
 * expense and an income, or "Transferência para reserva" turns into a monthly subscription.
 */
class FutureMovementsTest {

    private static final Instant DAY = Instant.parse("2026-11-06T13:00:00Z");

    @Test
    void aMoveBetweenTheUsersOwnAccountsIsNotCashFlow() {
        Wallet checking = wallet(1L, "Conta corrente");
        Wallet savings = wallet(2L, "Reserva");
        Transaction out = entry(10L, checking, 5L, "Withdrawal", "Transferência para reserva", "300.00");
        Transaction in = entry(11L, savings, 4L, "Deposit", "Transferência para reserva", "300.00");

        List<Movement> movements = FutureService.movements(List.of(out, in), List.of(checking, savings));

        assertEquals(List.of(), movements);
    }

    @Test
    void aPixToSomeoneElseWithTheSameValueStillCounts() {
        Wallet checking = wallet(1L, "Conta corrente");
        Wallet savings = wallet(2L, "Reserva");
        Transaction toThirdParty = entry(10L, checking, 5L, "Withdrawal", "Aluguel", "300.00");

        List<Movement> movements = FutureService.movements(List.of(toThirdParty), List.of(checking, savings));

        assertEquals(1, movements.size());
        assertEquals("Aluguel", movements.get(0).counterparty());
    }

    private static Wallet wallet(long id, String name) {
        Wallet wallet = new Wallet();
        wallet.setId(id);
        wallet.setName(name);
        wallet.setInstitutionName("Banco Aurora Sandbox");
        wallet.setSource(WalletSource.OPEN_FINANCE);
        return wallet;
    }

    private static Transaction entry(long id, Wallet wallet, long typeId, String typeName, String description,
                                     String amount) {
        Type type = new Type();
        type.setId(typeId);
        type.setName(typeName);
        Transaction transaction = new Transaction();
        transaction.setId(id);
        transaction.setAmount(new BigDecimal(amount));
        transaction.setDescription(description);
        transaction.setCreatedAt(DAY);
        transaction.setStatus(Status.SUCCESS);
        transaction.setSource(TransactionSource.OPEN_FINANCE);
        transaction.setPaymentType("PIX");
        transaction.setFromWallet(wallet);
        transaction.setToWallet(wallet);
        transaction.setType(type);
        return transaction;
    }
}
