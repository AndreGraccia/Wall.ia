package com.github.yildizmy.service.future;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.Map;

/**
 * A credit card reduced to what the projection needs: billing days and contracted charges.
 * <p>
 * Invoices are never stored as a single number. They are always rebuilt from the charges, so
 * "R$ 680 already committed next month" can be opened into the exact purchases and instalments.
 */
public record CardPlan(
        long id,
        String name,
        String institution,
        int closingDay,
        int dueDay,
        List<Charge> charges,
        Map<YearMonth, BigDecimal> paid
) {

    public CardPlan(long id, String name, String institution, int closingDay, int dueDay, List<Charge> charges) {
        this(id, name, institution, closingDay, dueDay, charges, Map.of());
    }

    /** The same card with what was already paid of an invoice before its due date (B12). */
    public CardPlan withPaid(Map<YearMonth, BigDecimal> payments) {
        return new CardPlan(id, name, institution, closingDay, dueDay, charges, Map.copyOf(payments));
    }

    /** Invoice (identified by its due month) that a purchase made on {@code date} falls into. */
    public YearMonth invoiceFor(LocalDate date) {
        YearMonth closingMonth = YearMonth.from(date);
        if (!date.isBefore(closingDate(closingMonth))) closingMonth = closingMonth.plusMonths(1);
        return dueDay > closingDay ? closingMonth : closingMonth.plusMonths(1);
    }

    public LocalDate dueDate(YearMonth invoice) {
        return invoice.atDay(Math.min(dueDay, invoice.lengthOfMonth()));
    }

    public LocalDate closingDate(YearMonth month) {
        return month.atDay(Math.min(closingDay, month.lengthOfMonth()));
    }

    /** Charges (with the instalment number) that compose one invoice. */
    public List<InvoiceLine> invoiceLines(YearMonth invoice) {
        return charges.stream()
                .filter(charge -> charge.installmentFor(invoice) > 0)
                .map(charge -> new InvoiceLine(charge, charge.installmentFor(invoice)))
                .toList();
    }

    /** What is still to leave the balance for one invoice: billed minus paid early. */
    public BigDecimal invoiceTotal(YearMonth invoice) {
        BigDecimal alreadyPaid = paid.get(invoice);
        return alreadyPaid == null ? billedTotal(invoice) : billedTotal(invoice).subtract(alreadyPaid).max(BigDecimal.ZERO);
    }

    /** Everything billed on one invoice; the value a payment is matched against. */
    public BigDecimal billedTotal(YearMonth invoice) {
        return invoiceLines(invoice).stream()
                .map(line -> line.charge().amountFor(line.installment()))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /**
     * @param firstInvoice due month of the invoice that carries instalment 1
     */
    public record Charge(
            long id,
            String description,
            LocalDate purchaseDate,
            BigDecimal totalAmount,
            BigDecimal installmentAmount,
            int installments,
            YearMonth firstInvoice
    ) {

        /** 1-based instalment number billed in {@code invoice}, or 0 when this charge is not on it. */
        public int installmentFor(YearMonth invoice) {
            long offset = java.time.temporal.ChronoUnit.MONTHS.between(firstInvoice, invoice);
            return offset >= 0 && offset < installments ? (int) offset + 1 : 0;
        }

        /**
         * Amount of instalment {@code number}: the instalments add up to the purchase, with the leftover cents on
         * the first one, the same split as the simulator. {@code installmentAmount} alone rounds down.
         */
        public BigDecimal amountFor(int number) {
            return ScenarioSimulator.split(totalAmount, installments).get(number - 1);
        }
    }

    public record InvoiceLine(Charge charge, int installment) {
    }
}
