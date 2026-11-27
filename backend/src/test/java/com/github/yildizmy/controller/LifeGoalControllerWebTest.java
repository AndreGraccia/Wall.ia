package com.github.yildizmy.controller;

import com.github.yildizmy.config.MessageSourceConfig;
import com.github.yildizmy.config.SecurityConfig;
import com.github.yildizmy.exception.WalletRuleException;
import com.github.yildizmy.security.AuthEntryPointJwt;
import com.github.yildizmy.security.JwtUtils;
import com.github.yildizmy.security.UserDetailsImpl;
import com.github.yildizmy.security.UserDetailsServiceImpl;
import com.github.yildizmy.service.LifeGoalService;
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

/** "Minha evolução" (ADR 0026) with the real security chain: token, validation at the edge, the caller's id. */
@WebMvcTest(LifeGoalController.class)
@Import({SecurityConfig.class, AuthEntryPointJwt.class,
        com.github.yildizmy.config.ClockConfig.class, com.github.yildizmy.config.AppConfig.class})
@TestPropertySource(properties = "app.security.allowedOrigin=http://localhost:3001")
class LifeGoalControllerWebTest {

    private static final String BODY = "{\"title\":\"Mudar\",\"currentSituation\":\"aqui\",\"desiredSituation\":\"ali\","
            + "\"steps\":[{\"description\":\"Curso\"}]}";

    @Autowired MockMvc mvc;
    @MockitoBean LifeGoalService lifeGoalService;
    @MockitoBean UserDetailsServiceImpl userDetailsService;
    @MockitoBean JwtUtils jwtUtils;
    @MockitoBean MessageSourceConfig messageConfig;
    @MockitoBean org.springframework.jdbc.core.JdbcTemplate jdbc; // admin audit interceptor

    private static UserDetailsImpl person(long id) {
        return new UserDetailsImpl(id, "user" + id, "x", "A", "B", List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    @Test
    void withoutATokenNothingRuns() throws Exception {
        mvc.perform(get("/api/v1/life-goals")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/life-goals").contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/v1/life-goals/1")).andExpect(status().isUnauthorized());
        verifyNoInteractions(lifeGoalService);
    }

    @Test
    void invalidInputStopsBeforeTheService() throws Exception {
        String manySteps = "{\"description\":\"x\"},".repeat(20) + "{\"description\":\"x\"}";
        for (String body : List.of(
                BODY.replace("Mudar", " "),
                BODY.replace("Mudar", "x".repeat(81)),
                BODY.replace("aqui", "x".repeat(1001)),
                BODY.replace("\"desiredSituation\":\"ali\",", ""),
                BODY.replace("Curso", ""),
                BODY.replace("Curso", "x".repeat(141)),
                BODY.replace("{\"description\":\"Curso\"}", manySteps),
                BODY.replace("{\"description\":\"Curso\"}", "null"),
                BODY.replace("\"steps\"", "\"estimatedCost\":-1,\"steps\""))) {
            mvc.perform(post("/api/v1/life-goals").with(user(person(7)))
                            .contentType(MediaType.APPLICATION_JSON).content(body))
                    .andExpect(status().isUnprocessableEntity());
        }
        mvc.perform(put("/api/v1/life-goals/1/steps/2").with(user(person(7)))
                        .contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnprocessableEntity());
        verifyNoInteractions(lifeGoalService);
    }

    @Test
    void theServiceGetsTheCallersIdAndNothingIsCached() throws Exception {
        mvc.perform(get("/api/v1/life-goals").with(user(person(7))))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"));
        mvc.perform(post("/api/v1/life-goals").with(user(person(7)))
                        .contentType(MediaType.APPLICATION_JSON).content(BODY))
                .andExpect(status().isCreated());
        mvc.perform(put("/api/v1/life-goals/4/steps/2").with(user(person(7)))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"done\":true}"))
                .andExpect(status().isOk());
        verify(lifeGoalService).list(7L);
        verify(lifeGoalService).create(eq(7L), any());
        verify(lifeGoalService).markStep(7L, 4L, 2L, true);
    }

    @Test
    void someoneElsesLifeGoalIs404() throws Exception {
        when(lifeGoalService.delete(8L, 4L)).thenThrow(new WalletRuleException("LIFE_GOAL_NOT_FOUND"));
        mvc.perform(delete("/api/v1/life-goals/4").with(user(person(8))))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("LIFE_GOAL_NOT_FOUND"));
    }
}
