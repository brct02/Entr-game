// Headless coffee shop simulation. Daily tick, three dayparts, every dollar through the ledger.
// Two ways in: start with a cart (cheap, and it tells you how busy the spot is), or sign a lease straight away.

import { Ledger, LedgerError, ownerContribution } from "./ledger.ts";
import { amortize, straightLine } from "./schedules.ts";
import { makeRng } from "./rng.ts";

export interface CoffeeLocation {
  name: string;
  rentPerSqFtYearCents: number;
  sqFt: number;
  matureDailyCustomers: number; // walk-in customers per day at the reference ticket once the shop is known
}

export interface CoffeeConfig {
  seed: number;
  months: number;
  personalCashCents: number;
  contributionCents: number;
  loan?: { principalCents: number; annualRatePct: number; months: number }; // drawn when the lease is signed

  // Route. cartMonths = 0 skips the cart. openShop = false means the player stays a cart.
  cartMonths: number;
  openShop: boolean;
  location: CoffeeLocation;

  // Cart
  cartCostCents: number;
  cartDailyFeeCents: number;     // pitch or permit fee per trading day
  cartCaptureShare: number;      // cart customers as a share of what a shop on that spot would get
  cartTicketCents: number;

  // Lease and opening
  depositMonths: number;
  freeRentMonths: number;
  buildoutCostCents: number;
  buildoutDays: number;          // rent runs during buildout unless free rent covers it
  equipmentCostCents: number;
  licensesCents: number;
  leaseTermMonths: number;       // buildout is depreciated over the lease
  equipmentLifeMonths: number;

  // Menu and demand
  ticketCents: number;           // the player's average ticket
  referenceTicketCents: number;  // what the market expects
  priceElasticity: number;
  startingAwareness: number;     // share of mature demand on opening day
  awarenessDays: number;         // days for awareness to close about two thirds of the gap
  dayOfWeek: number[];           // 7 multipliers, day 0 is a Monday
  daypartShare: number[];        // 3 shares of the day's customers: morning, midday, afternoon
  hoursPerDaypart: number;

  // Staff
  staffPerDaypart: number[];     // people on the floor
  ownerOnBar: number[];          // how many of those are the unpaid owner (0 or 1 each)
  wageCentsPerHour: number;
  payrollTaxPct: number;
  drinksPerPersonHour: number;

  // Stock
  unitCostCents: number;         // ingredients and packaging per ticket
  shelfLifeDays: number;
  parDays: number;               // order up to this many days of expected sales

  // Running costs while open
  monthlyUtilitiesCents: number;
  monthlyInsuranceCents: number;
  monthlyMarketingCents: number;
  monthlyOtherCents: number;
  cardFeePct: number;
}

export type Phase = "cart" | "buildout" | "open" | "idle";
export interface CoffeeMonth {
  month: number; phase: Phase; customersPerDay: number; revenueCents: number; netIncomeCents: number;
  cashCents: number; walkouts: number; spoilageCents: number;
}
export interface CoffeeResult {
  business: Ledger; person: Ledger; months: CoffeeMonth[];
  cart: { days: number; avgDailyCustomers: number } | null;
  failedOnDay: number | null; failedPhase: Phase | null; failedReason: string | null;
}

const MONTH_DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function ledgers() {
  const business = new Ledger("Coffee business", [
    { id: "cash", name: "Cash", type: "asset", isCash: true },
    { id: "inventory", name: "Inventory", type: "asset" },
    { id: "security_deposit", name: "Security deposit", type: "asset" },
    { id: "buildout", name: "Leasehold improvements", type: "asset" },
    { id: "equipment", name: "Equipment", type: "asset" },
    { id: "accum_depreciation", name: "Accumulated depreciation", type: "asset" },
    { id: "wages_payable", name: "Wages payable", type: "liability" },
    { id: "loan_payable", name: "Loan payable", type: "liability" },
    { id: "owner_equity", name: "Owner equity", type: "equity" },
    { id: "sales", name: "Sales", type: "revenue" },
    { id: "cogs", name: "Cost of goods sold", type: "expense" },
    { id: "spoilage", name: "Spoilage", type: "expense" },
    { id: "wages", name: "Wages", type: "expense" },
    { id: "payroll_tax", name: "Payroll tax", type: "expense" },
    { id: "rent", name: "Rent", type: "expense" },
    { id: "utilities", name: "Utilities", type: "expense" },
    { id: "insurance", name: "Insurance", type: "expense" },
    { id: "marketing", name: "Marketing", type: "expense" },
    { id: "other_operating", name: "Supplies and other", type: "expense" },
    { id: "card_fees", name: "Card fees", type: "expense" },
    { id: "licenses", name: "Licenses and permits", type: "expense" },
    { id: "pitch_fees", name: "Cart pitch fees", type: "expense" },
    { id: "interest", name: "Interest", type: "expense" },
    { id: "depreciation", name: "Depreciation", type: "expense" },
  ]);
  const person = new Ledger("Player", [
    { id: "cash", name: "Cash", type: "asset", isCash: true },
    { id: "investment_in_business", name: "Investment in business", type: "asset" },
    { id: "opening_equity", name: "Opening net worth", type: "equity" },
  ]);
  return { business, person };
}

export function runCoffee(cfg: CoffeeConfig): CoffeeResult {
  const rng = makeRng(cfg.seed);
  const { business: biz, person } = ledgers();
  const months: CoffeeMonth[] = [];
  const result: CoffeeResult = { business: biz, person, months, cart: null, failedOnDay: null, failedPhase: null, failedReason: null };

  // A count of customers around an expected value: real chance, not the average every day.
  const draw = (mean: number) => {
    if (mean <= 0) return 0;
    const z = Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
    return Math.max(0, Math.round(mean + Math.sqrt(mean) * z));
  };
  const pay = (day: number, account: string, memo: string, cents: number, flow: "operating" | "investing" | "financing" = "operating") => {
    if (cents > 0) biz.post({ day, memo, flow, lines: [{ account, debit: cents }, { account: "cash", credit: cents }] });
  };
  const sale = (day: number, customers: number, ticket: number) => {
    if (customers === 0) return;
    const gross = customers * ticket;
    const fee = Math.round((gross * cfg.cardFeePct) / 100);
    biz.post({ day, memo: `${customers} tickets`, flow: "operating",
      lines: [{ account: "cash", debit: gross - fee }, { account: "card_fees", debit: fee }, { account: "sales", credit: gross }] });
  };

  const cartDays = cfg.cartMonths * 30;
  const monthlyRent = Math.round((cfg.location.rentPerSqFtYearCents * cfg.location.sqFt) / 12);
  const loan = cfg.loan ? amortize(cfg.loan.principalCents, cfg.loan.annualRatePct, cfg.loan.months) : [];
  const depreciation: { schedule: number[]; start: number }[] = [];

  let day = 0;
  let phase: Phase = cartDays > 0 ? "cart" : cfg.openShop ? "buildout" : "idle";
  let leaseSignedDay = -1, leaseMonth = 0, openDay = -1;
  let cartCustomers = 0, cartTraded = 0;
  let batches: { units: number; day: number }[] = [];
  let recentDemand: number[] = [];
  let reputation = 1;

  const signLease = () => {
    leaseSignedDay = day;
    if (cfg.loan) biz.post({ day, memo: "Loan proceeds", flow: "financing",
      lines: [{ account: "cash", debit: cfg.loan.principalCents }, { account: "loan_payable", credit: cfg.loan.principalCents }] });
    pay(day, "security_deposit", "Lease security deposit", monthlyRent * cfg.depositMonths, "investing");
    pay(day, "buildout", "Buildout", cfg.buildoutCostCents, "investing");
    pay(day, "equipment", "Equipment", cfg.equipmentCostCents, "investing");
    pay(day, "licenses", "Licenses and permits", cfg.licensesCents);
  };

  try {
    person.post({ day, memo: "Opening balance", flow: "financing",
      lines: [{ account: "cash", debit: cfg.personalCashCents }, { account: "opening_equity", credit: cfg.personalCashCents }] });
    ownerContribution(person, biz, day, cfg.contributionCents);
    if (phase === "cart") {
      pay(day, "equipment", "Coffee cart", cfg.cartCostCents, "investing");
      depreciation.push({ schedule: straightLine(cfg.cartCostCents, 0, 60), start: 0 });
    }

    for (let m = 0; m < cfg.months; m++) {
      const monthStart = day;
      const calMonth = m % 12;
      let customers = 0, walkouts = 0, spoiled = 0, tradedDays = 0;
      const phaseAtStart = phase;

      for (let d = 0; d < MONTH_DAYS[calMonth]; d++, day++) {
        // Phase changes happen at the start of a day.
        if (phase === "cart" && day >= cartDays) {
          result.cart = { days: cartTraded, avgDailyCustomers: cartCustomers / Math.max(1, cartTraded) };
          phase = cfg.openShop ? "buildout" : "cart";
        }
        if (phase === "buildout" && leaseSignedDay < 0) {
          signLease();
          depreciation.push({ schedule: straightLine(cfg.buildoutCostCents, 0, cfg.leaseTermMonths), start: m + 1 });
          depreciation.push({ schedule: straightLine(cfg.equipmentCostCents, 0, cfg.equipmentLifeMonths), start: m + 1 });
        }
        if (phase === "buildout" && day >= leaseSignedDay + cfg.buildoutDays) { phase = "open"; openDay = day; }

        // Monthly bills fall on the first day of each month.
        if (d === 0) {
          if (leaseSignedDay >= 0) {
            if (leaseMonth >= cfg.freeRentMonths) pay(day, "rent", "Rent", monthlyRent);
            const p = loan[leaseMonth];
            if (p) { pay(day, "interest", "Loan interest", p.interest); pay(day, "loan_payable", "Loan principal", p.principal, "financing"); }
            leaseMonth++;
          }
          if (phase === "open") {
            pay(day, "utilities", "Utilities", cfg.monthlyUtilitiesCents);
            pay(day, "insurance", "Insurance", cfg.monthlyInsuranceCents);
            pay(day, "marketing", "Marketing", cfg.monthlyMarketingCents);
            pay(day, "other_operating", "Supplies and other", cfg.monthlyOtherCents);
          }
        }

        const dow = cfg.dayOfWeek[day % 7];
        if (phase === "cart") {
          const n = draw(cfg.location.matureDailyCustomers * cfg.cartCaptureShare * dow);
          pay(day, "pitch_fees", "Cart pitch fee", cfg.cartDailyFeeCents);
          pay(day, "cogs", "Cart ingredients", n * cfg.unitCostCents);
          sale(day, n, cfg.cartTicketCents);
          cartCustomers += n; cartTraded++; customers += n; tradedDays++;
        } else if (phase === "open") {
          // Morning: throw out expired stock, then take delivery up to par.
          const expired = batches.filter(b => day - b.day >= cfg.shelfLifeDays).reduce((s, b) => s + b.units, 0);
          batches = batches.filter(b => day - b.day < cfg.shelfLifeDays);
          if (expired > 0) {
            biz.post({ day, memo: "Spoiled stock", flow: "operating",
              lines: [{ account: "spoilage", debit: expired * cfg.unitCostCents }, { account: "inventory", credit: expired * cfg.unitCostCents }] });
            spoiled += expired * cfg.unitCostCents;
          }
          const sinceOpen = day - openDay;
          const cartBoost = Math.min(0.3, cfg.cartMonths * 0.08); // a cart on the spot means people already know you
          const start = Math.min(1, cfg.startingAwareness + cartBoost);
          const awareness = 1 - (1 - start) * Math.exp(-sinceOpen / cfg.awarenessDays);
          const expected = cfg.location.matureDailyCustomers * awareness * reputation * dow *
            Math.pow(cfg.ticketCents / cfg.referenceTicketCents, -cfg.priceElasticity);
          const forecast = recentDemand.length ? recentDemand.reduce((a, b) => a + b, 0) / recentDemand.length : expected;
          let onHand = batches.reduce((s, b) => s + b.units, 0);
          const order = Math.max(0, Math.ceil(forecast * cfg.parDays) - onHand);
          if (order > 0) { pay(day, "inventory", "Stock delivery", order * cfg.unitCostCents); batches.push({ units: order, day }); onHand += order; }

          // Three dayparts: demand arrives, staff and stock limit what gets served.
          const demand = draw(expected);
          let served = 0, paidHours = 0, allotted = 0;
          for (let p = 0; p < 3; p++) {
            const want = p === 2 ? demand - allotted : Math.min(demand - allotted, Math.round(demand * cfg.daypartShare[p]));
            allotted += want;
            const capacity = cfg.staffPerDaypart[p] * cfg.drinksPerPersonHour * cfg.hoursPerDaypart;
            const got = Math.min(want, capacity, onHand - served);
            served += got;
            paidHours += Math.max(0, cfg.staffPerDaypart[p] - cfg.ownerOnBar[p]) * cfg.hoursPerDaypart;
          }
          const lost = demand - served;
          let toUse = served; // oldest stock first
          for (const b of batches) { const u = Math.min(b.units, toUse); b.units -= u; toUse -= u; }
          batches = batches.filter(b => b.units > 0);
          sale(day, served, cfg.ticketCents);
          if (served > 0) biz.post({ day, memo: "Cost of tickets sold", flow: "operating",
            lines: [{ account: "cogs", debit: served * cfg.unitCostCents }, { account: "inventory", credit: served * cfg.unitCostCents }] });
          const wages = paidHours * cfg.wageCentsPerHour;
          if (wages > 0) biz.post({ day, memo: "Wages earned", flow: "operating",
            lines: [{ account: "wages", debit: wages }, { account: "wages_payable", credit: wages }] });

          // Turning people away costs you later; a good run slowly earns it back.
          reputation = Math.max(0.7, Math.min(1, reputation + 0.003 * (1 - reputation) - 0.25 * (demand ? lost / demand : 0)));
          recentDemand = [...recentDemand.slice(-6), demand];
          customers += served; walkouts += lost; tradedDays++;
        }

        // Payday every seventh day.
        if (day % 7 === 6 && biz.balance("wages_payable") > 0) {
          const owed = biz.balance("wages_payable");
          const tax = Math.round((owed * cfg.payrollTaxPct) / 100);
          biz.post({ day, memo: "Payroll", flow: "operating", lines: [
            { account: "wages_payable", debit: owed }, { account: "payroll_tax", debit: tax }, { account: "cash", credit: owed + tax } ] });
        }
      }

      const lastDay = day - 1;
      for (const dep of depreciation) {
        const amt = dep.schedule[m - dep.start];
        if (amt) biz.post({ day: lastDay, memo: "Depreciation", flow: "operating",
          lines: [{ account: "depreciation", debit: amt }, { account: "accum_depreciation", credit: amt }] });
      }
      if (!biz.balanceSheet().balanced || !person.balanceSheet().balanced) throw new Error("books out of balance");
      const is = biz.incomeStatement(monthStart, lastDay);
      months.push({ month: m + 1, phase: phase === "open" ? "open" : phaseAtStart, customersPerDay: customers / Math.max(1, tradedDays),
        revenueCents: is.totalRevenue, netIncomeCents: is.netIncome, cashCents: biz.cash(), walkouts, spoilageCents: spoiled });
    }
  } catch (e) {
    if (!(e instanceof LedgerError)) throw e;
    result.failedOnDay = day; result.failedPhase = phase; result.failedReason = e.message;
  }
  if (!result.cart && cartTraded > 0) result.cart = { days: cartTraded, avgDailyCustomers: cartCustomers / cartTraded };
  return result;
}
