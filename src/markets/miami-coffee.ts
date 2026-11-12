// Market pack: Miami-Dade, independent coffee shop. Captured 2026-11-12 from web search results.
// "sourced" = a published figure; "estimated" = my figure, no source found; "derived" = computed from sourced figures.

import type { CoffeeConfig, CoffeeLocation } from "../coffee.ts";
import type { Provenance } from "./miami.ts";

export const MIAMI_COFFEE_PROVENANCE: Record<string, Provenance> = {
  retailRent: { value: "$31.92 (Miami submarket, lowest), $50.27 (county average), $97.85 (Miami Beach, highest) per sq ft per year", kind: "sourced", asOf: "Q3 2026",
    source: "Cushman & Wakefield Miami Retail MarketBeat https://www.cushmanwakefield.com/en/united-states/insights/us-marketbeats/miami-marketbeats/retail",
    note: "Other brokers put the county average lower: Lee & Associates $44.34 NNN (Q3 2026), Colliers $42.50 (Q2 2026). Pass-through charges on top of base rent are not modeled." },
  shopSize: { value: "1,000 sq ft", kind: "sourced", asOf: "2026", source: "howmuchtostartabusiness.com assumes a 1,000-2,000 sq ft storefront; joe.coffee calculator defaults to 800" },
  dailyCustomers: { value: "150 / 190 / 300 a day at maturity for the three locations", kind: "estimated", asOf: "2026-11-12",
    source: "Placed inside published ranges: small independents 150-250 a day, average urban shops 250-400 (dojobusiness.com). No source ties customer counts to a specific Miami block or rent level.",
    note: "This is the number that decides everything and it is a guess. The link between rent and foot traffic is assumed." },
  ticket: { value: "$8.47 average ticket at independent shops", kind: "sourced", asOf: "2026", source: "joe.coffee industry trends https://joe.coffee/coffee-industry-trends/",
    note: "Single source. Other guides give $7-$12 for a healthy specialty shop." },
  cogs: { value: "30% of sales, so $2.54 per ticket", kind: "sourced", asOf: "2026", source: "Bellwether benchmark https://bellwethercoffee.com/blog/coffee-shop-profit-margins (gross margin 65-75%)",
    note: "Franchise disclosure data runs nearer 40% (sharpsheets.io)." },
  wage: { value: "$16.50 an hour before tips", kind: "sourced", asOf: "mid 2026", source: "Miami barista postings at $16-$19 (CareerBuilder, Snagajob $16.75).",
    note: "BLS median for the wider counter-worker group in Miami is $14.23 (May 2025), which predates Florida's move to a $15 minimum; that date is from general knowledge, not checked today." },
  payrollTax: { value: "7.65% employer share", kind: "sourced", asOf: "current law", source: "Social Security 6.2% plus Medicare 1.45%; from general knowledge, not checked today. Unemployment insurance and workers' comp not modeled." },
  startup: { value: "buildout $60,000, equipment $40,000, licenses $4,000", kind: "sourced", asOf: "2026",
    source: "Published ranges: buildout $20k-$90k-$350k, equipment $20k-$60k-$150k, licenses $2k-$8k; small shops total $80k-$150k (risingsunartscentre.org guide, howmuchtostartabusiness.com).",
    note: "Low-quality secondary sources. Picked so the total lands inside the $80k-$150k range for a small shop." },
  cart: { value: "$20,000 cart", kind: "sourced", asOf: "2026", source: "Cart or kiosk $15k-$40k (howmuchtostartabusiness.com); kiosk or pop-up $25k-$75k (joe.coffee)" },
  cartTrading: { value: "cart gets 30% of a shop's customers on the same spot, $6.50 ticket, $60 a day pitch fee", kind: "estimated", asOf: "2026-11-12", source: "none" },
  overheads: { value: "utilities $900, insurance $300, marketing $600, supplies and other $900 a month", kind: "sourced", asOf: "2026",
    source: "Bellwether example P&L for a $30,000-a-month shop https://bellwethercoffee.com/blog/coffee-shop-profit-margins", note: "One example shop, not a Miami figure." },
  benchmarks: { value: "labor about 30% of sales; healthy net margin 5-15%; industry average 4-5%", kind: "sourced", asOf: "2026",
    source: "Bellwether; timetackle.com citing IBISWorld-based analysis", note: "Used to check results, not as inputs." },
  everythingElse: { value: "price elasticity 1.2, opening awareness 35%, 120-day ramp, weekday pattern, daypart split 50/30/20, 30 tickets per person-hour, 5-day shelf life, 2.9% card fee, 60-day buildout, 2-month deposit, loan at 10.5% over 7 years",
    kind: "estimated", asOf: "2026-11-12", source: "none" },
};

export const MIAMI_COFFEE_LOCATIONS: Record<"value" | "average" | "prime", CoffeeLocation> = {
  value:   { name: "Lower-rent Miami submarket", rentPerSqFtYearCents: 31_92, sqFt: 1000, matureDailyCustomers: 150 },
  average: { name: "County-average rent",        rentPerSqFtYearCents: 50_27, sqFt: 1000, matureDailyCustomers: 190 },
  prime:   { name: "Miami Beach",                rentPerSqFtYearCents: 97_85, sqFt: 1000, matureDailyCustomers: 300 },
};

export const MIAMI_COFFEE: CoffeeConfig = {
  seed: 1, months: 36,
  personalCashCents: 90_000_00, contributionCents: 70_000_00,
  loan: { principalCents: 100_000_00, annualRatePct: 10.5, months: 84 },
  cartMonths: 0, openShop: true, location: MIAMI_COFFEE_LOCATIONS.average,
  cartCostCents: 20_000_00, cartDailyFeeCents: 60_00, cartCaptureShare: 0.3, cartTicketCents: 6_50,
  depositMonths: 2, freeRentMonths: 0, buildoutCostCents: 60_000_00, buildoutDays: 60,
  equipmentCostCents: 40_000_00, licensesCents: 4_000_00, leaseTermMonths: 60, equipmentLifeMonths: 84,
  ticketCents: 8_47, referenceTicketCents: 8_47, priceElasticity: 1.2,
  startingAwareness: 0.35, awarenessDays: 120,
  dayOfWeek: [1.0, 1.0, 1.0, 1.0, 1.05, 1.15, 0.9], daypartShare: [0.5, 0.3, 0.2], hoursPerDaypart: 4,
  staffPerDaypart: [3, 2, 2], ownerOnBar: [0, 0, 0], wageCentsPerHour: 16_50, payrollTaxPct: 7.65, drinksPerPersonHour: 30,
  unitCostCents: 2_54, shelfLifeDays: 5, parDays: 2,
  monthlyUtilitiesCents: 900_00, monthlyInsuranceCents: 300_00, monthlyMarketingCents: 600_00, monthlyOtherCents: 900_00,
  cardFeePct: 2.9,
};
