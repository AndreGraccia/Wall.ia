package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.Loan;
import com.github.yildizmy.exception.WalletRuleException;
import com.github.yildizmy.repository.CreditCardRepository;
import com.github.yildizmy.repository.EnvelopeRepository;
import com.github.yildizmy.repository.GoalRepository;
import com.github.yildizmy.repository.LoanRepository;
import com.github.yildizmy.repository.RecurrenceDecisionRepository;
import com.github.yildizmy.repository.TransactionRepository;
import com.github.yildizmy.repository.WalletRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FutureDebtPayoffTest {

    private final LoanRepository loans = mock(LoanRepository.class);
    private final FutureService service = new FutureService(
            mock(WalletRepository.class), mock(TransactionRepository.class), mock(RecurrenceDecisionRepository.class),
            mock(CreditCardRepository.class), loans, mock(GoalRepository.class), mock(EnvelopeRepository.class),
            mock(com.github.yildizmy.repository.ManualDebtRepository.class), mock(UserService.class), mock(com.github.yildizmy.service.market.MarketRatesService.class),
            Clock.fixed(Instant.parse("2026-09-25T15:00:00Z"), ZoneOffset.UTC));

    private static Loan loan(long id, String balance, String installment, String rate) {
        Loan loan = new Loan();
        loan.setId(id);
        loan.setProduct("Crédito pessoal");
        loan.setInstitution("Banco Aurora");
        loan.setOutstandingBalance(balance == null ? null : new BigDecimal(balance));
        loan.setInstallmentAmount(installment == null ? null : new BigDecimal(installment));
        loan.setAnnualRate(rate == null ? null : new BigDecimal(rate));
        return loan;
    }

    @Test
    void loansWithoutWhatThePlanNeedsAreCountedAndPaidOffOnesAreIgnored() {
        when(loans.findByUserIdOrderById(7L)).thenReturn(List.of(
                loan(1, "1200.00", "100.00", "0"),
                loan(2, "900.00", "90.00", null),
                loan(3, "0.00", "50.00", "20")));

        var answer = service.debtPayoff(7L, new BigDecimal("100"));

        assertEquals(1, answer.loansWithoutRate());
        assertEquals(1, answer.plan().avalanche().order().size());
        assertEquals("Crédito pessoal - Banco Aurora", answer.plan().avalanche().order().get(0).label());
        assertEquals(12, answer.plan().baseline().months());
        assertEquals(6, answer.plan().avalanche().months());
    }

    @Test
    void aNegativeOrAbsurdExtraIsRefused() {
        assertThrows(WalletRuleException.class, () -> service.debtPayoff(7L, new BigDecimal("-1")));
        assertThrows(WalletRuleException.class, () -> service.debtPayoff(7L, new BigDecimal("1000001")));
    }

    @Test
    void anAmountWithAHugeExponentIsRefusedBeforeAnyArithmetic() {
        // ?extra=1e-40000000 passed the range check and setScale(2) then took 14 s of CPU per request.
        org.junit.jupiter.api.Assertions.assertTimeoutPreemptively(java.time.Duration.ofSeconds(1), () -> {
            assertThrows(WalletRuleException.class, () -> service.debtPayoff(7L, new BigDecimal("1e-40000000")));
            assertThrows(WalletRuleException.class, () -> service.debtPayoff(7L, new BigDecimal("0.001")));
        });
    }
}
