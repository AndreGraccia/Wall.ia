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
import java.time.LocalDate;

/**
 * A monthly amount the user decided to set aside. It is a commitment in the projection. Target, date and saved amount
 * are optional and declared by the person; none of them is money the system saw move (ADR 0025).
 */
@Getter
@Setter
@Entity
@Table(name = "goal")
public class Goal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(length = 60, nullable = false)
    private String name;

    @Column(name = "monthly_amount", precision = 12, scale = 2, nullable = false)
    private BigDecimal monthlyAmount;

    @Column(name = "day_of_month", nullable = false)
    private int dayOfMonth;

    @Column(name = "target_amount", precision = 12, scale = 2)
    private BigDecimal targetAmount;

    @Column(name = "target_date")
    private LocalDate targetDate;

    @Column(name = "saved_amount", precision = 12, scale = 2)
    private BigDecimal savedAmount;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
