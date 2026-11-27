package com.github.yildizmy.service;

import com.github.yildizmy.dto.response.FutureResponses;
import com.github.yildizmy.dto.response.PlanResponses;
import com.github.yildizmy.service.future.MonthFlow;
import com.github.yildizmy.service.future.QuestionParser;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.stream.Stream;

/**
 * "Pergunte à Wall.ia" about the person's own plan, method, pending review and savings targets (ADR 0027). Java picks
 * the calculation and computes it; no language model calculates or writes anything, and every change is confirmed by
 * the person on the screen.
 */
@Service
@RequiredArgsConstructor
public class AssistantService {

    private static final int MAX_METHODS = 3;
    private static final BigDecimal MAX_TARGET = new BigDecimal("100000000.00");

    private final FutureService futureService;
    private final MonthPlanService planService;
    private final ProfileService profileService;
    private final Clock clock;

    public FutureResponses.Answer ask(long userId, String question) {
        FutureResponses.Answer answer = futureService.ask(userId, question);
        return switch (QuestionParser.parse(question).intent()) {
            case PLAN_STATUS -> {
                PlanResponses.MonthPlan plan = planService.view(userId);
                yield answer.withAssist(new FutureResponses.Assist(plan.saved(), plan.slices(), plan.unclassified(),
                        null, null, null));
            }
            case METHOD -> answer.withAssist(new FutureResponses.Assist(null, null, null,
                    profileService.suggestions(userId).suggestions().stream().limit(MAX_METHODS).toList(), null, null));
            case REVIEW -> {
                PlanResponses.CashFlow flow = planService.cashFlow(userId, null);
                int pending = (int) Stream.of(flow.income(), flow.spending())
                        .flatMap(side -> side.items().stream())
                        .filter(item -> item.origin() == MonthFlow.Origin.NAME || item.origin() == MonthFlow.Origin.NONE)
                        .count();
                yield answer.withAssist(new FutureResponses.Assist(null, null, null, null, pending, null));
            }
            case SAVE_GOAL -> {
                LocalDate today = LocalDate.now(clock.withZone(FutureService.ZONE));
                FutureResponses.GoalDraft draft = answer.amount() == null || answer.amount().compareTo(MAX_TARGET) > 0
                        ? null
                        : QuestionParser.targetDate(question, today)
                        .flatMap(date -> futureService.draftGoal(userId, answer.amount(), date))
                        .orElse(null);
                yield answer.withAssist(new FutureResponses.Assist(null, List.of(), null, null, null, draft));
            }
            default -> answer;
        };
    }
}
