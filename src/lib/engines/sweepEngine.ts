import { section80TTA, type TaxRegime } from "@/lib/tax";

export const SWEEP_UNIT = 5_000;
export const SWEEP_TDS_THRESHOLD = 40_000;
export const SWEEP_TDS_RATE = 0.1;
/** Premature-break penalty: the broken portion earns (FD rate − 1%) for the period it was held. */
export const SWEEP_BREAK_PENALTY = 0.01;
export const SWEEP_DEFAULT_SAVINGS_RATE = 0.0275;
export const SWEEP_DEFAULT_FD_RATE = 0.0655;
export const SWEEP_THRESHOLDS = [15_000, 30_000] as const;

export interface SweepInput {
  initialBalance: number;
  monthlySurplus: number;
  threshold: number;
  savingsRate: number;
  fdRate: number;
  annualWithdrawal: number;
  /** FY month (1 = April … 12 = March) in which the emergency withdrawal happens. */
  withdrawalMonth: number;
  years: number;
  taxSlab: number;
  regime: TaxRegime;
  tdsEnabled: boolean;
}

export interface SweepYearRow {
  year: number;
  deposits: number;
  withdrawals: number;
  shortfall: number;
  savingsInterest: number;
  fdInterest: number;
  breakPenalty: number;
  brokenPrincipal: number;
  deduction80TTA: number;
  taxableInterest: number;
  tds: number;
  tax: number;
  savingsBalance: number;
  fdBalance: number;
  fdCount: number;
  total: number;
  cumulativeDeposits: number;
  cumulativeWithdrawals: number;
  cumulativeNetInterest: number;
  cumulativeTax: number;
}

export interface SweepResult {
  rows: SweepYearRow[];
  finalTotal: number;
  totalDeposits: number;
  totalWithdrawals: number;
  totalNetInterest: number;
  totalTax: number;
  totalPenalty: number;
}

interface FixedDeposit {
  principal: number;
  value: number;
  monthsHeld: number;
}

interface YearAccumulator {
  withdrawals: number;
  shortfall: number;
  breakPenalty: number;
  brokenPrincipal: number;
}

export function simulateSweep(input: SweepInput): SweepResult {
  const fds: FixedDeposit[] = [];
  const fdMonthlyFactor = Math.pow(1 + input.fdRate / 4, 1 / 3);
  const penaltyQuarterlyRate = Math.max(0, input.fdRate - SWEEP_BREAK_PENALTY) / 4;
  let savings = input.initialBalance;
  let pendingSavingsInterest = 0;

  const rows: SweepYearRow[] = [];
  let cumulativeDeposits = input.initialBalance;
  let cumulativeWithdrawals = 0;
  let cumulativeNetInterest = 0;
  let cumulativeTax = 0;
  let totalPenalty = 0;

  const fdTotal = () => fds.reduce((sum, fd) => sum + fd.value, 0);

  /** Forward sweep: any surplus above the threshold moves into a new FD in ₹5,000 multiples. */
  const sweepExcess = () => {
    const excess = savings - input.threshold;
    if (excess < SWEEP_UNIT) return;
    const amount = Math.floor(excess / SWEEP_UNIT) * SWEEP_UNIT;
    savings -= amount;
    fds.push({ principal: amount, value: amount, monthsHeld: 0 });
  };

  /** Pay `amount` from savings first, then reverse-sweep FDs LIFO in ₹5,000 units. Returns the unmet amount. */
  const withdraw = (amount: number, acc: YearAccumulator): number => {
    const fromSavings = Math.min(savings, amount);
    savings -= fromSavings;
    const shortfall = amount - fromSavings;
    if (shortfall <= 0) return 0;

    let toRaise = Math.ceil(shortfall / SWEEP_UNIT) * SWEEP_UNIT;
    let raised = 0;
    for (let i = fds.length - 1; i >= 0 && toRaise > 0.005; i--) {
      const fd = fds[i];
      const penalisedValue = fd.principal * Math.pow(1 + penaltyQuarterlyRate, fd.monthsHeld / 3);
      if (penalisedValue <= 0) continue;
      const fraction = Math.min(1, toRaise / penalisedValue);
      const proceeds = penalisedValue * fraction;
      acc.breakPenalty += (fd.value - penalisedValue) * fraction;
      acc.brokenPrincipal += fd.principal * fraction;
      fd.principal *= 1 - fraction;
      fd.value *= 1 - fraction;
      raised += proceeds;
      toRaise -= proceeds;
      if (fraction >= 1) fds.splice(i, 1);
    }

    savings += raised;
    const paid = Math.min(savings, shortfall);
    savings -= paid;
    return shortfall - paid;
  };

  for (let year = 1; year <= input.years; year++) {
    const acc: YearAccumulator = { withdrawals: 0, shortfall: 0, breakPenalty: 0, brokenPrincipal: 0 };
    let deposits = year === 1 ? input.initialBalance : 0;
    let savingsInterest = 0;
    let fdInterestGross = 0;

    for (let month = 1; month <= 12; month++) {
      savings += input.monthlySurplus;
      deposits += input.monthlySurplus;
      cumulativeDeposits += input.monthlySurplus;

      if (month === input.withdrawalMonth && input.annualWithdrawal > 0) {
        const unmet = withdraw(input.annualWithdrawal, acc);
        acc.withdrawals += input.annualWithdrawal - unmet;
        acc.shortfall += unmet;
      }

      sweepExcess();

      pendingSavingsInterest += savings * (input.savingsRate / 12);
      for (const fd of fds) {
        const grown = fd.value * fdMonthlyFactor;
        fdInterestGross += grown - fd.value;
        fd.value = grown;
        fd.monthsHeld += 1;
      }

      if (month % 3 === 0) {
        savings += pendingSavingsInterest;
        savingsInterest += pendingSavingsInterest;
        pendingSavingsInterest = 0;
      }
    }

    const fdInterestNet = fdInterestGross - acc.breakPenalty;
    const deduction80TTA = section80TTA(savingsInterest, input.regime);
    const taxableInterest = Math.max(0, savingsInterest - deduction80TTA + fdInterestNet);
    const tax = taxableInterest * input.taxSlab;

    let tds = 0;
    if (input.tdsEnabled && fdInterestNet > SWEEP_TDS_THRESHOLD) {
      const fdValue = fdTotal();
      tds = Math.min(fdInterestNet * SWEEP_TDS_RATE, fdValue);
      if (fdValue > 0) {
        const keep = 1 - tds / fdValue;
        for (const fd of fds) {
          fd.value *= keep;
          fd.principal *= keep;
        }
      }
    }

    const balanceDue = tax - tds;
    if (balanceDue > 0) {
      withdraw(balanceDue, acc);
    } else {
      savings -= balanceDue;
    }

    const netInterest = savingsInterest + fdInterestNet;
    cumulativeWithdrawals += acc.withdrawals;
    cumulativeNetInterest += netInterest;
    cumulativeTax += tax;
    totalPenalty += acc.breakPenalty;

    const fdBalance = fdTotal();
    rows.push({
      year,
      deposits,
      withdrawals: acc.withdrawals,
      shortfall: acc.shortfall,
      savingsInterest,
      fdInterest: fdInterestGross,
      breakPenalty: acc.breakPenalty,
      brokenPrincipal: acc.brokenPrincipal,
      deduction80TTA,
      taxableInterest,
      tds,
      tax,
      savingsBalance: savings,
      fdBalance,
      fdCount: fds.length,
      total: savings + fdBalance,
      cumulativeDeposits,
      cumulativeWithdrawals,
      cumulativeNetInterest,
      cumulativeTax,
    });
  }

  const last = rows[rows.length - 1];
  return {
    rows,
    finalTotal: last ? last.total : input.initialBalance,
    totalDeposits: cumulativeDeposits,
    totalWithdrawals: cumulativeWithdrawals,
    totalNetInterest: cumulativeNetInterest,
    totalTax: cumulativeTax,
    totalPenalty,
  };
}

export type SweepYieldConfig = Pick<SweepInput, "threshold" | "savingsRate" | "fdRate" | "taxSlab" | "regime">;

/** Post-tax one-year yield on a static balance (no surplus, no withdrawals). */
export function sweepOneYearPostTaxYield(balance: number, config: SweepYieldConfig): number {
  const result = simulateSweep({
    ...config,
    initialBalance: balance,
    monthlySurplus: 0,
    annualWithdrawal: 0,
    withdrawalMonth: 1,
    years: 1,
    tdsEnabled: false,
  });
  return (result.finalTotal - balance) / balance;
}
