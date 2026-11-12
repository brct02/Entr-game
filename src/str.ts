// Headless short-term rental simulation (leased unit, operator furnishes and runs it).
// Daily tick. Every dollar goes through the ledger. No AI, no network, no clock.

import { Ledger, LedgerError, ownerContribution } from "./ledger.ts";
import { amortize, straightLine } from "./schedules.ts";
import { makeRng } from "./rng.ts";

export interface StrConfig {
  seed: number;
  months: number;
  personalCashCents: number;      // what the player has personally
  contributionCents: number;      // what they put into the business on day 0
  loan?: { principalCents: number; annualRatePct: number; months: number };
  furnishingCostCents: number;
  furnishingLifeMonths: number;
  securityDepositCents: number;
  monthlyRentCents: number;
  monthlyUtilitiesCents: number;
  monthlyOtherCents: number;      // insurance, software, supplies
  nightlyRateCents: number;       // the player's price
  referenceRateCents: number;     // what the market expects for this unit
  priceElasticity: number;        // how fast bookings fall as price rises above reference
  baseDailyBookingProb: number;   // chance a vacant day gets booked at the reference rate, average season
  seasonality: number[];          // 12 booking-demand multipliers, Jan..Dec
  rateSeasonality?: number[];     // 12 nightly-rate multipliers, Jan..Dec (market-wide seasonal pricing). Default: flat
  maxStayNights: number;
  cleaningFeeCents: number;       // charged to guest per stay; the platform fee applies to it too
  cleaningCostCents: number;      // paid to cleaner per stay
  platformFeePct: number;
}

export interface MonthResult { month: number; revenueCents: number; netIncomeCents: number; cashCents: number; occupancy: number; }

export interface StrResult {
  business: Ledger;
  person: Ledger;
  months: MonthResult[];
  insolventOnDay: number | null;
  insolventReason: string | null;
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // shortcut: no leap years; add when real dates matter

function businessLedger(): Ledger {
  return new Ledger("STR business", [
    { id: "cash", name: "Cash", type: "asset", isCash: true },
    { id: "security_deposit", name: "Security deposit", type: "asset" },
    { id: "furnishings", name: "Furnishings", type: "asset" },
    { id: "accum_depreciation", name: "Accumulated depreciation", type: "asset" }, // contra: carries a negative balance
    { id: "loan_payable", name: "Loan payable", type: "liability" },
    { id: "owner_equity", name: "Owner equity", type: "equity" },
    { id: "rental_revenue", name: "Rental revenue", type: "revenue" },
    { id: "cleaning_fee_revenue", name: "Cleaning fee revenue", type: "revenue" },
    { id: "rent", name: "Rent", type: "expense" },
    { id: "utilities", name: "Utilities", type: "expense" },
    { id: "other_operating", name: "Insurance, software, supplies", type: "expense" },
    { id: "platform_fees", name: "Platform fees", type: "expense" },
    { id: "cleaning", name: "Cleaning", type: "expense" },
    { id: "interest", name: "Interest", type: "expense" },
    { id: "depreciation", name: "Depreciation", type: "expense" },
  ]);
}

function personLedger(): Ledger {
  return new Ledger("Player", [
    { id: "cash", name: "Cash", type: "asset", isCash: true },
    { id: "investment_in_business", name: "Investment in business", type: "asset" },
    { id: "opening_equity", name: "Opening net worth", type: "equity" },
  ]);
}

export function runStr(cfg: StrConfig): StrResult {
  if (cfg.seasonality.length !== 12) throw new Error("seasonality needs 12 values");
  const rng = makeRng(cfg.seed);
  const biz = businessLedger();
  const person = personLedger();
  const months: MonthResult[] = [];
  const result: StrResult = { business: biz, person, months, insolventOnDay: null, insolventReason: null };

  const loan = cfg.loan ? amortize(cfg.loan.principalCents, cfg.loan.annualRatePct, cfg.loan.months) : [];
  const depreciation = straightLine(cfg.furnishingCostCents, 0, cfg.furnishingLifeMonths);

  let day = 0;
  try {
    // Day 0: fund, borrow, furnish, pay the deposit.
    person.post({ day, memo: "Opening balance", flow: "financing",
      lines: [{ account: "cash", debit: cfg.personalCashCents }, { account: "opening_equity", credit: cfg.personalCashCents }] });
    ownerContribution(person, biz, day, cfg.contributionCents);
    if (cfg.loan) biz.post({ day, memo: "Loan proceeds", flow: "financing",
      lines: [{ account: "cash", debit: cfg.loan.principalCents }, { account: "loan_payable", credit: cfg.loan.principalCents }] });
    biz.post({ day, memo: "Buy furnishings", flow: "investing",
      lines: [{ account: "furnishings", debit: cfg.furnishingCostCents }, { account: "cash", credit: cfg.furnishingCostCents }] });
    biz.post({ day, memo: "Security deposit", flow: "investing",
      lines: [{ account: "security_deposit", debit: cfg.securityDepositCents }, { account: "cash", credit: cfg.securityDepositCents }] });

    let nightsLeft = 0;
    for (let m = 0; m < cfg.months; m++) {
      const monthStart = day;
      const calMonth = m % 12;
      let occupiedNights = 0;

      // First of the month: fixed costs and debt service.
      const fixed: [string, string, number][] = [
        ["rent", "Rent", cfg.monthlyRentCents],
        ["utilities", "Utilities", cfg.monthlyUtilitiesCents],
        ["other_operating", "Insurance, software, supplies", cfg.monthlyOtherCents],
      ];
      for (const [account, memo, cents] of fixed)
        if (cents > 0) biz.post({ day, memo, flow: "operating", lines: [{ account, debit: cents }, { account: "cash", credit: cents }] });
      const pay = loan[m];
      if (pay) {
        if (pay.interest > 0) biz.post({ day, memo: "Loan interest", flow: "operating",
          lines: [{ account: "interest", debit: pay.interest }, { account: "cash", credit: pay.interest }] });
        if (pay.principal > 0) biz.post({ day, memo: "Loan principal", flow: "financing",
          lines: [{ account: "loan_payable", debit: pay.principal }, { account: "cash", credit: pay.principal }] });
      }

      const season = cfg.seasonality[calMonth];
      const nightly = Math.round(cfg.nightlyRateCents * (cfg.rateSeasonality?.[calMonth] ?? 1));
      const bookingProb = Math.min(0.95, Math.max(0,
        cfg.baseDailyBookingProb * season * Math.pow(cfg.nightlyRateCents / cfg.referenceRateCents, -cfg.priceElasticity)));

      for (let d = 0; d < MONTH_DAYS[calMonth]; d++, day++) {
        if (nightsLeft === 0 && rng() < bookingProb) {
          nightsLeft = 1 + Math.floor(rng() * cfg.maxStayNights);
          if (cfg.cleaningFeeCents > 0) {
            const fee = Math.round((cfg.cleaningFeeCents * cfg.platformFeePct) / 100);
            biz.post({ day, memo: "Cleaning fee collected", flow: "operating", lines: [
              { account: "cash", debit: cfg.cleaningFeeCents - fee },
              { account: "platform_fees", debit: fee },
              { account: "cleaning_fee_revenue", credit: cfg.cleaningFeeCents },
            ] });
          }
        }
        if (nightsLeft > 0) {
          // shortcut: cash arrives nightly; real platforms pay out after check-in. Fix when payout timing is modeled.
          const gross = nightly;
          const fee = Math.round((gross * cfg.platformFeePct) / 100);
          biz.post({ day, memo: "Guest night", flow: "operating", lines: [
            { account: "cash", debit: gross - fee },
            { account: "platform_fees", debit: fee },
            { account: "rental_revenue", credit: gross },
          ] });
          occupiedNights++;
          nightsLeft--;
          if (nightsLeft === 0 && cfg.cleaningCostCents > 0) biz.post({ day, memo: "Turnover cleaning", flow: "operating",
            lines: [{ account: "cleaning", debit: cfg.cleaningCostCents }, { account: "cash", credit: cfg.cleaningCostCents }] });
        }
      }

      // Month-end close: depreciation, then check the books.
      const lastDay = day - 1;
      const dep = depreciation[m];
      if (dep) biz.post({ day: lastDay, memo: "Depreciation", flow: "operating",
        lines: [{ account: "depreciation", debit: dep }, { account: "accum_depreciation", credit: dep }] });
      if (!biz.balanceSheet().balanced || !person.balanceSheet().balanced) throw new Error("books out of balance");
      const is = biz.incomeStatement(monthStart, lastDay);
      months.push({ month: m + 1, revenueCents: is.totalRevenue, netIncomeCents: is.netIncome,
        cashCents: biz.cash(), occupancy: occupiedNights / MONTH_DAYS[calMonth] });
    }
  } catch (e) {
    if (!(e instanceof LedgerError)) throw e;
    result.insolventOnDay = day;
    result.insolventReason = e.message;
  }
  return result;
}

/** Placeholder assumptions for one leased 1-bedroom. NOT calibrated to any market. Replace with a sourced market pack. */
export const PLACEHOLDER_UNIT: StrConfig = {
  seed: 1, months: 36,
  personalCashCents: 40_000_00, contributionCents: 15_000_00,
  loan: { principalCents: 10_000_00, annualRatePct: 11, months: 36 },
  furnishingCostCents: 14_000_00, furnishingLifeMonths: 60,
  securityDepositCents: 2_600_00,
  monthlyRentCents: 2_600_00, monthlyUtilitiesCents: 280_00, monthlyOtherCents: 220_00,
  nightlyRateCents: 185_00, referenceRateCents: 185_00, priceElasticity: 1.8,
  baseDailyBookingProb: 0.42,
  seasonality: [1.25, 1.3, 1.3, 1.1, 0.9, 0.8, 0.8, 0.75, 0.7, 0.85, 1.0, 1.2],
  maxStayNights: 5, cleaningFeeCents: 120_00, cleaningCostCents: 110_00, platformFeePct: 15,
};
