package com.github.yildizmy.controller;

import com.github.yildizmy.dto.request.CategoryRequests;
import com.github.yildizmy.dto.response.CategoryResponses;
import com.github.yildizmy.security.UserDetailsImpl;
import com.github.yildizmy.service.CategoryService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Categories the person decides (ADR 0024). The user is always the token's; ownership is checked in the service. */
@RestController
@RequestMapping("/api/v1/categories")
@RequiredArgsConstructor
public class CategoryController {

    private final CategoryService service;

    @PutMapping("/transactions/{id}")
    public ResponseEntity<Void> choose(@AuthenticationPrincipal UserDetailsImpl user, @PathVariable long id,
                                       @Valid @RequestBody CategoryRequests.Choice request) {
        service.choose(user.getId(), id, request.category());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/transactions/{id}")
    public ResponseEntity<Void> clear(@AuthenticationPrincipal UserDetailsImpl user, @PathVariable long id) {
        service.clear(user.getId(), id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/rules/preview")
    public ResponseEntity<CategoryResponses.Preview> preview(@AuthenticationPrincipal UserDetailsImpl user,
                                                             @Valid @RequestBody CategoryRequests.Rule request) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.preview(
                user.getId(), request.transactionId(), request.category(), request.includePrevious()));
    }

    @PostMapping("/rules")
    public ResponseEntity<CategoryResponses.Rule> create(@AuthenticationPrincipal UserDetailsImpl user,
                                                         @Valid @RequestBody CategoryRequests.Rule request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.createRule(
                user.getId(), request.transactionId(), request.category(), request.includePrevious()));
    }

    @GetMapping("/rules")
    public ResponseEntity<List<CategoryResponses.Rule>> rules(@AuthenticationPrincipal UserDetailsImpl user) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(service.rules(user.getId()));
    }

    @DeleteMapping("/rules/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal UserDetailsImpl user, @PathVariable long id) {
        service.deleteRule(user.getId(), id);
        return ResponseEntity.noContent().build();
    }
}
