package com.github.yildizmy.domain.entity;

import com.github.yildizmy.domain.EncryptedText;
import com.github.yildizmy.service.future.RecurrenceDetector.Direction;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;

/** "Sempre que for <contraparte>, usar <categoria>" (ADR 0024). */
@Getter
@Setter
@Entity
@Table(name = "category_rule")
public class CategoryRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(length = 3, nullable = false)
    private Direction direction;

    /** The counterparty the rule matches: a transaction description, so encrypted like one (ADR 0014). */
    @Convert(converter = EncryptedText.class)
    @Column(nullable = false, columnDefinition = "text")
    private String description;

    @Column(length = 24, nullable = false)
    private String category;

    /** First movement date the rule reaches; null reaches the previous ones too. */
    @Column(name = "applies_from")
    private LocalDate appliesFrom;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;
}
