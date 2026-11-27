package com.github.yildizmy.service;

import com.github.yildizmy.security.FieldCipher;
import com.github.yildizmy.service.job.JobLock;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.List;
import java.util.Map;

/**
 * Rewrites encrypted columns under the current key (ADR 0016): clear text written before the key existed, the
 * {@code enc:v1:} format without a key id, and values under a previous key. Once a run reports nothing left, the
 * previous key can leave {@code data_encryption_previous_keys}.
 * <p>
 * Walks each table by id in short transactions, so it never holds a long lock. A value no configured key opens is
 * skipped and counted, never overwritten: it may be the only copy of that text.
 */
@Slf4j
@Service
public class EncryptionRotationService {

    static final int BATCH = 500;
    record Column(String table, String name) {
    }

    /** Every encrypted column; each table has a numeric {@code id}. */
    static final List<Column> COLUMNS = List.of(
            new Column("transaction", "description"),
            new Column("card_charge", "description"),
            new Column("investment", "institution"),
            new Column("investment", "name"),
            new Column("investment", "note"));

    public record Result(int rewritten, int failed) {
    }

    private final JdbcTemplate jdbc;
    private final JobLock jobLock;
    private final TransactionTemplate transactions;

    @Autowired
    public EncryptionRotationService(JdbcTemplate jdbc, JobLock jobLock, PlatformTransactionManager transactionManager) {
        this.jdbc = jdbc;
        this.jobLock = jobLock;
        this.transactions = new TransactionTemplate(transactionManager);
    }

    /** After the retention job; cheap when there is nothing to rewrite (one indexed-range query per table). */
    @Scheduled(cron = "${app.security.rotation-cron:0 45 3 * * *}", zone = "America/Sao_Paulo")
    public void scheduled() {
        jobLock.runExclusive("encryption-rotation", this::rewrite);
    }

    public Result rewrite() {
        if (!FieldCipher.enabled()) return new Result(0, 0);
        int rewritten = 0;
        int failed = 0;
        for (Column column : COLUMNS) {
            String table = column.table();
            String name = column.name();
            long after = 0;
            while (true) {
                long from = after;
                // Table and column names come from the constant list above, never from input.
                List<Map<String, Object>> rows = jdbc.queryForList("SELECT id, " + name + " AS secret FROM " + table
                        + " WHERE id > ? AND " + name + " IS NOT NULL AND " + name + " NOT LIKE ? ORDER BY id LIMIT ?",
                        from, FieldCipher.currentPattern(), BATCH);
                if (rows.isEmpty()) break;
                int[] counts = transactions.execute(status -> {
                    int ok = 0;
                    int bad = 0;
                    for (Map<String, Object> row : rows) {
                        try {
                            String plain = FieldCipher.decrypt((String) row.get("secret"));
                            jdbc.update("UPDATE " + table + " SET " + name + " = ? WHERE id = ?",
                                    FieldCipher.encrypt(plain), row.get("id"));
                            ok++;
                        } catch (IllegalStateException unreadable) {
                            bad++;
                        }
                    }
                    return new int[]{ok, bad};
                });
                rewritten += counts[0];
                failed += counts[1];
                after = ((Number) rows.get(rows.size() - 1).get("id")).longValue();
            }
        }
        if (rewritten > 0 || failed > 0) log.info("Encryption rotation: {} rewritten, {} unreadable", rewritten, failed);
        if (failed > 0) log.warn("Some values open with no configured key; keep the previous keys until this is zero");
        return new Result(rewritten, failed);
    }
}
