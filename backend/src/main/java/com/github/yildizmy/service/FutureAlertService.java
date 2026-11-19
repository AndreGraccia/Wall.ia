package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.FutureAlert;
import com.github.yildizmy.domain.entity.User;
import com.github.yildizmy.dto.response.FutureResponses;
import com.github.yildizmy.exception.WalletRuleException;
import com.github.yildizmy.repository.FutureAlertRepository;
import com.github.yildizmy.repository.UserRepository;
import com.github.yildizmy.service.push.PushService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.NumberFormat;
import java.time.Clock;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

/**
 * Opt-in e-mail when the projection shows a new negative window. The daily job reuses the same engine
 * as the Future page, writes once per window, and never includes more than the dates and amounts.
 */
@Slf4j
@Service
public class FutureAlertService {

    static final int HORIZON_DAYS = 30;
    private static final Locale PT_BR = Locale.forLanguageTag("pt-BR");
    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("dd/MM");

    private final FutureAlertRepository alertRepository;
    private final UserRepository userRepository;
    private final FutureService futureService;
    private final JavaMailSender mailSender;
    private final PushService pushService;
    private final Clock clock;
    private final String from;
    private final String appUrl;
    private final com.github.yildizmy.service.job.JobLock jobLock;

    public FutureAlertService(
            FutureAlertRepository alertRepository,
            UserRepository userRepository,
            FutureService futureService,
            JavaMailSender mailSender,
            PushService pushService,
            Clock clock,
            @Value("${app.email-verification.mail-from}") String from,
            @Value("${app.security.allowedOrigin}") String appUrl,
            com.github.yildizmy.service.job.JobLock jobLock) {
        this.jobLock = jobLock;
        this.alertRepository = alertRepository;
        this.userRepository = userRepository;
        this.futureService = futureService;
        this.mailSender = mailSender;
        this.pushService = pushService;
        this.clock = clock;
        this.from = from;
        this.appUrl = appUrl;
    }

    private boolean emailVerified(long userId) {
        return userRepository.findById(userId).map(user -> user.getEmailVerifiedAt() != null).orElse(false);
    }

    /** False when neither a verified e-mail nor a browser can receive the alert: the switch is on but silent. */
    @Transactional(readOnly = true)
    public boolean deliverable(long userId) {
        return emailVerified(userId) || pushService.hasSubscription(userId);
    }

    @Transactional(readOnly = true)
    public boolean enabled(long userId) {
        return alertRepository.findById(userId).map(FutureAlert::isEnabled).orElse(false);
    }

    @Transactional
    public void setEnabled(long userId, boolean enabled) {
        // Sign-up does not confirm the e-mail; without this, anyone could aim Wall.ia's mail at a stranger.
        // A browser subscribed from the user's own session is a channel of its own.
        if (enabled && !emailVerified(userId) && !pushService.hasSubscription(userId)) {
            throw new WalletRuleException("ALERT_EMAIL_NOT_VERIFIED");
        }
        FutureAlert alert = alertRepository.findById(userId).orElseGet(() -> {
            FutureAlert created = new FutureAlert();
            created.setUserId(userId);
            return created;
        });
        alert.setEnabled(enabled);
        if (!enabled) alert.setLastWindowStart(null);
        alert.setUpdatedAt(clock.instant());
        alertRepository.save(alert);
    }

    /** Every morning in Brasília time, on one instance only; "-" in {@code future_alert_cron} turns it off. */
    @Scheduled(cron = "${app.future.alert-cron:0 0 8 * * *}", zone = "America/Sao_Paulo")
    public void scheduled() {
        jobLock.runExclusive("future-alerts", this::runDaily);
    }

    public int runDaily() {
        int sent = 0;
        for (FutureAlert alert : alertRepository.findByEnabledTrue()) {
            try {
                if (check(alert)) sent++;
            } catch (RuntimeException exception) {
                // One user's failure (mail down, bad data) must not stop the others.
                log.warn("Future alert skipped for one user: {}", exception.getClass().getSimpleName());
            }
        }
        return sent;
    }

    private boolean check(FutureAlert alert) {
        // The verification lasts 90 days or ends when the e-mail changes; without it, only push is left.
        boolean email = emailVerified(alert.getUserId());
        boolean push = pushService.hasSubscription(alert.getUserId());
        if (!email && !push) return false;
        FutureResponses.Overview overview = futureService.overview(alert.getUserId(), HORIZON_DAYS);
        FutureResponses.RiskWindow window = overview.projection().riskWindows().stream().findFirst().orElse(null);
        Decision decision = decide(alert.getLastWindowStart(), window == null ? null : window.start());
        if (decision == Decision.NONE) return false;
        if (decision == Decision.CLEAR) {
            alert.setLastWindowStart(null);
            alertRepository.save(alert);
            return false;
        }
        // decide() answers SEND only with a window; said here so the next change cannot break it silently.
        if (window == null) return false;
        boolean delivered = false;
        if (email) {
            try {
                send(userRepository.findById(alert.getUserId()).orElseThrow(), window, overview.spendingLimit());
                delivered = true;
            } catch (IllegalStateException exception) {
                log.warn("Alert e-mail failed for one user; trying push");
            }
        }
        // Lock-screen text: the date only, never amounts. A push failure must not undo an e-mail already sent.
        if (push && sendPush(alert.getUserId(), "Wall.ia: seu saldo pode ficar negativo",
                "A partir de %s. Toque para ver por quê e como sair.".formatted(window.start().format(DAY)), "/future")) {
            delivered = true;
        }
        // Nothing got through: keep the window unannounced so tomorrow tries again.
        if (!delivered) return false;
        alert.setLastWindowStart(window.start());
        alert.setLastSentAt(clock.instant());
        alertRepository.save(alert);
        return true;
    }

    /**
     * A window drifts a few days as everyday spending is estimated again; it is still the same hole.
     * ponytail: fixed tolerance, not window overlap; upgrade to overlap if two real holes a week apart get merged.
     */
    static final int SAME_WINDOW_DAYS = 7;

    /** SEND for a window not announced yet, CLEAR when the hole is gone (so a future one is announced), NONE otherwise. */
    static Decision decide(LocalDate lastAnnounced, LocalDate currentWindowStart) {
        if (currentWindowStart == null) return lastAnnounced == null ? Decision.NONE : Decision.CLEAR;
        if (lastAnnounced == null) return Decision.SEND;
        long drift = Math.abs(java.time.temporal.ChronoUnit.DAYS.between(lastAnnounced, currentWindowStart));
        return drift <= SAME_WINDOW_DAYS ? Decision.NONE : Decision.SEND;
    }

    static String body(String firstName, FutureResponses.RiskWindow window, FutureResponses.SpendingLimit limit, String url) {
        NumberFormat currency = NumberFormat.getCurrencyInstance(PT_BR);
        String cost = window.overdraftCostCap() == null || window.overdraftCostCap().signum() <= 0 ? ""
                : window.overdraftEstimate() == null
                ? "\nSe o banco cobrir com cheque especial, os juros podem chegar a %s (teto legal de 8%% ao mês), mais IOF."
                        .formatted(currency.format(window.overdraftCostCap()))
                : "LEGAL_CAP".equals(window.overdraftEstimate().source())
                ? "\nSe o banco cobrir com cheque especial, os juros podem chegar a %s (teto legal de 8%% ao mês), mais %s de IOF."
                        .formatted(currency.format(window.overdraftCostCap()), currency.format(window.overdraftEstimate().iof()))
                : ("\nSe o banco cobrir com cheque especial, deve custar cerca de %s (juros de %s%% ao mês, %s, mais IOF)."
                        + " No teto legal, os juros chegariam a %s.")
                        .formatted(currency.format(window.overdraftEstimate().total()),
                                NumberFormat.getNumberInstance(PT_BR).format(window.overdraftEstimate().monthlyRate()),
                                "BANK".equals(window.overdraftEstimate().source())
                                        ? "a taxa do seu banco no Banco Central" : "a mediana dos bancos no Banco Central",
                                currency.format(window.overdraftCostCap()));
        String relief = window.relief() == null ? ""
                : "\nA próxima entrada prevista é %s, em %s.".formatted(window.relief().label(), window.relief().date().format(DAY));
        // The limit keeps the envelopes out; the e-mail talks about the bank balance, so envelopes come back in.
        java.math.BigDecimal missing = limit == null || limit.shortfall() == null ? java.math.BigDecimal.ZERO
                : limit.shortfall().subtract(limit.reserved() == null ? java.math.BigDecimal.ZERO : limit.reserved())
                .max(java.math.BigDecimal.ZERO);
        String gap = missing.signum() > 0
                ? "\nMesmo sem gastar nada no dia a dia, faltam %s até a próxima entrada.".formatted(currency.format(missing))
                : "";
        return """
                %s

                Pela projeção da Wall.ia, seu saldo pode ficar abaixo de zero entre %s e %s, chegando a %s.%s%s%s

                Veja por quê e as opções calculadas para evitar o negativo:
                %s/future

                Você recebe este aviso porque ativou os alertas na tela Futuro. Para parar, desative lá.
                A Wall.ia nunca pede senha, código ou dados bancários por e-mail.
                """.formatted(
                greeting(firstName),
                window.start().format(DAY),
                window.end().format(DAY),
                currency.format(window.lowestBalance()),
                relief, gap, cost,
                url);
    }

    /** The name is free text typed at sign-up; keep one word of letters so it cannot carry a phishing line. */
    static String greeting(String firstName) {
        String word = firstName == null ? "" : firstName.strip().split("\\s+")[0].replaceAll("[^\\p{L}'-]", "");
        if (word.length() > 30) word = word.substring(0, 30);
        return word.isEmpty() ? "Olá." : "Olá, " + word + ".";
    }

    private void send(User user, FutureResponses.RiskWindow window, FutureResponses.SpendingLimit limit) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(from);
        message.setTo(user.getEmail());
        message.setSubject("Wall.ia: seu saldo pode ficar negativo a partir de " + window.start().format(DAY));
        message.setText(body(user.getFirstName(), window, limit, appUrl));
        try {
            mailSender.send(message);
        } catch (MailException exception) {
            throw new IllegalStateException("mail unavailable", exception);
        }
    }

    enum Decision { SEND, CLEAR, NONE }

    /** Body of GET and PUT /future/alerts. */
    private boolean sendPush(long userId, String title, String body, String url) {
        try {
            return pushService.send(userId, title, body, url) > 0;
        } catch (RuntimeException exception) {
            log.warn("Alert push failed for one user: {}", exception.getClass().getSimpleName());
            return false;
        }
    }

    /** @param deliverable response only: whether a verified e-mail or a browser can receive it */
    public record Settings(boolean enabled, Boolean deliverable) {
    }
}
