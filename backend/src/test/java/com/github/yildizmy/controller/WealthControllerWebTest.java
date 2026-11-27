package com.github.yildizmy.controller;

import com.github.yildizmy.config.MessageSourceConfig;
import com.github.yildizmy.config.SecurityConfig;
import com.github.yildizmy.exception.WalletRuleException;
import com.github.yildizmy.security.AuthEntryPointJwt;
import com.github.yildizmy.security.JwtUtils;
import com.github.yildizmy.security.UserDetailsImpl;
import com.github.yildizmy.security.UserDetailsServiceImpl;
import com.github.yildizmy.service.WealthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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

/** Patrimônio (ADR 0026) with the real security chain: token, validation at the edge, the caller's id. */
@WebMvcTest(WealthController.class)
@Import({SecurityConfig.class, AuthEntryPointJwt.class,
        com.github.yildizmy.config.ClockConfig.class, com.github.yildizmy.config.AppConfig.class})
@TestPropertySource(properties = "app.security.allowedOrigin=http://localhost:3001")
class WealthControllerWebTest {

    private static final String NEW = "{\"institution\":\"Corretora\",\"name\":\"Reserva\",\"assetClass\":\"FUND\","
            + "\"value\":100.5,\"valueDate\":\"2026-11-01\"}";

    @Autowired MockMvc mvc;
    @MockitoBean WealthService wealthService;
    @MockitoBean UserDetailsServiceImpl userDetailsService;
    @MockitoBean JwtUtils jwtUtils;
    @MockitoBean MessageSourceConfig messageConfig;
    @MockitoBean org.springframework.jdbc.core.JdbcTemplate jdbc; // admin audit interceptor

    private static UserDetailsImpl person(long id) {
        return new UserDetailsImpl(id, "user" + id, "x", "A", "B", List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    @Test
    void withoutATokenNothingRuns() throws Exception {
        mvc.perform(get("/api/v1/wealth")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/wealth/investments").contentType(MediaType.APPLICATION_JSON).content(NEW))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/v1/wealth/investments/1")).andExpect(status().isUnauthorized());
        verifyNoInteractions(wealthService);
    }

    @Test
    void invalidInputStopsBeforeTheService() throws Exception {
        for (String body : List.of(
                NEW.replace("100.5", "-1"),
                NEW.replace("100.5", "1.001"),
                NEW.replace("100.5", "1000000000000"),
                NEW.replace("FUND", "TIP"),
                NEW.replace("Reserva", " "),
                NEW.replace("Corretora", "x".repeat(61)),
                NEW.replace(",\"valueDate\":\"2026-11-01\"", ""),
                NEW.replace("}", ",\"note\":\"" + "x".repeat(501) + "\"}"))) {
            mvc.perform(post("/api/v1/wealth/investments").with(user(person(7)))
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isUnprocessableEntity());
        }
        mvc.perform(delete("/api/v1/wealth/investments/1/values/ontem").with(user(person(7))))
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_DATE"));
        verifyNoInteractions(wealthService);
    }

    @Test
    void theServiceGetsTheCallersIdAndNothingIsCached() throws Exception {
        mvc.perform(get("/api/v1/wealth").with(user(person(7))))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"));
        mvc.perform(post("/api/v1/wealth/investments").with(user(person(7)))
                        .contentType(MediaType.APPLICATION_JSON).content(NEW))
                .andExpect(status().isCreated());
        mvc.perform(delete("/api/v1/wealth/investments/3/values/2026-11-01").with(user(person(7))))
                .andExpect(status().isOk());
        verify(wealthService).view(7L);
        verify(wealthService).create(eq(7L), any());
        verify(wealthService).deleteValue(7L, 3L, LocalDate.of(2026, 11, 1));
    }

    @Test
    void someoneElsesInvestmentIs404() throws Exception {
        when(wealthService.delete(8L, 3L)).thenThrow(new WalletRuleException("INVESTMENT_NOT_FOUND"));
        mvc.perform(delete("/api/v1/wealth/investments/3").with(user(person(8))))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("INVESTMENT_NOT_FOUND"));
        mvc.perform(put("/api/v1/wealth/investments/3/values").with(user(person(8)))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"value\":1}"))
                .andExpect(status().isUnprocessableEntity());
    }
}
