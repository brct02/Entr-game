// Market pack: Miami-Dade, independent coffee shop. Captured 2026-11-12 from web search results.
// "sourced" = a published figure; "estimated" = my figure, no source found; "derived" = computed from sourced figures.

import type { CoffeeConfig, CoffeeLocation } from "../coffee.ts";
import type { Provenance } from "./miami.ts";
import { taxValue } from "../taxpack.ts";
import { FL_MIAMI_DADE_2026 as TAX } from "../taxpacks/fl-miami-dade.ts";

// Local taxes come only from the tax pack. If an item there is unknown, this line stops instead of guessing.
const t = (key: Parameters<typeof taxValue>[1]) => taxValue(TAX, key, 2026);
const SALES_TAX_PCT = t("preparedFoodAndDrinkTaxable") === 1 ? t("salesTaxStatePct") + t("salesTaxLocalPct") : 0;

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
  startup: { value: "buildout $60,000, equipment $40,000, licenses $4,000", kind: "sourced", asOf: "2026",
    source: "Published ranges: buildout $20k-$90k-$350k, equipment $20k-$60k-$150k, licenses $2k-$8k; small shops total $80k-$150k (risingsunartscentre.org guide, howmuchtostartabusiness.com).",
    note: "Low-quality secondary sources. Picked so the total lands inside the $80k-$150k range for a small shop." },
  cart: { value: "$20,000 cart", kind: "sourced", asOf: "2026", source: "Cart or kiosk $15k-$40k (howmuchtostartabusiness.com); kiosk or pop-up $25k-$75k (joe.coffee)" },
  cartTrading: { value: "cart gets 30% of a shop's customers on the same spot, $6.50 ticket, $60 a day pitch fee", kind: "estimated", asOf: "2026-11-12", source: "none" },
  overheads: { value: "utilities $900, insurance $300, marketing $600, supplies and other $900 a month", kind: "sourced", asOf: "2026",
    source: "Bellwether example P&L for a $30,000-a-month shop https://bellwethercoffee.com/blog/coffee-shop-profit-margins", note: "One example shop, not a Miami figure." },
  benchmarks: { value: "labor about 30% of sales; healthy net margin 5-15%; industry average 4-5%", kind: "sourced", asOf: "2026",
    source: "Bellwether; timetackle.com citing IBISWorld-based analysis", note: "Used to check results, not as inputs." },
  passThrough: { value: "$9 per sq ft per year on top of base rent", kind: "sourced", asOf: "2026",
    source: "Two Miami listings: a Crexi listing quoting a CAM estimate of $9.06 per sq ft, and a LoopNet listing quoting about $500 a month on 850 sq ft",
    note: "Two listings, not a market average. Applied to all three locations; prime locations likely run higher." },
  manager: { value: "$70,000 a year", kind: "sourced", asOf: "2023-2025",
    source: "Salary.com Miami coffee house manager average $78,645 (Mar 2025) https://www.salary.com/research/salary/position/coffee-house-manager-salary/miami-fl ; Comparably $62,058 (Nov 2023); postings at $62,918 and $70,907",
    note: "Sources disagree by about $17,000. $70,000 sits between them." },
  payrollBurden: { value: "10% of wages", kind: "derived", asOf: "2026",
    source: "FICA 7.65%; Florida reemployment tax 2.7% on the first $7,000 per employee for new employers (Florida Dept. of Revenue https://floridarevenue.com/taxes/taxesfees/Pages/rt_rate.aspx), which is under 1% of a typical barista's yearly pay",
    note: "The remaining 1.5% is an estimate for workers' comp and federal unemployment tax; no source found." },
  repairs: { value: "2% of sales", kind: "sourced", asOf: "undated",
    source: "National Restaurant Association average of about 1.5% of sales as reported by FSR Magazine; ResQ puts restaurants at 3-4%", note: "Restaurant figures, not coffee-shop figures." },
  sCorpAdmin: { value: "$2,500 a year for payroll service and the extra tax return", kind: "sourced", asOf: "2026",
    source: "Published ranges of $1,500-$4,000 a year (jupid.com S corp guide, uplinq.com); individual guides quote $2,400-$4,000" },
  employmentTax: { value: "self-employment tax 15.3% on 92.35% of profit; Social Security part stops at $184,500 of earnings", kind: "sourced", asOf: "tax year 2026",
    source: "2026 Social Security wage base of $184,500 and unchanged FICA rates, per payroll guides read today; the 92.35% factor is from general knowledge",
    note: "Income tax, the half-of-SE-tax deduction and the qualified business income deduction are not modeled." },
  localTaxes: { value: "7% sales tax on tickets, $313 certificate of use then $63 a year reinspection, $45 a year county business tax", kind: "sourced", asOf: "tax year 2026",
    source: "src/taxpacks/fl-miami-dade.ts, which carries a link for each figure",
    note: "The City of Miami's own business tax is unknown and is not charged. Bags of beans would be exempt from sales tax; the shop does not sell them yet." },
  waste: { value: "2% of tickets", kind: "estimated", asOf: "2026-11-12", source: "none" },
  ownerPersonal: { value: "job take-home $3,800 a month, living costs $4,000 a month", kind: "estimated", asOf: "2026-11-12", source: "none", note: "Placeholders until the personal-finance layer is sourced." },
  everythingElse: { value: "price elasticity 1.2, opening awareness 35%, 120-day ramp, weekday pattern, daypart split 50/30/20, 30 tickets per person-hour, 5-day shelf life, 2.9% card fee, 60-day buildout, 2-month deposit, loan at 10.5% over 7 years",
    kind: "estimated", asOf: "2026-11-12", source: "none" },
};

export const MIAMI_COFFEE_LOCATIONS: Record<"value" | "average" | "prime", CoffeeLocation> = {
  value:   { name: "Lower-rent Miami submarket", rentPerSqFtYearCents: 31_92, sqFt: 1000, matureDailyCustomers: 150, passThroughPerSqFtYearCents: 9_00 },
  average: { name: "County-average rent",        rentPerSqFtYearCents: 50_27, sqFt: 1000, matureDailyCustomers: 190, passThroughPerSqFtYearCents: 9_00 },
  prime:   { name: "Miami Beach",                rentPerSqFtYearCents: 97_85, sqFt: 1000, matureDailyCustomers: 300, passThroughPerSqFtYearCents: 9_00 },
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
  staffPerDaypart: [3, 2, 2], ownerOnBar: [0, 0, 0], wageCentsPerHour: 16_50, payrollTaxPct: 10, drinksPerPersonHour: 30,
  unitCostCents: 2_54, shelfLifeDays: 5, parDays: 2,
  monthlyUtilitiesCents: 900_00, monthlyInsuranceCents: 300_00, monthlyMarketingCents: 600_00, monthlyOtherCents: 900_00,
  cardFeePct: 2.9, repairsPctOfSales: 2, wastePct: 2,
  salesTaxPct: SALES_TAX_PCT, certificateOfUseCents: t("certificateOfUseInitialCents"), countyBusinessTaxCentsPerYear: t("countyBusinessTaxCentsPerYear"),
  certificateOfUseAnnualCents: t("certificateOfUseAnnualCents"),
  management: "owner", managerSalaryCentsPerYear: 70_000_00, minCashAfterDrawCents: 15_000_00,
  jobNetMonthlyCents: 3_800_00, personalMonthlyExpensesCents: 4_000_00,
  entity: "pass_through", sCorpAdminMonthlyCents: 208_00,
};
