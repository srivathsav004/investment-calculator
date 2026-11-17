import { section80TTA, type TaxRegime } from "@/lib/tax";

export const SWEEP_UNIT = 5_000;
export const SWEEP_TDS_THRESHOLD = 40_000;
export const SWEEP_TDS_RATE = 0.1;
/** Premature-break penalty: the broken portion earns (FD rate − 1%) for the period it was held. */
export const SWEEP_BREAK_PENALTY = 0.01;
export const SWEEP_DEFAULT_SAVINGS_RATE = 0.0275;
/** ICICI general-citizen FD bracket for 1 year to under 18 months (Upstox, Nov 2026); its top rate anywhere is 6.60%. */
export const SWEEP_DEFAULT_FD_RATE = 0.0625;
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
  /** Number of equal withdrawals spread across the year, starting at `withdrawalMonth` (default 1). */
  withdrawalsPerYear?: number;
  /** Withdraw only every Nth year (default 1 = every year). `annualWithdrawal` is the total for a withdrawal year. */
  withdrawalEveryYears?: number;
  /** When true a newly swept FD starts earning from the following month instead of the month it was created. */
  fdStartsNextMonth?: boolean;
}

export interface SweepMonthRow {
  /** 1 = April … 12 = March. */
  month: number;
  credited: number;
  withdrawn: number;
  /** Amount moved from savings into a new FD this month. */
  swept: number;
  /** FD principal broken (reverse-swept) this month for the withdrawal. */
  broken: number;
  savingsInterestAccrued: number;
  /** Savings interest credited to the account (quarter-end months only). */
  savingsInterestCredited: number;
  fdInterest: number;
  savingsBalance: number;
  fdBalance: number;
  fdCount: number;
  note?: string;
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
  months: SweepMonthRow[];
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
  /** Simulation month (0-based) in which the FD was opened. */
  openedAt: number;
}

interface YearAccumulator {
  withdrawals: number;
  shortfall: number;
  breakPenalty: number;
  brokenPrincipal: number;
}

function formatRupees(value: number): string {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

export function simulateSweep(input: SweepInput): SweepResult {
  const fds: FixedDeposit[] = [];
  const fdMonthlyFactor = Math.pow(1 + input.fdRate / 4, 1 / 3);
  const penaltyQuarterlyRate = Math.max(0, input.fdRate - SWEEP_BREAK_PENALTY) / 4;
  let savings = input.initialBalance;
  let pendingSavingsInterest = 0;

  const eventsPerYear = Math.min(12, Math.max(1, Math.round(input.withdrawalsPerYear ?? 1)));
  const everyYears = Math.max(1, Math.round(input.withdrawalEveryYears ?? 1));
  const perEvent = input.annualWithdrawal / eventsPerYear;
  const withdrawalMonths = new Set(
    Array.from({ length: eventsPerYear }, (_, k) => ((input.withdrawalMonth - 1 + Math.round((k * 12) / eventsPerYear)) % 12) + 1),
  );

  const rows: SweepYearRow[] = [];
  let cumulativeDeposits = input.initialBalance;
  let cumulativeWithdrawals = 0;
  let cumulativeNetInterest = 0;
  let cumulativeTax = 0;
  let totalPenalty = 0;

  const fdTotal = () => fds.reduce((sum, fd) => sum + fd.value, 0);

  /** Forward sweep: any surplus above the threshold moves into a new FD in ₹5,000 multiples. */
  const sweepExcess = (openedAt: number): number => {
    const excess = savings - input.threshold;
    if (excess < SWEEP_UNIT) return 0;
    const amount = Math.floor(excess / SWEEP_UNIT) * SWEEP_UNIT;
    savings -= amount;
    fds.push({ principal: amount, value: amount, monthsHeld: 0, openedAt });
    return amount;
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
    const monthRows: SweepMonthRow[] = [];

    for (let month = 1; month <= 12; month++) {
      const simMonth = (year - 1) * 12 + month - 1;
      const brokenBefore = acc.brokenPrincipal;
      const monthCredit = input.monthlySurplus + (year === 1 && month === 1 ? input.initialBalance : 0);
      savings += input.monthlySurplus;
      deposits += input.monthlySurplus;
      cumulativeDeposits += input.monthlySurplus;

      let withdrawnNow = 0;
      if (year % everyYears === 0 && withdrawalMonths.has(month) && perEvent > 0) {
        const unmet = withdraw(perEvent, acc);
        withdrawnNow = perEvent - unmet;
        acc.withdrawals += withdrawnNow;
        acc.shortfall += unmet;
      }

      const swept = sweepExcess(simMonth);

      const savingsAccrued = savings * (input.savingsRate / 12);
      pendingSavingsInterest += savingsAccrued;
      let fdInterestNow = 0;
      for (const fd of fds) {
        if (input.fdStartsNextMonth && fd.openedAt === simMonth) continue;
        const grown = fd.value * fdMonthlyFactor;
        fdInterestNow += grown - fd.value;
        fd.value = grown;
        fd.monthsHeld += 1;
      }
      fdInterestGross += fdInterestNow;

      let savingsCredited = 0;
      if (month % 3 === 0) {
        savingsCredited = pendingSavingsInterest;
        savings += pendingSavingsInterest;
        savingsInterest += pendingSavingsInterest;
        pendingSavingsInterest = 0;
      }

      const notes: string[] = [];
      if (year === 1 && month === 1 && input.initialBalance > 0) notes.push(`Opening balance ${formatRupees(input.initialBalance)} included in credits`);
      if (swept > 0) notes.push(`${formatRupees(swept)} swept into FD #${fds.length}`);
      if (acc.brokenPrincipal - brokenBefore > 0.005) notes.push(`Reverse sweep broke ${formatRupees(acc.brokenPrincipal - brokenBefore)} of FD principal`);
      if (swept > 0 && input.fdStartsNextMonth) notes.push("new FD earns from next month");
      monthRows.push({
        month,
        credited: monthCredit,
        withdrawn: withdrawnNow,
        swept,
        broken: acc.brokenPrincipal - brokenBefore,
        savingsInterestAccrued: savingsAccrued,
        savingsInterestCredited: savingsCredited,
        fdInterest: fdInterestNow,
        savingsBalance: savings,
        fdBalance: fdTotal(),
        fdCount: fds.length,
        note: notes.length ? notes.join(" · ") : undefined,
      });
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
    const lastMonth = monthRows[monthRows.length - 1];
    lastMonth.savingsBalance = savings;
    lastMonth.fdBalance = fdTotal();
    lastMonth.fdCount = fds.length;
    lastMonth.note = [lastMonth.note, `31 Mar: tax ${formatRupees(tax)}${tds > 0 ? ` (TDS ${formatRupees(tds)} already cut from FDs)` : ""} settled`].filter(Boolean).join(" · ");

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
      months: monthRows,
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

export interface SweepScenarioDef {
  key: "none" | "occasional" | "frequent";
  label: string;
  description: string;
  withdrawalsPerYear: number;
  withdrawalEveryYears: number;
  annualWithdrawal: number;
}

export interface SweepScenarioOutcome {
  scenario: SweepScenarioDef;
  threshold: number;
  finalTotal: number;
  netInterest: number;
  tax: number;
  penalty: number;
  withdrawn: number;
  shortfall: number;
}

/** The three withdrawal habits compared on the sweep page. `amount` is the total taken in a withdrawal year. */
export function sweepScenarioDefs(amount: number): SweepScenarioDef[] {
  return [
    { key: "none", label: "Never withdraw", description: "Money stays put for the whole horizon", withdrawalsPerYear: 1, withdrawalEveryYears: 1, annualWithdrawal: 0 },
    { key: "occasional", label: "Occasional", description: `${formatRupees(amount)} once every 3 years`, withdrawalsPerYear: 1, withdrawalEveryYears: 3, annualWithdrawal: amount },
    { key: "frequent", label: "Frequent", description: `${formatRupees(amount)} a year, taken as 12 monthly withdrawals`, withdrawalsPerYear: 12, withdrawalEveryYears: 1, annualWithdrawal: amount },
  ];
}

/** Every scenario at every threshold, with everything else (cash-flows, rates, tax) held equal. */
export function compareSweepScenarios(base: SweepInput, amount: number): SweepScenarioOutcome[] {
  const outcomes: SweepScenarioOutcome[] = [];
  for (const scenario of sweepScenarioDefs(amount)) {
    for (const threshold of SWEEP_THRESHOLDS) {
      const result = simulateSweep({
        ...base,
        threshold,
        annualWithdrawal: scenario.annualWithdrawal,
        withdrawalsPerYear: scenario.withdrawalsPerYear,
        withdrawalEveryYears: scenario.withdrawalEveryYears,
      });
      outcomes.push({
        scenario,
        threshold,
        finalTotal: result.finalTotal,
        netInterest: result.totalNetInterest,
        tax: result.totalTax,
        penalty: result.totalPenalty,
        withdrawn: result.totalWithdrawals,
        shortfall: result.rows.reduce((sum, r) => sum + r.shortfall, 0),
      });
    }
  }
  return outcomes;
}
