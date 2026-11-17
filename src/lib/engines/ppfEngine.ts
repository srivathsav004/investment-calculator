export const PPF_MAX_ANNUAL_DEPOSIT = 1_50_000;
export const PPF_MIN_ANNUAL_DEPOSIT = 500;
export const PPF_LOCK_IN_YEARS = 15;
export const PPF_BLOCK_YEARS = 5;
export const PPF_MAX_BLOCKS = 4;
/** Form H extension: total withdrawals per block capped at 60% of the block-opening balance. */
export const PPF_FORM_H_WITHDRAWAL_CAP = 0.6;

export type PpfDepositMode = "lumpBefore5" | "lumpAfter5" | "sipBefore5" | "sipAfter5";
export type PpfExtensionMode = "stop" | "extendNoContrib" | "extendWithContrib";

export const PPF_DEPOSIT_MODE_LABELS: Record<PpfDepositMode, string> = {
  lumpBefore5: "Lump sum on/before 5 Apr",
  lumpAfter5: "Lump sum after 5 Apr",
  sipBefore5: "Monthly on/before 5th",
  sipAfter5: "Monthly after 5th",
};

export const PPF_EXTENSION_MODE_LABELS: Record<PpfExtensionMode, string> = {
  stop: "Stop at 15 years",
  extendNoContrib: "Extend without contributions",
  extendWithContrib: "Extend with contributions (Form H)",
};

export interface PpfInput {
  rate: number;
  annualDeposit: number;
  depositMode: PpfDepositMode;
  extensionMode: PpfExtensionMode;
  /** Number of 5-year extension blocks after the 15-year lock-in (0–4). */
  extensionBlocks: number;
  /** Fraction of the opening balance withdrawn each extension year (0–1). */
  annualWithdrawalPct: number;
}

export interface PpfMonthRow {
  /** 1 = April … 12 = March. */
  month: number;
  withdrawal: number;
  deposit: number;
  /** Balance that earns interest this month (lowest between the 5th and month-end). */
  eligibleBalance: number;
  interestAccrued: number;
  /** Interest credited to the account (non-zero only in March). */
  interestCredited: number;
  /** Account balance at month-end, after any 31 March credit. */
  balance: number;
}

export interface PpfYearRow {
  year: number;
  phase: string;
  opening: number;
  withdrawal: number;
  deposit: number;
  interest: number;
  closing: number;
  cumulativeDeposits: number;
  cumulativeInterest: number;
  cumulativeWithdrawals: number;
  months: PpfMonthRow[];
}

export interface PpfResult {
  rows: PpfYearRow[];
  totalYears: number;
  totalDeposits: number;
  totalInterest: number;
  totalWithdrawals: number;
  maturityValue: number;
}

/**
 * Balance eligible for interest in FY month m (1 = April … 12 = March):
 * the lowest balance between the 5th and the last day of that month.
 */
function eligibleBalance(base: number, annualDeposit: number, mode: PpfDepositMode, month: number): number {
  const monthly = annualDeposit / 12;
  switch (mode) {
    case "lumpBefore5":
      return base + annualDeposit;
    case "lumpAfter5":
      return month === 1 ? base : base + annualDeposit;
    case "sipBefore5":
      return base + monthly * month;
    case "sipAfter5":
      return base + monthly * (month - 1);
  }
}

/** Deposit made in FY month m (1 = April … 12 = March). */
function monthDeposit(annualDeposit: number, mode: PpfDepositMode, month: number): number {
  if (mode === "sipBefore5" || mode === "sipAfter5") return annualDeposit / 12;
  return month === 1 ? annualDeposit : 0;
}

export function simulatePpf(input: PpfInput): PpfResult {
  const deposit = Math.min(Math.max(input.annualDeposit, 0), PPF_MAX_ANNUAL_DEPOSIT);
  const blocks = input.extensionMode === "stop" ? 0 : Math.min(Math.max(Math.round(input.extensionBlocks), 0), PPF_MAX_BLOCKS);
  const totalYears = PPF_LOCK_IN_YEARS + blocks * PPF_BLOCK_YEARS;
  const withdrawalPct = Math.min(Math.max(input.annualWithdrawalPct, 0), 1);

  const rows: PpfYearRow[] = [];
  let balance = 0;
  let cumulativeDeposits = 0;
  let cumulativeInterest = 0;
  let cumulativeWithdrawals = 0;
  let blockCapRemaining = 0;

  for (let year = 1; year <= totalYears; year++) {
    const inExtension = year > PPF_LOCK_IN_YEARS;
    const blockIndex = inExtension ? Math.ceil((year - PPF_LOCK_IN_YEARS) / PPF_BLOCK_YEARS) : 0;
    const isBlockStart = inExtension && (year - PPF_LOCK_IN_YEARS - 1) % PPF_BLOCK_YEARS === 0;
    const opening = balance;

    if (isBlockStart) blockCapRemaining = opening * PPF_FORM_H_WITHDRAWAL_CAP;

    let withdrawal = 0;
    if (inExtension && withdrawalPct > 0) {
      const requested = opening * withdrawalPct;
      withdrawal =
        input.extensionMode === "extendWithContrib" ? Math.min(requested, blockCapRemaining) : Math.min(requested, opening);
      withdrawal = Math.floor(withdrawal);
      if (input.extensionMode === "extendWithContrib") blockCapRemaining -= withdrawal;
    }

    const base = opening - withdrawal;
    const yearDeposit = !inExtension || input.extensionMode === "extendWithContrib" ? deposit : 0;

    const monthRows: PpfMonthRow[] = [];
    let interestAccrued = 0;
    let runningBalance = base;
    for (let month = 1; month <= 12; month++) {
      const eligible = eligibleBalance(base, yearDeposit, input.depositMode, month);
      const accrued = eligible * (input.rate / 12);
      const monthlyDeposit = monthDeposit(yearDeposit, input.depositMode, month);
      interestAccrued += accrued;
      runningBalance += monthlyDeposit;
      monthRows.push({
        month,
        withdrawal: month === 1 ? withdrawal : 0,
        deposit: monthlyDeposit,
        eligibleBalance: eligible,
        interestAccrued: accrued,
        interestCredited: 0,
        balance: runningBalance,
      });
    }
    const interest = Math.round(interestAccrued);
    monthRows[11].interestCredited = interest;
    monthRows[11].balance += interest;

    balance = base + yearDeposit + interest;
    cumulativeDeposits += yearDeposit;
    cumulativeInterest += interest;
    cumulativeWithdrawals += withdrawal;

    rows.push({
      year,
      phase: inExtension ? `Ext. block ${blockIndex}` : "Lock-in",
      opening,
      withdrawal,
      deposit: yearDeposit,
      interest,
      closing: balance,
      cumulativeDeposits,
      cumulativeInterest,
      cumulativeWithdrawals,
      months: monthRows,
    });
  }

  return {
    rows,
    totalYears,
    totalDeposits: cumulativeDeposits,
    totalInterest: cumulativeInterest,
    totalWithdrawals: cumulativeWithdrawals,
    maturityValue: balance,
  };
}

/** Effective annual yield earned on deposits, given the deposit-timing mode. */
export function ppfFirstYearEffectiveYield(rate: number, mode: PpfDepositMode): number {
  const deposit = 12_000;
  let interest = 0;
  for (let month = 1; month <= 12; month++) interest += eligibleBalance(0, deposit, mode, month) * (rate / 12);
  return interest / deposit;
}
