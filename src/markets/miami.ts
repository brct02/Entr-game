// Market pack: City of Miami, FL - one leased 1-bedroom run as a short-term rental.
// Captured 2026-11-12 from web search results. Each value says where it came from and how far to trust it.
// "sourced" = a published figure; "estimated" = my figure, no source found; "derived" = computed from sourced figures.

import type { StrConfig } from "../str.ts";

export interface Provenance { value: string; kind: "sourced" | "estimated" | "derived"; source: string; asOf: string; note?: string; }

export const MIAMI_1BR_PROVENANCE: Record<string, Provenance> = {
  monthlyRent: { value: "$2,500", kind: "sourced", asOf: "Sep 2026",
    source: "Zumper median 1BR asking rent, via WLRN https://www.wlrn.org/business/2026-10-06/at-2-500-for-one-bedroom-apartment-miami-ranks-sixth-most-expensive-among-u-s-cities",
    note: "Other sources run higher: Trulia $2,566 (May 2026), Rentometer $2,712 average (Jan 2026). Rent in a building that allows short stays may differ; not sourced." },
  occupancy: { value: "58% target, accepted range 53-65%", kind: "sourced", asOf: "2026",
    source: "Chalet 58% https://chalet-nextjs.vercel.app/airbnb-analytics/miami-fl ; Rabbu 53% https://rabbu.com/airbnb-data/miami-fl ; AirDNA 61% https://www.airdna.co/city/us/florida/miami ; Airbtics median 65% https://airbtics.com/top-airbnb-listings-in-miami-united-states/",
    note: "Four providers, four numbers. The spread is the honest answer." },
  referenceRate: { value: "$140 per night base rate, 1BR", kind: "derived", asOf: "2026",
    source: "1BR annual revenue $23k-$39k (Rabbu, BNBCalc https://www.bnbcalc.com/markets/us/miami-fl) at ~58% occupancy implies roughly $110-$185; RedAwning lists $133 for 1BR https://www.redawning.com/pm/airbnb-management-cities/miami-florida",
    note: "Set at $140 so simulated annual revenue stays inside the sourced $23k-$39k range on every test seed; $150 pushed one seed to $40k. All-sizes ADR is much higher ($188-$267 depending on provider). Do not use that for a 1BR." },
  seasonality: { value: "booking demand peaks Mar, lowest Sep-Oct", kind: "derived", asOf: "2026",
    source: "Chalet: monthly occupancy from 50% (Oct) to 74% (Mar). BNBCalc monthly revenue order.",
    note: "Only the two end points are sourced. Months in between are interpolated." },
  rateSeasonality: { value: "peak Dec-Feb about 1.33x, low months about 0.74x", kind: "derived", asOf: "2026",
    source: "Chalet: ADR $156 low season, $282 peak (Dec-Feb), $212 average.",
    note: "Which months count as low season is not stated per month; Aug-Oct assumed. March multiplier is estimated." },
  stayLength: { value: "5.6 nights average for a 1BR", kind: "sourced", asOf: "2026", source: "BNBCalc https://www.bnbcalc.com/markets/us/miami-fl" },
  cleaningFee: { value: "$107 per stay, 1BR", kind: "sourced", asOf: "2026", source: "BNBCalc https://www.bnbcalc.com/markets/us/miami-fl" },
  cleaningCost: { value: "$100 per turnover", kind: "estimated", asOf: "2026-11-12", source: "none", note: "What the operator pays the cleaner. Needs a real quote." },
  platformFee: { value: "15.5% of booking subtotal, cleaning fee included", kind: "sourced", asOf: "2026",
    source: "Hostfully https://www.hostfully.com/blog/airbnb-host-fees/ ; BNBCalc fee guide. Several secondary sources agree; Airbnb's own page not opened." },
  utilities: { value: "$265 per month", kind: "sourced", asOf: "2026", source: "rentcostcalc https://rentcostcalc.pages.dev/city-guides/miami-fl ($200 utilities + $65 internet)",
    note: "Low-quality single source, and a resident's usage, not a rental's." },
  licensing: { value: "$170 per year state license, $50 city Certificate of Use application", kind: "sourced", asOf: "2026",
    source: "AirROI regulations summary https://www.airroi.com/airbnb-data/united-states/florida/miami/regulations",
    note: "Folded into monthly other costs. Business Tax Receipt amount not found." },
  otherMonthly: { value: "$264 per month (insurance, software, supplies, licence share)", kind: "estimated", asOf: "2026-11-12", source: "none except the $14 licence share" },
  furnishing: { value: "$14,000, 5-year life", kind: "estimated", asOf: "2026-11-12", source: "none" },
  priceElasticity: { value: "1.8", kind: "estimated", asOf: "2026-11-12", source: "none", note: "How fast bookings fall as price rises. Needs real data." },
  bookingProbability: { value: "0.20 per vacant day", kind: "derived", asOf: "2026-11-12", source: "Solved so simulated occupancy lands on the 58% target given 5.5-night stays; checked by test." },
};

export const MIAMI_1BR: StrConfig = {
  seed: 1, months: 36,
  personalCashCents: 60_000_00, contributionCents: 25_000_00,
  furnishingCostCents: 14_000_00, furnishingLifeMonths: 60,
  securityDepositCents: 2_500_00,
  monthlyRentCents: 2_500_00, monthlyUtilitiesCents: 265_00, monthlyOtherCents: 264_00,
  nightlyRateCents: 140_00, referenceRateCents: 140_00, priceElasticity: 1.8,
  baseDailyBookingProb: 0.20,
  //            Jan   Feb   Mar   Apr   May   Jun   Jul   Aug   Sep   Oct   Nov   Dec
  seasonality: [1.08, 1.12, 1.28, 1.05, 0.95, 0.95, 0.97, 0.90, 0.86, 0.86, 0.95, 1.10],
  rateSeasonality: [1.33, 1.33, 1.15, 1.0, 1.0, 0.9, 0.9, 0.74, 0.74, 0.74, 1.0, 1.33],
  maxStayNights: 10, // uniform 1-10 nights, mean 5.5, against a sourced 5.6
  cleaningFeeCents: 107_00, cleaningCostCents: 100_00, platformFeePct: 15.5,
};

/**
 * Regulatory gate, City of Miami only (not Miami Beach, not unincorporated Miami-Dade).
 * Source: City rule as summarized by AirROI and 19pine, 2026: single-family homes and duplexes in T3 and T4-R
 * transect zones are not eligible for short-term rental use. Not legal advice; confirm with the Zoning Department.
 */
export function miamiStrEligibility(unit: { transectZone: string; buildingType: "single_family" | "duplex" | "condo" | "apartment"; associationAllowsShortStays: boolean }) {
  const zone = unit.transectZone.toUpperCase();
  if ((zone === "T3" || zone === "T4-R") && (unit.buildingType === "single_family" || unit.buildingType === "duplex"))
    return { eligible: false, reason: "Single-family homes and duplexes in T3 and T4-R zones are not eligible for short-term rental use in the City of Miami." };
  if (!unit.associationAllowsShortStays)
    return { eligible: false, reason: "The building's association does not allow short stays. Zoning approval does not override the association's rules." };
  return { eligible: true, reason: "Eligible on zoning and association rules. Still needs a state vacation rental license, a city Certificate of Use and a Business Tax Receipt before listing." };
}
