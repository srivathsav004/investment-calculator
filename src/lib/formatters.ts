const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const inrPaiseFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const plainFormatter = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

const LAKH = 1_00_000;
const CRORE = 1_00_00_000;

/** ₹1,50,000 — exact rupees, Indian digit grouping. */
export function formatINR(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return inrFormatter.format(Math.round(value));
}

/** ₹1,50,000.00 — exact rupees with paise. */
export function formatINRExact(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return inrPaiseFormatter.format(value);
}

/** 1,50,000 — Indian digit grouping without the currency symbol. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "—";
  return plainFormatter.format(Math.round(value));
}

/** ₹40.68 L / ₹1.03 Cr / ₹85,000 — Lakh/Crore shorthand. */
export function formatCompactINR(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= CRORE) return `${sign}₹${(abs / CRORE).toFixed(digits)} Cr`;
  if (abs >= LAKH) return `${sign}₹${(abs / LAKH).toFixed(digits)} L`;
  return `${sign}${inrFormatter.format(Math.round(abs))}`;
}

/** Short axis label: 40.7L, 1.03Cr, 85k. */
export function formatAxisINR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= CRORE) return `${sign}${(abs / CRORE).toFixed(abs >= 10 * CRORE ? 0 : 2)}Cr`;
  if (abs >= LAKH) return `${sign}${(abs / LAKH).toFixed(abs >= 10 * LAKH ? 0 : 1)}L`;
  if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(0)}k`;
  return `${sign}${abs.toFixed(0)}`;
}

/** 0.071 → "7.10%" */
export function formatPct(rate: number, digits = 2): string {
  if (!Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(digits)}%`;
}

/** Financial year label for a 1-indexed simulation year starting FY 2026–27. */
export function fyLabel(yearIndex: number, startYear = 2026): string {
  const start = startYear + yearIndex - 1;
  return `FY${String(start).slice(2)}-${String(start + 1).slice(2)}`;
}

export const FY_MONTH_NAMES = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"] as const;

/** Deflate a nominal amount received at the end of `years` into today's rupees. */
export function toReal(nominal: number, years: number, inflation: number): number {
  return nominal / Math.pow(1 + inflation, years);
}

/** Convert a nominal rate into a real (inflation-adjusted) rate — Fisher equation. */
export function realRate(nominalRate: number, inflation: number): number {
  return (1 + nominalRate) / (1 + inflation) - 1;
}

function npv(rate: number, cashflows: readonly number[]): number {
  let total = 0;
  for (let t = 0; t < cashflows.length; t++) total += cashflows[t] / Math.pow(1 + rate, t);
  return total;
}

function dNpv(rate: number, cashflows: readonly number[]): number {
  let total = 0;
  for (let t = 1; t < cashflows.length; t++) total -= (t * cashflows[t]) / Math.pow(1 + rate, t + 1);
  return total;
}

/**
 * Periodic IRR for evenly spaced cashflows (index 0 = today, negative = investment).
 * Newton–Raphson with a bisection fallback. Returns NaN when no sign change exists.
 */
export function irr(cashflows: readonly number[], guess = 0.08): number {
  const hasNegative = cashflows.some((c) => c < 0);
  const hasPositive = cashflows.some((c) => c > 0);
  if (!hasNegative || !hasPositive) return Number.NaN;

  let rate = guess;
  for (let i = 0; i < 100; i++) {
    const value = npv(rate, cashflows);
    const slope = dNpv(rate, cashflows);
    if (Math.abs(value) < 1e-7) return rate;
    if (slope === 0 || !Number.isFinite(slope)) break;
    const next = rate - value / slope;
    if (!Number.isFinite(next) || next <= -0.9999) break;
    if (Math.abs(next - rate) < 1e-10) return next;
    rate = next;
  }

  let lo = -0.9999;
  let hi = 10;
  let fLo = npv(lo, cashflows);
  if (fLo * npv(hi, cashflows) > 0) return Number.NaN;
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    const fMid = npv(mid, cashflows);
    if (Math.abs(fMid) < 1e-7 || hi - lo < 1e-12) return mid;
    if (fLo * fMid < 0) {
      hi = mid;
    } else {
      lo = mid;
      fLo = fMid;
    }
  }
  return (lo + hi) / 2;
}

/** Annualised IRR from monthly cashflows. */
export function annualisedMonthlyIrr(monthlyCashflows: readonly number[]): number {
  const monthly = irr(monthlyCashflows, 0.006);
  return Number.isFinite(monthly) ? Math.pow(1 + monthly, 12) - 1 : Number.NaN;
}

/** Compound annual growth rate. */
export function cagr(start: number, end: number, years: number): number {
  if (start <= 0 || years <= 0) return Number.NaN;
  return Math.pow(end / start, 1 / years) - 1;
}
