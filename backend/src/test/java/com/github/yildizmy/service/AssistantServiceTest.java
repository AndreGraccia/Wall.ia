package com.github.yildizmy.service;

import com.github.yildizmy.service.future.QuestionParser;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

/** Which question is which, and the date a savings question names (ADR 0027). */
class AssistantServiceTest {

    private static final LocalDate TODAY = LocalDate.parse("2026-11-27");

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "Como está meu plano?                          | PLAN_STATUS",
            "Estou gastando demais?                        | PLAN_STATUS",
            "Qual método combina comigo?                   | METHOD",
            "O que preciso revisar?                        | REVIEW",
            "Quero juntar 3000 até junho                   | SAVE_GOAL",
            "Quero guardar R$ 5.000 em 10 meses            | SAVE_GOAL",
            "Posso comprar um celular de 900?              | PURCHASE",
            "Quanto posso gastar por dia?                  | DAILY_LIMIT",
            "Qual ação devo comprar na bolsa?              | UNKNOWN",
            "Quero juntar dinheiro para investir em ações  | UNKNOWN",
    })
    void eachQuestionReachesItsCalculation(String question, String intent) {
        assertEquals(intent, QuestionParser.parse(question).intent().name());
    }

    @Test
    void aSavingsQuestionGivesTheAmountAndTheDate() {
        assertEquals(new BigDecimal("3000.00"), QuestionParser.parse("Quero juntar 3000 até junho").amount());
        // June already passed in November: the next one.
        assertEquals(LocalDate.parse("2027-06-30"), QuestionParser.targetDate("juntar 3000 até junho", TODAY).orElseThrow());
        assertEquals(LocalDate.parse("2026-12-31"), QuestionParser.targetDate("save 500 by december", TODAY).orElseThrow());
        assertEquals(TODAY.plusMonths(10), QuestionParser.targetDate("guardar 5000 em 10 meses", TODAY).orElseThrow());
        assertTrue(QuestionParser.targetDate("quero juntar 3000", TODAY).isEmpty(), "no date, no invented one");
        assertTrue(QuestionParser.targetDate("juntar 10 até janeiro de 2020", TODAY).isEmpty(), "a past date");
    }
}
