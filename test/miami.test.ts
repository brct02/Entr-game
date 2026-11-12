import { test } from "node:test";
import assert from "node:assert/strict";
import { runStr } from "../src/str.ts";
import { MIAMI_1BR, MIAMI_1BR_PROVENANCE, miamiStrEligibility } from "../src/markets/miami.ts";

// Funded heavily here so the unit survives 36 months and we measure the market, not the bankroll.
const funded = (seed: number) => runStr({ ...MIAMI_1BR, seed, personalCashCents: 200_000_00, contributionCents: 150_000_00 });

test("benchmark gate: simulated Miami occupancy lands in the sourced 53-65% range across seeds", () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const r = funded(seed);
    assert.equal(r.insolventOnDay, null);
    const occ = r.months.reduce((s, m) => s + m.occupancy, 0) / r.months.length;
    assert.ok(occ >= 0.53 && occ <= 0.65, `seed ${seed}: occupancy ${occ.toFixed(3)} outside sourced range`);
  }
});

test("benchmark gate: simulated annual revenue lands in the sourced $23k-$39k range for a 1BR", () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const r = funded(seed);
    const annual = r.months.reduce((s, m) => s + m.revenueCents, 0) / 3 / 100;
    assert.ok(annual >= 23_000 && annual <= 39_000, `seed ${seed}: annual revenue $${annual.toFixed(0)} outside sourced range`);
  }
});

test("seasonality shows up: March out-earns September", () => {
  const r = funded(1);
  const byMonth = (i: number) => [0, 12, 24].reduce((s, y) => s + r.months[y + i].revenueCents, 0);
  assert.ok(byMonth(2) > byMonth(8));
});

test("regulatory gate blocks ineligible units", () => {
  assert.equal(miamiStrEligibility({ transectZone: "T3", buildingType: "single_family", associationAllowsShortStays: true }).eligible, false);
  assert.equal(miamiStrEligibility({ transectZone: "T6", buildingType: "condo", associationAllowsShortStays: false }).eligible, false);
  assert.equal(miamiStrEligibility({ transectZone: "T6", buildingType: "condo", associationAllowsShortStays: true }).eligible, true);
});

test("every market-pack value carries a source label", () => {
  for (const [k, p] of Object.entries(MIAMI_1BR_PROVENANCE)) {
    assert.ok(["sourced", "estimated", "derived"].includes(p.kind), k);
    assert.ok(p.source.length > 0 && p.asOf.length > 0, k);
  }
});
