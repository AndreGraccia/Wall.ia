-- User feedback on suspected charges. This table never modifies or deletes imported bank transactions.
CREATE TABLE charge_alert_decision
(
    id             BIGSERIAL                  NOT NULL,
    user_id        BIGINT                     NOT NULL,
    transaction_id BIGINT                     NOT NULL,
    decision       VARCHAR(24)                NOT NULL,
    created_at     TIMESTAMP WITH TIME ZONE    NOT NULL,
    updated_at     TIMESTAMP WITH TIME ZONE    NOT NULL,
    CONSTRAINT pk_charge_alert_decision PRIMARY KEY (id),
    CONSTRAINT fk_charge_alert_decision_user FOREIGN KEY (user_id)
        REFERENCES public."user" (id) ON DELETE CASCADE,
    CONSTRAINT fk_charge_alert_decision_transaction FOREIGN KEY (transaction_id)
        REFERENCES public.transaction (id) ON DELETE CASCADE,
    CONSTRAINT uq_charge_alert_decision_user_transaction UNIQUE (user_id, transaction_id),
    CONSTRAINT ck_charge_alert_decision_value
        CHECK (decision IN ('REVIEW', 'NOT_ANOMALOUS', 'RESOLVED'))
);

CREATE INDEX idx_charge_alert_decision_user ON charge_alert_decision (user_id);

COMMENT ON TABLE charge_alert_decision IS
    'User feedback on suspected charges; it does not mutate transaction data or execute financial actions.';
