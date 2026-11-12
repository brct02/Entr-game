import { dollars } from "./ledger.ts";
import { runCoffee, type CoffeeConfig } from "./coffee.ts";
import { MIAMI_COFFEE, MIAMI_COFFEE_LOCATIONS as L } from "./markets/miami-coffee.ts";

function report(label: string, cfg: CoffeeConfig) {
  const r = runCoffee(cfg);
  const b = r.business;
  console.log(`\n=== ${label} ===`);
  if (r.cart) console.log(`Cart: ${r.cart.days} days, ${r.cart.avgDailyCustomers.toFixed(0)} customers a day (a shop here would see about ${(r.cart.avgDailyCustomers / cfg.cartCaptureShare).toFixed(0)})`);
  console.log(r.failedOnDay === null ? `Still trading after ${r.months.length} months, cash ${dollars(b.cash())}`
    : `OUT OF CASH on day ${r.failedOnDay} during ${r.failedPhase}: ${r.failedReason}`);
  const low = Math.min(...r.months.map(m => m.cashCents));
  if (r.months.length) console.log(`Lowest month-end cash: ${dollars(low)}`);
  const y = r.months.slice(-12);
  if (r.failedOnDay === null && r.months.length >= 36) {
    const last = b.entries[b.entries.length - 1].day;
    const is = b.incomeStatement(last - 364, last);
    const pct = (x: number) => ((100 * x) / is.totalRevenue).toFixed(1).padStart(5) + "%";
    const draws = y.reduce((s, m) => s + m.ownerDrawCents, 0);
    console.log(`Last 12 months: ${(y.reduce((s, m) => s + m.customersPerDay, 0) / 12).toFixed(0)} customers a day, revenue ${dollars(is.totalRevenue)}`);
    console.log(cfg.management === "owner"
      ? `   profit ${dollars(is.netIncome)} (${pct(is.netIncome).trim()}); owner drew ${dollars(draws)}; left after the draw ${dollars(is.netIncome - draws)} (${pct(is.netIncome - draws).trim()})`
      : `   profit after the manager's salary ${dollars(is.netIncome)} (${pct(is.netIncome).trim()}); owner kept their job`);
    const e = is.expenses;
    console.log(`   goods and waste ${pct(e["Cost of goods sold"] + (e["Waste and spoilage"] ?? 0))} | staff ${pct(e["Wages"] + e["Payroll tax"] + (e["Manager salary"] ?? 0))} | rent and pass-throughs ${pct(e["Rent"])} | skipped draws: ${r.skippedDraws}`);
    console.log(`   owner's personal cash at the end: ${dollars(r.person.cash())}`);
  }
}

console.log("Miami-Dade independent coffee shop. Inputs and their sources: src/markets/miami-coffee.ts");
report("Owner-managed, county-average rent, $70k own money + $100k loan", MIAMI_COFFEE);
report("Hired manager, owner keeps their job, same shop and money", { ...MIAMI_COFFEE, management: "hired" });
report("Hired manager, Miami Beach rent", { ...MIAMI_COFFEE, management: "hired", location: L.prime });
report("Hired manager, lower-rent submarket", { ...MIAMI_COFFEE, management: "hired", location: L.value });
report("Cart for 3 months first, then the same lease", { ...MIAMI_COFFEE, cartMonths: 3, months: 39, personalCashCents: 110_000_00, contributionCents: 90_000_00 });
report("Cart only, $30k, no loan, 12 months", { ...MIAMI_COFFEE, cartMonths: 12, openShop: false, months: 12, loan: undefined, contributionCents: 30_000_00 });
report("Owner-managed, lower-rent submarket", { ...MIAMI_COFFEE, location: L.value });
report("Thin capital: $40k own + $60k loan", { ...MIAMI_COFFEE, contributionCents: 40_000_00, loan: { principalCents: 60_000_00, annualRatePct: 10.5, months: 84 } });
