package com.github.yildizmy.dto.response;

import com.github.yildizmy.domain.enums.Status;
import com.github.yildizmy.domain.enums.TransactionSource;
import lombok.Data;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Data Transfer Object for Transaction response.
 */
@Data
public class TransactionResponse {

    private Long id;
    private BigDecimal amount;
    private String description;
    private String createdAt;
    private UUID referenceNumber;
    private Status status;
    private TransactionSource source;
    /** Open Finance {@code type} (PIX, TED, BOLETO...); null for local entries and imports before V31. */
    private String paymentType;
    private WalletResponse fromWallet;
    private WalletResponse toWallet;
    private TypeResponse type;
}
