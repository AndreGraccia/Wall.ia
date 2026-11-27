package com.github.yildizmy.controller;

import com.github.yildizmy.dto.request.WealthRequests;
import com.github.yildizmy.dto.response.WealthResponses;
import com.github.yildizmy.exception.WalletRuleException;
import com.github.yildizmy.security.UserDetailsImpl;
import com.github.yildizmy.service.WealthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;

/**
 * Patrimônio (ADR 0026). The user is always the token's; an investment id of someone else is 404. Every route
 * answers the whole updated view.
 */
@RestController
@RequestMapping("/api/v1/wealth")
@RequiredArgsConstructor
public class WealthController {

    private final WealthService wealthService;

    @GetMapping
    public ResponseEntity<WealthResponses.Wealth> view(@AuthenticationPrincipal UserDetailsImpl user) {
        return noStore(HttpStatus.OK, wealthService.view(user.getId()));
    }

    /** 409 INVESTMENT_LIMIT; 422 INVESTMENT_FUTURE_DATE. */
    @PostMapping("/investments")
    public ResponseEntity<WealthResponses.Wealth> create(@AuthenticationPrincipal UserDetailsImpl user,
                                                         @Valid @RequestBody WealthRequests.NewInvestment request) {
        return noStore(HttpStatus.CREATED, wealthService.create(user.getId(), request));
    }

    @PutMapping("/investments/{id}")
    public ResponseEntity<WealthResponses.Wealth> update(@AuthenticationPrincipal UserDetailsImpl user,
                                                         @PathVariable long id,
                                                         @Valid @RequestBody WealthRequests.Details request) {
        return noStore(HttpStatus.OK, wealthService.update(user.getId(), id, request));
    }

    /** 409 INVESTMENT_VALUE_LIMIT; 422 INVESTMENT_FUTURE_DATE. */
    @PutMapping("/investments/{id}/values")
    public ResponseEntity<WealthResponses.Wealth> putValue(@AuthenticationPrincipal UserDetailsImpl user,
                                                           @PathVariable long id,
                                                           @Valid @RequestBody WealthRequests.Value request) {
        return noStore(HttpStatus.OK, wealthService.putValue(user.getId(), id, request));
    }

    /** {@code date} as YYYY-MM-DD (400 INVALID_DATE); 422 INVESTMENT_LAST_VALUE. */
    @DeleteMapping("/investments/{id}/values/{date}")
    public ResponseEntity<WealthResponses.Wealth> deleteValue(@AuthenticationPrincipal UserDetailsImpl user,
                                                              @PathVariable long id, @PathVariable String date) {
        LocalDate parsed;
        try {
            parsed = LocalDate.parse(date);
        } catch (DateTimeParseException invalid) {
            throw new WalletRuleException("INVALID_DATE");
        }
        return noStore(HttpStatus.OK, wealthService.deleteValue(user.getId(), id, parsed));
    }

    @DeleteMapping("/investments/{id}")
    public ResponseEntity<WealthResponses.Wealth> delete(@AuthenticationPrincipal UserDetailsImpl user,
                                                         @PathVariable long id) {
        return noStore(HttpStatus.OK, wealthService.delete(user.getId(), id));
    }

    private <T> ResponseEntity<T> noStore(HttpStatus status, T body) {
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(body);
    }
}
