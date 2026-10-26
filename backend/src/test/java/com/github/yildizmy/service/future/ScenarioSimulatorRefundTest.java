package com.github.yildizmy.service.future;

import com.github.yildizmy.service.future.CashEvent.Certainty;
import com.github.yildizmy.service.future.CashEvent.Kind;
import com.github.yildizmy.service.future.ScenarioSimulator.Method;
import com.github.yildizmy.service.future.ScenarioSimulator.Scenario;
import com.github.yildizmy.service.future.ScenarioSimulator.Type;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ScenarioSimulatorRefundTest {

    @Test
    void hypotheticalRefundImprovesTheProjectionWithoutChangingTheOriginalEvents() {
        LocalDate today = LocalDate.of(2026, 10, 26);
        CashEvent committedBill = new CashEvent(
                today.plusDays(1), new BigDecimal("-60.00"), "Conta de energia",
                Kind.RECURRING_EXPENSE, "BILL", Certainty.CONFIRMED, "Banco sandbox", "bill-1");
        List<CashEvent> baseline = List.of(committedBill);

        var outcome = ScenarioSimulator.apply(
                new Scenario(Type.REFUND, new BigDecimal("30.00"), 1, Method.CASH,
                        null, null, 1, null, "Estorno hipotético"),
                today, today.plusDays(90), baseline, List.of());

        assertEquals(1, baseline.size(), "the stored/planned source events remain untouched");
        assertEquals(2, outcome.events().size());
        CashEvent refund = outcome.events().stream().filter(event -> event.reference().equals("hypothetical-refund"))
                .findFirst().orElseThrow();
        assertEquals(today, refund.date());
        assertEquals(new BigDecimal("30.00"), refund.amount());
        assertEquals(Kind.SCENARIO, refund.kind());
        assertEquals(Certainty.HYPOTHETICAL, refund.certainty());
        assertEquals(BigDecimal.ZERO, outcome.newMonthlyCommitment());

        var before = ProjectionEngine.project(today, new BigDecimal("40.00"), baseline, 90);
        var after = ProjectionEngine.project(today, new BigDecimal("40.00"), outcome.events(), 90);
        assertEquals(new BigDecimal("-20.00"), before.minBalance());
        assertEquals(new BigDecimal("10.00"), after.minBalance());
        assertTrue(before.negativeDays() > 0);
        assertEquals(0, after.negativeDays());
    }
}
