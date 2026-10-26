package com.github.yildizmy.controller;

import com.github.yildizmy.dto.response.BillingRadarReport;
import com.github.yildizmy.dto.response.BillingRadarPriceImpact;
import com.github.yildizmy.security.UserDetailsImpl;
import com.github.yildizmy.service.BillingRadarService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Evidence-based review signals for recurring charges; no charge is changed or cancelled. */
@RestController
@RequestMapping("/api/v1/billing-radar")
@RequiredArgsConstructor
public class BillingRadarController {

    private final BillingRadarService billingRadarService;

    @GetMapping
    public ResponseEntity<BillingRadarReport> report(@AuthenticationPrincipal UserDetailsImpl user) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(billingRadarService.report(user.getId()));
    }

    @PostMapping("/{key}/simulate-price-reversion")
    public ResponseEntity<BillingRadarPriceImpact> simulatePriceReversion(
            @PathVariable String key,
            @AuthenticationPrincipal UserDetailsImpl user) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(billingRadarService.simulatePriceReversion(user.getId(), key));
    }
}
