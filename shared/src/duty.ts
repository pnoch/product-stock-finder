// Coarse destination import estimate: VAT/GST plus a category duty rate. This
// is an ESTIMATE for ranking and expectation-setting, not a customs quote.
// Rates are curated, not authoritative; refine with real user feedback.

const COUNTRY_VAT: Record<string, number> = {
  TH: 0.07,
  SG: 0.09,
  MY: 0.1,
  AU: 0.1,
  NZ: 0.15,
  GB: 0.2,
  DE: 0.19,
  FR: 0.2,
  GR: 0.24,
  PL: 0.23,
  CZ: 0.21,
  CA: 0.13,
  ZA: 0.15,
  AE: 0.05,
  US: 0,
  HK: 0,
};

// Category → duty rate. Networking/electronics are commonly low or zero under
// ITA; a coarse default covers the rest.
const CATEGORY_DUTY: Record<string, number> = {
  "Networking Switch": 0,
  Router: 0,
  "Single-Board Computer": 0,
  Storage: 0,
  "Network Card": 0,
  "Network Gateway": 0,
  "Wireless Bridge": 0,
  UPS: 0,
  Cooling: 0,
  default: 0.05,
};

export interface ImportEstimate {
  vatRate: number;
  dutyRate: number;
}

export function estimateImportDuty(
  _price: number,
  category: string,
  countryCode: string,
): ImportEstimate | null {
  if (!Object.prototype.hasOwnProperty.call(COUNTRY_VAT, countryCode)) {
    return null;
  }
  const vatRate = COUNTRY_VAT[countryCode]!;
  const dutyRate = Object.prototype.hasOwnProperty.call(CATEGORY_DUTY, category)
    ? CATEGORY_DUTY[category]!
    : CATEGORY_DUTY.default!;
  return { vatRate, dutyRate };
}
