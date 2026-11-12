// Double-entry ledger. All money is integer cents. No floating point money anywhere.
// Every economic action in the game must end up here as a balanced entry or be rejected.

export type AccountType = "asset" | "liability" | "equity" | "revenue" | "expense";
export type CashFlowClass = "operating" | "investing" | "financing";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  isCash?: boolean; // cash accounts cannot go negative
}

export interface Line {
  account: string;
  debit?: number;
  credit?: number;
}

export interface Entry {
  day: number; // game day, 0-based
  memo: string;
  flow: CashFlowClass; // how any cash movement in this entry is classified
  lines: Line[];
}

export class LedgerError extends Error {}

const DEBIT_NORMAL: Record<AccountType, boolean> = {
  asset: true,
  expense: true,
  liability: false,
  equity: false,
  revenue: false,
};

export class Ledger {
  readonly entity: string;
  readonly accounts = new Map<string, Account>();
  readonly entries: Entry[] = [];
  private balances = new Map<string, number>(); // signed in the account's normal direction

  constructor(entity: string, accounts: Account[]) {
    this.entity = entity;
    for (const a of accounts) {
      if (this.accounts.has(a.id)) throw new LedgerError(`duplicate account ${a.id}`);
      this.accounts.set(a.id, a);
      this.balances.set(a.id, 0);
    }
  }

  /** Validate and record an entry. Throws LedgerError and changes nothing if invalid. */
  post(entry: Entry): void {
    if (!Number.isInteger(entry.day) || entry.day < 0) throw new LedgerError("bad day");
    const last = this.entries[this.entries.length - 1];
    if (last && entry.day < last.day) throw new LedgerError("entries must be posted in date order");
    if (entry.lines.length < 2) throw new LedgerError("entry needs at least two lines");

    let debits = 0;
    let credits = 0;
    const delta = new Map<string, number>();
    for (const l of entry.lines) {
      const acct = this.accounts.get(l.account);
      if (!acct) throw new LedgerError(`unknown account ${l.account}`);
      const d = l.debit ?? 0;
      const c = l.credit ?? 0;
      if (!Number.isSafeInteger(d) || !Number.isSafeInteger(c) || d < 0 || c < 0)
        throw new LedgerError("amounts must be non-negative integer cents");
      if ((d === 0) === (c === 0)) throw new LedgerError("each line needs exactly one of debit or credit");
      debits += d;
      credits += c;
      const signed = DEBIT_NORMAL[acct.type] ? d - c : c - d;
      delta.set(acct.id, (delta.get(acct.id) ?? 0) + signed);
    }
    if (debits !== credits) throw new LedgerError(`unbalanced entry: debits ${debits}, credits ${credits}`);

    for (const [id, change] of delta) {
      if (this.accounts.get(id)!.isCash && this.balances.get(id)! + change < 0)
        throw new LedgerError(`insufficient cash in ${id} for "${entry.memo}"`);
    }
    for (const [id, change] of delta) this.balances.set(id, this.balances.get(id)! + change);
    this.entries.push(entry);
  }

  balance(account: string): number {
    const b = this.balances.get(account);
    if (b === undefined) throw new LedgerError(`unknown account ${account}`);
    return b;
  }

  cash(): number {
    let total = 0;
    for (const a of this.accounts.values()) if (a.isCash) total += this.balances.get(a.id)!;
    return total;
  }

  private sumType(type: AccountType): number {
    let total = 0;
    for (const a of this.accounts.values()) if (a.type === type) total += this.balances.get(a.id)!;
    return total;
  }

  /** Balance sheet as of now. Net income to date is folded into equity. */
  balanceSheet() {
    const assets = this.sumType("asset");
    const liabilities = this.sumType("liability");
    const netIncome = this.sumType("revenue") - this.sumType("expense");
    const equity = this.sumType("equity") + netIncome;
    return { assets, liabilities, equity, balanced: assets === liabilities + equity };
  }

  /** Activity by account for entries with fromDay <= day <= toDay. */
  private activity(fromDay: number, toDay: number): Map<string, number> {
    const out = new Map<string, number>();
    for (const e of this.entries) {
      if (e.day < fromDay || e.day > toDay) continue;
      for (const l of e.lines) {
        const acct = this.accounts.get(l.account)!;
        const d = l.debit ?? 0;
        const c = l.credit ?? 0;
        out.set(acct.id, (out.get(acct.id) ?? 0) + (DEBIT_NORMAL[acct.type] ? d - c : c - d));
      }
    }
    return out;
  }

  incomeStatement(fromDay: number, toDay: number) {
    const act = this.activity(fromDay, toDay);
    const revenue: Record<string, number> = {};
    const expenses: Record<string, number> = {};
    let totalRevenue = 0;
    let totalExpenses = 0;
    for (const [id, amt] of act) {
      const a = this.accounts.get(id)!;
      if (a.type === "revenue") { revenue[a.name] = amt; totalRevenue += amt; }
      if (a.type === "expense") { expenses[a.name] = amt; totalExpenses += amt; }
    }
    return { revenue, expenses, totalRevenue, totalExpenses, netIncome: totalRevenue - totalExpenses };
  }

  /**
   * Direct-method cash flow statement: cash movement per entry, grouped by the entry's class.
   * shortcut: direct method only; add the indirect reconciliation when AR/AP and accruals arrive.
   */
  cashFlow(fromDay: number, toDay: number) {
    const out = { operating: 0, investing: 0, financing: 0, netChange: 0 };
    for (const e of this.entries) {
      if (e.day < fromDay || e.day > toDay) continue;
      for (const l of e.lines) {
        if (!this.accounts.get(l.account)!.isCash) continue;
        const change = (l.debit ?? 0) - (l.credit ?? 0);
        out[e.flow] += change;
        out.netChange += change;
      }
    }
    return out;
  }
}

/** Owner puts personal cash into the business. Both ledgers stay balanced or neither changes. */
export function ownerContribution(person: Ledger, business: Ledger, day: number, cents: number): void {
  // Post the personal side first: it is the one that can fail on insufficient cash.
  person.post({
    day, memo: `Capital contribution to ${business.entity}`, flow: "investing",
    lines: [{ account: "investment_in_business", debit: cents }, { account: "cash", credit: cents }],
  });
  business.post({
    day, memo: "Owner capital contribution", flow: "financing",
    lines: [{ account: "cash", debit: cents }, { account: "owner_equity", credit: cents }],
  });
}

export const dollars = (cents: number): string =>
  (cents < 0 ? "-" : "") + "$" + (Math.abs(cents) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
