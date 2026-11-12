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
    console.log(`Last 12 months: ${(y.reduce((s, m) => s + m.customersPerDay, 0) / 12).toFixed(0)} customers a day, revenue ${dollars(is.totalRevenue)}, profit before owner pay ${dollars(is.netIncome)} (${pct(is.netIncome).trim()})`);
    const e = is.expenses;
    console.log(`   goods and spoilage ${pct(e["Cost of goods sold"] + (e["Spoilage"] ?? 0))} | wages and payroll tax ${pct(e["Wages"] + e["Payroll tax"])} | rent ${pct(e["Rent"])}`);
  }
}

console.log("Miami-Dade independent coffee shop. Inputs and their sources: src/markets/miami-coffee.ts");
report("Straight to a lease, county-average rent, $70k own money + $100k loan", MIAMI_COFFEE);
report("Cart for 3 months first, then the same lease", { ...MIAMI_COFFEE, cartMonths: 3, months: 39, personalCashCents: 110_000_00, contributionCents: 90_000_00 });
report("Cart only, $30k, no loan, 12 months", { ...MIAMI_COFFEE, cartMonths: 12, openShop: false, months: 12, loan: undefined, contributionCents: 30_000_00 });
report("Straight to Miami Beach rent, same money", { ...MIAMI_COFFEE, location: L.prime });
report("Lower-rent submarket, same money", { ...MIAMI_COFFEE, location: L.value });
report("County-average rent, owner works the bar mornings and midday", { ...MIAMI_COFFEE, ownerOnBar: [1, 1, 0] });
report("Thin capital: $40k own + $60k loan", { ...MIAMI_COFFEE, contributionCents: 40_000_00, loan: { principalCents: 60_000_00, annualRatePct: 10.5, months: 84 } });
