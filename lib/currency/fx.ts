/**
 * Multi-currency helpers. Prices are stored in their native currency
 * (priceNative + currency) and normalized to AED (priceAed) at ingest for
 * cross-country sorting and range filters.
 *
 * FX_TO_AED is a static snapshot — enough for sort ordering and rough filters.
 * Phase 2: replace with a live/cached rate feed refreshed daily.
 */

export const FX_TO_AED: Record<string, number> = {
  AED: 1,
  USD: 3.6725,
  EUR: 3.98,
  GBP: 4.65,
  SAR: 0.98,
  QAR: 1.009,
  BHD: 9.74,
  KWD: 11.95,
  OMR: 9.54,
  INR: 0.044,
  PKR: 0.0132,
  TRY: 0.108,
  EGP: 0.075,
  CAD: 2.67,
  AUD: 2.42,
  CHF: 4.12,
  SGD: 2.73,
  THB: 0.103,
};

export const SUPPORTED_CURRENCIES = Object.keys(FX_TO_AED);

export function isSupportedCurrency(code: string): boolean {
  return code.toUpperCase() in FX_TO_AED;
}

/** Convert a native amount to AED (the normalized sort/filter value). */
export function toAed(amount: number, currency: string): number {
  const rate = FX_TO_AED[currency.toUpperCase()] ?? 1;
  return Math.round(amount * rate);
}

/** Format an amount in its own currency, e.g. "£450,000" or "AED 2,650,000". */
export function formatMoney(
  amount: number | null | undefined,
  currency: string = "AED",
): string {
  if (amount == null) return "Price on request";
  const code = currency.toUpperCase();
  try {
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    // Unknown currency code — fall back to "<CODE> <amount>".
    return `${code} ${Math.round(amount).toLocaleString()}`;
  }
}

/** Common country names for display (ISO-3166 alpha-2). Extend as needed. */
export const COUNTRY_NAMES: Record<string, string> = {
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  QA: "Qatar",
  BH: "Bahrain",
  OM: "Oman",
  KW: "Kuwait",
  GB: "United Kingdom",
  US: "United States",
  IN: "India",
  PK: "Pakistan",
  TR: "Türkiye",
  EG: "Egypt",
  CA: "Canada",
  AU: "Australia",
  SG: "Singapore",
  TH: "Thailand",
  CH: "Switzerland",
  FR: "France",
  ES: "Spain",
  PT: "Portugal",
};

export function countryName(code: string | null | undefined): string | null {
  if (!code) return null;
  return COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase();
}
