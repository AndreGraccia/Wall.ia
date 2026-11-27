package com.github.yildizmy.domain.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;

/** What an investment was worth on a date, as the person informed it. */
@Getter
@Setter
@NoArgsConstructor
@Entity
@Table(name = "investment_value")
@IdClass(InvestmentValue.Key.class)
public class InvestmentValue {

    public record Key(Long investment, LocalDate valueDate) implements Serializable {
    }

    @Id
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "investment_id", nullable = false)
    private Investment investment;

    @Id
    @Column(name = "value_date", nullable = false)
    private LocalDate valueDate;

    @Column(precision = 14, scale = 2, nullable = false)
    private BigDecimal amount;

    public InvestmentValue(Investment investment, LocalDate valueDate, BigDecimal amount) {
        this.investment = investment;
        this.valueDate = valueDate;
        this.amount = amount;
    }
}
