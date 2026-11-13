// Builds web/dist/floor-plan.html: one self-contained page that runs the real engine in the browser.
// The page does not re-implement any rule. This script strips the types from the engine's own source files,
// joins them into one script, and checks the joined copy gives the same answers as the engine itself.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { runInNewContext } from "node:vm";
import { runCoffee, checkCoffeeLayout } from "../src/coffee.ts";
import { MIAMI_COFFEE } from "../src/markets/miami-coffee.ts";

const root = new URL("..", import.meta.url).pathname;
const files = ["ledger", "schedules", "rng", "tax", "taxpack", "taxpacks/fl-miami-dade", "coffee", "markets/miami-coffee"];
const EXPORTS = ["runCoffee", "checkCoffeeLayout", "businessTaxForSeats", "MIAMI_COFFEE", "MIAMI_COFFEE_LOCATIONS"];

const body = files.map(f => {
  const js = stripTypeScriptTypes(readFileSync(`${root}src/${f}.ts`, "utf8"))
    // Imports go, since everything lives in one scope; an import renamed with "as" becomes a plain alias.
    .replace(/^\s*import\s[^;]*;\s*$/gm, stmt => [...stmt.matchAll(/(\w+)\s+as\s+(\w+)/g)].map(m => `const ${m[2]} = ${m[1]};`).join("\n"))
    .replace(/^export\s+(?=const|function|class|async)/gm, "");
  if (/^\s*(import|export)\s/m.test(js)) throw new Error(`${f}: an import or export survived bundling`);
  return `// ---- ${f} ----\n${js}`;
}).join("\n");
const engine = `const ENGINE = (() => {\n"use strict";\n${body}\nreturn { ${EXPORTS.join(", ")} };\n})();`;

// Same answers as the engine, or no page.
const E = runInNewContext(`${engine}; ENGINE`, { Math, Number, Object, Array, Map, Error, Infinity, console });
const cfg = { ...MIAMI_COFFEE, loan: undefined, personalCashCents: 900_000_00, contributionCents: 600_000_00 };
const mine = runCoffee(cfg).months.map(m => m.revenueCents);
const theirs = E.runCoffee({ ...E.MIAMI_COFFEE, loan: undefined, personalCashCents: 900_000_00, contributionCents: 600_000_00 }).months.map((m: any) => m.revenueCents);
if (JSON.stringify(mine) !== JSON.stringify(theirs)) throw new Error("bundled engine disagrees with the engine");
const a = checkCoffeeLayout(1000, { ...cfg.layout, tableSeats: 40 }, cfg.layoutRules).errors;
const b = E.checkCoffeeLayout(1000, { ...cfg.layout, tableSeats: 40 }, cfg.layoutRules).errors;
if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error("bundled layout check disagrees with the engine");

const html = readFileSync(`${root}web/floor-plan.template.html`, "utf8");
if (!html.includes("/*__ENGINE__*/")) throw new Error("template has no engine marker");
mkdirSync(`${root}web/dist`, { recursive: true });
writeFileSync(`${root}web/dist/floor-plan.html`, html.replace("/*__ENGINE__*/", () => engine));
console.log(`built web/dist/floor-plan.html (${Math.round(engine.length / 1024)} KB of engine, checked against the source)`);
