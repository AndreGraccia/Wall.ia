package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.Loan;
import com.github.yildizmy.domain.entity.ManualDebt;
import com.github.yildizmy.dto.request.FutureRequests;
import com.github.yildizmy.exception.WalletRuleException;
import com.github.yildizmy.repository.CreditCardRepository;
import com.github.yildizmy.repository.EnvelopeRepository;
import com.github.yildizmy.repository.GoalRepository;
import com.github.yildizmy.repository.LoanRepository;
import com.github.yildizmy.repository.ManualDebtRepository;
import com.github.yildizmy.repository.RecurrenceDecisionRepository;
import com.github.yildizmy.repository.TransactionRepository;
import com.github.yildizmy.repository.WalletRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** B14: "Pix no crédito" typed by the person enters the payoff order with its own CET (ADR 0013, ADR 0020). */
class FuturePixCreditTest {

    private final LoanRepository loans = mock(LoanRepository.class);
    private final ManualDebtRepository manualDebts = mock(ManualDebtRepository.class);
    private final FutureService service = new FutureService(
            mock(WalletRepository.class), mock(TransactionRepository.class), mock(RecurrenceDecisionRepository.class),
            mock(CreditCardRepository.class), loans, mock(GoalRepository.class), mock(EnvelopeRepository.class),
            manualDebts, mock(UserService.class), mock(com.github.yildizmy.service.market.MarketRatesService.class),
            Clock.fixed(Instant.parse("2026-11-19T15:00:00Z"), ZoneOffset.UTC));

    private static ManualDebt pix(long id, String balance, String installment, String monthlyCet) {
        ManualDebt debt = new ManualDebt();
        debt.setId(id);
        debt.setKind(ManualDebt.PIX_CREDIT);
        debt.setLabel("Banco Aurora");
        debt.setOutstandingBalance(new BigDecimal(balance));
        debt.setInstallmentAmount(new BigDecimal(installment));
        debt.setMonthlyCet(new BigDecimal(monthlyCet));
        debt.setCreatedAt(Instant.parse("2026-11-19T15:00:00Z"));
        return debt;
    }

    private static Loan loan() {
        Loan loan = new Loan();
        loan.setId(1L);
        loan.setProduct("Crédito pessoal");
        loan.setInstitution("Banco Aurora");
        loan.setOutstandingBalance(new BigDecimal("3000.00"));
        loan.setInstallmentAmount(new BigDecimal("300.00"));
        loan.setAnnualRate(new BigDecimal("30"));
        return loan;
    }

    @Test
    void pixOnCreditAt8PercentAMonthGoesFirstInTheAvalancheAndSaysItWasTypedByThePerson() {
        when(loans.findByUserIdOrderById(7L)).thenReturn(List.of(loan()));
        when(manualDebts.findByUserIdOrderById(7L)).thenReturn(List.of(pix(5, "1000.00", "100.00", "8")));

        var answer = service.debtPayoff(7L, new BigDecimal("200"));

        var first = answer.plan().avalanche().order().get(0);
        assertEquals("pix-5", first.id());
        assertEquals("Pix no crédito - Banco Aurora", first.label());
        assertEquals("MANUAL", first.origin());
        assertEquals("OPEN_FINANCE", answer.plan().avalanche().order().get(1).origin());
    }

    @Test
    void theMonthlyCetIsChargedAsTypedToTheCent() {
        // 8% a.m. on R$ 1.000,00 is R$ 80,00 in the first month; an instalment of R$ 1.080,00 pays it all.
        when(manualDebts.findByUserIdOrderById(7L)).thenReturn(List.of(pix(5, "1000.00", "1080.00", "8")));

        var baseline = service.debtPayoff(7L, BigDecimal.ZERO).plan().baseline();

        assertEquals(1, baseline.months());
        assertEquals(new BigDecimal("80.00"), baseline.interest());
    }

    @Test
    void registeringStoresWhatWasTypedWithItsOriginAndCertainty() {
        when(manualDebts.save(any())).thenAnswer(call -> {
            ManualDebt saved = call.getArgument(0);
            saved.setId(9L);
            return saved;
        });

        var created = service.createManualDebt(7L, new FutureRequests.ManualDebt(
                "PIX_CREDIT", "  Banco Aurora ", new BigDecimal("1000.00"), new BigDecimal("100.00"), new BigDecimal("8.5")));

        assertEquals(9L, created.id());
        assertEquals("Banco Aurora", created.label());
        assertEquals("MANUAL", created.origin());
        assertEquals("ESTIMATED", created.certainty());
        assertEquals(new BigDecimal("8.5"), created.monthlyCet());
    }

    @Test
    void moreThanTheLimitIsRefusedAndNothingIsSaved() {
        when(manualDebts.countByUserId(7L)).thenReturn((long) FutureService.MAX_MANUAL_DEBTS);

        var error = assertThrows(WalletRuleException.class, () -> service.createManualDebt(7L, new FutureRequests.ManualDebt(
                "PIX_CREDIT", "Banco Aurora", new BigDecimal("1000.00"), new BigDecimal("100.00"), new BigDecimal("8"))));

        assertEquals("MANUAL_DEBT_LIMIT", error.getMessage());
        verify(manualDebts, never()).save(any());
    }

    @Test
    void someoneElsesDebtIsNotFound() {
        when(manualDebts.findByIdAndUserId(5L, 7L)).thenReturn(Optional.empty());

        var error = assertThrows(WalletRuleException.class, () -> service.deleteManualDebt(7L, 5L));

        assertEquals("MANUAL_DEBT_NOT_FOUND", error.getMessage());
    }

    @Test
    void commitmentsListThePixOnCreditWithItsOrigin() {
        when(manualDebts.findByUserIdOrderById(7L)).thenReturn(List.of(pix(5, "1000.00", "100.00", "8")));

        var commitments = service.commitments(7L);

        assertEquals(1, commitments.manualDebts().size());
        assertEquals("MANUAL", commitments.manualDebts().get(0).origin());
        assertEquals(null, commitments.bankData(), "typed by the person: no bank sync to be late");
    }
}
