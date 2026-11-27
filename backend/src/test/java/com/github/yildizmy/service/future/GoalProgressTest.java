package com.github.yildizmy.service.future;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static com.github.yildizmy.service.future.GoalProgress.Status.DATE_TOO_SOON;
import static com.github.yildizmy.service.future.GoalProgress.Status.LATE;
import static com.github.yildizmy.service.future.GoalProgress.Status.NO_DATE;
import static com.github.yildizmy.service.future.GoalProgress.Status.ON_TRACK;
import static com.github.yildizmy.service.future.GoalProgress.Status.REACHED;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class GoalProgressTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 1, 15);

    private static GoalProgress progress(String monthly, int day, String target, String date, String saved) {
        return GoalProgress.of(new CashEventPlanner.GoalPlan(1, "Viagem", new BigDecimal(monthly), day),
                new BigDecimal(target), date == null ? null : LocalDate.parse(date),
                saved == null ? null : new BigDecimal(saved), TODAY);
    }

    @Test
    void theRequiredContributionIsRoundedUpOverTheContributionDaysLeft() {
        // 20/01, 20/02 and 20/03: three days for R$ 1.000; 333,33 would end one cent short.
        GoalProgress result = progress("200.00", 20, "1200.00", "2026-03-20", "200.00");

        assertEquals(LATE, result.status());
        assertEquals(new BigDecimal("1000.00"), result.remaining());
        assertEquals(new BigDecimal("16.6"), result.savedPercent());
        assertEquals(3, result.contributionsUntilDate());
        assertEquals(new BigDecimal("333.34"), result.requiredMonthly());
        assertEquals(LocalDate.of(2026, 5, 20), result.projectedDate());
    }

    @Test
    void reachingTheTargetOnTheDateItselfIsOnTrack() {
        GoalProgress result = progress("500.00", 20, "1000.00", "2026-02-20", null);

        assertEquals(ON_TRACK, result.status());
        assertEquals(LocalDate.of(2026, 2, 20), result.projectedDate());
        assertEquals(new BigDecimal("500.00"), result.requiredMonthly());
    }

    @Test
    void todaysContributionDayIsNotCountedAgainAndShortMonthsUseTheLastDay() {
        GoalProgress result = progress("100.00", 15, "100.00", "2026-02-14", null);

        assertEquals(DATE_TOO_SOON, result.status());
        assertEquals(LocalDate.of(2026, 2, 15), result.projectedDate());
        assertEquals(LocalDate.of(2026, 2, 28), progress("100.00", 31, "200.00", null, null).projectedDate());
    }

    @Test
    void aDateWithNoContributionDayLeftHasNoRequiredAmount() {
        GoalProgress result = progress("100.00", 20, "500.00", "2026-01-19", null);

        assertEquals(DATE_TOO_SOON, result.status());
        assertNull(result.requiredMonthly());
        assertEquals(0, result.contributionsUntilDate());
    }

    @Test
    void withoutADateOnlyTheForecastExistsAndAnAbsurdOneIsLeftOut() {
        assertEquals(NO_DATE, progress("100.00", 20, "300.00", null, null).status());
        assertEquals(LocalDate.of(2026, 3, 20), progress("100.00", 20, "300.00", null, null).projectedDate());
        assertNull(progress("0.01", 20, "100000000.00", null, null).projectedDate());
    }

    @Test
    void whatIsSavedCoveringTheTargetIsReachedAndNeverAboveAHundredPercent() {
        GoalProgress result = progress("100.00", 20, "300.00", "2026-03-20", "450.00");

        assertEquals(REACHED, result.status());
        assertEquals(new BigDecimal("0.00"), result.remaining());
        assertEquals(new BigDecimal("100.0"), result.savedPercent());
        assertNull(result.requiredMonthly());
        assertNull(result.projectedDate());
    }
}
