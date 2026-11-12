// Loan amortization and straight-line depreciation, in integer cents.

export interface LoanPayment { month: number; payment: number; interest: number; principal: number; balance: number; }

/** Fixed-payment amortizing loan. The last payment absorbs rounding so the balance ends at exactly zero. */
export function amortize(principalCents: number, annualRatePct: number, months: number): LoanPayment[] {
  if (!Number.isSafeInteger(principalCents) || principalCents <= 0 || months <= 0 || annualRatePct < 0)
    throw new Error("bad loan terms");
  const r = annualRatePct / 100 / 12;
  const level = r === 0 ? Math.ceil(principalCents / months)
    : Math.round((principalCents * r) / (1 - Math.pow(1 + r, -months)));
  const out: LoanPayment[] = [];
  let balance = principalCents;
  for (let m = 1; m <= months; m++) {
    const interest = Math.round(balance * r);
    let principal = level - interest;
    if (m === months || principal > balance) principal = balance;
    balance -= principal;
    out.push({ month: m, payment: principal + interest, interest, principal, balance });
  }
  return out;
}

/** Monthly straight-line depreciation. The last month absorbs the remainder. */
export function straightLine(costCents: number, salvageCents: number, months: number): number[] {
  if (months <= 0 || salvageCents < 0 || salvageCents > costCents) throw new Error("bad depreciation terms");
  const base = costCents - salvageCents;
  const per = Math.floor(base / months);
  const out = new Array<number>(months).fill(per);
  out[months - 1] = base - per * (months - 1);
  return out;
}
