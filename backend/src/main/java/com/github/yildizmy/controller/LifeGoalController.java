package com.github.yildizmy.controller;

import com.github.yildizmy.dto.request.LifeGoalRequests;
import com.github.yildizmy.dto.response.LifeGoalResponses;
import com.github.yildizmy.security.UserDetailsImpl;
import com.github.yildizmy.service.LifeGoalService;
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

/**
 * "Minha evolução" (ADR 0026). The user is always the token's; a life goal, step or linked goal of someone else is
 * 404. Every route answers the whole updated list.
 */
@RestController
@RequestMapping("/api/v1/life-goals")
@RequiredArgsConstructor
public class LifeGoalController {

    private final LifeGoalService lifeGoalService;

    @GetMapping
    public ResponseEntity<LifeGoalResponses.LifeGoals> list(@AuthenticationPrincipal UserDetailsImpl user) {
        return noStore(HttpStatus.OK, lifeGoalService.list(user.getId()));
    }

    /** 409 LIFE_GOAL_LIMIT; 404 GOAL_NOT_FOUND; 400 INVALID_DATE. */
    @PostMapping
    public ResponseEntity<LifeGoalResponses.LifeGoals> create(@AuthenticationPrincipal UserDetailsImpl user,
                                                              @Valid @RequestBody LifeGoalRequests.LifeGoal request) {
        return noStore(HttpStatus.CREATED, lifeGoalService.create(user.getId(), request));
    }

    /** 404 LIFE_GOAL_NOT_FOUND, LIFE_GOAL_STEP_NOT_FOUND or GOAL_NOT_FOUND. */
    @PutMapping("/{id}")
    public ResponseEntity<LifeGoalResponses.LifeGoals> update(@AuthenticationPrincipal UserDetailsImpl user,
                                                              @PathVariable long id,
                                                              @Valid @RequestBody LifeGoalRequests.LifeGoal request) {
        return noStore(HttpStatus.OK, lifeGoalService.update(user.getId(), id, request));
    }

    @PutMapping("/{id}/steps/{stepId}")
    public ResponseEntity<LifeGoalResponses.LifeGoals> markStep(@AuthenticationPrincipal UserDetailsImpl user,
                                                                @PathVariable long id, @PathVariable long stepId,
                                                                @Valid @RequestBody LifeGoalRequests.StepDone request) {
        return noStore(HttpStatus.OK, lifeGoalService.markStep(user.getId(), id, stepId, request.done()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<LifeGoalResponses.LifeGoals> delete(@AuthenticationPrincipal UserDetailsImpl user,
                                                              @PathVariable long id) {
        return noStore(HttpStatus.OK, lifeGoalService.delete(user.getId(), id));
    }

    private <T> ResponseEntity<T> noStore(HttpStatus status, T body) {
        return ResponseEntity.status(status).cacheControl(CacheControl.noStore()).body(body);
    }
}
