package com.github.yildizmy.exception;

import com.github.yildizmy.config.MessageSourceConfig;
import jakarta.validation.ConstraintViolationException;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.async.AsyncRequestTimeoutException;

import java.util.Set;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** The error contract the UI depends on: each exception gets its status and a body without internals. */
class GlobalExceptionHandlerWebTest {

    @RestController
    static class Throwing {
        record Body(@NotBlank String name) {
        }

        @GetMapping("/boom/{kind}")
        String boom(@PathVariable String kind) {
            throw switch (kind) {
                case "auth-rate" -> new AuthenticationRateLimitException();
                case "ask-rate" -> new AskRateLimitException();
                case "insight-rate" -> new InsightRateLimitException();
                case "of-down" -> new OpenFinanceUnavailableException("gateway https://bank.internal timed out");
                case "verify" -> new CodedException("EMAIL_VERIFICATION_REQUIRED", HttpStatus.PRECONDITION_REQUIRED);
                case "resend" -> new CodedException("CODE_RESEND_LIMIT", HttpStatus.TOO_MANY_REQUESTS, 60);
                case "wallet-missing" -> new WalletRuleException("GOAL_NOT_FOUND");
                case "wallet-rule" -> new WalletRuleException("SAME_WALLET");
                case "denied" -> new AccessDeniedException("user 8 is not the owner of wallet 3");
                case "integrity" -> new org.springframework.dao.DataIntegrityViolationException(
                        "duplicate key value violates unique constraint \"users_email_key\"");
                case "not-found" -> new NoSuchElementFoundException("Wallet not found");
                case "exists" -> new ElementAlreadyExistsException("Wallet already exists");
                case "funds" -> new InsufficientFundsException("Insufficient funds");
                case "bad-login" -> new BadCredentialsException("password for ana@exemplo.com does not match");
                case "constraint" -> new ConstraintViolationException("amount: must be positive", Set.of());
                case "timeout" -> new AsyncRequestTimeoutException();
                default -> new IllegalStateException("SELECT * FROM users failed at db-prod:5432");
            };
        }

        @PostMapping("/validate")
        String validate(@Valid @RequestBody Body body) {
            return body.name();
        }
    }

    private static MockMvc mvc(boolean traceEnabled) {
        MessageSourceConfig messages = mock(MessageSourceConfig.class);
        when(messages.getMessage(anyString())).thenReturn("Validation error");
        GlobalExceptionHandler handler = new GlobalExceptionHandler(messages);
        ReflectionTestUtils.setField(handler, "printStackTrace", traceEnabled);
        return MockMvcBuilders.standaloneSetup(new Throwing()).setControllerAdvice(handler).build();
    }

    private final MockMvc mvc = mvc(false);

    @Test
    void loginRateLimitIs429WithItsCode() throws Exception {
        mvc.perform(get("/boom/auth-rate")).andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("AUTH_RATE_LIMIT"));
    }

    @Test
    void askRateLimitIs429WithItsCode() throws Exception {
        mvc.perform(get("/boom/ask-rate")).andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("ASK_RATE_LIMIT"));
    }

    @Test
    void insightRateLimitIs429WithItsCode() throws Exception {
        mvc.perform(get("/boom/insight-rate")).andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("INSIGHT_RATE_LIMIT"));
    }

    @Test
    void openFinanceDownIs502AndDoesNotLeakTheGatewayMessage() throws Exception {
        mvc.perform(get("/boom/of-down")).andExpect(status().isBadGateway())
                .andExpect(jsonPath("$.code").value("OPEN_FINANCE_UNAVAILABLE"))
                .andExpect(content().string(not(containsString("bank.internal"))));
    }

    @Test
    void codedExceptionKeepsItsOwnStatus428WithoutRetryAfter() throws Exception {
        mvc.perform(get("/boom/verify")).andExpect(status().is(428))
                .andExpect(jsonPath("$.code").value("EMAIL_VERIFICATION_REQUIRED"))
                .andExpect(header().doesNotExist("Retry-After"));
    }

    @Test
    void codedExceptionWithWaitTellsTheClientWhenToRetry() throws Exception {
        mvc.perform(get("/boom/resend")).andExpect(status().isTooManyRequests())
                .andExpect(header().string("Retry-After", "60"))
                .andExpect(jsonPath("$.code").value("CODE_RESEND_LIMIT"));
    }

    @Test
    void walletRuleForAMissingResourceIs404() throws Exception {
        mvc.perform(get("/boom/wallet-missing")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("GOAL_NOT_FOUND"));
    }

    @Test
    void walletRuleBrokenByValidInputIs422() throws Exception {
        mvc.perform(get("/boom/wallet-rule")).andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("SAME_WALLET"));
    }

    @Test
    void accessDeniedIs403AndDoesNotSayWhoOwnsWhat() throws Exception {
        mvc.perform(get("/boom/denied")).andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"))
                .andExpect(content().string(not(containsString("wallet 3"))));
    }

    @Test
    void integrityViolationIs409WithoutTheSqlConstraint() throws Exception {
        mvc.perform(get("/boom/integrity")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CONFLICT"))
                .andExpect(content().string(not(containsString("users_email_key"))));
    }

    @Test
    void notFoundIs404WithStatusAndMessage() throws Exception {
        mvc.perform(get("/boom/not-found")).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.message").value("Wallet not found"));
    }

    @Test
    void alreadyExistsIs409() throws Exception {
        mvc.perform(get("/boom/exists")).andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value("Wallet already exists"));
    }

    @Test
    void insufficientFundsIs422() throws Exception {
        mvc.perform(get("/boom/funds")).andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.status").value(422));
    }

    @Test
    void rejectedCredentialsAre401WithoutSayingWhy() throws Exception {
        mvc.perform(get("/boom/bad-login")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(content().string(not(containsString("ana@exemplo.com"))));
    }

    @Test
    void constraintViolationIs400() throws Exception {
        mvc.perform(get("/boom/constraint")).andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void invalidBodyIs422WithTheFieldThatFailed() throws Exception {
        mvc.perform(post("/validate").contentType(MediaType.APPLICATION_JSON).content("{\"name\":\"\"}"))
                .andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.message").value("Validation error"))
                .andExpect(jsonPath("$.errors[0].field").value("name"));
    }

    @Test
    void anUnexpectedErrorIs500WithAGenericCodeOnly() throws Exception {
        mvc.perform(get("/boom/anything-else")).andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(content().string(not(containsString("db-prod"))));
    }

    @Test
    void aFrameworkServerErrorAlsoGetsTheGenericBody() throws Exception {
        mvc.perform(get("/boom/timeout")).andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"));
    }

    @Test
    void stackTraceNeverGoesOutWhenTracingIsOffEvenIfTheClientAsks() throws Exception {
        mvc.perform(get("/boom/not-found").param("trace", "true"))
                .andExpect(jsonPath("$.stackTrace").doesNotExist());
    }

    @Test
    void stackTraceGoesOutOnlyWithTracingOnAndTheClientAsking() throws Exception {
        MockMvc tracing = mvc(true);

        tracing.perform(get("/boom/not-found")).andExpect(jsonPath("$.stackTrace").doesNotExist());
        tracing.perform(get("/boom/not-found").param("trace", "false")).andExpect(jsonPath("$.stackTrace").doesNotExist());
        tracing.perform(get("/boom/not-found").param("trace", "true"))
                .andExpect(jsonPath("$.stackTrace").value(containsString("NoSuchElementFoundException")));
    }
}
