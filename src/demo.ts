import { dollars } from "./ledger.ts";
import { runStr, type StrConfig } from "./str.ts";
import { MIAMI_1BR } from "./markets/miami.ts";

function report(label: string, cfg: StrConfig) {
  const r = runStr(cfg);
  const b = r.business;
  const lastDay = b.entries[b.entries.length - 1].day;
  const is = b.incomeStatement(0, lastDay);
  const years = Math.max(1, r.months.length) / 12;
  const occ = r.months.reduce((s, m) => s + m.occupancy, 0) / Math.max(1, r.months.length);
  console.log(`\n=== ${label} ===`);
  console.log(r.insolventOnDay === null ? `Survived ${r.months.length} months` : `OUT OF CASH in month ${r.months.length + 1}: ${r.insolventReason}`);
  console.log(`Occupancy ${(occ * 100).toFixed(0)}% | revenue per year ${dollars(Math.round(is.totalRevenue / years))} | net income per year ${dollars(Math.round(is.netIncome / years))} | ending cash ${dollars(b.cash())}`);
  for (const [name, amt] of Object.entries(is.expenses).sort((a, b) => b[1] - a[1]))
    console.log(`   ${name.padEnd(32)} ${dollars(Math.round(amt / years)).padStart(12)} per year`);
}

console.log("City of Miami, leased 1-bedroom. Sourced and estimated inputs: see src/markets/miami.ts");
report("Median rent $2,500, $25k capital", MIAMI_1BR);
report("Same, with enough capital to last 36 months (to see the true yearly loss)", { ...MIAMI_1BR, personalCashCents: 200_000_00, contributionCents: 150_000_00 });
report("What rent would it take? Rent $1,700", { ...MIAMI_1BR, monthlyRentCents: 1_700_00, securityDepositCents: 1_700_00 });
report("Top-quartile unit: $185 base rate that the market accepts, rent $2,500", { ...MIAMI_1BR, nightlyRateCents: 185_00, referenceRateCents: 185_00 });
