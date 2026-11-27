package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.FinancialProfile;
import com.github.yildizmy.domain.entity.Loan;
import com.github.yildizmy.domain.entity.MethodChoice;
import com.github.yildizmy.exception.WalletRuleException;
import com.github.yildizmy.repository.CreditCardRepository;
import com.github.yildizmy.repository.EnvelopeRepository;
import com.github.yildizmy.repository.FinancialProfileRepository;
import com.github.yildizmy.repository.GoalRepository;
import com.github.yildizmy.repository.LoanRepository;
import com.github.yildizmy.repository.ManualDebtRepository;
import com.github.yildizmy.repository.MethodChoiceRepository;
import com.github.yildizmy.repository.MonthPlanRepository;
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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Perfil contextual mínimo and "Meu método" (ADR 0021). */
class ProfileServiceTest {

    private final LoanRepository loans = mock(LoanRepository.class);
    private final ManualDebtRepository manualDebts = mock(ManualDebtRepository.class);
    private final FinancialProfileRepository profiles = mock(FinancialProfileRepository.class);
    private final MethodChoiceRepository choices = mock(MethodChoiceRepository.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-11-23T15:00:00Z"), ZoneOffset.UTC);
    private final FutureService future = new FutureService(mock(WalletRepository.class), mock(TransactionRepository.class),
            mock(RecurrenceDecisionRepository.class), mock(CreditCardRepository.class), loans, mock(GoalRepository.class),
            mock(EnvelopeRepository.class), manualDebts, mock(MonthPlanRepository.class), mock(UserService.class),
            mock(com.github.yildizmy.service.market.MarketRatesService.class), clock);
    private final ProfileService service = new ProfileService(future, profiles, choices, manualDebts,
            mock(UserService.class), clock);

    private static MethodChoice choice(String method) {
        MethodChoice choice = new MethodChoice();
        choice.setMethod(method);
        choice.setCatalogVersion("2026-11-23");
        choice.setChosenAt(Instant.parse("2026-11-20T10:00:00Z"));
        return choice;
    }

    @Test
    void nothingDeclaredIsNotSaidAndNoMethod() {
        var profile = service.profile(7L);

        assertEquals("NOT_SAID", profile.preference());
        assertEquals("NOT_SAID", profile.mainGoal());
        assertNull(profile.method());
        assertNull(profile.derived().confirmedIncome());
    }

    @Test
    void choosingTheCurrentMethodAgainAddsNothingAndANewOneIsAppended() {
        when(choices.findTop20ByUserIdOrderByChosenAtDescIdDesc(7L)).thenReturn(List.of(choice("ENVELOPES")));

        service.chooseMethod(7L, "ENVELOPES");
        verify(choices, never()).save(any());

        service.chooseMethod(7L, "PERCENT_BALANCED");
        verify(choices).save(org.mockito.ArgumentMatchers.argThat(saved ->
                saved.getMethod().equals("PERCENT_BALANCED") && saved.getCatalogVersion().equals(com.github.yildizmy.service.future.MethodCatalog.VERSION)
                        && saved.getChosenAt().equals(clock.instant())));
    }

    @Test
    void theHistoryHasACapAndAnUnknownMethodIsRefused() {
        when(choices.countByUserId(7L)).thenReturn((long) ProfileService.MAX_METHOD_CHOICES);
        assertEquals("METHOD_CHOICE_LIMIT", assertThrows(WalletRuleException.class,
                () -> service.chooseMethod(7L, "ENVELOPES")).getMessage());
        assertEquals("METHOD_NOT_IN_CATALOG", assertThrows(WalletRuleException.class,
                () -> service.chooseMethod(7L, "BUY_STOCKS")).getMessage());
        verify(choices, never()).save(any());
    }

    @Test
    void suggestionsReadTheDeclaredPreferenceAndCountLoansAndTypedDebts() {
        FinancialProfile profile = new FinancialProfile();
        profile.setPreference("DETAILED");
        when(profiles.findByUserId(7L)).thenReturn(Optional.of(profile));
        Loan loan = new Loan();
        loan.setId(1L);
        loan.setProduct("Crédito pessoal");
        loan.setInstitution("Banco");
        loan.setOutstandingBalance(new BigDecimal("3000.00"));
        loan.setInstallmentAmount(new BigDecimal("300.00"));
        loan.setAnnualRate(new BigDecimal("30"));
        when(loans.findByUserIdOrderById(7L)).thenReturn(List.of(loan));
        when(manualDebts.countByUserId(7L)).thenReturn(1L);

        var suggestions = service.suggestions(7L);

        assertEquals("DETAILED", suggestions.preference());
        assertTrue(suggestions.needsConfirmedIncome());
        assertEquals(2, suggestions.data().debtsWithRate());
        assertEquals(List.of("DEBT_AVALANCHE", "DEBT_SNOWBALL", "ENVELOPES"),
                suggestions.suggestions().stream().map(item -> item.method()).toList());
    }

    @Test
    void updatingTheProfileStoresWhatWasDeclared() {
        var profile = service.update(7L, "SIMPLE", "BUILD_RESERVE");

        assertEquals("SIMPLE", profile.preference());
        assertEquals("BUILD_RESERVE", profile.mainGoal());
        verify(profiles).save(any(FinancialProfile.class));
    }
}
