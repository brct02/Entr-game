// What each setup earns once it is established, with enough money that running out of cash is not the story.
import { dollars } from "./ledger.ts";
import { runCoffee } from "./coffee.ts";
import { MIAMI_COFFEE, MIAMI_COFFEE_LOCATIONS as L } from "./markets/miami-coffee.ts";

console.log("Established shop, last 12 of 36 months, average of 5 seeds. Miami-Dade inputs: src/markets/miami-coffee.ts\n");
console.log("location".padEnd(28), "who runs it".padEnd(10), "revenue".padStart(12), "profit".padStart(12), "margin".padStart(8), "owner draw".padStart(12), "peak cash needed".padStart(18));
for (const loc of [L.value, L.average, L.prime]) for (const management of ["owner", "hired"] as const) {
  let rev = 0, profit = 0, draw = 0, trough = 0;
  for (const seed of [1, 2, 3, 4, 5]) {
    const r = runCoffee({ ...MIAMI_COFFEE, seed, location: loc, management, loan: undefined, personalCashCents: 900_000_00, contributionCents: 600_000_00 });
    const b = r.business; const last = b.entries[b.entries.length - 1].day;
    const is = b.incomeStatement(last - 364, last);
    rev += is.totalRevenue; profit += is.netIncome; draw += r.months.slice(-12).reduce((s, m) => s + m.ownerDrawCents, 0);
    trough += 600_000_00 - Math.min(...r.months.map(m => m.cashCents));
  }
  const n = 5;
  console.log(loc.name.padEnd(28), management.padEnd(10), dollars(Math.round(rev / n)).padStart(12), dollars(Math.round(profit / n)).padStart(12),
    ((100 * profit) / rev).toFixed(1).padStart(7) + "%", dollars(Math.round(draw / n)).padStart(12), dollars(Math.round(trough / n)).padStart(18));
}
