package com.github.yildizmy.domain.entity;

import com.github.yildizmy.domain.EncryptedText;
import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.Convert;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapKeyColumn;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.SortNatural;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.SortedMap;
import java.util.TreeMap;

/** An investment the person typed (ADR 0026). Informative only: never part of the balance or of the projection. */
@Getter
@Setter
@Entity
@Table(name = "investment")
public class Investment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Convert(converter = EncryptedText.class)
    @Column(columnDefinition = "text", nullable = false)
    private String institution;

    @Convert(converter = EncryptedText.class)
    @Column(columnDefinition = "text", nullable = false)
    private String name;

    @Column(name = "asset_class", length = 20, nullable = false)
    private String assetClass;

    @Column(name = "invested_amount", precision = 14, scale = 2)
    private BigDecimal investedAmount;

    @Column(name = "maturity_date")
    private LocalDate maturityDate;

    /** The method or model the person says she chose, in her words. */
    @Convert(converter = EncryptedText.class)
    @Column(columnDefinition = "text")
    private String note;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    /** What it was worth on each informed date; the latest date is the current value. */
    @ElementCollection
    @CollectionTable(name = "investment_value", joinColumns = @JoinColumn(name = "investment_id"))
    @MapKeyColumn(name = "value_date")
    @Column(name = "amount", precision = 14, scale = 2, nullable = false)
    @SortNatural
    private SortedMap<LocalDate, BigDecimal> values = new TreeMap<>();
}
