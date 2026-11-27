package com.github.yildizmy.controller;

import com.github.yildizmy.dto.request.PlanRequests;
import com.github.yildizmy.dto.response.FutureResponses;
import com.github.yildizmy.dto.response.PlanResponses;
import com.github.yildizmy.exception.WalletRuleException;
import com.github.yildizmy.security.UserDetailsImpl;
import com.github.yildizmy.service.FutureService;
import com.github.yildizmy.service.MonthPlanService;
import com.github.yildizmy.service.ProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.YearMonth;
import java.time.format.DateTimeParseException;

/**
 * Plano do mês, Entradas e saídas, Projeção mensal, perfil e "Meu método" (proposta de André Graccia e documento de
 * evolução do grupo, ADR 0021). The user is always the token's; no route takes a user id or a resource id.
 */
@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class PlanController {

    private final MonthPlanService planService;
    private final FutureService futureService;
    private final ProfileService profileService;

    @GetMapping("/plan")
    public ResponseEntity<PlanResponses.MonthPlan> plan(@AuthenticationPrincipal UserDetailsImpl user) {
        return noStore(planService.view(user.getId()));
    }

    /** Saves the slices (a draft may be incomplete). 422 for a broken rule; on an active plan, 422 when incomplete. */
    @PutMapping("/plan")
    public ResponseEntity<PlanResponses.MonthPlan> save(@AuthenticationPrincipal UserDetailsImpl user,
                                                        @Valid @RequestBody PlanRequests.Plan request) {
        return noStore(planService.save(user.getId(), request.toSlices()));
    }

    /** "Ver se cabe": 90 days with and without these slices as the active plan. Saves nothing. */
    @PostMapping("/plan/fit")
    public ResponseEntity<FutureResponses.ScenarioResult> fit(@AuthenticationPrincipal UserDetailsImpl user,
                                                              @Valid @RequestBody PlanRequests.Plan request) {
        return noStore(futureService.monthPlanFit(user.getId(), request.toSlices()));
    }

    /** The confirmation. On: saved, 100% and confirmed income, or 422 with the code. Off: always. */
    @PutMapping("/plan/activation")
    public ResponseEntity<PlanResponses.MonthPlan> activation(@AuthenticationPrincipal UserDetailsImpl user,
                                                              @Valid @RequestBody PlanRequests.Activation request) {
        return noStore(planService.setActive(user.getId(), request.active()));
    }

    /** 3, 6 or 12 months; anything else is 400 INVALID_HORIZON. */
    @GetMapping("/plan/projection")
    public ResponseEntity<PlanResponses.Projection> projection(@AuthenticationPrincipal UserDetailsImpl user,
                                                               @RequestParam(defaultValue = "3") int months) {
        return noStore(planService.projection(user.getId(), months));
    }

    /** {@code month} as YYYY-MM, the current one and the 12 before; 400 INVALID_MONTH otherwise. */
    @GetMapping("/cash-flow")
    public ResponseEntity<PlanResponses.CashFlow> cashFlow(@AuthenticationPrincipal UserDetailsImpl user,
                                                           @RequestParam(required = false) String month) {
        YearMonth parsed = null;
        if (month != null) {
            try {
                parsed = YearMonth.parse(month);
            } catch (DateTimeParseException invalid) {
                throw new WalletRuleException("INVALID_MONTH");
            }
        }
        return noStore(planService.cashFlow(user.getId(), parsed));
    }

    @GetMapping("/methods")
    public ResponseEntity<PlanResponses.Catalog> methods() {
        return ResponseEntity.ok().cacheControl(CacheControl.noCache()).body(profileService.catalog());
    }

    @GetMapping("/methods/suggestions")
    public ResponseEntity<PlanResponses.Suggestions> suggestions(@AuthenticationPrincipal UserDetailsImpl user) {
        return noStore(profileService.suggestions(user.getId()));
    }

    @GetMapping("/profile")
    public ResponseEntity<PlanResponses.Profile> profile(@AuthenticationPrincipal UserDetailsImpl user) {
        return noStore(profileService.profile(user.getId()));
    }

    @PutMapping("/profile")
    public ResponseEntity<PlanResponses.Profile> updateProfile(@AuthenticationPrincipal UserDetailsImpl user,
                                                               @Valid @RequestBody PlanRequests.Profile request) {
        return noStore(profileService.update(user.getId(), request.preference(), request.mainGoal()));
    }

    /** Appends to the history; choosing the current method again changes nothing. */
    @PutMapping("/profile/method")
    public ResponseEntity<PlanResponses.Profile> chooseMethod(@AuthenticationPrincipal UserDetailsImpl user,
                                                              @Valid @RequestBody PlanRequests.MethodChoice request) {
        return noStore(profileService.chooseMethod(user.getId(), request.method()));
    }

    private <T> ResponseEntity<T> noStore(T body) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(body);
    }
}
