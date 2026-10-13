-- FMP-PROD-02: Production hands produced elements over to Storage Yard & Delivery.
-- Additive only: one new enum value, no data is changed.
ALTER TYPE "contract_boq_piece_status" ADD VALUE 'SENT_TO_STORAGE';
