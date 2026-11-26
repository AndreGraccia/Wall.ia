package com.github.yildizmy.controller;

import com.github.yildizmy.config.MessageSourceConfig;
import com.github.yildizmy.config.SecurityConfig;
import com.github.yildizmy.exception.WalletRuleException;
import com.github.yildizmy.security.AuthEntryPointJwt;
import com.github.yildizmy.security.JwtUtils;
import com.github.yildizmy.security.UserDetailsImpl;
import com.github.yildizmy.security.UserDetailsServiceImpl;
import com.github.yildizmy.service.FutureService;
import com.github.yildizmy.service.MonthPlanService;
import com.github.yildizmy.service.ProfileService;
import com.github.yildizmy.service.future.MonthPlanCalculator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.YearMonth;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Plano do mês, Entradas e saídas, Projeção mensal, perfil e "Meu método" (ADR 0021) with the real security chain.
 * No route takes a user id or a resource id: the id is always the token's, so another person's plan cannot even be
 * named. The checks: no token, nothing runs; invalid input, 422 before the service; the service gets the caller's id.
 */
@WebMvcTest(PlanController.class)
@Import({SecurityConfig.class, AuthEntryPointJwt.class,
        com.github.yildizmy.config.ClockConfig.class, com.github.yildizmy.config.AppConfig.class})
@TestPropertySource(properties = "app.security.allowedOrigin=http://localhost:3001")
class PlanControllerWebTest {

    private static final String PLAN = "{\"slices\":[{\"kind\":\"FIXED\",\"label\":\"Fixo\",\"percent\":35},"
            + "{\"kind\":\"INVESTMENT\",\"label\":\"Investimento\",\"percent\":65,\"commitment\":true}]}";

    @Autowired MockMvc mvc;
    @MockitoBean MonthPlanService planService;
    @MockitoBean FutureService futureService;
    @MockitoBean ProfileService profileService;
    @MockitoBean UserDetailsServiceImpl userDetailsService;
    @MockitoBean JwtUtils jwtUtils;
    @MockitoBean MessageSourceConfig messageConfig;
    @MockitoBean org.springframework.jdbc.core.JdbcTemplate jdbc; // admin audit interceptor

    private static UserDetailsImpl person(long id) {
        return new UserDetailsImpl(id, "user" + id, "x", "A", "B", List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    @Test
    void withoutATokenNothingRuns() throws Exception {
        mvc.perform(get("/api/v1/plan")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/v1/plan").contentType(MediaType.APPLICATION_JSON).content(PLAN)).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/plan/fit").contentType(MediaType.APPLICATION_JSON).content(PLAN)).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/v1/plan/activation").contentType(MediaType.APPLICATION_JSON).content("{\"active\":true}"))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/plan/projection")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/cash-flow")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/methods")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/methods/suggestions")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/profile")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/v1/profile/method").contentType(MediaType.APPLICATION_JSON).content("{\"method\":\"ENVELOPES\"}"))
                .andExpect(status().isUnauthorized());
        verifyNoInteractions(planService, futureService, profileService);
    }

    @Test
    void everyCallUsesTheCallersIdAndIsNeverCached() throws Exception {
        mvc.perform(get("/api/v1/plan").with(user(person(7))))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", org.hamcrest.Matchers.containsString("no-store")));
        mvc.perform(put("/api/v1/plan").with(user(person(7))).contentType(MediaType.APPLICATION_JSON).content(PLAN))
                .andExpect(status().isOk());
        mvc.perform(post("/api/v1/plan/fit").with(user(person(7))).contentType(MediaType.APPLICATION_JSON).content(PLAN))
                .andExpect(status().isOk());
        mvc.perform(put("/api/v1/plan/activation").with(user(person(7))).contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":true}")).andExpect(status().isOk());
        mvc.perform(get("/api/v1/plan/projection?months=12").with(user(person(7)))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/cash-flow?month=2026-10").with(user(person(7)))).andExpect(status().isOk());
        mvc.perform(get("/api/v1/methods/suggestions").with(user(person(7)))).andExpect(status().isOk());
        mvc.perform(put("/api/v1/profile").with(user(person(7))).contentType(MediaType.APPLICATION_JSON)
                .content("{\"preference\":\"SIMPLE\",\"mainGoal\":\"LEAVE_DEBT\"}")).andExpect(status().isOk());
        mvc.perform(put("/api/v1/profile/method").with(user(person(7))).contentType(MediaType.APPLICATION_JSON)
                .content("{\"method\":\"PERCENT_BALANCED\"}")).andExpect(status().isOk());

        verify(planService).view(7L);
        verify(planService).save(eq(7L), eq(List.of(
                new MonthPlanCalculator.Slice(MonthPlanCalculator.Kind.FIXED, "Fixo", new java.math.BigDecimal("35"), false),
                new MonthPlanCalculator.Slice(MonthPlanCalculator.Kind.INVESTMENT, "Investimento", new java.math.BigDecimal("65"), true))));
        verify(futureService).monthPlanFit(eq(7L), any());
        verify(planService).setActive(7L, true);
        verify(planService).projection(7L, 12);
        verify(planService).cashFlow(7L, YearMonth.of(2026, 10));
        verify(profileService).suggestions(7L);
        verify(profileService).update(7L, "SIMPLE", "LEAVE_DEBT");
        verify(profileService).chooseMethod(7L, "PERCENT_BALANCED");
    }

    @Test
    void aMalformedPlanIs422BeforeTheService() throws Exception {
        String[] bodies = {
                "{\"slices\":[]}",
                "{}",
                "{\"slices\":[{\"kind\":\"SALARY\",\"label\":\"X\",\"percent\":10}]}",
                "{\"slices\":[{\"kind\":\"CUSTOM\",\"label\":\"\",\"percent\":10}]}",
                "{\"slices\":[{\"kind\":\"CUSTOM\",\"label\":\"X\",\"percent\":100.01}]}",
                "{\"slices\":[{\"kind\":\"CUSTOM\",\"label\":\"X\",\"percent\":-1}]}",
                "{\"slices\":[{\"kind\":\"CUSTOM\",\"label\":\"X\",\"percent\":7.501}]}",
                "{\"slices\":[{\"kind\":\"CUSTOM\",\"label\":\"" + "x".repeat(41) + "\",\"percent\":1}]}",
                "{\"slices\":[" + "{\"kind\":\"CUSTOM\",\"label\":\"X\",\"percent\":1},".repeat(12)
                        + "{\"kind\":\"CUSTOM\",\"label\":\"X\",\"percent\":1}]}"};
        for (String body : bodies) {
            mvc.perform(put("/api/v1/plan").with(user(person(7))).contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isUnprocessableEntity());
            mvc.perform(post("/api/v1/plan/fit").with(user(person(7))).contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isUnprocessableEntity());
        }
        mvc.perform(put("/api/v1/plan/activation").with(user(person(7))).contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnprocessableEntity());
        mvc.perform(put("/api/v1/profile").with(user(person(7))).contentType(MediaType.APPLICATION_JSON)
                .content("{\"preference\":\"SIMPLE\",\"mainGoal\":\"GET_RICH\"}")).andExpect(status().isUnprocessableEntity());
        mvc.perform(put("/api/v1/profile/method").with(user(person(7))).contentType(MediaType.APPLICATION_JSON)
                .content("{\"method\":\"BUY_STOCKS\"}")).andExpect(status().isUnprocessableEntity());
        verify(planService, never()).save(anyLong(), any());
        verify(planService, never()).setActive(anyLong(), anyBoolean());
        verify(futureService, never()).monthPlanFit(anyLong(), any());
        verify(profileService, never()).update(anyLong(), anyString(), anyString());
        verify(profileService, never()).chooseMethod(anyLong(), anyString());
    }

    @Test
    void ruleCodesFromTheServiceKeepTheirStatus() throws Exception {
        when(planService.setActive(7L, true)).thenThrow(new WalletRuleException("MONTH_PLAN_INCOMPLETE"));
        mvc.perform(put("/api/v1/plan/activation").with(user(person(7))).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"active\":true}"))
                .andExpect(status().isUnprocessableEntity())
                .andExpect(jsonPath("$.code").value("MONTH_PLAN_INCOMPLETE"));
        when(profileService.chooseMethod(7L, "ENVELOPES")).thenThrow(new WalletRuleException("METHOD_CHOICE_LIMIT"));
        mvc.perform(put("/api/v1/profile/method").with(user(person(7))).contentType(MediaType.APPLICATION_JSON)
                .content("{\"method\":\"ENVELOPES\"}")).andExpect(status().isConflict());
    }

    @Test
    void aBadMonthIs400AndNeverReachesTheService() throws Exception {
        mvc.perform(get("/api/v1/cash-flow?month=2026-13").with(user(person(7))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_MONTH"));
        mvc.perform(get("/api/v1/cash-flow?month=novembro").with(user(person(7)))).andExpect(status().isBadRequest());
        verify(planService, never()).cashFlow(anyLong(), any());
        verify(planService, never()).projection(anyLong(), anyInt());
    }

    @Test
    void theCatalogIsTheSameForEveryoneAndHasTheNineMethods() throws Exception {
        when(profileService.catalog()).thenReturn(new ProfileService(null, null, null, null, null, null).catalog());
        mvc.perform(get("/api/v1/methods").with(user(person(7))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.methods.length()").value(9))
                .andExpect(jsonPath("$.methods[1].id").value("PERCENT_BALANCED"))
                .andExpect(jsonPath("$.methods[1].preset.length()").value(6));
    }
}
