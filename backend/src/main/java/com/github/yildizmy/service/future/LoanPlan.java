package com.github.yildizmy.service.future;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * A loan as reported by the institution: what is left, the instalment and when it is due.
 */
public record LoanPlan(
        long id,
        String product,
        String institution,
        BigDecimal outstandingBalance,
        BigDecimal installmentAmount,
        int installmentsTotal,
        int installmentsPaid,
        LocalDate nextDueDate,
        Integer dueDay
) {

    public int remainingInstallments() {
        return Math.max(0, installmentsTotal - installmentsPaid);
    }

    /** Due dates of the remaining instalments, keeping the original day of month when possible. */
    public List<LocalDate> dueDates() {
        List<LocalDate> dates = new ArrayList<>();
        if (nextDueDate == null) return dates;
        // The contractual day survives short months: due on the 31st, reported as 28/02, is 31/03 next.
        int day = dueDay != null ? dueDay : nextDueDate.getDayOfMonth();
        for (int i = 0; i < remainingInstallments(); i++) {
            LocalDate month = nextDueDate.plusMonths(i);
            dates.add(month.withDayOfMonth(Math.min(day, month.lengthOfMonth())));
        }
        return dates;
    }

    /**
     * The first instalment due on or after {@code today}. The bank keeps reporting a due date until it sees the
     * payment, so {@link #nextDueDate()} can be in the past; this is the one still ahead (null when none is left).
     */
    public LocalDate upcomingDueDate(LocalDate today) {
        return dueDates().stream().filter(date -> !date.isBefore(today)).findFirst().orElse(null);
    }
}
