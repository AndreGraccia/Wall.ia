package com.github.yildizmy.controller;

import com.github.yildizmy.config.MessageSourceConfig;
import com.github.yildizmy.config.SecurityConfig;
import com.github.yildizmy.exception.AskRateLimitException;
import com.github.yildizmy.security.AuthEntryPointJwt;
import com.github.yildizmy.security.JwtUtils;
import com.github.yildizmy.security.UserDetailsImpl;
import com.github.yildizmy.security.UserDetailsServiceImpl;
import com.github.yildizmy.service.ForecastService;
import com.github.yildizmy.service.ChargeAlertService;
import com.github.yildizmy.service.FutureAlertService;
import com.github.yildizmy.service.FutureService;
import com.github.yildizmy.service.InsightsService;
import com.github.yildizmy.service.OpenFinanceService;
import com.github.yildizmy.service.ask.AskUsage;
import com.github.yildizmy.service.market.MarketRatesService;
import com.github.yildizmy.service.push.PushService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Routes that act on the signed-in user (Futuro, Análises, Mercado, Open Finance), with the real security chain.
 * The user id always comes from the token, never from the request, so the checks are: no token, no call;
 * invalid input, no call; and the service receives the caller's id.
 */
@WebMvcTest({FutureController.class, InsightsController.class, MarketController.class, OpenFinanceController.class})
@Import({SecurityConfig.class, AuthEntryPointJwt.class,
        com.github.yildizmy.config.ClockConfig.class, com.github.yildizmy.config.AppConfig.class})
@TestPropertySource(properties = "app.security.allowedOrigin=http://localhost:3001")
class UserScopedControllersWebTest {

    @Autowired MockMvc mvc;
    @MockitoBean FutureService futureService;
    @MockitoBean AskUsage askUsage;
    @MockitoBean FutureAlertService alertService;
    @MockitoBean ForecastService forecastService;
    @MockitoBean ChargeAlertService chargeAlertService;
    @MockitoBean PushService pushService;
    @MockitoBean InsightsService insightsService;
    @MockitoBean MarketRatesService marketRates;
    @MockitoBean OpenFinanceService openFinanceService;
    @MockitoBean UserDetailsServiceImpl userDetailsService;
    @MockitoBean JwtUtils jwtUtils;
    @MockitoBean MessageSourceConfig messageConfig;
    @MockitoBean org.springframework.jdbc.core.JdbcTemplate jdbc; // admin audit interceptor

    private static UserDetailsImpl person(long id) {
        return new UserDetailsImpl(id, "user" + id, "x", "A", "B", List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    @Test
    void withoutATokenNothingRuns() throws Exception {
        mvc.perform(get("/api/v1/future/overview")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/future/charge-alerts")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/insights/reports").contentType(MediaType.APPLICATION_JSON)
                .content("{\"months\":3,\"language\":\"pt-BR\"}")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/market/overview")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/open-finance/sync")).andExpect(status().isUnauthorized());
        verifyNoInteractions(futureService, insightsService, openFinanceService, forecastService, chargeAlertService);
        verify(marketRates, never()).quotes(anyLong()); // the startup refresh is not a request
    }

    @Test
    void theOverviewIsTheCallersAndNeverCached() throws Exception {
        mvc.perform(get("/api/v1/future/overview?horizon=60").with(user(person(7))))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")));
        verify(futureService).overview(7L, 60);
    }

    @Test
    void theChargeRadarIsScopedToTheCallerAndNeverCached() throws Exception {
        when(chargeAlertService.findForUser(7L)).thenReturn(List.of());
        mvc.perform(get("/api/v1/future/charge-alerts").with(user(person(7))))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")));
        verify(chargeAlertService).findForUser(7L);
    }

    @Test
    void chargeAlertFeedbackUsesTheAuthenticatedUserRatherThanRequestData() throws Exception {
        mvc.perform(put("/api/v1/future/charge-alerts/42/decision")
                        .with(user(person(7)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"decision\":\"REVIEW\"}"))
                .andExpect(status().isNoContent());
        verify(chargeAlertService).decide(7L, 42L, "REVIEW");
    }

    @Test
    void anUnknownHorizonIs400() throws Exception {
        mvc.perform(get("/api/v1/future/overview?horizon=45").with(user(person(7))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_HORIZON"));
        verify(futureService, never()).overview(anyLong(), anyInt());
    }

    @Test
    void deletingAGoalOrEnvelopeActsOnTheCallersOwn() throws Exception {
        mvc.perform(delete("/api/v1/future/goals/3").with(user(person(7)))).andExpect(status().isNoContent());
        mvc.perform(delete("/api/v1/future/envelopes/4").with(user(person(7)))).andExpect(status().isNoContent());
        verify(futureService).deleteGoal(7L, 3L);
        verify(futureService).deleteEnvelope(7L, 4L);
    }

    @Test
    void aSpentAskLimitIs429AndTheQuestionIsNeverAnswered() throws Exception {
        doThrow(new AskRateLimitException()).when(askUsage).acquire(7L);
        mvc.perform(post("/api/v1/future/ask").with(user(person(7))).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"question\":\"posso gastar 100?\"}"))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("ASK_RATE_LIMIT"));
        verify(futureService, never()).ask(anyLong(), anyString());
    }

    @Test
    void adminOnlyFutureRoutesAre403ForAUser() throws Exception {
        mvc.perform(get("/api/v1/future/ask/metrics").with(user(person(7)))).andExpect(status().isForbidden());
        mvc.perform(post("/api/v1/future/alerts/run").with(user(person(7)))).andExpect(status().isForbidden());
        verify(askUsage, never()).summary(anyInt());
        verify(alertService, never()).runDaily();
    }

    @Test
    void anInsightReportOutsideOneToTwelveMonthsIsRejectedBeforeTheModel() throws Exception {
        mvc.perform(post("/api/v1/insights/reports").with(user(person(7))).contentType(MediaType.APPLICATION_JSON)
                .content("{\"months\":13,\"language\":\"pt-BR\"}")).andExpect(status().isUnprocessableEntity());
        verify(insightsService, never()).generate(any(), anyInt(), any());
    }

    @Test
    void theMarketOverviewUsesTheCallersBankAndIsNeverCached() throws Exception {
        mvc.perform(get("/api/v1/market/overview").with(user(person(7))))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")));
        verify(marketRates).quotes(7L);
    }

    @Test
    void aFailedForecastSnapshotNeverTurnsASyncIntoAnError() throws Exception {
        doThrow(new IllegalStateException("db")).when(forecastService).record(7L);
        mvc.perform(post("/api/v1/open-finance/sync").with(user(person(7)))).andExpect(status().isOk());
        verify(openFinanceService).sync(7L);
    }

    @Test
    void aConsentDecisionNeedsAConsentId() throws Exception {
        mvc.perform(post("/api/v1/open-finance/connection/reject").with(user(person(7)))
                .contentType(MediaType.APPLICATION_JSON).content("{\"consentId\":\"\"}"))
                .andExpect(status().isUnprocessableEntity());
        verify(openFinanceService, never()).reject(anyLong(), anyString());
    }

    @Test
    void revokingActsOnTheCallersConnection() throws Exception {
        mvc.perform(delete("/api/v1/open-finance/connection").with(user(person(7)))).andExpect(status().isNoContent());
        verify(openFinanceService).revoke(7L);
    }
}
