-- FMP-CONTRACT-06 — additive, non-destructive: structured Payment Term details
-- (percentages / interim type / tax clearance status). `payment_terms` booleans are unchanged,
-- so workflow generation and every existing reader keep working; old rows stay NULL.
ALTER TABLE "contracts" ADD COLUMN "payment_term_details" JSONB;
