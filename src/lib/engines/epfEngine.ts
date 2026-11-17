/** Statutory PF wage ceiling (₹/month), effective Sept 2026. */
export const EPF_WAGE_CEILING = 25_000;
export const EPF_EMPLOYEE_RATE = 0.12;
export const EPF_EMPLOYER_RATE = 0.12;
export const EPS_RATE = 0.0833;
/** EPS contribution cap = 8.33% of the statutory ceiling. */
export const EPS_MONTHLY_CAP = Math.round(EPS_RATE * EPF_WAGE_CEILING);
/** Employee (EPF + VPF) contributions above this per FY earn taxable interest — Rule 9D. */
export const EPF_TAX_FREE_EMPLOYEE_LIMIT = 2_50_000;

export interface EpfInput {
  rate: number;
  monthlyBasic: number;
  annualHike: number;
  vpfPct: number;
  capWageAtCeiling: boolean;
  years: number;
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

export interface EpfYearRow {
  year: number;
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
}

export interface EpfResult {
  rows: EpfYearRow[];
  firstMonth: EpfMonthlySplit;
  finalEpfBalance: number;
  finalTaxFreeBalance: number;
  finalTaxableBalance: number;
  finalPensionCorpus: number;
  totalEmployee: number;
  totalEmployer: number;
  totalInterest: number;
  totalTax: number;
}

export function epfMonthlySplit(
  monthlyBasic: number,
  vpfPct: number,
  capWageAtCeiling: boolean,
): EpfMonthlySplit {
  const pfWage = capWageAtCeiling ? Math.min(monthlyBasic, EPF_WAGE_CEILING) : monthlyBasic;
  const employee = Math.round(pfWage * EPF_EMPLOYEE_RATE);
  const vpf = Math.round(monthlyBasic * vpfPct);
  const employerTotal = Math.round(pfWage * EPF_EMPLOYER_RATE);
  const eps = Math.min(Math.round(pfWage * EPS_RATE), EPS_MONTHLY_CAP);
  return { basic: monthlyBasic, pfWage, employee, vpf, employerTotal, eps, employerEpf: employerTotal - eps };
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
 * One FY of EPF accrual. Each month's contribution is credited at month-end, so
 * interest for month m runs on the balance at the close of month m − 1.
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

export function simulateEpf(input: EpfInput): EpfResult {
  const state: BucketState = { taxFree: 0, taxable: 0 };
  const rows: EpfYearRow[] = [];
  let pensionCorpus = 0;
  let cumulativeContributions = 0;
  let cumulativeTax = 0;
  let totalEmployee = 0;
  let totalEmployer = 0;
  let totalInterest = 0;

  const firstMonth = epfMonthlySplit(input.monthlyBasic, input.vpfPct, input.capWageAtCeiling);

  for (let year = 1; year <= input.years; year++) {
    const basic = Math.round(input.monthlyBasic * Math.pow(1 + input.annualHike, year - 1));
    const split = epfMonthlySplit(basic, input.vpfPct, input.capWageAtCeiling);
    const result = runEpfYear(
      state,
      { employeeMonthly: split.employee + split.vpf, employerMonthly: split.employerEpf },
      input.rate,
    );

    const taxOnInterest = Math.round(result.taxableInterest * input.taxSlab);
    const employeeYear = split.employee * 12;
    const vpfYear = split.vpf * 12;
    const employerEpfYear = split.employerEpf * 12;
    const epsYear = split.eps * 12;

    pensionCorpus += epsYear;
    cumulativeContributions += employeeYear + vpfYear + employerEpfYear;
    cumulativeTax += taxOnInterest;
    totalEmployee += employeeYear + vpfYear;
    totalEmployer += employerEpfYear + epsYear;
    totalInterest += result.taxFreeInterest + result.taxableInterest;

    rows.push({
      year,
      monthlyBasic: basic,
      employeeContribution: employeeYear,
      vpfContribution: vpfYear,
      employerEpfContribution: employerEpfYear,
      epsContribution: epsYear,
      taxableContribution: result.taxableContribution,
      interest: result.taxFreeInterest + result.taxableInterest,
      taxFreeInterest: result.taxFreeInterest,
      taxableInterest: result.taxableInterest,
      taxOnInterest,
      taxFreeBalance: state.taxFree,
      taxableBalance: state.taxable,
      epfBalance: state.taxFree + state.taxable,
      pensionCorpus,
      cumulativeContributions,
      cumulativeTax,
    });
  }

  return {
    rows,
    firstMonth,
    finalEpfBalance: state.taxFree + state.taxable,
    finalTaxFreeBalance: state.taxFree,
    finalTaxableBalance: state.taxable,
    finalPensionCorpus: pensionCorpus,
    totalEmployee,
    totalEmployer,
    totalInterest,
    totalTax: cumulativeTax,
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
