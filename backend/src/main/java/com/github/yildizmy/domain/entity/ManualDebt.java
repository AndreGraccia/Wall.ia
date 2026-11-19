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

import java.math.BigDecimal;
import java.time.Instant;

/**
 * A debt the person types because Open Finance does not send it (B14, ADR 0020). Only "Pix no crédito" for now.
 * Origin MANUAL, certainty ESTIMATED: nobody checked it against the institution.
 */
@Getter
@Setter
@Entity
@Table(name = "manual_debt")
public class ManualDebt {

    public static final String PIX_CREDIT = "PIX_CREDIT";

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(length = 20, nullable = false)
    private String kind;

    @Column(length = 60, nullable = false)
    private String label;

    @Column(precision = 12, scale = 2, nullable = false)
    private BigDecimal outstandingBalance;

    @Column(precision = 12, scale = 2, nullable = false)
    private BigDecimal installmentAmount;

    /** CET in percent a month, as typed (8.0 = 8% a.m.). */
    @Column(precision = 6, scale = 4, nullable = false)
    private BigDecimal monthlyCet;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
