package com.github.yildizmy.domain.entity;

import com.github.yildizmy.domain.EncryptedText;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
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

@Getter
@Setter
@Entity
@Table(name = "life_goal_step")
public class LifeGoalStep {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "life_goal_id", nullable = false)
    private LifeGoal lifeGoal;

    @Column(nullable = false)
    private int position;

    @Convert(converter = EncryptedText.class)
    @Column(columnDefinition = "text", nullable = false)
    private String description;

    @Column(nullable = false)
    private boolean done;

    @Column(name = "done_at")
    private Instant doneAt;

    /** Marking again keeps the first date; unmarking clears it. */
    public void mark(boolean value, Instant now) {
        if (value && !done) doneAt = now;
        if (!value) doneAt = null;
        done = value;
    }
}
