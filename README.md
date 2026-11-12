# ENTREPRENEURSHIP

Realistic business simulation game. This repo holds the deterministic core: no AI, no network, no UI yet.

## What works (milestones M1 and the start of M2)

- `src/ledger.ts` - double-entry ledger in integer cents. Rejects unbalanced entries, unknown accounts, fractional cents, out-of-order dates, and any payment the cash balance cannot cover. Produces income statement, balance sheet and direct-method cash flow.
- `src/schedules.ts` - loan amortization and straight-line depreciation.
- `src/rng.ts` - seeded random numbers, so the same seed and decisions always give the same result.
- `src/str.ts` - headless short-term rental business (leased unit) on a daily tick, with separate personal and business books.
- `test/core.test.ts` - 8 tests covering the rules above.

## Run

Needs Node 22.18 or newer. No dependencies to install.

    npm test
    npm run demo

## Known limits

- The numbers in `PLACEHOLDER_UNIT` are placeholders. They are not calibrated to any market.
- A business is marked insolvent at the first bill it cannot pay. There is no owner top-up, late fee or credit line yet.
- Guest cash arrives nightly. Real platform payout timing is not modeled.
- Cash flow is direct method only. No receivables, payables or accruals yet.
- No leap years. No taxes. One unit only.

## Next

Sourced market pack for one metro, owner top-ups and a credit line, payout timing, then the benchmark gate (36-month runs inside sourced ranges across three seeds).
