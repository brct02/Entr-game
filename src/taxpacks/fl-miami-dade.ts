import type { TaxPack } from "../taxpack.ts";

// Researched 2026-11-12 from web search results. Only one item comes from a government page read today,
// so this pack is provisional until a person checks it against the official sources.
const src = (value: number, source: string, asOf: string, official = false, note?: string) =>
  ({ value, kind: "sourced" as const, source, official, asOf, note });

export const FL_MIAMI_DADE_2026: TaxPack = {
  jurisdiction: { state: "FL", county: "Miami-Dade", city: "Miami" },
  taxYear: 2026, capturedOn: "2026-11-12", reviewedByHuman: false,
  items: {
    stateIndividualIncomeTaxTopPct: src(0, "https://taxfoundation.org/statetaxindex/states/Florida/", "2026"),
    stateCorporateIncomeTaxPct: src(5.5, "https://taxfoundation.org/statetaxindex/states/Florida/", "2026", false, "C corporations only"),
    corporateIncomeTaxExemptionCents: src(50_000_00, "https://quickbooks.intuit.com/r/florida/business-tax-guide-florida/", "2026"),
    sCorpPaysStateIncomeTax: src(0, "https://unclekam.com/tax-strategy-blog/florida-s-corp-taxes-2026-the-complete-owners-guide-to-savings/", "2026", false, "Generally exempt"),
    salesTaxStatePct: src(6, "https://www.floridasalestax.com/florida-tax-law-blog/2026/august/florida-county-surtax-rates-for-2026-the-complet/", "2026"),
    salesTaxLocalPct: src(1, "https://trykintsugi.com/sales-tax-guides/usa/florida/miami-dade-county", "Sep 2026", false, "County surtax; Florida cities add none"),
    preparedFoodAndDrinkTaxable: { value: null, kind: "unknown", source: "", official: false, asOf: "", note: "Not confirmed today from a source. Groceries are exempt; whether a cafe's drinks are taxed needs the Department of Revenue's rule." },
    commercialRentSalesTaxPct: src(0, "https://floridarevenue.com/taxes/tips/Documents/TIP_25A01-04.pdf", "repealed 1 Oct 2025", true),
    unemploymentNewEmployerPct: src(2.7, "https://floridarevenue.com/taxes/taxesfees/Pages/rt_rate.aspx", "2026", true),
    unemploymentWageBaseCents: src(7_000_00, "https://netchex.com/resources/tax-guide/florida/", "2026"),
    minimumWageCentsPerHour: src(15_00, "https://www.niural.com/blog/hiring-in-florida-minimum-wage-and-employment-guide", "from 30 Sep 2026"),
    lodgingTaxTotalPct: src(13, "https://www.bnbcalc.com/blog/short-term-rental-regulation/miami-florida-guide", "2026", false, "Combined state and local taxes on short stays in the City of Miami"),
    localBusinessLicenseCentsPerYear: { value: null, kind: "unknown", source: "", official: false, asOf: "", note: "City and county business tax receipt amounts not found." },
  },
};
