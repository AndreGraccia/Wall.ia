-- O metodo 35/20/15 com reserva passa a se chamar pelo que faz ("Equilibrado 35/20/15", id PERCENT_BALANCED).
-- O credito a quem propos (Andre Graccia) fica no ADR 0021 e no CHANGELOG, nao na interface. Escolhas antigas
-- continuam no historico, com o id novo.
ALTER TABLE method_choice DROP CONSTRAINT method_choice_method_check;

UPDATE method_choice SET method = 'PERCENT_BALANCED' WHERE method = 'PERCENT_ANDRE';

ALTER TABLE method_choice ADD CONSTRAINT method_choice_method_check CHECK (method IN ('PERCENT_503020',
    'PERCENT_BALANCED', 'ZERO_BASED', 'PAY_YOURSELF_FIRST', 'PRIORITIES', 'INCOME_CYCLE', 'ENVELOPES',
    'DEBT_AVALANCHE', 'DEBT_SNOWBALL'));
