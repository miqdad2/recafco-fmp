-- CM-70E — Documents & Obligations: split the old combined
-- submission_or_expiry_date field into two separate, independently-optional
-- dates (Submission Date, Expiry Date). Additive only: two new nullable
-- columns. The existing submission_or_expiry_date column and any data
-- already in it are kept exactly as-is (not dropped, not backfilled) —
-- which of the two meanings an old combined date held is not recoverable
-- with confidence, so no guess is made.

-- AlterTable
ALTER TABLE "contract_document_obligations" ADD COLUMN     "submission_date" DATE,
ADD COLUMN     "expiry_date" DATE;
