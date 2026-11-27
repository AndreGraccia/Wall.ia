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

/** One choice of budgeting method (ADR 0021). Append-only: the current method is the latest row. */
@Getter
@Setter
@Entity
@Table(name = "method_choice")
public class MethodChoice {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(length = 30, nullable = false)
    private String method;

    @Column(name = "catalog_version", length = 20, nullable = false)
    private String catalogVersion;

    @Column(name = "chosen_at", nullable = false)
    private Instant chosenAt;
}
