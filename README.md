# ENTREPRENEURSHIP

Realistic business simulation game. This repo holds the deterministic core: no AI, no network, no UI yet.

## What works (milestones M1 and the start of M2)

- `src/ledger.ts` - double-entry ledger in integer cents. Rejects unbalanced entries, unknown accounts, fractional cents, out-of-order dates, and any payment the cash balance cannot cover. Produces income statement, balance sheet and direct-method cash flow.
- `src/schedules.ts` - loan amortization and straight-line depreciation.
- `src/rng.ts` - seeded random numbers, so the same seed and decisions always give the same result.
- `src/str.ts` - headless short-term rental business (leased unit) on a daily tick, with separate personal and business books.
- `src/markets/miami.ts` - first market pack: City of Miami leased 1-bedroom. Every value is labeled sourced, derived or estimated, with its source and date. Includes the city's zoning and association gate.
- `test/` - 13 tests: ledger rules, determinism, and a benchmark gate that fails if simulated Miami occupancy or revenue leaves the sourced ranges.

## Run

Needs Node 22.18 or newer. No dependencies to install.

    npm test
    npm run demo

## Known limits

- `PLACEHOLDER_UNIT` in `src/str.ts` is made-up test data. Use the Miami pack for anything you want to read as a result.
- In the Miami pack, cleaner cost, furnishing cost, insurance and supplies, and price elasticity are estimates with no source yet. Providers disagree on occupancy (53% to 65%) and on nightly rates.
- Lodging taxes collected from guests are not modeled.
- A business is marked insolvent at the first bill it cannot pay. There is no owner top-up, late fee or credit line yet.
- Guest cash arrives nightly. Real platform payout timing is not modeled.
- Cash flow is direct method only. No receivables, payables or accruals yet.
- No leap years. No taxes. One unit only.

## Next

Source the remaining estimates, owner top-ups and a credit line, payout timing, real-world shock library (applied as percentage changes, once per game, at the matching season).
