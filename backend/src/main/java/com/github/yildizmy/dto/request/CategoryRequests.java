package com.github.yildizmy.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

/** Shape is checked here (422); whether the category fits the movement is checked in the service (ADR 0024). */
public final class CategoryRequests {

    private static final String CATEGORY =
            "^(SALARY|OTHER_INCOME|ESSENTIAL|LEISURE|RENT|BILL|SUBSCRIPTION|CARD_INVOICE|LOAN|OTHER)$";

    private CategoryRequests() {
    }

    public record Choice(@NotNull @Pattern(regexp = CATEGORY) String category) {
    }
}
