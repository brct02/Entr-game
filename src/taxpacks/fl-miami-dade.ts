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
    preparedFoodAndDrinkTaxable: src(1, "https://www.law.cornell.edu/regulations/florida/Fla-Admin-Code-Ann-R-12A-1-011", "rule text as published",
      false, "Rule 12A-1.011(4)(b): food prepared and sold for immediate consumption is taxable. Restaurants are covered in Rule 12A-1.0115, which was not opened."),
    packagedGroceriesTaxable: src(0, "https://www.floridasalestax.com/taas/taa-12a-028-sale-of-bankery-products/", "Dec 2012 advisement",
      false, "Dept. of Revenue advisement TAA 12A-028: coffee beans, ground coffee and K-cups are exempt food products. Rule 12A-1.011(2)(a)7 lists coffee as exempt."),
    commercialRentSalesTaxPct: src(0, "https://floridarevenue.com/taxes/tips/Documents/TIP_25A01-04.pdf", "repealed 1 Oct 2025", true),
    unemploymentNewEmployerPct: src(2.7, "https://floridarevenue.com/taxes/taxesfees/Pages/rt_rate.aspx", "2026", true),
    unemploymentWageBaseCents: src(7_000_00, "https://netchex.com/resources/tax-guide/florida/", "2026"),
    minimumWageCentsPerHour: src(15_00, "https://www.niural.com/blog/hiring-in-florida-minimum-wage-and-employment-guide", "from 30 Sep 2026"),
    lodgingTaxTotalPct: src(13, "https://www.bnbcalc.com/blog/short-term-rental-regulation/miami-florida-guide", "2026", false, "Combined state and local taxes on short stays in the City of Miami"),
    countyBusinessTaxCentsPerYear: src(45_00, "https://www.mdctaxcollector.gov/categories-e-g", "read 12 Nov 2026",
      true, "Eating establishment inside a city, 1 to 30 seats. $90 for 31-74 seats, $135 for 75-149, $180 for 150 or more. Read from the search result; the page itself would not load."),
    cityBusinessTaxCentsPerYear: { value: 100_00, kind: "assumed", source: "", official: false, asOf: "2026-11-12",
      note: "Set at $100 by Chris Turney on 12 Nov 2026 as a working figure, not a sourced one. City of Miami requires its own receipt as well as the county's. The real amount is set in City Code section 31-50, by seats for restaurants; it was not found. An AI search summary gave $55 to $150, but the city page it cited (Get a Business Tax Receipt) states no amounts, so it is not accepted." },
    certificateOfUseInitialCents: src(313_00, "https://www.miami.gov/Business-Licenses/Certificate-of-Use-and-Accessory-Use%E2%80%93-Application-Inspection-Fees", "read 12 Nov 2026",
      true, "City of Miami, commercial use, first 2,000 sq ft. The $50 application fee is credited toward it. $63 for each further 1,000 sq ft."),
    certificateOfUseAnnualCents: src(63_00, "https://www.miami.gov/files/assets/public/v/1/fs-exhibit-a-pz-chpts-2-23-62.pdf", "fee schedule adopted 23 Apr 2026",
      true, "City of Miami annual reinspection, commercial, 500 to under 2,500 sq ft. $50 under 500 sq ft; $75 for 2,500 to under 5,000. Late penalty 10% then 5% a month, capped at 25%."),
  },
};
