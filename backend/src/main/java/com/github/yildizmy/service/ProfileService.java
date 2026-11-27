package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.FinancialProfile;
import com.github.yildizmy.domain.entity.MethodChoice;
import com.github.yildizmy.dto.response.PlanResponses;
import com.github.yildizmy.exception.WalletRuleException;
import com.github.yildizmy.repository.FinancialProfileRepository;
import com.github.yildizmy.repository.ManualDebtRepository;
import com.github.yildizmy.repository.MethodChoiceRepository;
import com.github.yildizmy.service.future.MethodAdvisor;
import com.github.yildizmy.service.future.MethodCatalog;
import com.github.yildizmy.service.future.MonthPlanCalculator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Clock;
import java.util.List;

/**
 * Perfil contextual mínimo and "Meu método" (ADR 0021). What the person declares is stored; what comes from the data
 * (income fixed or variable, weight of the fixed bills, debts) is computed on every call. The Wall.ia does not impose a
 * method: it shows the catalog, explains why some methods fit, and records the person's choice.
 */
@Service
@RequiredArgsConstructor
public class ProfileService {

    /** Choosing a method is a human action; this only stops a script from growing the history without end. */
    static final int MAX_METHOD_CHOICES = 100;

    private final FutureService futureService;
    private final FinancialProfileRepository profiles;
    private final MethodChoiceRepository choices;
    private final ManualDebtRepository manualDebts;
    private final UserService userService;
    private final Clock clock;

    public PlanResponses.Catalog catalog() {
        return new PlanResponses.Catalog(MethodCatalog.VERSION, MethodCatalog.METHODS);
    }

    @Transactional(readOnly = true)
    public PlanResponses.Profile profile(long userId) {
        return toResponse(userId, profiles.findByUserId(userId).orElse(null));
    }

    @Transactional
    public PlanResponses.Profile update(long userId, String preference, String mainGoal) {
        userService.lockForUpdate(userId);
        FinancialProfile profile = profiles.findByUserId(userId).orElseGet(() -> {
            FinancialProfile created = new FinancialProfile();
            created.setUser(userService.getReferenceById(userId));
            return created;
        });
        profile.setPreference(preference);
        profile.setMainGoal(mainGoal);
        profile.setUpdatedAt(clock.instant());
        profiles.save(profile);
        return toResponse(userId, profile);
    }

    /** Appends the choice; choosing the current method again adds nothing. 409 METHOD_CHOICE_LIMIT past the cap. */
    @Transactional
    public PlanResponses.Profile chooseMethod(long userId, String method) {
        if (MethodCatalog.find(method).isEmpty()) throw new WalletRuleException("METHOD_NOT_IN_CATALOG");
        userService.lockForUpdate(userId);
        List<MethodChoice> history = choices.findTop20ByUserIdOrderByChosenAtDescIdDesc(userId);
        if (history.isEmpty() || !history.get(0).getMethod().equals(method)) {
            if (choices.countByUserId(userId) >= MAX_METHOD_CHOICES) throw new WalletRuleException("METHOD_CHOICE_LIMIT");
            MethodChoice choice = new MethodChoice();
            choice.setUser(userService.getReferenceById(userId));
            choice.setMethod(method);
            choice.setCatalogVersion(MethodCatalog.VERSION);
            choice.setChosenAt(clock.instant());
            choices.save(choice);
        }
        return toResponse(userId, profiles.findByUserId(userId).orElse(null));
    }

    @Transactional(readOnly = true)
    public PlanResponses.Suggestions suggestions(long userId) {
        FinancialProfile profile = profiles.findByUserId(userId).orElse(null);
        String preference = profile == null ? FinancialProfile.NOT_SAID : profile.getPreference();
        String goal = profile == null ? FinancialProfile.NOT_SAID : profile.getMainGoal();
        MethodAdvisor.Facts facts = facts(userId, MethodAdvisor.Preference.valueOf(preference),
                MethodAdvisor.Goal.valueOf(goal));
        MethodAdvisor.Advice advice = MethodAdvisor.suggest(facts);
        return new PlanResponses.Suggestions(MethodCatalog.VERSION, advice.needsConfirmedIncome(), preference,
                advice.suggestions(), derived(facts));
    }

    private MethodAdvisor.Facts facts(long userId, MethodAdvisor.Preference preference, MethodAdvisor.Goal goal) {
        FutureService.Context context = futureService.context(userId);
        BigDecimal income = MonthPlanCalculator.income(context.confirmed()).map(MonthPlanCalculator.Income::monthly).orElse(null);
        BigDecimal fixed = MonthPlanCalculator.fixedUsed(context.countedRecurrences(), context.loanPlans()).total();
        long loansWithRate = context.loans().stream()
                .filter(loan -> loan.getAnnualRate() != null && loan.getOutstandingBalance() != null
                        && loan.getOutstandingBalance().signum() > 0)
                .count();
        int debts = (int) (loansWithRate + manualDebts.countByUserId(userId));
        return new MethodAdvisor.Facts(income, MethodAdvisor.variableIncome(context.confirmed()), fixed, debts, preference, goal);
    }

    private static PlanResponses.Derived derived(MethodAdvisor.Facts facts) {
        return new PlanResponses.Derived(facts.confirmedIncome(), facts.variableIncome(), facts.fixedMonthly(),
                facts.fixedSharePercent(), facts.debtsWithRate());
    }

    private PlanResponses.Profile toResponse(long userId, FinancialProfile profile) {
        List<PlanResponses.MethodChoice> history = choices.findTop20ByUserIdOrderByChosenAtDescIdDesc(userId).stream()
                .map(choice -> new PlanResponses.MethodChoice(choice.getMethod(), choice.getCatalogVersion(), choice.getChosenAt()))
                .toList();
        return new PlanResponses.Profile(
                profile == null ? FinancialProfile.NOT_SAID : profile.getPreference(),
                profile == null ? FinancialProfile.NOT_SAID : profile.getMainGoal(),
                profile == null ? null : profile.getUpdatedAt(),
                history.isEmpty() ? null : history.get(0).method(),
                history,
                derived(facts(userId, MethodAdvisor.Preference.NOT_SAID, MethodAdvisor.Goal.NOT_SAID)));
    }
}
