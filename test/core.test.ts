import { test } from "node:test";
import assert from "node:assert/strict";
import { Ledger, LedgerError, ownerContribution } from "../src/ledger.ts";
import { amortize, straightLine } from "../src/schedules.ts";
import { runStr, PLACEHOLDER_UNIT } from "../src/str.ts";

const mk = () => new Ledger("t", [
  { id: "cash", name: "Cash", type: "asset", isCash: true },
  { id: "investment_in_business", name: "Inv", type: "asset" },
  { id: "owner_equity", name: "Equity", type: "equity" },
  { id: "opening_equity", name: "Open", type: "equity" },
  { id: "rev", name: "Revenue", type: "revenue" },
  { id: "exp", name: "Expense", type: "expense" },
]);
const fund = (l: Ledger, cents: number) => l.post({ day: 0, memo: "open", flow: "financing",
  lines: [{ account: "cash", debit: cents }, { account: "opening_equity", credit: cents }] });

test("rejects unbalanced, unknown-account, fractional and out-of-order entries", () => {
  const l = mk();
  assert.throws(() => l.post({ day: 0, memo: "x", flow: "operating", lines: [{ account: "cash", debit: 100 }, { account: "rev", credit: 99 }] }), LedgerError);
  assert.throws(() => l.post({ day: 0, memo: "x", flow: "operating", lines: [{ account: "cash", debit: 100 }, { account: "nope", credit: 100 }] }), LedgerError);
  assert.throws(() => l.post({ day: 0, memo: "x", flow: "operating", lines: [{ account: "cash", debit: 10.5 }, { account: "rev", credit: 10.5 }] }), LedgerError);
  fund(l, 100);
  l.post({ day: 5, memo: "sale", flow: "operating", lines: [{ account: "cash", debit: 1 }, { account: "rev", credit: 1 }] });
  assert.throws(() => l.post({ day: 4, memo: "late", flow: "operating", lines: [{ account: "cash", debit: 1 }, { account: "rev", credit: 1 }] }), LedgerError);
  assert.equal(l.entries.length, 2);
});

test("cannot spend cash that is not there, and a rejected entry changes nothing", () => {
  const l = mk();
  fund(l, 500);
  assert.throws(() => l.post({ day: 1, memo: "big bill", flow: "operating", lines: [{ account: "exp", debit: 501 }, { account: "cash", credit: 501 }] }), /insufficient cash/);
  assert.equal(l.cash(), 500);
  assert.equal(l.balance("exp"), 0);
});

test("owner contribution keeps personal and business books separate and balanced", () => {
  const person = mk(); const biz = mk();
  fund(person, 10_000);
  ownerContribution(person, biz, 1, 4_000);
  assert.equal(person.cash(), 6_000);
  assert.equal(biz.cash(), 4_000);
  assert.ok(person.balanceSheet().balanced && biz.balanceSheet().balanced);
  assert.throws(() => ownerContribution(person, biz, 2, 6_001), LedgerError);
  assert.equal(biz.cash(), 4_000); // business untouched when the person cannot fund it
});

test("loan amortizes to exactly zero and principal sums to the amount borrowed", () => {
  for (const [p, r, n] of [[10_000_00, 11, 36], [250_000_00, 7.25, 120], [5_000_00, 0, 7]] as const) {
    const s = amortize(p, r, n);
    assert.equal(s.length, n);
    assert.equal(s[n - 1].balance, 0);
    assert.equal(s.reduce((t, x) => t + x.principal, 0), p);
    assert.ok(s.every(x => x.payment === x.interest + x.principal && x.principal >= 0));
  }
});

test("straight-line depreciation totals cost minus salvage", () => {
  const d = straightLine(14_000_00, 1_000_00, 60);
  assert.equal(d.reduce((a, b) => a + b, 0), 13_000_00);
});

test("STR sim: books balance and cash flow ties to cash, every seed", () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const r = runStr({ ...PLACEHOLDER_UNIT, seed });
    const b = r.business;
    const last = b.entries[b.entries.length - 1].day;
    assert.ok(b.balanceSheet().balanced);
    assert.ok(r.person.balanceSheet().balanced);
    assert.equal(b.cashFlow(0, last).netChange, b.cash()); // business started with zero cash
    assert.ok(b.cash() >= 0);
    const sumMonthly = r.months.reduce((t, m) => t + m.netIncomeCents, 0);
    if (r.insolventOnDay === null) assert.equal(sumMonthly, b.incomeStatement(0, last).netIncome);
  }
});

test("STR sim is deterministic: same seed same result, different seed different result", () => {
  const a = runStr(PLACEHOLDER_UNIT), b = runStr(PLACEHOLDER_UNIT), c = runStr({ ...PLACEHOLDER_UNIT, seed: 99 });
  assert.deepEqual(a.months, b.months);
  assert.notDeepEqual(a.months, c.months);
});

test("economics respond to decisions: overpricing lowers occupancy, thin capital can fail", () => {
  const occ = (r: ReturnType<typeof runStr>) => r.months.reduce((s, m) => s + m.occupancy, 0) / r.months.length;
  const base = runStr(PLACEHOLDER_UNIT);
  const pricey = runStr({ ...PLACEHOLDER_UNIT, nightlyRateCents: 250_00 });
  assert.ok(occ(pricey) < occ(base));
  const broke = runStr({ ...PLACEHOLDER_UNIT, contributionCents: 6_700_00, baseDailyBookingProb: 0.05 });
  assert.notEqual(broke.insolventOnDay, null);
  assert.ok(broke.business.balanceSheet().balanced); // even a failed business has clean books
});
