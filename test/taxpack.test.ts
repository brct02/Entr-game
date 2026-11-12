import { test } from "node:test";
import assert from "node:assert/strict";
import { validateTaxPack, taxValue, type TaxPack } from "../src/taxpack.ts";
import { FL_MIAMI_DADE_2026 } from "../src/taxpacks/fl-miami-dade.ts";

const clone = (): TaxPack => structuredClone(FL_MIAMI_DADE_2026);

test("Miami-Dade pack is accepted, flagged provisional, and lists what is still unknown", () => {
  const c = validateTaxPack(FL_MIAMI_DADE_2026, 2026);
  assert.deepEqual(c.errors, []);
  assert.equal(c.provisional, true);
  assert.deepEqual(c.unknown, []);
  assert.deepEqual(c.assumed, ["cityBusinessTaxCentsPerYear"]);
  assert.equal(taxValue(FL_MIAMI_DADE_2026, "cityBusinessTaxCentsPerYear", 2026), 100_00);
  assert.equal(taxValue(FL_MIAMI_DADE_2026, "preparedFoodAndDrinkTaxable", 2026), 1);
  assert.equal(taxValue(FL_MIAMI_DADE_2026, "packagedGroceriesTaxable", 2026), 0);
  assert.equal(taxValue(FL_MIAMI_DADE_2026, "salesTaxStatePct", 2026) + taxValue(FL_MIAMI_DADE_2026, "salesTaxLocalPct", 2026), 7);
});

test("the engine refuses to guess: unknown items and bad packs stop it", () => {
  const gap = clone(); gap.items.cityBusinessTaxCentsPerYear = { value: null, kind: "unknown", source: "", official: false, asOf: "" };
  assert.throws(() => taxValue(gap, "cityBusinessTaxCentsPerYear", 2026), /unknown/);
  const bareAssumption = clone(); bareAssumption.items.cityBusinessTaxCentsPerYear.note = "";
  assert.ok(validateTaxPack(bareAssumption, 2026).errors.some(e => e.includes("who set it")));
  assert.throws(() => taxValue(FL_MIAMI_DADE_2026, "salesTaxStatePct", 2027), /tax year/);
  const noSource = clone(); noSource.items.salesTaxStatePct.source = "";
  assert.ok(validateTaxPack(noSource, 2026).errors.some(e => e.includes("source link")));
  const absurd = clone(); absurd.items.salesTaxLocalPct.value = 70;
  assert.ok(validateTaxPack(absurd, 2026).errors.some(e => e.includes("outside the plausible range")));
  const sneaky = clone(); sneaky.items.cityBusinessTaxCentsPerYear = { value: 100_00, kind: "unknown", source: "", official: false, asOf: "" };
  assert.ok(validateTaxPack(sneaky, 2026).errors.some(e => e.includes("cannot carry a value")));
  const missing = clone(); delete (missing.items as any).lodgingTaxTotalPct;
  assert.ok(validateTaxPack(missing, 2026).errors.some(e => e.includes("missing")));
});
