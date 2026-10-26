package com.github.yildizmy.service;

import com.github.yildizmy.security.FieldCipher;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * "Baixar meus dados" (LGPD art. 18, II and V): everything kept about the person, in one JSON.
 * <p>
 * Columns are listed one by one on purpose. A new column only reaches the export when someone adds it here, so a
 * secret added later (a token, a hash) never leaks by default. Left out: password and e-mail code hashes, session
 * cut-off, push keys. Descriptions are stored encrypted (ADR 0014) and are exported in clear.
 */
@Service
@RequiredArgsConstructor
public class AccountExportService {

    private static final String OWN_WALLETS = "(SELECT id FROM wallet WHERE user_id = ?)";

    /** Section name, query, and how many times the query takes the user id. */
    record Section(String name, String sql, int idParams) {
    }

    static final List<Section> SECTIONS = List.of(
            new Section("roles", "SELECT r.type AS role FROM user_role ur JOIN role r ON r.id = ur.role_id "
                    + "WHERE ur.user_id = ?", 1),
            new Section("wallets", "SELECT id, name, iban, balance, source, institution_name, external_account_id, "
                    + "last_synced_at FROM wallet WHERE user_id = ? ORDER BY id", 1),
            new Section("transactions", "SELECT t.id, t.created_at, t.amount, t.description, ty.name AS type, t.status, "
                    + "t.source, t.payment_type, t.reference_number, t.from_wallet_id, t.to_wallet_id "
                    + "FROM transaction t JOIN type ty ON ty.id = t.type_id "
                    + "WHERE t.from_wallet_id IN " + OWN_WALLETS + " OR t.to_wallet_id IN " + OWN_WALLETS
                    + " ORDER BY t.created_at, t.id", 2),
            new Section("creditCards", "SELECT id, institution, name, last_digits, credit_limit, closing_day, due_day, "
                    + "next_bill_due_date, next_bill_total, next_bill_minimum, last_synced_at "
                    + "FROM credit_card WHERE user_id = ? ORDER BY id", 1),
            new Section("cardCharges", "SELECT c.id, c.card_id, c.purchase_date, c.description, c.total_amount, "
                    + "c.installment_amount, c.installments, c.first_invoice FROM card_charge c "
                    + "JOIN credit_card k ON k.id = c.card_id WHERE k.user_id = ? ORDER BY c.id", 1),
            new Section("loans", "SELECT id, institution, product, contracted_amount, outstanding_balance, "
                    + "installment_amount, installments_total, installments_paid, next_due_date, due_day, annual_rate, "
                    + "cet, amortization_system, last_synced_at FROM loan WHERE user_id = ? ORDER BY id", 1),
            new Section("openFinanceConnections", "SELECT institution_id, institution_name, consent_id, status, "
                    + "created_at, authorised_at, expires_at, last_synced_at, rejected_by, rejection_reason, rejected_at "
                    + "FROM open_finance_connection WHERE user_id = ? ORDER BY id", 1),
            new Section("openFinanceConsents", "SELECT c.consent_id, c.institution_id, c.purpose, c.created_at, "
                    + "c.expires_at, c.terms_version, c.terms_language, (SELECT string_agg(p.permission, ',' ORDER BY "
                    + "p.permission) FROM open_finance_consent_permission p WHERE p.consent_id = c.consent_id) AS permissions "
                    + "FROM open_finance_consent c WHERE c.user_id = ? ORDER BY c.created_at, c.consent_id", 1),
            new Section("openFinanceConsentEvents", "SELECT e.consent_id, e.event, e.actor, e.reason, e.occurred_at "
                    + "FROM open_finance_consent_event e JOIN open_finance_consent c ON c.consent_id = e.consent_id "
                    + "WHERE c.user_id = ? ORDER BY e.id", 1),
            new Section("goals", "SELECT id, name, monthly_amount, day_of_month, created_at FROM goal "
                    + "WHERE user_id = ? ORDER BY id", 1),
            new Section("envelopes", "SELECT id, name, amount, created_at FROM envelope WHERE user_id = ? ORDER BY id", 1),
            new Section("answers", "SELECT pattern_key, status, category, amount, decided_at FROM recurrence_decision "
                    + "WHERE user_id = ? ORDER BY id", 1),
            new Section("alerts", "SELECT enabled, last_window_start, last_sent_at, updated_at FROM future_alert "
                    + "WHERE user_id = ?", 1),
            new Section("chargeAlertDecisions", "SELECT transaction_id, decision, created_at, updated_at "
                    + "FROM charge_alert_decision WHERE user_id = ? ORDER BY updated_at, id", 1),
            new Section("forecastSnapshots", "SELECT taken_on, balance FROM forecast_snapshot WHERE user_id = ? "
                    + "ORDER BY taken_on", 1),
            new Section("pushDevices", "SELECT created_at FROM push_subscription WHERE user_id = ? ORDER BY id", 1),
            new Section("adminActions", "SELECT method, path, status, at FROM admin_audit WHERE actor_id = ? "
                    + "ORDER BY at", 1));

    private final JdbcTemplate jdbc;
    private final Clock clock;

    @Transactional(readOnly = true)
    public Map<String, Object> export(long userId) {
        Map<String, Object> export = new LinkedHashMap<>();
        export.put("generatedAt", clock.instant().toString());
        export.put("legalBasis", "LGPD art. 18, II e V");
        export.put("profile", jdbc.queryForList("SELECT id, first_name, last_name, username, email, email_verified_at "
                + "FROM \"user\" WHERE id = ?", userId).stream().map(AccountExportService::readable).findFirst().orElseThrow());
        for (Section section : SECTIONS) {
            Object[] ids = new Object[section.idParams()];
            java.util.Arrays.fill(ids, userId);
            export.put(section.name(), jdbc.queryForList(section.sql(), ids).stream()
                    .map(AccountExportService::readable).toList());
        }
        return export;
    }

    /** Dates as ISO text instead of epoch numbers, descriptions decrypted. */
    static Map<String, Object> readable(Map<String, Object> row) {
        Map<String, Object> out = new LinkedHashMap<>();
        row.forEach((column, value) -> {
            if (value instanceof java.sql.Timestamp timestamp) value = timestamp.toInstant().toString();
            else if (value instanceof java.sql.Date date) value = date.toLocalDate().toString();
            else if (value instanceof String text && "description".equals(column)) value = FieldCipher.decrypt(text);
            out.put(column, value);
        });
        return out;
    }
}
