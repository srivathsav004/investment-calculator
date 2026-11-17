/** Statutory PF wage ceiling (₹/month) in force since 17 Sep 2026 (Gazette S.O. 5109(E)). */
export const EPF_WAGE_CEILING = 25_000;
/** Ceiling that applied from Sept 2014 until 16 Sep 2026. */
export const EPF_WAGE_CEILING_OLD = 15_000;
/** The new ceiling took effect on 17 September 2026, so September 2026 is split 16 days old / 14 days new. */
export const EPF_CEILING_CHANGE = { year: 2026, month: 9, oldDays: 16, daysInMonth: 30 } as const;
export const EPF_EMPLOYEE_RATE = 0.12;
export const EPF_EMPLOYER_RATE = 0.12;
export const EPS_RATE = 0.0833;
/** EPS contribution cap = 8.33% of the statutory ceiling. */
export const EPS_MONTHLY_CAP = Math.round(EPS_RATE * EPF_WAGE_CEILING);
/** Employee (EPF + VPF) contributions above this per FY earn taxable interest — Rule 9D. */
export const EPF_TAX_FREE_EMPLOYEE_LIMIT = 2_50_000;
/** Interest rates EPFO has already declared, keyed by the FY's starting calendar year. FY2025-26 = 8.25%. */
export const EPF_DECLARED_RATES: Record<number, number> = { 2025: 0.0825 };
/** An operative EPF account earns interest up to this age; after it the account is inoperative. */
export const EPF_INTEREST_END_AGE = 58;
export const EPS_PENSION_AGE = 58;
export const EPS_MIN_SERVICE_YEARS = 10;
export const EPS_MAX_PENSIONABLE_SERVICE = 35;
export const EPS_WEIGHTAGE_YEARS = 2;
export const EPS_WEIGHTAGE_AFTER_YEARS = 20;
export const EPS_EARLY_REDUCTION_PER_YEAR = 0.04;
export const EPS_MIN_PENSION = 1_000;
export const EPS_PENSION_DIVISOR = 70;

export interface EpfInput {
  /** Rate for years EPFO hasn't declared yet (FY2025-26 always uses the declared 8.25%). */
  rate: number;
  /** Basic + DA per month, held flat for the whole timeline. */
  monthlyBasic: number;
  vpfPct: number;
  capWageAtCeiling: boolean;
  /** Member of EPS-95. False when wages exceeded the ceiling at joining — the full 12% then goes to EPF. */
  epsMember: boolean;
  /** Date of birth, YYYY-MM-DD. */
  dob: string;
  /** Month the UAN's contributions began, YYYY-MM. */
  startMonth: string;
  /** Age at which contributions stop (50–58). */
  retireAge: number;
  taxSlab: number;
}

export interface EpfMonthlySplit {
  basic: number;
  pfWage: number;
  employee: number;
  vpf: number;
  employerTotal: number;
  eps: number;
  employerEpf: number;
}

export interface EpfMonthRow {
  /** e.g. "Aug 2025". */
  label: string;
  basic: number;
  /** Effective wage ceiling (blended for Sept 2026). */
  ceiling: number;
  employee: number;
  vpf: number;
  employerEpf: number;
  eps: number;
  /** Interest accrued this month (tax-free + taxable bucket); credited on 31 March. */
  interestAccrued: number;
  /** Interest credited to the balance this month (31 March, or the final month). */
  interestCredited: number;
  balance: number;
  note?: string;
}

export interface EpfYearRow {
  /** 1 = the FY the UAN started in. */
  year: number;
  /** Calendar year the FY begins in (2025 for FY25-26). */
  fyStart: number;
  fy: string;
  monthsInYear: number;
  rate: number;
  rateDeclared: boolean;
  monthlyBasic: number;
  employeeContribution: number;
  vpfContribution: number;
  employerEpfContribution: number;
  epsContribution: number;
  taxableContribution: number;
  interest: number;
  taxFreeInterest: number;
  taxableInterest: number;
  taxOnInterest: number;
  taxFreeBalance: number;
  taxableBalance: number;
  epfBalance: number;
  pensionCorpus: number;
  cumulativeContributions: number;
  cumulativeTax: number;
  months: EpfMonthRow[];
}

export interface EpfEraSplit {
  label: string;
  ceiling: number;
  split: EpfMonthlySplit;
}

export interface EpfPension {
  eligible: boolean;
  serviceYears: number;
  pensionableService: number;
  pensionableWage: number;
  monthlyPension: number;
  earlyReduction: number;
}

export interface EpfResult {
  rows: EpfYearRow[];
  eraSplits: EpfEraSplit[];
  retirementDate: string;
  lastContributionMonth: string;
  contributionMonths: number;
  finalEpfBalance: number;
  finalTaxFreeBalance: number;
  finalTaxableBalance: number;
  finalPensionCorpus: number;
  totalEmployee: number;
  totalEmployer: number;
  totalInterest: number;
  totalTax: number;
  pension: EpfPension;
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function epsCapFor(ceiling: number): number {
  return Math.round(EPS_RATE * ceiling);
}

export function epfMonthlySplit(
  monthlyBasic: number,
  vpfPct: number,
  capWageAtCeiling: boolean,
  ceiling: number = EPF_WAGE_CEILING,
  epsMember = true,
): EpfMonthlySplit {
  const pfWage = capWageAtCeiling ? Math.min(monthlyBasic, ceiling) : monthlyBasic;
  const employee = Math.round(pfWage * EPF_EMPLOYEE_RATE);
  const vpf = Math.round(monthlyBasic * vpfPct);
  const employerTotal = Math.round(pfWage * EPF_EMPLOYER_RATE);
  const eps = epsMember ? Math.min(Math.round(Math.min(pfWage, ceiling) * EPS_RATE), epsCapFor(ceiling)) : 0;
  return { basic: monthlyBasic, pfWage, employee, vpf, employerTotal, eps, employerEpf: employerTotal - eps };
}

interface CeilingInfo {
  ceiling: number;
  /** Share of the month at the old ceiling (1 before the change, 0 after, 16/30 in Sept 2026). */
  oldShare: number;
}

function ceilingFor(year: number, month: number): CeilingInfo {
  const change = EPF_CEILING_CHANGE;
  if (year < change.year || (year === change.year && month < change.month)) return { ceiling: EPF_WAGE_CEILING_OLD, oldShare: 1 };
  if (year === change.year && month === change.month) {
    const oldShare = change.oldDays / change.daysInMonth;
    return { ceiling: oldShare * EPF_WAGE_CEILING_OLD + (1 - oldShare) * EPF_WAGE_CEILING, oldShare };
  }
  return { ceiling: EPF_WAGE_CEILING, oldShare: 0 };
}

function blendedSplit(basic: number, input: EpfInput, info: CeilingInfo): EpfMonthlySplit {
  const oldSplit = epfMonthlySplit(basic, input.vpfPct, input.capWageAtCeiling, EPF_WAGE_CEILING_OLD, input.epsMember);
  if (info.oldShare === 1) return oldSplit;
  const newSplit = epfMonthlySplit(basic, input.vpfPct, input.capWageAtCeiling, EPF_WAGE_CEILING, input.epsMember);
  if (info.oldShare === 0) return newSplit;
  const mix = (a: number, b: number) => Math.round(info.oldShare * a + (1 - info.oldShare) * b);
  return {
    basic,
    pfWage: mix(oldSplit.pfWage, newSplit.pfWage),
    employee: mix(oldSplit.employee, newSplit.employee),
    vpf: newSplit.vpf,
    employerTotal: mix(oldSplit.employerTotal, newSplit.employerTotal),
    eps: mix(oldSplit.eps, newSplit.eps),
    employerEpf: mix(oldSplit.employerEpf, newSplit.employerEpf),
  };
}

interface BucketState {
  taxFree: number;
  taxable: number;
}

interface YearFlows {
  /** Employee (EPF + VPF) contribution for each of the 12 months. */
  employeeMonthly: number;
  /** Employer contribution flowing into EPF (excludes EPS) each month. */
  employerMonthly: number;
}

interface BucketYearResult {
  taxFreeInterest: number;
  taxableInterest: number;
  taxableContribution: number;
}

/**
 * One FY of EPF accrual for the cross-asset comparator. Each month's contribution is credited at
 * month-end, so interest for month m runs on the balance at the close of month m − 1.
 * Interest is accrued monthly at rate/12 and credited on 31 March.
 */
function runEpfYear(state: BucketState, flows: YearFlows, rate: number): BucketYearResult {
  const monthlyRate = rate / 12;
  let taxFreeInterest = 0;
  let taxableInterest = 0;
  let employeeYtd = 0;
  let taxableContribution = 0;

  for (let month = 1; month <= 12; month++) {
    taxFreeInterest += state.taxFree * monthlyRate;
    taxableInterest += state.taxable * monthlyRate;

    const room = Math.max(0, EPF_TAX_FREE_EMPLOYEE_LIMIT - employeeYtd);
    const toTaxFree = Math.min(room, flows.employeeMonthly);
    const toTaxable = flows.employeeMonthly - toTaxFree;
    employeeYtd += flows.employeeMonthly;
    taxableContribution += toTaxable;

    state.taxFree += toTaxFree + flows.employerMonthly;
    state.taxable += toTaxable;
  }

  const roundedTaxFree = Math.round(taxFreeInterest);
  const roundedTaxable = Math.round(taxableInterest);
  state.taxFree += roundedTaxFree;
  state.taxable += roundedTaxable;
  return { taxFreeInterest: roundedTaxFree, taxableInterest: roundedTaxable, taxableContribution };
}

function parseDob(dob: string): { year: number; month: number; day: number } {
  const [year, month, day] = dob.split("-").map(Number);
  return { year, month, day };
}

function parseMonth(value: string): { year: number; month: number } {
  const [year, month] = value.split("-").map(Number);
  return { year, month };
}

const fyStartOf = (year: number, month: number) => (month >= 4 ? year : year - 1);
const fyName = (fyStart: number) => `FY${String(fyStart).slice(2)}-${String(fyStart + 1).slice(2)}`;
const monthLabel = (year: number, month: number) => `${MONTH_ABBR[month - 1]} ${year}`;

/** Monthly EPS-95 pension estimate from the last-60-month average wage. */
function estimatePension(input: EpfInput, serviceMonths: number, wages: number[]): EpfPension {
  const serviceYears = serviceMonths / 12;
  const wholeYears = Math.floor(serviceMonths / 12) + (serviceMonths % 12 >= 6 ? 1 : 0);
  const weightage = wholeYears >= EPS_WEIGHTAGE_AFTER_YEARS ? EPS_WEIGHTAGE_YEARS : 0;
  const pensionableService = Math.min(EPS_MAX_PENSIONABLE_SERVICE, wholeYears + weightage);
  const recent = wages.slice(-60);
  const average = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
  const pensionableWage = Math.min(average, EPF_WAGE_CEILING);
  const eligible = input.epsMember && serviceYears >= EPS_MIN_SERVICE_YEARS;
  const earlyReduction = Math.max(0, EPS_PENSION_AGE - input.retireAge) * EPS_EARLY_REDUCTION_PER_YEAR;
  const base = (pensionableWage * pensionableService) / EPS_PENSION_DIVISOR;
  const monthlyPension = eligible ? Math.max(EPS_MIN_PENSION, Math.round(base * (1 - earlyReduction))) : 0;
  return { eligible, serviceYears, pensionableService, pensionableWage, monthlyPension, earlyReduction };
}

/**
 * Calendar-month EPF timeline from the UAN's first contribution month until the month before the
 * member reaches `retireAge`. Interest accrues monthly on the running balance and is credited each
 * 31 March (and on the last month); the FY2025-26 rate is the declared 8.25%.
 * After the 58th birthday the account is inoperative and earns nothing, so the timeline stops there.
 */
export function simulateEpf(input: EpfInput): EpfResult {
  const dob = parseDob(input.dob);
  const start = parseMonth(input.startMonth);
  const startFy = fyStartOf(start.year, start.month);

  // Last contribution month: the month before the birthday month (contributions stop at the birthday).
  let endYear = dob.year + input.retireAge;
  let endMonth = dob.month - 1;
  if (endMonth === 0) {
    endMonth = 12;
    endYear -= 1;
  }
  const retirementDate = `${dob.year + input.retireAge}-${String(dob.month).padStart(2, "0")}-${String(dob.day).padStart(2, "0")}`;

  const state: BucketState = { taxFree: 0, taxable: 0 };
  const rows: EpfYearRow[] = [];
  const eraSplits: EpfEraSplit[] = [];
  const wages: number[] = [];
  let pensionCorpus = 0;
  let cumulativeContributions = 0;
  let cumulativeTax = 0;
  let totalEmployee = 0;
  let totalEmployer = 0;
  let totalInterest = 0;
  let contributionMonths = 0;

  let year = start.year;
  let month = start.month;
  const isPastEnd = () => year > endYear || (year === endYear && month > endMonth);

  // The month cap also guards against malformed dates, which would otherwise never reach the end.
  while (!isPastEnd() && contributionMonths < 1200) {
    const fyStart = fyStartOf(year, month);
    const declared = fyStart in EPF_DECLARED_RATES;
    const rate = declared ? EPF_DECLARED_RATES[fyStart] : input.rate;
    const monthlyRate = rate / 12;
    const months: EpfMonthRow[] = [];
    let employeeYtd = 0;
    let taxFreeInterest = 0;
    let taxableInterest = 0;
    let taxableContribution = 0;
    let employeeYear = 0;
    let vpfYear = 0;
    let employerEpfYear = 0;
    let epsYear = 0;
    let basicNow = 0;

    while (!isPastEnd() && fyStartOf(year, month) === fyStart && contributionMonths < 1200) {
      const basic = input.monthlyBasic;
      basicNow = basic;
      const info = ceilingFor(year, month);
      const split = blendedSplit(basic, input, info);
      const eraLabel = info.oldShare === 1 ? "Until 16 Sep 2026" : info.oldShare === 0 ? "From 17 Sep 2026" : "September 2026 (blended)";
      if (eraSplits.every((e) => e.label !== eraLabel)) eraSplits.push({ label: eraLabel, ceiling: info.ceiling, split });

      const accruedTaxFree = state.taxFree * monthlyRate;
      const accruedTaxable = state.taxable * monthlyRate;
      taxFreeInterest += accruedTaxFree;
      taxableInterest += accruedTaxable;

      const employeeMonthly = split.employee + split.vpf;
      const room = Math.max(0, EPF_TAX_FREE_EMPLOYEE_LIMIT - employeeYtd);
      const toTaxFree = Math.min(room, employeeMonthly);
      const toTaxable = employeeMonthly - toTaxFree;
      employeeYtd += employeeMonthly;
      taxableContribution += toTaxable;
      state.taxFree += toTaxFree + split.employerEpf;
      state.taxable += toTaxable;

      employeeYear += split.employee;
      vpfYear += split.vpf;
      employerEpfYear += split.employerEpf;
      epsYear += split.eps;
      wages.push(Math.min(split.pfWage, info.ceiling));
      contributionMonths += 1;

      const notes: string[] = [];
      if (info.oldShare > 0 && info.oldShare < 1) notes.push("Ceiling split: 16/30 days at ₹15,000 + 14/30 at ₹25,000");
      if (toTaxable > 0) notes.push(`₹${Math.round(toTaxable).toLocaleString("en-IN")} above the ₹2.5L limit → taxable bucket`);
      months.push({
        label: monthLabel(year, month),
        basic,
        ceiling: info.ceiling,
        employee: split.employee,
        vpf: split.vpf,
        employerEpf: split.employerEpf,
        eps: split.eps,
        interestAccrued: accruedTaxFree + accruedTaxable,
        interestCredited: 0,
        balance: state.taxFree + state.taxable,
        note: notes.length ? notes.join(" · ") : undefined,
      });

      month += 1;
      if (month === 13) {
        month = 1;
        year += 1;
      }
    }

    const roundedTaxFree = Math.round(taxFreeInterest);
    const roundedTaxable = Math.round(taxableInterest);
    state.taxFree += roundedTaxFree;
    state.taxable += roundedTaxable;
    const last = months[months.length - 1];
    last.interestCredited = roundedTaxFree + roundedTaxable;
    last.balance = state.taxFree + state.taxable;
    const finished = isPastEnd();
    if (finished) {
      last.note = [last.note, `Last contribution — you turn ${input.retireAge} on ${retirementDate}; interest is credited on exit`].filter(Boolean).join(" · ");
    }

    const taxOnInterest = Math.round(roundedTaxable * input.taxSlab);
    pensionCorpus += epsYear;
    cumulativeContributions += employeeYear + vpfYear + employerEpfYear;
    cumulativeTax += taxOnInterest;
    totalEmployee += employeeYear + vpfYear;
    totalEmployer += employerEpfYear + epsYear;
    totalInterest += roundedTaxFree + roundedTaxable;

    rows.push({
      year: fyStart - startFy + 1,
      fyStart,
      fy: fyName(fyStart),
      monthsInYear: months.length,
      rate,
      rateDeclared: declared,
      monthlyBasic: basicNow,
      employeeContribution: employeeYear,
      vpfContribution: vpfYear,
      employerEpfContribution: employerEpfYear,
      epsContribution: epsYear,
      taxableContribution,
      interest: roundedTaxFree + roundedTaxable,
      taxFreeInterest: roundedTaxFree,
      taxableInterest: roundedTaxable,
      taxOnInterest,
      taxFreeBalance: state.taxFree,
      taxableBalance: state.taxable,
      epfBalance: state.taxFree + state.taxable,
      pensionCorpus,
      cumulativeContributions,
      cumulativeTax,
      months,
    });
  }

  return {
    rows,
    eraSplits,
    retirementDate,
    lastContributionMonth: monthLabel(endYear, endMonth),
    contributionMonths,
    finalEpfBalance: state.taxFree + state.taxable,
    finalTaxFreeBalance: state.taxFree,
    finalTaxableBalance: state.taxable,
    finalPensionCorpus: pensionCorpus,
    totalEmployee,
    totalEmployer,
    totalInterest,
    totalTax: cumulativeTax,
    pension: estimatePension(input, contributionMonths, wages),
  };
}

export interface VoluntaryPfYear {
  year: number;
  invested: number;
  value: number;
}

/**
 * Pure VPF-style accumulation (employee money only) used by the cross-asset comparator.
 * Tax on the taxable bucket's interest is paid out of pocket, so value is corpus net of tax paid.
 */
export function simulateVoluntaryPf(monthlyContribution: number, years: number, rate: number, taxSlab: number): VoluntaryPfYear[] {
  const state: BucketState = { taxFree: 0, taxable: 0 };
  const rows: VoluntaryPfYear[] = [];
  let cumulativeTaxPaid = 0;
  for (let year = 1; year <= years; year++) {
    const result = runEpfYear(state, { employeeMonthly: monthlyContribution, employerMonthly: 0 }, rate);
    cumulativeTaxPaid += result.taxableInterest * taxSlab;
    rows.push({
      year,
      invested: monthlyContribution * 12 * year,
      value: state.taxFree + state.taxable - cumulativeTaxPaid,
    });
  }
  return rows;
}
