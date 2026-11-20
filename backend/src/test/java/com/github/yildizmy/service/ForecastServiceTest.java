package com.github.yildizmy.service;

import com.github.yildizmy.domain.entity.ForecastSnapshot;
import com.github.yildizmy.dto.response.FutureResponses;
import com.github.yildizmy.repository.ForecastSnapshotRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ForecastServiceTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 9, 24);

    private final ForecastSnapshotRepository repository = mock(ForecastSnapshotRepository.class);
    private final FutureService future = mock(FutureService.class);
    private final ForecastService service = new ForecastService(repository, future,
            Clock.fixed(Instant.parse("2026-09-24T15:00:00Z"), ZoneOffset.UTC));

    @Test
    void theForecastIsStoredDayByDayOnlyWhenTheUserHasConfirmedSomething() {
        when(future.overview(7L, ForecastService.HORIZON_DAYS)).thenReturn(overview(1));
        when(repository.findByUserIdAndTakenOn(7L, TODAY)).thenReturn(Optional.empty());

        service.record(7L);

        ForecastSnapshot saved = saved();
        assertEquals(new BigDecimal("1000.00"), saved.getBalance());
        assertEquals("1000.00;950.00;-20.50", saved.getProjection());
        assertEquals(List.of(new BigDecimal("1000.00"), new BigDecimal("950.00"), new BigDecimal("-20.50")),
                ForecastService.parse(saved.getProjection()));
    }

    @Test
    void aSecondSyncOnTheSameDayUpdatesTheRowAndNoAnswersMeansNoForecast() {
        ForecastSnapshot existing = new ForecastSnapshot();
        existing.setProjection("1;2;3");
        when(future.overview(7L, ForecastService.HORIZON_DAYS)).thenReturn(overview(0));
        when(repository.findByUserIdAndTakenOn(7L, TODAY)).thenReturn(Optional.of(existing));

        service.record(7L);

        assertSame(existing, saved());
        assertNull(existing.getProjection());
    }

    @Test
    void theNorthStarCountsAvoidedDaysPerActiveUserPerMonthAndKeepsMissesBesideIt() {
        when(repository.findByTakenOnGreaterThanEqualOrderByUserIdAscTakenOnAsc(TODAY.minusDays(29 + 30))).thenReturn(List.of(
                row(1L, TODAY.minusDays(10), "500.00", "-50;-50;-50;-50;-50;-50;-50;-50;-50;-50;-50"),
                row(1L, TODAY.minusDays(2), "120.00", null),
                row(2L, TODAY.minusDays(1), "900.00", null)));

        FutureResponses.NorthStar result = service.northStar(30);

        assertEquals(2, result.activeUsers());
        assertEquals(1, result.gradedUsers());
        assertEquals(1, result.avoided());
        assertEquals(0, result.missed());
        assertEquals(new BigDecimal("170.00"), result.meanAbsoluteError());
        // 1 avoided day, 2 active users, over 30 days.
        assertEquals(new BigDecimal("0.50"), result.avoidedPerActiveUserMonth());
    }

    private static ForecastSnapshot row(long userId, LocalDate day, String balance, String projection) {
        ForecastSnapshot row = new ForecastSnapshot();
        row.setUserId(userId);
        row.setTakenOn(day);
        row.setBalance(new BigDecimal(balance));
        row.setProjection(projection);
        return row;
    }

    private ForecastSnapshot saved() {
        ArgumentCaptor<ForecastSnapshot> captor = ArgumentCaptor.forClass(ForecastSnapshot.class);
        verify(repository).save(captor.capture());
        return captor.getValue();
    }

    private static FutureResponses.Overview overview(int confirmed) {
        List<FutureResponses.DayPoint> days = List.of(
                day(0, "1000.00"), day(1, "950.00"), day(2, "-20.50"));
        FutureResponses.Projection projection = new FutureResponses.Projection(2, new BigDecimal("1000.00"),
                new BigDecimal("-20.50"), TODAY.plusDays(2), new BigDecimal("-20.50"), 1, days, List.of(), List.of());
        return new FutureResponses.Overview(Instant.now(), TODAY, new BigDecimal("1000.00"), BigDecimal.ZERO, null,
                projection, new FutureResponses.Sources(1, 0, 0, confirmed, 0, null), null, null, null, List.of(), BigDecimal.ZERO);
    }

    private static FutureResponses.DayPoint day(int offset, String balance) {
        return new FutureResponses.DayPoint(TODAY.plusDays(offset), new BigDecimal(balance), BigDecimal.ZERO, BigDecimal.ZERO);
    }
}
