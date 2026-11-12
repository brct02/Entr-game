// Owner employment taxes for tax year 2026, federal only. Deterministic, integer cents.
// Covers self-employment tax (sole proprietor or default LLC) and payroll tax on an S corporation owner's salary.
// NOT covered yet: income tax, the deduction for half of self-employment tax, the qualified business income deduction,
// state taxes. Education, not tax advice.

export const TAX_YEAR = 2026;
export const SS_WAGE_BASE_CENTS = 184_500_00; // 2026 Social Security wage base
const SS_RATE = 0.124, MEDICARE_RATE = 0.029, SE_FACTOR = 0.9235;
const ADDL_MEDICARE_RATE = 0.009, ADDL_MEDICARE_THRESHOLD_CENTS = 200_000_00; // single filer

/** Self-employment tax on a year's net profit. Owed whether or not the owner took the money out. */
export function selfEmploymentTax(netProfitCents: number): number {
  if (netProfitCents <= 0) return 0;
  const base = Math.round(netProfitCents * SE_FACTOR);
  return Math.round(Math.min(base, SS_WAGE_BASE_CENTS) * SS_RATE + base * MEDICARE_RATE
    + Math.max(0, base - ADDL_MEDICARE_THRESHOLD_CENTS) * ADDL_MEDICARE_RATE);
}

/** Both halves of payroll tax on an S corporation owner's salary. Distributions above the salary are not taxed here. */
export function sCorpPayrollTax(salaryCents: number): number {
  if (salaryCents <= 0) return 0;
  return Math.round(Math.min(salaryCents, SS_WAGE_BASE_CENTS) * SS_RATE + salaryCents * MEDICARE_RATE
    + Math.max(0, salaryCents - ADDL_MEDICARE_THRESHOLD_CENTS) * ADDL_MEDICARE_RATE);
}

export interface EntityComparison {
  soleProprietorTaxCents: number; sCorpTaxCents: number; sCorpAdminCents: number;
  sCorpSavingCents: number; // positive means the S corporation election leaves the owner better off
  salaryUsedCents: number; warning: string | null;
}

/**
 * Compare the two for one year. profitBeforeOwnerPayCents is what the business earns before paying the owner anything.
 * reasonableSalaryCents is what it would cost to hire someone to do the owner's job; the IRS expects at least that
 * before distributions. If profit is below it, the whole profit is salary and the election saves nothing.
 */
export function compareEntities(profitBeforeOwnerPayCents: number, reasonableSalaryCents: number, sCorpAdminCents: number): EntityComparison {
  const sole = selfEmploymentTax(profitBeforeOwnerPayCents);
  // Salary plus the employer's half of payroll tax must fit inside profit.
  const maxSalary = Math.max(0, Math.floor(profitBeforeOwnerPayCents / (1 + (SS_RATE + MEDICARE_RATE) / 2)));
  const salary = Math.min(reasonableSalaryCents, maxSalary);
  const sCorp = sCorpPayrollTax(salary);
  return {
    soleProprietorTaxCents: sole, sCorpTaxCents: sCorp, sCorpAdminCents,
    sCorpSavingCents: sole - sCorp - sCorpAdminCents, salaryUsedCents: salary,
    warning: salary < reasonableSalaryCents ? "Profit does not cover a reasonable salary, so there is nothing left to take as distributions." : null,
  };
}
