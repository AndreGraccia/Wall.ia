package com.github.yildizmy.domain.entity;

import com.github.yildizmy.domain.EncryptedText;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/** "Onde estou, onde quero chegar" (ADR 0026): the person's own words, with no score. */
@Getter
@Setter
@Entity
@Table(name = "life_goal")
public class LifeGoal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Convert(converter = EncryptedText.class)
    @Column(columnDefinition = "text", nullable = false)
    private String title;

    @Convert(converter = EncryptedText.class)
    @Column(name = "current_situation", columnDefinition = "text", nullable = false)
    private String currentSituation;

    @Convert(converter = EncryptedText.class)
    @Column(name = "desired_situation", columnDefinition = "text", nullable = false)
    private String desiredSituation;

    @Column(name = "target_date")
    private LocalDate targetDate;

    @Column(name = "estimated_cost", precision = 14, scale = 2)
    private BigDecimal estimatedCost;

    /** Optional link to a monthly goal of the same person. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "goal_id")
    private Goal goal;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "lifeGoal", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position")
    private List<LifeGoalStep> steps = new ArrayList<>();
}
