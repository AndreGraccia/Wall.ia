package com.github.yildizmy.service.future;

import com.github.yildizmy.service.future.QuestionParser.Intent;
import com.github.yildizmy.service.future.QuestionParser.Parsed;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class QuestionParserTest {

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "Posso comprar um notebook de R$ 4.000 em 10x?        | PURCHASE     | 4000.00 | 10  | true",
            "posso comprar um tênis de 399,90?                    | PURCHASE     | 399.90  | 1   | false",
            "Dá pra parcelar 1.500,50 em 3 vezes no cartão?       | PURCHASE     | 1500.50 | 3   | true",
            "E se eu comprar uma TV de 3 mil?                     | PURCHASE     | 3000.00 | 1   | false",
            "posso gastar 200 no fim de semana?                   | PURCHASE     | 200.00  | 1   | false",
            "Can I afford a 39.90 subscription?                   | PURCHASE     | 39.90   | 1   | false",
            "Can I buy a $1,200 phone?                            | PURCHASE     | 1200.00 | 1   | false",
            // The app's own English suggestion used to come back as "How much?".
            "Can I buy a R$ 4,000 laptop in 10x?                  | PURCHASE     | 4000.00 | 10  | true",
            "Can I afford 1,250.50 in 5 installments?             | PURCHASE     | 1250.50 | 5   | true",
            // Review findings: dates, years and model numbers are not prices.
            "Posso comprar um presente de 150 no natal de 2026?   | PURCHASE     | 150.00  | 1   | false",
            "Posso gastar 20 no dia 25?                           | PURCHASE     | 20.00   | 1   | false",
            "Posso comprar um iphone 15 em 12x?                   | PURCHASE     |         | 12  | true",
            "Quanto posso gastar num celular de 2000?             | PURCHASE     | 2000.00 | 1   | false",
            "Posso comprar 3 mil em 100x?                         | PURCHASE     | 3000.00 | 100 | true",
            // Paying a bill is not a new purchase.
            "Posso pagar a fatura do cartão de 2000?              | COMMITTED    | 2000.00 | 1   | true",
            "Quanto posso gastar por dia?                         | DAILY_LIMIT  |         | 1   | false",
            "posso gastar 50 por dia?                             | DAILY_LIMIT  | 50.00   | 1   | false",
            "quanto eu posso gastar hoje                          | DAILY_LIMIT  |         | 1   | false",
            "How much can I spend per day?                        | DAILY_LIMIT  |         | 1   | false",
            "Por que meu saldo fica negativo?                     | WHY_NEGATIVE |         | 1   | false",
            "vai faltar dinheiro esse mês?                        | WHY_NEGATIVE |         | 1   | false",
            "Quanto do meu dinheiro já está comprometido?         | COMMITTED    |         | 1   | false",
            "Quando cai meu salário?                              | NEXT_INCOME  |         | 1   | false",
            "Qual o limite do meu cartão?                         | UNKNOWN      |         | 1   | true",
            "What is my lowest balance?                           | UNKNOWN      |         | 1   | false",
            "Qual a previsão do tempo?                            | UNKNOWN      |         | 1   | false",
            // Investment is outside what the engine answers: "comprar" must not turn it into a purchase (CT-V19, A3).
            "Qual ação devo comprar na bolsa?                     | UNKNOWN      |         | 1   | false",
            "Vale a pena investir no Tesouro Direto?              | UNKNOWN      |         | 1   | false",
            "Should I buy bitcoin?                                | UNKNOWN      |         | 1   | false",
            "Posso comprar uma bolsa de 300?                      | PURCHASE     | 300.00  | 1   | false",
    })
    void understandsTheQuestionsTheEngineCanAnswer(String question, Intent intent, BigDecimal amount,
                                                   int installments, boolean card) {
        Parsed parsed = QuestionParser.parse(question);

        assertEquals(intent, parsed.intent());
        if (amount == null) assertNull(parsed.amount());
        else assertEquals(amount, parsed.amount());
        assertEquals(installments, parsed.installments());
        assertEquals(card, parsed.card());
    }

    @ParameterizedTest
    @CsvSource(delimiter = '|', value = {
            "r$ 1.234,56 e 99            | 1234.56",
            "custa 4k                    | 4000.00",
            "2 mil e 500                 | 2000.00",
            "de 300 reais                | 300.00",
            "no verde 50                 | ",
            "dia 25/12 de 80             | 80.00",
    })
    void findsTheAmountOnlyWhenItIsClearlyAPrice(String text, BigDecimal expected) {
        BigDecimal amount = QuestionParser.amount(QuestionParser.normalize(text));
        if (expected == null) assertNull(amount);
        else assertEquals(expected, amount);
    }
}
