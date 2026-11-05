/**
 * FMP-SALES-09 — what "Create Contract" from a Confirmed Sales enquiry fills in on the New Contract Register. Only fields
 * the contract already supports; nothing is invented. The user still reviews and completes the register form.
 */
export interface EnquiryContractPrefill {
  enquiryId: string;
  enquiryNumber: string;
  companyName: string;
  /** Project Name field. */
  title: string;
  /** An existing Customer (First Party) whose name equals the enquiry's company, if there is exactly one. */
  firstPartyId: string;
  clientContactName: string;
  clientContactPhone: string;
  projectSiteLocation: string;
  scopeDescription: string;
  /** Written into the contract's Notes so the enquiry reference stays on the contract. */
  notes: string;
}
