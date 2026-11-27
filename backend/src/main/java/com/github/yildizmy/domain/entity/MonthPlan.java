package com.github.yildizmy.domain.entity;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Embeddable;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OrderColumn;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** How the person splits the confirmed monthly income (ADR 0021). One per user; the rules live in MonthPlanCalculator. */
@Getter
@Setter
@Entity
@Table(name = "month_plan")
public class MonthPlan {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "month_plan_slice", joinColumns = @JoinColumn(name = "month_plan_id"))
    @OrderColumn(name = "position")
    private List<Slice> slices = new ArrayList<>();

    @Column(nullable = false)
    private boolean active;

    @Column(name = "activated_at")
    private Instant activatedAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Getter
    @Setter
    @Embeddable
    public static class Slice {

        @Column(length = 20, nullable = false)
        private String kind;

        @Column(length = 40, nullable = false)
        private String label;

        @Column(precision = 5, scale = 2, nullable = false)
        private BigDecimal percent;

        @Column(nullable = false)
        private boolean commitment;
    }
}
