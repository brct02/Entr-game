import { dollars } from "./ledger.ts";
import { runStr, PLACEHOLDER_UNIT, type StrConfig } from "./str.ts";

function report(label: string, cfg: StrConfig) {
  const r = runStr(cfg);
  const b = r.business;
  const lastDay = b.entries[b.entries.length - 1].day;
  const is = b.incomeStatement(0, lastDay);
  const cf = b.cashFlow(0, lastDay);
  const bs = b.balanceSheet();
  const occ = r.months.reduce((s, m) => s + m.occupancy, 0) / Math.max(1, r.months.length);
  console.log(`\n=== ${label} (seed ${cfg.seed}) ===`);
  console.log(r.insolventOnDay === null
    ? `Survived ${r.months.length} months`
    : `INSOLVENT on day ${r.insolventOnDay} (month ${r.months.length + 1}): ${r.insolventReason}`);
  console.log(`Avg occupancy ${(occ * 100).toFixed(0)}% | revenue ${dollars(is.totalRevenue)} | net income ${dollars(is.netIncome)}`);
  console.log(`Cash flow: operating ${dollars(cf.operating)}, investing ${dollars(cf.investing)}, financing ${dollars(cf.financing)} | ending cash ${dollars(b.cash())}`);
  console.log(`Balance sheet: assets ${dollars(bs.assets)} = liabilities ${dollars(bs.liabilities)} + equity ${dollars(bs.equity)} | balanced: ${bs.balanced}`);
}

console.log("Placeholder assumptions, not calibrated to a real market.");
report("Base case", PLACEHOLDER_UNIT);
report("Same unit, different luck", { ...PLACEHOLDER_UNIT, seed: 2 });
report("Overpriced by 35%", { ...PLACEHOLDER_UNIT, nightlyRateCents: 250_00 });
report("Thin capital: $7k in, no loan cushion", { ...PLACEHOLDER_UNIT, contributionCents: 7_000_00 });
