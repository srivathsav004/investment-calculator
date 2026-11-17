export interface LadderYear {
  year: number;
  invested: number;
  value: number;
}

/**
 * Rolling monthly investment into a taxable instrument whose post-tax return compounds every
 * `compoundEveryMonths` months — used by the overview for the bank FD benchmark.
 */
export function simulateRecurringTaxable(
  monthlyContribution: number,
  years: number,
  rate: number,
  taxSlab: number,
  compoundEveryMonths: 1 | 3,
): LadderYear[] {
  const periodsPerYear = 12 / compoundEveryMonths;
  const monthlyFactor = Math.pow(1 + (rate * (1 - taxSlab)) / periodsPerYear, 1 / compoundEveryMonths);
  const rows: LadderYear[] = [];
  let value = 0;
  for (let month = 1; month <= years * 12; month++) {
    value = (value + monthlyContribution) * monthlyFactor;
    if (month % 12 === 0) rows.push({ year: month / 12, invested: monthlyContribution * month, value });
  }
  return rows;
}
