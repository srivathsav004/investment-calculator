import { section80TTA, type TaxRegime } from "@/lib/tax";
import { sweepOneYearPostTaxYield, type SweepYieldConfig } from "@/lib/engines/sweepEngine";

export interface IdfcSlab {
  /** Upper bound of the slab in ₹ (Infinity for the last slab). */
  upTo: number;
  rate: number;
}

export const IDFC_DEFAULT_SLABS: readonly IdfcSlab[] = [
  { upTo: 3_00_000, rate: 0.025 },
  { upTo: 25_00_000, rate: 0.07 },
  { upTo: Number.POSITIVE_INFINITY, rate: 0.06 },
];

/** Days in each FY month, April → March (non-leap year). */
export const FY_MONTH_DAYS = [30, 31, 30, 31, 31, 30, 31, 30, 31, 31, 28, 31] as const;
const DAYS_IN_YEAR = 365;

/** Annualised interest on a balance using progressive (marginal) slabs. */
export function progressiveAnnualInterest(balance: number, slabs: readonly IdfcSlab[] = IDFC_DEFAULT_SLABS): number {
  let interest = 0;
  let lower = 0;
  for (const slab of slabs) {
    if (balance <= lower) break;
    interest += (Math.min(balance, slab.upTo) - lower) * slab.rate;
    lower = slab.upTo;
  }
  return interest;
}

export function blendedRate(balance: number, slabs: readonly IdfcSlab[] = IDFC_DEFAULT_SLABS): number {
  return balance > 0 ? progressiveAnnualInterest(balance, slabs) / balance : 0;
}

export interface IdfcInput {
  initialBalance: number;
  monthlySurplus: number;
  annualWithdrawal: number;
  withdrawalMonth: number;
  years: number;
  taxSlab: number;
  regime: TaxRegime;
  slabs?: readonly IdfcSlab[];
}

export interface IdfcYearRow {
  year: number;
  deposits: number;
  withdrawals: number;
  interest: number;
  deduction80TTA: number;
  taxableInterest: number;
  tax: number;
  closing: number;
  effectiveRate: number;
  cumulativeDeposits: number;
  cumulativeWithdrawals: number;
  cumulativeInterest: number;
  cumulativeTax: number;
}

export interface IdfcResult {
  rows: IdfcYearRow[];
  finalBalance: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalInterest: number;
  totalTax: number;
}

/**
 * Daily-balance progressive interest, credited and compounded monthly.
 * Deposits land on day 1 of each month, so the balance is constant within a month.
 * Tax (after 80TTA in the Old Regime) is debited from the account on 31 March.
 */
export function simulateIdfc(input: IdfcInput): IdfcResult {
  const slabs = input.slabs ?? IDFC_DEFAULT_SLABS;
  let balance = input.initialBalance;
  const rows: IdfcYearRow[] = [];
  let cumulativeDeposits = input.initialBalance;
  let cumulativeWithdrawals = 0;
  let cumulativeInterest = 0;
  let cumulativeTax = 0;

  for (let year = 1; year <= input.years; year++) {
    let deposits = year === 1 ? input.initialBalance : 0;
    let withdrawals = 0;
    let interest = 0;
    let balanceDays = 0;

    for (let month = 1; month <= 12; month++) {
      balance += input.monthlySurplus;
      deposits += input.monthlySurplus;
      cumulativeDeposits += input.monthlySurplus;

      if (month === input.withdrawalMonth && input.annualWithdrawal > 0) {
        const taken = Math.min(balance, input.annualWithdrawal);
        balance -= taken;
        withdrawals += taken;
      }

      const days = FY_MONTH_DAYS[month - 1];
      const monthInterest = (progressiveAnnualInterest(balance, slabs) * days) / DAYS_IN_YEAR;
      balanceDays += balance * days;
      balance += monthInterest;
      interest += monthInterest;
    }

    const deduction80TTA = section80TTA(interest, input.regime);
    const taxableInterest = Math.max(0, interest - deduction80TTA);
    const tax = Math.min(balance, taxableInterest * input.taxSlab);
    balance -= tax;

    cumulativeWithdrawals += withdrawals;
    cumulativeInterest += interest;
    cumulativeTax += tax;
    const averageBalance = balanceDays / DAYS_IN_YEAR;

    rows.push({
      year,
      deposits,
      withdrawals,
      interest,
      deduction80TTA,
      taxableInterest,
      tax,
      closing: balance,
      effectiveRate: averageBalance > 0 ? interest / averageBalance : 0,
      cumulativeDeposits,
      cumulativeWithdrawals,
      cumulativeInterest,
      cumulativeTax,
    });
  }

  return {
    rows,
    finalBalance: balance,
    totalDeposits: cumulativeDeposits,
    totalWithdrawals: cumulativeWithdrawals,
    totalInterest: cumulativeInterest,
    totalTax: cumulativeTax,
  };
}

export function idfcOneYearPostTaxYield(
  balance: number,
  taxSlab: number,
  regime: TaxRegime,
  slabs: readonly IdfcSlab[] = IDFC_DEFAULT_SLABS,
): number {
  const result = simulateIdfc({
    initialBalance: balance,
    monthlySurplus: 0,
    annualWithdrawal: 0,
    withdrawalMonth: 1,
    years: 1,
    taxSlab,
    regime,
    slabs,
  });
  return (result.finalBalance - balance) / balance;
}

export interface CrossoverPoint {
  balance: number;
  idfcYield: number;
  sweepYield: number;
  idfcInterest: number;
  sweepInterest: number;
}

export interface Crossing {
  balance: number;
  yield: number;
  /** Which product leads once the balance rises past this point. */
  leaderAbove: "idfc" | "sweep";
}

export interface CrossoverAnalysis {
  points: CrossoverPoint[];
  crossings: Crossing[];
  leaderAtMin: "idfc" | "sweep" | "tie";
  leaderAtMax: "idfc" | "sweep" | "tie";
}

/**
 * Post-tax one-year yield of IDFC Progressive Savings vs ICICI Auto-Sweep on a
 * static balance, sampled on a grid and refined by bisection at every sign change.
 */
export function analyseCrossover(
  sweepConfig: SweepYieldConfig,
  minBalance = 1_00_000,
  maxBalance = 25_00_000,
  step = 25_000,
  slabs: readonly IdfcSlab[] = IDFC_DEFAULT_SLABS,
): CrossoverAnalysis {
  const diff = (balance: number) =>
    idfcOneYearPostTaxYield(balance, sweepConfig.taxSlab, sweepConfig.regime, slabs) -
    sweepOneYearPostTaxYield(balance, sweepConfig);

  const points: CrossoverPoint[] = [];
  for (let balance = minBalance; balance <= maxBalance; balance += step) {
    const idfcYield = idfcOneYearPostTaxYield(balance, sweepConfig.taxSlab, sweepConfig.regime, slabs);
    const sweepYield = sweepOneYearPostTaxYield(balance, sweepConfig);
    points.push({
      balance,
      idfcYield,
      sweepYield,
      idfcInterest: idfcYield * balance,
      sweepInterest: sweepYield * balance,
    });
  }

  const crossings: Crossing[] = [];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1].idfcYield - points[i - 1].sweepYield;
    const curr = points[i].idfcYield - points[i].sweepYield;
    if (prev === 0 || Math.sign(prev) === Math.sign(curr)) continue;
    let lo = points[i - 1].balance;
    let hi = points[i].balance;
    let fLo = prev;
    for (let iter = 0; iter < 40 && hi - lo > 1; iter++) {
      const mid = (lo + hi) / 2;
      const fMid = diff(mid);
      if (Math.sign(fMid) === Math.sign(fLo)) {
        lo = mid;
        fLo = fMid;
      } else {
        hi = mid;
      }
    }
    const balance = Math.round((lo + hi) / 2);
    crossings.push({
      balance,
      yield: idfcOneYearPostTaxYield(balance, sweepConfig.taxSlab, sweepConfig.regime, slabs),
      leaderAbove: curr > 0 ? "idfc" : "sweep",
    });
  }

  const leader = (point: CrossoverPoint | undefined): "idfc" | "sweep" | "tie" => {
    if (!point) return "tie";
    const d = point.idfcYield - point.sweepYield;
    if (Math.abs(d) < 1e-9) return "tie";
    return d > 0 ? "idfc" : "sweep";
  };

  return { points, crossings, leaderAtMin: leader(points[0]), leaderAtMax: leader(points[points.length - 1]) };
}
