-- FMP-BOQ-03 - give the (boq_item_id, confirmation_status) index a short explicit name
-- (the generated name exceeds PostgreSQL's 63-character limit and was truncated).
ALTER INDEX "contract_boq_drawing_confirmations_boq_item_id_confirmation_sta" RENAME TO "contract_boq_drawing_conf_item_status_idx";
