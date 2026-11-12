// Headless coffee shop simulation. Daily tick, three dayparts, every dollar through the ledger.
// Two ways in: start with a cart (cheap, and it tells you how busy the spot is), or sign a lease straight away.

import { Ledger, LedgerError, ownerContribution } from "./ledger.ts";
import { amortize, straightLine } from "./schedules.ts";
import { makeRng } from "./rng.ts";
import { selfEmploymentTax } from "./tax.ts";

export interface CoffeeLocation {
  name: string;
  rentPerSqFtYearCents: number;
  sqFt: number;
  matureDailyCustomers: number; // walk-in customers per day at the reference ticket once the shop is known
  passThroughPerSqFtYearCents: number; // taxes, insurance and common-area charges billed on top of base rent
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

  // Who runs it. "owner": the owner manages full time, has no other job, and takes a monthly draw when cash allows.
  // "hired": a salaried manager runs it, the owner keeps their job and is paid only out of profits.
  management: "owner" | "hired";
  managerSalaryCentsPerYear: number; // the hired manager's salary, and the size of the owner-manager's draw
  minCashAfterDrawCents: number;     // the owner skips the draw if it would leave the business with less than this
  jobNetMonthlyCents: number;        // the owner's take-home pay from their job (hired-manager route only)
  personalMonthlyExpensesCents: number;

  // Legal form. "pass_through": sole proprietor or default LLC; the owner takes draws and owes self-employment tax on
  // the year's profit whether or not they drew it. "s_corp": an owner who works in the business is paid a salary
  // through payroll, and the business carries the extra filing and payroll-service cost.
  entity: "pass_through" | "s_corp";
  sCorpAdminMonthlyCents: number;

  // Staff
  staffPerDaypart: number[];     // people on the floor
  ownerOnBar: number[];          // how many of those are the unpaid owner (0 or 1 each)
  wageCentsPerHour: number;
  payrollTaxPct: number;          // employer payroll taxes plus workers' comp, as a share of wages
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
  salesTaxPct: number;           // collected from customers on top of the ticket and passed on to the state monthly
  certificateOfUseCents: number; // paid once when the lease is signed
  countyBusinessTaxCentsPerYear: number; // paid at opening and every 12 months after
  repairsPctOfSales: number;     // paid monthly on the previous month's sales
  wastePct: number;              // remakes, comps and spills, as a share of tickets served
}

export type Phase = "cart" | "buildout" | "open" | "idle";
export interface CoffeeMonth {
  month: number; phase: Phase; customersPerDay: number; revenueCents: number; netIncomeCents: number;
  cashCents: number; walkouts: number; spoilageCents: number; ownerDrawCents: number;
}
export interface CoffeeResult {
  business: Ledger; person: Ledger; months: CoffeeMonth[];
  cart: { days: number; avgDailyCustomers: number } | null;
  failedOnDay: number | null; failedPhase: Phase | null; failedReason: string | null;
  ownerDrawsCents: number; skippedDraws: number;
  ownerSalaryCents: number;         // gross salary paid to an S corporation owner
  ownerEmploymentTaxCents: number;  // self-employment tax, or both halves of payroll tax on the owner's salary
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
    { id: "sales_tax_payable", name: "Sales tax collected, owed to the state", type: "liability" },
    { id: "loan_payable", name: "Loan payable", type: "liability" },
    { id: "owner_equity", name: "Owner equity", type: "equity" },
    { id: "owner_draws", name: "Owner draws", type: "equity" }, // carries a negative balance
    { id: "sales", name: "Sales", type: "revenue" },
    { id: "cogs", name: "Cost of goods sold", type: "expense" },
    { id: "spoilage", name: "Waste and spoilage", type: "expense" },
    { id: "wages", name: "Wages", type: "expense" },
    { id: "manager_salary", name: "Manager salary", type: "expense" },
    { id: "owner_salary", name: "Owner salary", type: "expense" },
    { id: "entity_admin", name: "S corporation payroll and filing costs", type: "expense" },
    { id: "repairs", name: "Repairs and maintenance", type: "expense" },
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
    { id: "job_income", name: "Job income", type: "revenue" },
    { id: "business_income", name: "Draws from the business", type: "revenue" },
    { id: "living_expenses", name: "Living expenses", type: "expense" },
    { id: "employment_tax", name: "Self-employment and payroll tax", type: "expense" },
  ]);
  return { business, person };
}

export function runCoffee(cfg: CoffeeConfig): CoffeeResult {
  const rng = makeRng(cfg.seed);
  const { business: biz, person } = ledgers();
  const months: CoffeeMonth[] = [];
  const result: CoffeeResult = { business: biz, person, months, cart: null, failedOnDay: null, failedPhase: null, failedReason: null,
    ownerDrawsCents: 0, skippedDraws: 0, ownerSalaryCents: 0, ownerEmploymentTaxCents: 0 };
  if (cfg.management === "hired" && (cfg.ownerOnBar.some(n => n > 0) || cfg.cartMonths > 0))
    throw new Error("an owner who keeps their job cannot also work the bar or the cart");
  const personal = (fn: () => void) => {
    try { fn(); } catch (e) { throw e instanceof LedgerError ? new LedgerError("the owner ran out of personal money") : e; }
  };

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
    const tax = Math.round((gross * cfg.salesTaxPct) / 100);
    const fee = Math.round(((gross + tax) * cfg.cardFeePct) / 100); // the card company takes its cut of the tax too
    const lines = [{ account: "cash", debit: gross + tax - fee }, { account: "card_fees", debit: fee }, { account: "sales", credit: gross }];
    if (tax > 0) lines.push({ account: "sales_tax_payable", credit: tax });
    biz.post({ day, memo: `${customers} tickets`, flow: "operating", lines });
  };

  const cartDays = cfg.cartMonths * 30;
  const monthlyRent = Math.round((cfg.location.rentPerSqFtYearCents * cfg.location.sqFt) / 12);
  const monthlyPassThrough = Math.round((cfg.location.passThroughPerSqFtYearCents * cfg.location.sqFt) / 12);
  let lastMonthSales = 0;
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
    pay(day, "licenses", "Certificate of use", cfg.certificateOfUseCents);
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
      let customers = 0, walkouts = 0, spoiled = 0, tradedDays = 0, drawn = 0;
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

        if (phase === "open" && (day - openDay) % 365 === 0) pay(day, "licenses", "County business tax receipt", cfg.countyBusinessTaxCentsPerYear);

        // Monthly bills fall on the first day of each month.
        if (d === 0) {
          const owedTax = biz.balance("sales_tax_payable");
          if (owedTax > 0) biz.post({ day, memo: "Sales tax sent to the state", flow: "operating",
            lines: [{ account: "sales_tax_payable", debit: owedTax }, { account: "cash", credit: owedTax }] });
          if (leaseSignedDay >= 0) {
            if (leaseMonth >= cfg.freeRentMonths) pay(day, "rent", "Rent", monthlyRent);
            pay(day, "rent", "Lease pass-through charges", monthlyPassThrough);
            const p = loan[leaseMonth];
            if (p) { pay(day, "interest", "Loan interest", p.interest); pay(day, "loan_payable", "Loan principal", p.principal, "financing"); }
            leaseMonth++;
          }
          if (phase === "open") {
            pay(day, "utilities", "Utilities", cfg.monthlyUtilitiesCents);
            pay(day, "insurance", "Insurance", cfg.monthlyInsuranceCents);
            pay(day, "marketing", "Marketing", cfg.monthlyMarketingCents);
            pay(day, "other_operating", "Supplies and other", cfg.monthlyOtherCents);
            pay(day, "repairs", "Repairs and maintenance", Math.round((lastMonthSales * cfg.repairsPctOfSales) / 100));
          }
          // The owner's own month: job pay if they kept the job, a draw if they run the shop, then living costs.
          const trading = phase === "open" || phase === "cart";
          if (cfg.management === "hired" && cfg.jobNetMonthlyCents > 0)
            person.post({ day, memo: "Job pay", flow: "operating", lines: [{ account: "cash", debit: cfg.jobNetMonthlyCents }, { account: "job_income", credit: cfg.jobNetMonthlyCents }] });
          if (cfg.entity === "s_corp" && leaseSignedDay >= 0 || cfg.entity === "s_corp" && trading)
            pay(day, "entity_admin", "S corporation payroll and filing costs", cfg.sCorpAdminMonthlyCents);
          if (cfg.management === "owner" && trading && m > 0 && cfg.entity === "s_corp") {
            // Salary through payroll: the business pays gross plus the employer's 7.65%; the owner's 7.65% is withheld.
            const gross = Math.round(cfg.managerSalaryCentsPerYear / 12);
            const half = Math.round(gross * 0.0765);
            if (biz.cash() - gross - half >= cfg.minCashAfterDrawCents) {
              biz.post({ day, memo: "Owner salary", flow: "operating", lines: [
                { account: "owner_salary", debit: gross }, { account: "payroll_tax", debit: half }, { account: "cash", credit: gross + half } ] });
              person.post({ day, memo: "Salary from the business", flow: "operating", lines: [
                { account: "cash", debit: gross - half }, { account: "employment_tax", debit: half }, { account: "business_income", credit: gross } ] });
              drawn += gross; result.ownerSalaryCents += gross; result.ownerEmploymentTaxCents += 2 * half;
            } else result.skippedDraws++;
          }
          if (cfg.management === "owner" && trading && m > 0 && cfg.entity === "pass_through") {
            const draw = Math.round(cfg.managerSalaryCentsPerYear / 12);
            if (biz.cash() - draw >= cfg.minCashAfterDrawCents) {
              biz.post({ day, memo: "Owner draw", flow: "financing", lines: [{ account: "owner_draws", debit: draw }, { account: "cash", credit: draw }] });
              person.post({ day, memo: "Draw from the business", flow: "operating", lines: [{ account: "cash", debit: draw }, { account: "business_income", credit: draw }] });
              drawn += draw; result.ownerDrawsCents += draw;
            } else result.skippedDraws++;
          }
          if (cfg.personalMonthlyExpensesCents > 0) personal(() => person.post({ day, memo: "Living expenses", flow: "operating",
            lines: [{ account: "living_expenses", debit: cfg.personalMonthlyExpensesCents }, { account: "cash", credit: cfg.personalMonthlyExpensesCents }] }));
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
          const wasted = Math.min(batches.reduce((t, b) => t + b.units, 0), Math.round((served * cfg.wastePct) / 100));
          if (wasted > 0) {
            let w = wasted;
            for (const b of batches) { const u = Math.min(b.units, w); b.units -= u; w -= u; }
            batches = batches.filter(b => b.units > 0);
            biz.post({ day, memo: "Remakes, comps and spills", flow: "operating",
              lines: [{ account: "spoilage", debit: wasted * cfg.unitCostCents }, { account: "inventory", credit: wasted * cfg.unitCostCents }] });
            spoiled += wasted * cfg.unitCostCents;
          }
          const wages = paidHours * cfg.wageCentsPerHour;
          if (wages > 0) biz.post({ day, memo: "Wages earned", flow: "operating",
            lines: [{ account: "wages", debit: wages }, { account: "wages_payable", credit: wages }] });
          if (cfg.management === "hired") {
            const salary = Math.round(cfg.managerSalaryCentsPerYear / 365);
            biz.post({ day, memo: "Manager salary earned", flow: "operating",
              lines: [{ account: "manager_salary", debit: salary }, { account: "wages_payable", credit: salary }] });
          }

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
      lastMonthSales = is.totalRevenue;
      // Year end: a pass-through owner owes self-employment tax on the year's profit, drawn or not.
      // shortcut: paid in one sum at year end; real owners pay quarterly estimates and settle in April.
      if (cfg.entity === "pass_through" && m % 12 === 11) {
        const tax = selfEmploymentTax(biz.incomeStatement(day - 365, lastDay).netIncome);
        if (tax > 0) {
          personal(() => person.post({ day: lastDay, memo: "Self-employment tax", flow: "operating",
            lines: [{ account: "employment_tax", debit: tax }, { account: "cash", credit: tax }] }));
          result.ownerEmploymentTaxCents += tax;
        }
      }
      months.push({ month: m + 1, phase: phase === "open" ? "open" : phaseAtStart, customersPerDay: customers / Math.max(1, tradedDays),
        revenueCents: is.totalRevenue, netIncomeCents: is.netIncome, cashCents: biz.cash(), walkouts, spoilageCents: spoiled, ownerDrawCents: drawn });
    }
  } catch (e) {
    if (!(e instanceof LedgerError)) throw e;
    result.failedOnDay = day; result.failedPhase = phase; result.failedReason = e.message;
  }
  if (!result.cart && cartTraded > 0) result.cart = { days: cartTraded, avgDailyCustomers: cartCustomers / cartTraded };
  return result;
}
