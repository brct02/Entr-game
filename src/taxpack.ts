// Tax pack: the local tax facts for one US jurisdiction and one tax year.
// A research agent fills one of these in; this file decides whether the engine will accept it.
// Rule: the engine never guesses a tax. A value is either sourced, or it is marked unknown and anything that needs it stops.

export type TaxItemKind = "sourced" | "unknown";
export interface TaxItem {
  value: number | null;   // percent, or cents for money amounts; null when unknown
  kind: TaxItemKind;
  source: string;         // URL of the page the figure came from; empty when unknown
  official: boolean;      // true only if the source is a government site
  asOf: string;           // date or period the source states
  note?: string;
}

export const TAX_ITEM_BOUNDS = {
  stateIndividualIncomeTaxTopPct: [0, 15],
  stateCorporateIncomeTaxPct: [0, 15],
  corporateIncomeTaxExemptionCents: [0, 10_000_000_00],
  sCorpPaysStateIncomeTax: [0, 1],          // 1 = yes, 0 = no
  salesTaxStatePct: [0, 10],
  salesTaxLocalPct: [0, 8],
  preparedFoodAndDrinkTaxable: [0, 1],
  commercialRentSalesTaxPct: [0, 10],
  unemploymentNewEmployerPct: [0, 15],
  unemploymentWageBaseCents: [7_000_00, 100_000_00],
  minimumWageCentsPerHour: [7_25, 30_00],
  lodgingTaxTotalPct: [0, 25],
  localBusinessLicenseCentsPerYear: [0, 50_000_00],
} as const;
export type TaxItemKey = keyof typeof TAX_ITEM_BOUNDS;

export interface TaxPack {
  jurisdiction: { state: string; county: string; city?: string };
  taxYear: number;
  capturedOn: string;        // ISO date the research was done
  reviewedByHuman: boolean;  // a pack stays provisional until a person has checked it
  items: Record<TaxItemKey, TaxItem>;
}

export interface TaxPackCheck { ok: boolean; errors: string[]; unknown: TaxItemKey[]; unofficial: TaxItemKey[]; provisional: boolean; }

export function validateTaxPack(pack: TaxPack, expectedTaxYear: number): TaxPackCheck {
  const errors: string[] = [];
  const unknown: TaxItemKey[] = [], unofficial: TaxItemKey[] = [];
  if (!/^[A-Z]{2}$/.test(pack.jurisdiction.state)) errors.push("state must be a two-letter code");
  if (!pack.jurisdiction.county) errors.push("county is required");
  if (pack.taxYear !== expectedTaxYear) errors.push(`pack is for tax year ${pack.taxYear}, game needs ${expectedTaxYear}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(pack.capturedOn)) errors.push("capturedOn must be an ISO date");
  for (const key of Object.keys(TAX_ITEM_BOUNDS) as TaxItemKey[]) {
    const item = pack.items[key];
    if (!item) { errors.push(`${key}: missing`); continue; }
    if (item.kind === "unknown") {
      if (item.value !== null) errors.push(`${key}: an unknown item cannot carry a value`);
      unknown.push(key); continue;
    }
    if (item.kind !== "sourced") { errors.push(`${key}: kind must be sourced or unknown`); continue; }
    const [lo, hi] = TAX_ITEM_BOUNDS[key];
    if (typeof item.value !== "number" || !Number.isFinite(item.value) || item.value < lo || item.value > hi)
      errors.push(`${key}: value ${item.value} is outside the plausible range ${lo} to ${hi}`);
    if (!/^https:\/\//.test(item.source)) errors.push(`${key}: a sourced item needs an https source link`);
    if (!item.asOf) errors.push(`${key}: a sourced item needs an as-of date`);
    if (!item.official) unofficial.push(key);
  }
  return { ok: errors.length === 0, errors, unknown, unofficial, provisional: !pack.reviewedByHuman || unofficial.length > 0 };
}

/** The engine reads tax facts only through this. An invalid pack or an unknown item stops the game instead of guessing. */
export function taxValue(pack: TaxPack, key: TaxItemKey, expectedTaxYear: number): number {
  const check = validateTaxPack(pack, expectedTaxYear);
  if (!check.ok) throw new Error(`tax pack rejected: ${check.errors.join("; ")}`);
  const item = pack.items[key];
  if (item.kind === "unknown" || item.value === null)
    throw new Error(`${key} is unknown for ${pack.jurisdiction.county}, ${pack.jurisdiction.state}; it must be researched before the game can use it`);
  return item.value;
}
