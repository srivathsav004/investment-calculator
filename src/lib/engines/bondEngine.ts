import { annualisedMonthlyIrr } from "@/lib/formatters";

export type PayoutFrequency = "monthly" | "quarterly";

export const BOND_DEFAULT_LIQUID_FD_RATE = 0.065;
export const BOND_DEFAULT_BANK_FD_RATE = 0.07;

export interface BondInput {
  principal: number;
  ytm: number;
  tenureYears: number;
  frequency: PayoutFrequency;
  reinvest: boolean;
  liquidFdRate: number;
  bankFdRate: number;
  taxSlab: number;
}

export interface BondYearRow {
  year: number;
  grossCoupons: number;
  couponTax: number;
  netCoupons: number;
  fdInterest: number;
  fdTax: number;
  fdBalance: number;
  cashPaidOut: number;
  bondPrincipal: number;
  totalWealth: number;
  bankFdValue: number;
  cumulativeTax: number;
}

export interface BondResult {
  rows: BondYearRow[];
  finalWealth: number;
  totalGrossCoupons: number;
  totalTax: number;
  postTaxIrr: number;
  preTaxIrr: number;
  bankFdFinal: number;
  bankFdPostTaxCagr: number;
  couponPerPayout: number;
  netCouponPerPayout: number;
}

/**
 * Month-by-month bond cashflow engine. Coupons are paid every 1 or 3 months and taxed at slab.
 * In reinvest mode each post-tax coupon is parked in a liquid FD (compounded quarterly,
 * accrued monthly, its interest taxed at slab on 31 March). Principal is repaid at maturity.
 */
export function simulateBond(input: BondInput): BondResult {
  const months = Math.round(input.tenureYears * 12);
  const step = input.frequency === "monthly" ? 1 : 3;
  const coupon = (input.principal * input.ytm * step) / 12;
  const netCoupon = coupon * (1 - input.taxSlab);
  const fdFactor = Math.pow(1 + input.liquidFdRate / 4, 1 / 3);
  const bankFactor = Math.pow(1 + input.bankFdRate / 4, 1 / 3);

  const postTaxFlows: number[] = new Array(months + 1).fill(0);
  const preTaxFlows: number[] = new Array(months + 1).fill(0);
  postTaxFlows[0] = -input.principal;
  preTaxFlows[0] = -input.principal;

  let fdBalance = 0;
  let cashPaidOut = 0;
  let bankFd = input.principal;
  let cumulativeTax = 0;
  let totalGrossCoupons = 0;

  const rows: BondYearRow[] = [];
  let yearGross = 0;
  let yearCouponTax = 0;
  let yearFdInterest = 0;
  let yearBankInterest = 0;

  for (let month = 1; month <= months; month++) {
    const fdGrown = fdBalance * fdFactor;
    yearFdInterest += fdGrown - fdBalance;
    fdBalance = fdGrown;

    const bankGrown = bankFd * bankFactor;
    yearBankInterest += bankGrown - bankFd;
    bankFd = bankGrown;

    if (month % step === 0) {
      yearGross += coupon;
      yearCouponTax += coupon - netCoupon;
      totalGrossCoupons += coupon;
      preTaxFlows[month] += coupon;
      if (input.reinvest) {
        fdBalance += netCoupon;
      } else {
        cashPaidOut += netCoupon;
        postTaxFlows[month] += netCoupon;
      }
    }

    const isYearEnd = month % 12 === 0 || month === months;
    if (isYearEnd) {
      const fdTax = Math.min(fdBalance, yearFdInterest * input.taxSlab);
      fdBalance -= fdTax;
      bankFd -= yearBankInterest * input.taxSlab;
      cumulativeTax += yearCouponTax + fdTax;

      const isMaturity = month === months;
      rows.push({
        year: Math.ceil(month / 12),
        grossCoupons: yearGross,
        couponTax: yearCouponTax,
        netCoupons: yearGross - yearCouponTax,
        fdInterest: yearFdInterest,
        fdTax,
        fdBalance,
        cashPaidOut,
        bondPrincipal: isMaturity ? 0 : input.principal,
        totalWealth: input.principal + fdBalance + cashPaidOut,
        bankFdValue: bankFd,
        cumulativeTax,
      });
      yearGross = 0;
      yearCouponTax = 0;
      yearFdInterest = 0;
      yearBankInterest = 0;
    }
  }

  postTaxFlows[months] += input.principal + fdBalance;
  preTaxFlows[months] += input.principal;

  const years = months / 12;
  return {
    rows,
    finalWealth: input.principal + fdBalance + cashPaidOut,
    totalGrossCoupons,
    totalTax: cumulativeTax,
    postTaxIrr: annualisedMonthlyIrr(postTaxFlows),
    preTaxIrr: annualisedMonthlyIrr(preTaxFlows),
    bankFdFinal: bankFd,
    bankFdPostTaxCagr: years > 0 ? Math.pow(bankFd / input.principal, 1 / years) - 1 : 0,
    couponPerPayout: coupon,
    netCouponPerPayout: netCoupon,
  };
}

export interface LadderYear {
  year: number;
  invested: number;
  value: number;
}

/**
 * Rolling monthly investment into an instrument whose post-tax return compounds every
 * `compoundEveryMonths` months — used by the overview for bond ladders and bank FDs.
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
