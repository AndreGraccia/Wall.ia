package com.github.yildizmy.service.future;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Turns a free-text question into one of the questions the engine can answer.
 * <p>
 * Deterministic on purpose: the answer is always built from engine numbers, so the parser only has to
 * pick the right calculation and pull an amount and an instalment count out of the text. When it is not
 * sure about the amount it returns none and the user is asked for it: a wrong amount would produce a
 * confident wrong answer. A language model may later replace this class to understand more phrasings; it
 * would still only choose among these intents and never produce the numbers (ADR 0002).
 */
public final class QuestionParser {

    /** Same ceiling as the Modo Futuro form. */
    public static final int MAX_INSTALLMENTS = 24;

    // ponytail: keyword lists in PT and EN cover the suggested questions and common variations.
    // Swap for an LLM intent classifier when the share of UNKNOWN answers says it is time.
    private static final Pattern INSTALLMENTS = Pattern.compile("\\b(\\d{1,3})\\s*(x|vezes|parcelas?|installments?)\\b");
    private static final Pattern DATES = Pattern.compile(
            "\\b(dia|day|on the)\\s+\\d{1,2}\\b|\\b\\d{1,2}/\\d{1,2}(/\\d{2,4})?\\b");
    // Brazilian grouping ("4.000,50"), English grouping ("4,000.50": a comma before exactly three digits is never
    // a Brazilian decimal), plain decimals ("39.90", "399,90") and integers.
    private static final Pattern AMOUNT = Pattern.compile(
            "(r?\\$\\s*)?(\\d{1,3}(?:[.\\s]\\d{3})+(?:,\\d{1,2})?|\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?(?![\\d,])|\\d+\\.\\d{1,2}(?!\\d)|\\d+(?:,\\d{1,2})?(?![\\d,]))\\s*(mil|k|reais)?\\b");
    /** Words that introduce a price; an unmarked number without one is probably a model name ("iPhone 15"). */
    private static final Pattern PRICE_CUE = Pattern.compile(
            "\\b(de|por|custa|custando|gastar|gasto|pagar|valor|comprar|compro|parcelar|of|for|costs?|spend|pay|buy|afford)( an?)?\\s*$");
    private static final Pattern YEAR = Pattern.compile("(19|20)\\d{2}");

    /**
     * Investing is not something the engine answers, and the product never recommends one (no investment advice).
     * Checked first: "Qual ação devo comprar?" has "comprar" in it and must not become a purchase simulation.
     * "bolsa" alone is a handbag; only the stock-market phrasings count.
     */
    private static final Pattern INVESTMENT = Pattern.compile(
            "\\b(investir|investimentos?|acao|acoes|bolsa de valores|na bolsa|cripto\\w*|bitcoin|tesouro direto|cdb"
                    + "|renda fixa|fundos? de investimento|invest\\w*|stocks?|shares|crypto\\w*)\\b");
    private static final Pattern BILL_PAYMENT = Pattern.compile("\\b(pagar|quitar|pay)\\b.*\\b(fatura|boleto|conta de|invoice|bill)");
    private static final Pattern PURCHASE = Pattern.compile("\\b(comprar|compro|compra|parcelar|afford|buy|purchase)\\b");
    private static final Pattern SPEND = Pattern.compile("\\b(gastar|gasto|pagar|spend|pay)\\b");
    private static final Pattern PER_DAY = Pattern.compile("por dia|ao dia|diari[oa]|per day|a day|daily");
    private static final Pattern DAILY = Pattern.compile("quanto (eu )?posso gastar|posso gastar hoje|how much can i spend");
    private static final Pattern WHY = Pattern.compile(
            "por ?que|negativ|vermelho|faltar|falta dinheiro|buraco|\\bwhy\\b|negative|\\bshort\\b|overdraft|cheque especial");
    private static final Pattern COMMITTED = Pattern.compile(
            "comprometid|destino|compromisso|contas do mes|quanto (ja )?devo|committed|\\bbills\\b|\\bowe\\b");
    private static final Pattern INCOME = Pattern.compile(
            "salario|quando (eu )?recebo|proxim[oa] (entrada|pagamento|renda)|payday|salary|next income|get paid");
    private static final Pattern CARD = Pattern.compile("cartao|credito|\\bcard\\b|credit");

    private QuestionParser() {
    }

    public static Parsed parse(String question) {
        String text = normalize(question);

        Integer installments = null;
        Matcher inst = INSTALLMENTS.matcher(text);
        if (inst.find()) {
            installments = Integer.parseInt(inst.group(1));
            text = text.substring(0, inst.start()) + " " + text.substring(inst.end());
        }
        BigDecimal amount = amount(text);
        boolean card = CARD.matcher(text).find() || (installments != null && installments > 1);

        Intent intent;
        if (INVESTMENT.matcher(text).find()) {
            intent = Intent.UNKNOWN;
        } else if (BILL_PAYMENT.matcher(text).find()) {
            // Paying an existing bill is not a new purchase: simulating it would add the debt twice.
            intent = Intent.COMMITTED;
        } else if (PURCHASE.matcher(text).find()) {
            intent = Intent.PURCHASE;
        } else if (PER_DAY.matcher(text).find()) {
            intent = Intent.DAILY_LIMIT;
        } else if (amount != null && SPEND.matcher(text).find()) {
            intent = Intent.PURCHASE;
        } else if (DAILY.matcher(text).find() || SPEND.matcher(text).find()) {
            intent = Intent.DAILY_LIMIT;
        } else if (WHY.matcher(text).find()) {
            intent = Intent.WHY_NEGATIVE;
        } else if (COMMITTED.matcher(text).find()) {
            intent = Intent.COMMITTED;
        } else if (INCOME.matcher(text).find()) {
            intent = Intent.NEXT_INCOME;
        } else {
            intent = Intent.UNKNOWN;
        }
        return new Parsed(intent, amount, installments == null ? 1 : installments, card);
    }

    /**
     * A value marked with R$ wins. Otherwise only numbers introduced by a price word ("de 300",
     * "custa 300") or followed by "mil"/"reais" count; dates ("dia 25", "25/12") never do, and a year
     * ("natal de 2026") is dropped when another candidate exists. Among the rest, the largest.
     */
    static BigDecimal amount(String text) {
        String clean = DATES.matcher(text).replaceAll(" ");
        Matcher matcher = AMOUNT.matcher(clean);
        List<BigDecimal> candidates = new ArrayList<>();
        List<BigDecimal> years = new ArrayList<>();
        BigDecimal marked = null;
        while (matcher.find()) {
            String digits = matcher.group(2);
            boolean currency = matcher.group(1) != null;
            boolean scaled = matcher.group(3) != null;
            BigDecimal value = digits.matches("\\d+\\.\\d{1,2}")
                    ? new BigDecimal(digits)
                    : digits.matches("\\d{1,3}(,\\d{3})+(\\.\\d{1,2})?")
                    ? new BigDecimal(digits.replace(",", ""))
                    : new BigDecimal(digits.replaceAll("[.\\s]", "").replace(',', '.'));
            if ("mil".equals(matcher.group(3)) || "k".equals(matcher.group(3))) {
                value = value.multiply(BigDecimal.valueOf(1000));
            }
            if (value.signum() <= 0) continue;
            if (currency) {
                if (marked == null) marked = value;
                continue;
            }
            boolean cued = scaled || PRICE_CUE.matcher(clean.substring(0, matcher.start())).find();
            if (!cued) continue;
            if (!scaled && YEAR.matcher(digits).matches()) years.add(value);
            else candidates.add(value);
        }
        BigDecimal result = marked;
        if (result == null) result = candidates.stream().max(BigDecimal::compareTo).orElse(null);
        if (result == null) result = years.stream().max(BigDecimal::compareTo).orElse(null);
        return result == null ? null : result.setScale(2, RoundingMode.HALF_UP);
    }

    static String normalize(String value) {
        if (value == null) return "";
        String ascii = Normalizer.normalize(value, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return ascii.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    public enum Intent { PURCHASE, DAILY_LIMIT, WHY_NEGATIVE, COMMITTED, NEXT_INCOME, UNKNOWN }

    /**
     * @param amount       value found in the question, or null when there is none or it is ambiguous
     * @param installments 1 when none was mentioned; may be above {@link #MAX_INSTALLMENTS}, the caller decides
     * @param card         the question mentions a card, or splits the payment (instalments are a card thing in Brazil)
     */
    public record Parsed(Intent intent, BigDecimal amount, int installments, boolean card) {
    }
}
