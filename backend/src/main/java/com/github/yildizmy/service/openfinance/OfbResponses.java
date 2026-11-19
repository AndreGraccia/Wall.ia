package com.github.yildizmy.service.openfinance;

import tools.jackson.databind.JsonNode;
import com.github.yildizmy.exception.OpenFinanceUnavailableException;

import java.math.BigDecimal;
import java.math.MathContext;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.StreamSupport;

/**
 * Reads Open Finance Brasil responses (Accounts 2.4, Credit Cards Accounts 2.3, Loans 2.5, Resources 3.1) with the
 * field names of the official specification. Pure functions, tested against fixtures built from the official
 * schemas ({@code src/test/resources/ofb}).
 */
final class OfbResponses {

    static final ZoneId ZONE = ZoneId.of("America/Sao_Paulo");
    /**
     * Bills carry only the due date; the closing date is not in the API.
     * ponytail: closing estimated as 10 days before the due date, the most common gap in Brazil. Upgrade: learn it
     * from billPostDate of the last purchase in each bill.
     */
    static final int CLOSING_DAYS_BEFORE_DUE = 10;

    private OfbResponses() {
    }

    // --- Accounts --------------------------------------------------------------------------------

    static OpenFinanceSnapshot.Entry entry(JsonNode transaction) {
        return new OpenFinanceSnapshot.Entry(
                text(transaction, "transactionId"),
                text(transaction, "creditDebitType"),
                text(transaction, "transactionName"),
                transaction.path("type").asText("OUTROS"),
                amount(transaction.path("transactionAmount")),
                Instant.parse(text(transaction, "transactionDateTime")),
                transaction.path("completedAuthorisedPaymentType").asText(OpenFinanceSnapshot.Entry.SETTLED)
        );
    }

    /** {@code availableAmount}: what can be spent now. Blocked and automatically invested amounts are not. */
    static BigDecimal availableBalance(JsonNode balancesData) {
        return amount(balancesData.path("availableAmount"));
    }

    // --- Resources -------------------------------------------------------------------------------

    /** Resource ids of one type (ACCOUNT, CREDIT_CARD_ACCOUNT, LOAN) the institution says are AVAILABLE now. */
    static Set<String> available(JsonNode resourcesData, String type) {
        Set<String> ids = new java.util.HashSet<>();
        for (JsonNode resource : resourcesData) {
            if (type.equals(resource.path("type").asText()) && "AVAILABLE".equals(resource.path("status").asText())) {
                ids.add(resource.path("resourceId").asText());
            }
        }
        return ids;
    }

    // --- Credit cards ----------------------------------------------------------------------------

    /**
     * One card from its account, limits, bills and transactions. Purchases in instalments show up once per bill
     * (instalment k of n); they are folded back into one charge with its first bill, which is how the engine
     * projects the next instalments.
     */
    static OpenFinanceSnapshot.CreditCardAccount card(JsonNode account, JsonNode limitsData, JsonNode billsData,
                                                      List<JsonNode> transactions, LocalDate today) {
        JsonNode limit = stream(limitsData)
                .filter(line -> "LIMITE_CREDITO_TOTAL".equals(line.path("creditLineLimitType").asText()))
                .findFirst()
                .orElse(limitsData.path(0));

        Map<String, LocalDate> billDue = new LinkedHashMap<>();
        List<OpenFinanceSnapshot.Bill> bills = new ArrayList<>();
        for (JsonNode bill : billsData) {
            LocalDate due = LocalDate.parse(text(bill, "dueDate"));
            billDue.put(bill.path("billId").asText(), due);
            bills.add(new OpenFinanceSnapshot.Bill(due, amount(bill.path("billTotalAmount")),
                    bill.hasNonNull("billMinimumAmount") ? amount(bill.path("billMinimumAmount")) : null));
        }
        bills.sort(Comparator.comparing(OpenFinanceSnapshot.Bill::dueDate));
        OpenFinanceSnapshot.Bill next = bills.stream().filter(bill -> !bill.dueDate().isBefore(today)).findFirst()
                .orElse(bills.isEmpty() ? null : bills.get(bills.size() - 1));
        if (next == null) throw new OpenFinanceUnavailableException("The credit card has no bill to read the due day from");

        Map<String, OpenFinanceSnapshot.CardTransaction> purchases = new LinkedHashMap<>();
        String lastDigits = limit.path("identificationNumber").asText(null);
        for (JsonNode item : transactions) {
            // Purchases only: payments, refunds, fees and cashback are not spending to project.
            if (!"DEBITO".equals(item.path("creditDebitType").asText())
                    || !"OUTROS".equals(item.path("transactionType").asText("OUTROS"))) continue;
            if (lastDigits == null) lastDigits = item.path("identificationNumber").asText(null);
            boolean instalments = "A_PRAZO".equals(item.path("paymentType").asText());
            int total = instalments ? Math.max(1, item.path("chargeNumber").asInt(1)) : 1;
            int number = instalments ? Math.max(1, item.path("chargeIdentificator").asInt(1)) : 1;
            BigDecimal instalment = amount(item.hasNonNull("brazilianAmount") ? item.path("brazilianAmount") : item.path("amount"));
            LocalDate purchased = LocalDate.ofInstant(Instant.parse(text(item, "transactionDateTime")), ZONE);
            LocalDate bill = billDue.get(item.path("billId").asText());
            if (bill == null && item.hasNonNull("billPostDate")) bill = next.dueDate();
            if (bill == null) bill = purchased.plusMonths(1);
            LocalDate first = bill.minusMonths(number - 1L);
            String name = text(item, "transactionName");
            // Same purchase, any instalment: one charge with a stable id.
            String key = name + "|" + purchased + "|" + total + "|" + instalment.toPlainString();
            purchases.putIfAbsent(key, new OpenFinanceSnapshot.CardTransaction(
                    total == 1 ? text(item, "transactionId")
                            : UUID.nameUUIDFromBytes(key.getBytes(StandardCharsets.UTF_8)).toString(),
                    name, purchased, instalment.multiply(BigDecimal.valueOf(total)), total, first));
        }

        int dueDay = next.dueDate().getDayOfMonth();
        int closingDay = next.dueDate().minusDays(CLOSING_DAYS_BEFORE_DUE).getDayOfMonth();
        return new OpenFinanceSnapshot.CreditCardAccount(
                text(account, "creditCardAccountId"),
                account.path("name").asText("Cartão de crédito"),
                lastDigits != null && lastDigits.length() > 4 ? lastDigits.substring(lastDigits.length() - 4) : lastDigits,
                amount(limit.path("limitAmount")),
                closingDay,
                dueDay,
                List.copyOf(purchases.values()),
                next);
    }

    // --- Loans -----------------------------------------------------------------------------------

    /**
     * One loan from the contract, its instalment summary and its payments. Only monthly instalments are
     * projected; anything else returns null and stays out of the projection instead of being guessed.
     */
    static OpenFinanceSnapshot.LoanContract loan(String contractId, JsonNode contract, JsonNode instalments,
                                                 JsonNode payments, LocalDate today) {
        if (!"MENSAL".equals(contract.path("instalmentPeriodicity").asText())
                || !"MES".equals(instalments.path("typeNumberOfInstalments").asText("MES"))) return null;
        int total = instalments.path("totalNumberOfInstalments").asInt();
        int paid = instalments.path("paidInstalments").asInt();
        LocalDate firstDue = LocalDate.parse(text(contract, "firstInstalmentDueDate"));
        int dueDay = firstDue.getDayOfMonth();
        LocalDate nextDue = null;
        if (paid < total) {
            YearMonth month = YearMonth.from(firstDue).plusMonths(paid);
            nextDue = month.atDay(Math.min(dueDay, month.lengthOfMonth()));
        }
        return new OpenFinanceSnapshot.LoanContract(
                contractId,
                text(contract, "productName"),
                decimal(contract.path("contractAmount")),
                decimal(payments.path("contractOutstandingBalance")),
                decimal(contract.path("nextInstalmentAmount")),
                total,
                paid,
                nextDue,
                annualRatePercent(contract.path("interestRates")),
                dueDay,
                contract.path("amortizationScheduled").asText(null),
                contract.hasNonNull("CET") ? new BigDecimal(contract.path("CET").asText()) : null);
    }

    /**
     * Pre-fixed rate as a percentage per year, the unit the loan screen uses. The API sends a fraction and its
     * periodicity (AA per year, AM per month). Post-fixed rates depend on an index and are left out.
     */
    static BigDecimal annualRatePercent(JsonNode interestRates) {
        JsonNode rate = interestRates.path(0);
        if (rate.isMissingNode() || !rate.hasNonNull("preFixedRate")) return null;
        double fraction = new BigDecimal(rate.path("preFixedRate").asText()).doubleValue();
        double annual = "AM".equals(rate.path("taxPeriodicity").asText()) ? Math.pow(1 + fraction, 12) - 1 : fraction;
        return BigDecimal.valueOf(annual * 100).round(MathContext.DECIMAL64).setScale(4, RoundingMode.HALF_EVEN);
    }

    // --- helpers ---------------------------------------------------------------------------------

    private static java.util.stream.Stream<JsonNode> stream(JsonNode array) {
        return StreamSupport.stream(array.spliterator(), false);
    }

    /**
     * Consents API v3, {@code GET /consents/{consentId}}: nothing to do when AUTHORISED; REJECTED ends the connection
     * with who rejected it and why (e.g. USER / CUSTOMER_MANUALLY_REVOKED done in the bank's app); anything else
     * means the institution does not consider it usable now.
     */
    static void requireAuthorised(JsonNode consentData) {
        String status = text(consentData, "status");
        if ("AUTHORISED".equals(status)) return;
        if ("REJECTED".equals(status)) {
            JsonNode rejection = consentData.path("rejection");
            throw new com.github.yildizmy.exception.OpenFinanceConsentEndedException(
                    // Columns are 10 and 40 wide (V25): unexpected institution data must not break the write.
                    cut(rejection.path("rejectedBy").asText("ASPSP"), 10),
                    cut(rejection.path("reason").path("code").asText("CONSENT_EXPIRED"), 40));
        }
        throw new OpenFinanceUnavailableException("Consent is " + status + " at the institution");
    }

    private static String cut(String value, int max) {
        return value.length() > max ? value.substring(0, max) : value;
    }

    static String text(JsonNode node, String field) {
        String value = node.path(field).asText();
        if (value.isBlank()) throw new OpenFinanceUnavailableException("Open Finance response is missing " + field);
        return value;
    }

    /** An {@code {amount, currency}} object. */
    static BigDecimal amount(JsonNode money) {
        return decimal(money.path("amount"));
    }

    static BigDecimal decimal(JsonNode value) {
        try {
            return new BigDecimal(value.asText()).setScale(2, RoundingMode.HALF_EVEN);
        } catch (NumberFormatException exception) {
            throw new OpenFinanceUnavailableException("Open Finance response contains an invalid amount", exception);
        }
    }
}
