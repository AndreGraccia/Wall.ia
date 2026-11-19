package com.github.yildizmy.service.future;

import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;

/**
 * How old the Open Finance data under a screen is (B50, ADR 0020). Every screen that shows bank data uses this one
 * rule, so the Future, the Radar, Commitments and Analyses never disagree about "late".
 * <p>
 * A screen is only as fresh as its oldest input: the institution named is the one holding the data back. An account
 * that never synced is late by definition (there is nothing to trust yet).
 */
public final class BankDataFreshness {

    /** The daily sync runs at 7h30; 36 hours without one means at least one run failed for this person. */
    public static final Duration STALE_AFTER = Duration.ofHours(36);

    /** One Open Finance account (or card, or loan) and when it was last synced; null if never. */
    public record Source(String institution, Instant syncedAt) {
    }

    /**
     * @param institution     the institution whose data is the oldest (or never synced)
     * @param asOf            oldest sync; null when some account never synced
     * @param stale           older than {@link #STALE_AFTER}, or never synced
     * @param staleAfterHours the limit, so the screen can say it without hard-coding it
     */
    public record Status(String institution, Instant asOf, boolean stale, long staleAfterHours) {
    }

    private BankDataFreshness() {
    }

    /** @return null when there is no Open Finance data at all: nothing to be late */
    public static Status of(List<Source> sources, Instant now) {
        if (sources.isEmpty()) return null;
        Source oldest = sources.stream()
                .min(Comparator.comparing(Source::syncedAt, Comparator.nullsFirst(Comparator.naturalOrder())))
                .orElseThrow();
        boolean stale = oldest.syncedAt() == null || oldest.syncedAt().plus(STALE_AFTER).isBefore(now);
        return new Status(oldest.institution(), oldest.syncedAt(), stale, STALE_AFTER.toHours());
    }
}
