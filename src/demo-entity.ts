import { dollars } from "./ledger.ts";
import { compareEntities } from "./tax.ts";
console.log("Owner employment tax for one year, tax year 2026, federal only. Income tax not included.\n");
console.log("case".padEnd(46), "profit".padStart(10), "salary".padStart(10), "pass-through".padStart(13), "S corp tax".padStart(11), "S corp costs".padStart(13), "S corp saves".padStart(13));
const rows: [string, number, number][] = [
  ["Coffee cart, owner works it", 58_000_00, 45_000_00],
  ["Shop at average rent, owner-managed", 90_000_00, 70_000_00],
  ["Shop earning $120k before owner pay", 120_000_00, 70_000_00],
  ["Shop earning $150k before owner pay", 150_000_00, 70_000_00],
  ["Shop earning $265k before owner pay", 265_000_00, 70_000_00],
];
for (const [label, profit, salary] of rows) {
  const c = compareEntities(profit, salary, 2_500_00);
  console.log(label.padEnd(46), dollars(profit).padStart(10).replace(".00", ""), dollars(c.salaryUsedCents).padStart(10).replace(".00", ""),
    dollars(c.soleProprietorTaxCents).padStart(13), dollars(c.sCorpTaxCents).padStart(11), dollars(c.sCorpAdminCents).padStart(13), dollars(c.sCorpSavingCents).padStart(13));
}
