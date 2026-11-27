-- Complete goal (B56, ADR 0025): optional target, target date and amount already saved, all declared by the person.
-- Existing goals keep the three columns empty and behave as before.
ALTER TABLE goal
    ADD COLUMN target_amount NUMERIC(12, 2),
    ADD COLUMN target_date   DATE,
    ADD COLUMN saved_amount  NUMERIC(12, 2),
    ADD CONSTRAINT goal_target_check CHECK (target_amount > 0 AND target_amount <= 100000000),
    ADD CONSTRAINT goal_saved_check CHECK (saved_amount >= 0 AND saved_amount <= 100000000),
    ADD CONSTRAINT goal_date_needs_target_check CHECK (target_date IS NULL OR target_amount IS NOT NULL);
