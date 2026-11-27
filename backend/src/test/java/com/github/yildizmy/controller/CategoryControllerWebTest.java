package com.github.yildizmy.controller;

import com.github.yildizmy.config.MessageSourceConfig;
import com.github.yildizmy.config.SecurityConfig;
import com.github.yildizmy.exception.WalletRuleException;
import com.github.yildizmy.security.AuthEntryPointJwt;
import com.github.yildizmy.security.JwtUtils;
import com.github.yildizmy.security.UserDetailsImpl;
import com.github.yildizmy.security.UserDetailsServiceImpl;
import com.github.yildizmy.service.CategoryService;
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

import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** Category routes (ADR 0024) with the real security chain: the user id is always the token's. */
@WebMvcTest(CategoryController.class)
@Import({SecurityConfig.class, AuthEntryPointJwt.class,
        com.github.yildizmy.config.ClockConfig.class, com.github.yildizmy.config.AppConfig.class})
@TestPropertySource(properties = "app.security.allowedOrigin=http://localhost:3001")
class CategoryControllerWebTest {

    private static final String RULE = "{\"transactionId\":5,\"category\":\"LEISURE\",\"includePrevious\":true}";

    @Autowired MockMvc mvc;
    @MockitoBean CategoryService service;
    @MockitoBean UserDetailsServiceImpl userDetailsService;
    @MockitoBean JwtUtils jwtUtils;
    @MockitoBean MessageSourceConfig messageConfig;
    @MockitoBean org.springframework.jdbc.core.JdbcTemplate jdbc; // admin audit interceptor

    private static UserDetailsImpl person(long id) {
        return new UserDetailsImpl(id, "user" + id, "x", "A", "B", List.of(new SimpleGrantedAuthority("ROLE_USER")));
    }

    @Test
    void withoutATokenNothingRuns() throws Exception {
        mvc.perform(put("/api/v1/categories/transactions/5").contentType(MediaType.APPLICATION_JSON)
                .content("{\"category\":\"LEISURE\"}")).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/v1/categories/transactions/5")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/v1/categories/rules")).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/categories/rules").contentType(MediaType.APPLICATION_JSON).content(RULE))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/v1/categories/rules/preview").contentType(MediaType.APPLICATION_JSON).content(RULE))
                .andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/v1/categories/rules/3")).andExpect(status().isUnauthorized());
        verifyNoInteractions(service);
    }

    @Test
    void choosingAndUndoingUseTheCallersId() throws Exception {
        mvc.perform(put("/api/v1/categories/transactions/5").with(user(person(7))).contentType(MediaType.APPLICATION_JSON)
                .content("{\"category\":\"LEISURE\"}")).andExpect(status().isNoContent());
        mvc.perform(delete("/api/v1/categories/transactions/5").with(user(person(7)))).andExpect(status().isNoContent());
        verify(service).choose(7L, 5L, "LEISURE");
        verify(service).clear(7L, 5L);
    }

    @Test
    void anUnknownCategoryIsRefusedBeforeTheService() throws Exception {
        for (String body : List.of("{\"category\":\"INVESTMENT\"}", "{\"category\":\"UNCLASSIFIED\"}", "{}")) {
            mvc.perform(put("/api/v1/categories/transactions/5").with(user(person(7)))
                    .contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isUnprocessableEntity());
        }
        verifyNoInteractions(service);
    }

    @Test
    void ruleRoutesUseTheCallersIdAndCreateAnswers201() throws Exception {
        mvc.perform(post("/api/v1/categories/rules/preview").with(user(person(7)))
                .contentType(MediaType.APPLICATION_JSON).content(RULE)).andExpect(status().isOk());
        mvc.perform(post("/api/v1/categories/rules").with(user(person(7)))
                .contentType(MediaType.APPLICATION_JSON).content(RULE)).andExpect(status().isCreated());
        mvc.perform(get("/api/v1/categories/rules").with(user(person(7)))).andExpect(status().isOk());
        mvc.perform(delete("/api/v1/categories/rules/3").with(user(person(7)))).andExpect(status().isNoContent());
        verify(service).preview(7L, 5L, "LEISURE", true);
        verify(service).createRule(7L, 5L, "LEISURE", true);
        verify(service).rules(7L);
        verify(service).deleteRule(7L, 3L);
    }

    @Test
    void aRuleWithoutScopeIsRefused() throws Exception {
        mvc.perform(post("/api/v1/categories/rules").with(user(person(7))).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"transactionId\":5,\"category\":\"LEISURE\"}"))
                .andExpect(status().isUnprocessableEntity());
        verifyNoInteractions(service);
    }

    @Test
    void someoneElsesTransactionIsNotFound() throws Exception {
        doThrow(new WalletRuleException("TRANSACTION_NOT_FOUND")).when(service).choose(8L, 5L, "LEISURE");

        mvc.perform(put("/api/v1/categories/transactions/5").with(user(person(8))).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"category\":\"LEISURE\"}"))
                .andExpect(status().isNotFound()).andExpect(jsonPath("$.code").value("TRANSACTION_NOT_FOUND"));
    }
}
