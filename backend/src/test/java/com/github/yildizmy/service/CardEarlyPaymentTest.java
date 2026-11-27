package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.CardCharge;
import com.github.yildizmy.domain.entity.CreditCard;
import com.github.yildizmy.domain.entity.Transaction;
import com.github.yildizmy.domain.entity.Type;
import com.github.yildizmy.domain.entity.Wallet;
import com.github.yildizmy.domain.enums.Status;
import com.github.yildizmy.domain.enums.TransactionSource;
import com.github.yildizmy.repository.CreditCardRepository;
import com.github.yildizmy.repository.EnvelopeRepository;
import com.github.yildizmy.repository.GoalRepository;
import com.github.yildizmy.repository.LoanRepository;
import com.github.yildizmy.repository.ManualDebtRepository;
import com.github.yildizmy.repository.MonthPlanRepository;
import com.github.yildizmy.repository.RecurrenceDecisionRepository;
import com.github.yildizmy.repository.TransactionRepository;
import com.github.yildizmy.repository.WalletRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * A bill paid before its due date already left the balance, so the projection must not take it again. Today is
 * 28/11/2026; both cards close on the 25th and are due on 02/12.
 */
class CardEarlyPaymentTest {

    private final WalletRepository wallets = mock(WalletRepository.class);
    private final TransactionRepository transactions = mock(TransactionRepository.class);
    private final CreditCardRepository cards = mock(CreditCardRepository.class);
    private final FutureService service = new FutureService(wallets, transactions,
            mock(RecurrenceDecisionRepository.class), cards, mock(LoanRepository.class), mock(GoalRepository.class),
            mock(EnvelopeRepository.class), mock(ManualDebtRepository.class), mock(MonthPlanRepository.class),
            mock(UserService.class), mock(com.github.yildizmy.service.market.MarketRatesService.class),
            Clock.fixed(Instant.parse("2026-11-28T15:00:00Z"), ZoneOffset.UTC));
    private final Wallet account = new Wallet();
    private final List<Transaction> history = new ArrayList<>();
    private final List<CreditCard> owned = new ArrayList<>();
    private long ids = 1;

    CardEarlyPaymentTest() {
        account.setId(1L);
        account.setName("Conta");
        account.setInstitutionName("Banco Aurora");
        account.setBalance(new BigDecimal("3000.00"));
        when(wallets.findByUserId(7L)).thenReturn(List.of(account));
        when(transactions.findAllByUserIdSince(eq(7L), any())).thenReturn(history);
        when(cards.findByUserIdOrderById(7L)).thenReturn(owned);
    }

    private void card(String name, String institution, String total) {
        CreditCard card = new CreditCard();
        card.setId(ids++);
        card.setName(name);
        card.setInstitution(institution);
        card.setCreditLimit(new BigDecimal("8000.00"));
        card.setClosingDay(25);
        card.setDueDay(2);
        CardCharge charge = new CardCharge();
        charge.setId(ids++);
        charge.setCard(card);
        charge.setDescription("Loja");
        charge.setPurchaseDate(LocalDate.parse("2026-11-10"));
        charge.setTotalAmount(new BigDecimal(total));
        charge.setInstallmentAmount(new BigDecimal(total));
        charge.setInstallments(1);
        charge.setFirstInvoice(LocalDate.parse("2026-12-01"));
        card.getCharges().add(charge);
        owned.add(card);
    }

    private void paid(String date, String amount, String description, TransactionSource source) {
        Type type = new Type();
        type.setId(5L);
        type.setName("Withdrawal");
        Transaction transaction = new Transaction();
        transaction.setId(ids++);
        transaction.setType(type);
        transaction.setAmount(new BigDecimal(amount));
        transaction.setDescription(description);
        transaction.setFromWallet(account);
        transaction.setToWallet(account);
        transaction.setCreatedAt(Instant.parse(date + "T13:00:00Z"));
        transaction.setStatus(Status.SUCCESS);
        transaction.setSource(source);
        transaction.setPaymentType("BOLETO");
        history.add(transaction);
    }

    private void paid(String date, String amount, String description) {
        paid(date, amount, description, TransactionSource.OPEN_FINANCE);
    }

    /** What the projection still takes for card bills, as positive money. */
    private BigDecimal projected() {
        return service.overview(7L, 30).projection().events().stream()
                .filter(event -> "CARD_INVOICE".equals(event.category()) && event.date().isBefore(LocalDate.parse("2026-12-15")))
                .map(event -> event.amount().negate())
                .reduce(new BigDecimal("0.00"), BigDecimal::add);
    }

    @Test
    void aBillPaidInFullBeforeTheDueDateIsNotProjectedAgain() {
        card("Aurora Card", "Banco Aurora", "600.00");
        paid("2026-11-27", "600.00", "Pagamento fatura Aurora Card");

        assertEquals(new BigDecimal("0.00"), projected());
        var invoice = service.commitments(7L).cards().get(0);
        assertEquals(0, invoice.committedLimit().signum(), "the paid bill frees the limit");
    }

    @Test
    void theExactAmountIsEnoughWhenTheBankWordingSaysNothing() {
        card("Aurora Card", "Banco Aurora", "600.00");
        paid("2026-11-26", "600.00", "NU PAGAMENTOS SA");

        assertEquals(new BigDecimal("0.00"), projected());
    }

    @Test
    void aPartialPaymentThatNamesTheCardReducesWhatIsProjected() {
        card("Aurora Card", "Banco Aurora", "600.00");
        paid("2026-11-26", "150.00", "Pagamento fatura Aurora Card");
        paid("2026-11-27", "100.00", "Pagamento fatura Aurora Card");

        assertEquals(new BigDecimal("350.00"), projected());
    }

    @Test
    void thePaymentGoesToTheCardItNamesAndTheOtherStays() {
        card("Aurora Card", "Banco Aurora", "600.00");
        card("Boreal", "Banco Boreal", "600.00");
        paid("2026-11-26", "600.00", "Pagamento fatura Boreal");

        assertEquals(new BigDecimal("600.00"), projected());
    }

    @Test
    void whenItCannotTellWhichBillWasPaidNothingIsHidden() {
        card("Aurora Card", "Banco Aurora", "600.00");
        card("Boreal", "Banco Boreal", "600.00");
        paid("2026-11-26", "600.00", "Pagamento de cartao");

        assertEquals(new BigDecimal("1200.00"), projected(), "two bills of the same value");
    }

    @Test
    void aPartialPaymentThatNamesNoCardHidesNothing() {
        card("Aurora Card", "Banco Aurora", "600.00");
        paid("2026-11-26", "100.00", "Pagamento fatura Vivo");

        assertEquals(new BigDecimal("600.00"), projected());
    }

    @Test
    void paymentsBeforeTheClosingTypedByHandOrAboveTheBillHideNothing() {
        card("Aurora Card", "Banco Aurora", "600.00");
        paid("2026-11-20", "600.00", "Pagamento fatura Aurora Card");
        paid("2026-11-26", "600.00", "Pagamento fatura Aurora Card", TransactionSource.LOCAL);
        paid("2026-11-27", "900.00", "Pagamento fatura Aurora Card");

        assertEquals(new BigDecimal("600.00"), projected());
    }
}
