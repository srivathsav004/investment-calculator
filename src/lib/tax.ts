export type TaxRegime = "new" | "old";
export type ValueMode = "nominal" | "real";

export const TAX_SLABS = [0, 0.1, 0.2, 0.3] as const;

/** Section 80TTA: savings-account interest deduction, Old Regime only. */
export const SECTION_80TTA_LIMIT = 10_000;

export interface TaxContext {
  slab: number;
  regime: TaxRegime;
}

/** 80TTA deduction available on savings-account interest (never on FD interest). */
export function section80TTA(savingsInterest: number, regime: TaxRegime): number {
  if (regime !== "old") return 0;
  return Math.min(SECTION_80TTA_LIMIT, Math.max(0, savingsInterest));
}

/** Tax payable at the flat marginal slab on taxable income (never negative). */
export function taxAtSlab(taxableIncome: number, slab: number): number {
  return Math.max(0, taxableIncome) * slab;
}

/** Yield a fully-taxable instrument must offer to match a tax-free yield. */
export function preTaxEquivalent(taxFreeRate: number, slab: number): number {
  return slab >= 1 ? Number.POSITIVE_INFINITY : taxFreeRate / (1 - slab);
}

export function postTaxRate(rate: number, slab: number): number {
  return rate * (1 - slab);
}
