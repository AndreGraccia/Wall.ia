package com.github.yildizmy.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** What the person declares about themselves (ADR 0021). Anything that comes from the data is computed, not stored. */
@Getter
@Setter
@Entity
@Table(name = "financial_profile")
public class FinancialProfile {

    public static final String NOT_SAID = "NOT_SAID";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    /** SIMPLE, DETAILED, NOT_SAID */
    @Column(length = 20, nullable = false)
    private String preference = NOT_SAID;

    /** STABILITY, LEAVE_DEBT, ORGANIZE_MONTH, BUILD_RESERVE, OTHER, NOT_SAID */
    @Column(name = "main_goal", length = 20, nullable = false)
    private String mainGoal = NOT_SAID;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}
