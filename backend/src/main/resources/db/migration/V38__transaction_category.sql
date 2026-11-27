-- The category a person picks for a movement (ADR 0024). Read on top of the automatic classification; the bank
-- transaction is never changed.
CREATE TABLE category_choice
(
    id             BIGSERIAL                NOT NULL,
    user_id        BIGINT                   NOT NULL,
    transaction_id BIGINT                   NOT NULL,
    category       VARCHAR(24)              NOT NULL,
    created_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at     TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_category_choice PRIMARY KEY (id),
    CONSTRAINT fk_category_choice_user FOREIGN KEY (user_id)
        REFERENCES public."user" (id) ON DELETE CASCADE,
    CONSTRAINT fk_category_choice_transaction FOREIGN KEY (transaction_id)
        REFERENCES public.transaction (id) ON DELETE CASCADE,
    CONSTRAINT uq_category_choice_user_transaction UNIQUE (user_id, transaction_id),
    CONSTRAINT ck_category_choice_category CHECK (category IN
        ('SALARY', 'OTHER_INCOME', 'ESSENTIAL', 'LEISURE', 'RENT', 'BILL', 'SUBSCRIPTION', 'CARD_INVOICE', 'LOAN', 'OTHER'))
);

-- "Sempre que for <contraparte>, usar <categoria>". The counterparty is a transaction description, so the column is
-- named like one: encrypted by the application (ADR 0014), decrypted on export and covered by key rotation.
CREATE TABLE category_rule
(
    id           BIGSERIAL                NOT NULL,
    user_id      BIGINT                   NOT NULL,
    direction    VARCHAR(3)               NOT NULL,
    description  TEXT                     NOT NULL,
    category     VARCHAR(24)              NOT NULL,
    applies_from DATE,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL,
    CONSTRAINT pk_category_rule PRIMARY KEY (id),
    CONSTRAINT fk_category_rule_user FOREIGN KEY (user_id)
        REFERENCES public."user" (id) ON DELETE CASCADE,
    CONSTRAINT ck_category_rule_direction CHECK (direction IN ('IN', 'OUT')),
    CONSTRAINT ck_category_rule_category CHECK (category IN
        ('SALARY', 'OTHER_INCOME', 'ESSENTIAL', 'LEISURE', 'RENT', 'BILL', 'SUBSCRIPTION', 'CARD_INVOICE', 'LOAN', 'OTHER'))
);

CREATE INDEX idx_category_rule_user ON category_rule (user_id);
