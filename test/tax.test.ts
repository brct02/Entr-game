import { test } from "node:test";
import assert from "node:assert/strict";
import { selfEmploymentTax, sCorpPayrollTax, compareEntities } from "../src/tax.ts";

test("self-employment tax: 15.3% of 92.35% of profit below the wage base, nothing on a loss", () => {
  assert.equal(selfEmploymentTax(100_000_00), 14_129_55); // 92,350 x 15.3%
  assert.equal(selfEmploymentTax(-5_000_00), 0);
  // Above the wage base only Medicare keeps growing.
  const a = selfEmploymentTax(300_000_00), b = selfEmploymentTax(310_000_00);
  assert.ok(b - a < 10_000_00 * 0.04);
});

test("S corporation payroll tax is 15.3% of salary below the wage base", () => {
  assert.equal(sCorpPayrollTax(70_000_00), 10_710_00);
});

test("the election loses money at low profit and saves at high profit, for the same job", () => {
  const cart = compareEntities(58_000_00, 45_000_00, 2_500_00);
  const shop = compareEntities(90_000_00, 70_000_00, 2_500_00);
  const big = compareEntities(150_000_00, 70_000_00, 2_500_00);
  assert.ok(cart.sCorpSavingCents < 0);
  assert.ok(shop.sCorpSavingCents < 0);
  assert.ok(big.sCorpSavingCents > 5_000_00);
  const thin = compareEntities(40_000_00, 70_000_00, 2_500_00);
  assert.ok(thin.warning && thin.sCorpSavingCents < 0);
});
