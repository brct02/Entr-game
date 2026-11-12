import { test } from "node:test";
import assert from "node:assert/strict";
import { runCoffee } from "../src/coffee.ts";
import { MIAMI_COFFEE, MIAMI_COFFEE_LOCATIONS, MIAMI_COFFEE_PROVENANCE } from "../src/markets/miami-coffee.ts";

const funded = { ...MIAMI_COFFEE, personalCashCents: 600_000_00, contributionCents: 500_000_00 };
const matureYear = (r: ReturnType<typeof runCoffee>) => r.months.slice(24, 36);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

test("coffee: books balance, cash never negative, cash flow ties to cash, on every seed and route", () => {
  for (const seed of [1, 2, 3]) for (const cartMonths of [0, 3]) {
    const r = runCoffee({ ...funded, seed, cartMonths });
    const b = r.business; const last = b.entries[b.entries.length - 1].day;
    assert.equal(r.failedOnDay, null);
    assert.ok(b.balanceSheet().balanced && r.person.balanceSheet().balanced);
    assert.ok(b.cash() >= 0);
    assert.equal(b.cashFlow(0, last).netChange, b.cash());
    assert.equal(sum(r.months.map(m => m.netIncomeCents)), b.incomeStatement(0, last).netIncome);
  }
});

test("coffee: deterministic for a seed, different across seeds", () => {
  assert.deepEqual(runCoffee(funded).months, runCoffee(funded).months);
  assert.notDeepEqual(runCoffee(funded).months, runCoffee({ ...funded, seed: 7 }).months);
});

test("coffee benchmark gate: mature shop sits inside published ranges", () => {
  for (const seed of [1, 2, 3, 4]) {
    const r = runCoffee({ ...funded, seed });
    const y = matureYear(r);
    const perDay = sum(y.map(m => m.customersPerDay)) / 12;
    const revenue = sum(y.map(m => m.revenueCents)) / 100;
    assert.ok(perDay >= 150 && perDay <= 400, `customers per day ${perDay.toFixed(0)}`);
    assert.ok(revenue >= 300_000 && revenue <= 650_000, `annual revenue $${revenue.toFixed(0)}`);
    const b = r.business; const last = b.entries[b.entries.length - 1].day;
    const is = b.incomeStatement(0, last);
    const gross = 1 - (is.expenses["Cost of goods sold"] + (is.expenses["Spoilage"] ?? 0)) / is.totalRevenue;
    assert.ok(gross >= 0.65 && gross <= 0.75, `gross margin ${gross.toFixed(3)}`);
  }
});

test("coffee: a cart costs less, reveals demand, and gives the shop a head start", () => {
  const cartOnly = runCoffee({ ...MIAMI_COFFEE, cartMonths: 6, openShop: false, months: 6, loan: undefined, contributionCents: 30_000_00 });
  assert.equal(cartOnly.failedOnDay, null);
  const seen = cartOnly.cart!.avgDailyCustomers / MIAMI_COFFEE.cartCaptureShare;
  assert.ok(Math.abs(seen - MIAMI_COFFEE.location.matureDailyCustomers) < 25, `cart implies ${seen.toFixed(0)} a day`);
  const straight = runCoffee({ ...funded, months: 12 });
  const viaCart = runCoffee({ ...funded, months: 15, cartMonths: 3 });
  const firstOpen = (r: ReturnType<typeof runCoffee>) => r.months.find(m => m.phase === "open" && m.customersPerDay > 0)!;
  assert.ok(firstOpen(viaCart).customersPerDay > firstOpen(straight).customersPerDay);
});

test("coffee: decisions have consequences", () => {
  const base = runCoffee(funded);
  const understaffed = runCoffee({ ...funded, staffPerDaypart: [1, 1, 1], drinksPerPersonHour: 12 });
  assert.ok(sum(understaffed.months.map(m => m.walkouts)) > sum(base.months.map(m => m.walkouts)));
  const overstocked = runCoffee({ ...funded, parDays: 6 });
  assert.ok(sum(overstocked.months.map(m => m.spoilageCents)) > sum(base.months.map(m => m.spoilageCents)));
  const pricey = runCoffee({ ...funded, ticketCents: 11_00 });
  assert.ok(sum(matureYear(pricey).map(m => m.customersPerDay)) < sum(matureYear(base).map(m => m.customersPerDay)));
  const cannotAfford = runCoffee({ ...MIAMI_COFFEE, location: MIAMI_COFFEE_LOCATIONS.prime, contributionCents: 20_000_00, loan: undefined });
  assert.equal(cannotAfford.failedPhase, "buildout");
});

test("coffee: every market-pack value carries a source label", () => {
  for (const [k, p] of Object.entries(MIAMI_COFFEE_PROVENANCE)) assert.ok(p.source.length > 0 && p.asOf.length > 0 && p.kind, k);
});
