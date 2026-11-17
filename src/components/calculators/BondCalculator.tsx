"use client";

import { useMemo } from "react";
import { Banknote, CalendarClock, Landmark, Percent, ScrollText, TriangleAlert } from "lucide-react";
import { useUrlState } from "@/lib/url-state";
import { formatCompactINR, formatINR, formatPct, fyLabel } from "@/lib/formatters";
import { BOND_DEFAULT_BANK_FD_RATE, BOND_DEFAULT_LIQUID_FD_RATE, simulateBond, type BondYearRow, type PayoutFrequency } from "@/lib/engines/bondEngine";
import { useGlobalSettings } from "@/components/providers/GlobalSettingsProvider";
import { Callout, KpiCard, Money, PageHeader, SectionCard } from "@/components/common/display";
import { Segmented, SliderField, SwitchField } from "@/components/common/fields";
import { WealthChart, type ChartSeries } from "@/components/charts/WealthChart";
import { YearTable, type YearColumn } from "@/components/ledger/YearTable";

const DEFAULTS = {
  p: 500000,
  ytm: 0.105,
  ten: 3,
  freq: "monthly" as PayoutFrequency,
  reinv: true,
  lfd: BOND_DEFAULT_LIQUID_FD_RATE,
  bfd: BOND_DEFAULT_BANK_FD_RATE,
};

const SERIES: ChartSeries[] = [
  { key: "bond", label: "Bond strategy wealth", color: "var(--chart-1)" },
  { key: "fd", label: "Bank FD (same principal)", color: "var(--chart-2)", dashed: true },
];

export function BondCalculator() {
  const { slab, adjust, adjustRate, isReal } = useGlobalSettings();
  const [s, set, reset] = useUrlState(DEFAULTS, {
    allowed: { freq: ["monthly", "quarterly"] },
    bounds: { p: [50000, 2500000], ytm: [0.09, 0.12], ten: [1, 5], lfd: [0.04, 0.08], bfd: [0.05, 0.09] },
  });

  const result = useMemo(
    () =>
      simulateBond({
        principal: s.p,
        ytm: s.ytm,
        tenureYears: s.ten,
        frequency: s.freq,
        reinvest: s.reinv,
        liquidFdRate: s.lfd,
        bankFdRate: s.bfd,
        taxSlab: slab,
      }),
    [s.p, s.ytm, s.ten, s.freq, s.reinv, s.lfd, s.bfd, slab],
  );

  const chartData = useMemo(
    () => [
      { year: 0, bond: s.p, fd: s.p },
      ...result.rows.map((row) => ({ year: row.year, bond: adjust(row.totalWealth, row.year), fd: adjust(row.bankFdValue, row.year) })),
    ],
    [result.rows, s.p, adjust],
  );

  const columns = useMemo<YearColumn<BondYearRow>[]>(
    () => [
      { key: "year", label: "Year", value: (r) => r.year, format: "int" },
      { key: "fy", label: "FY", value: (r) => fyLabel(r.year), format: "text" },
      { key: "gross", label: "Gross coupons", value: (r) => adjust(r.grossCoupons, r.year), format: "inr" },
      { key: "ctax", label: "Tax on coupons", value: (r) => adjust(r.couponTax, r.year), format: "inr", tone: (r) => (r.couponTax > 0 ? "negative" : undefined) },
      { key: "net", label: "Net coupons", value: (r) => adjust(r.netCoupons, r.year), format: "inr", tone: () => "positive" },
      { key: "fdInt", label: "Liquid FD int.", value: (r) => adjust(r.fdInterest, r.year), format: "inr" },
      { key: "fdTax", label: "FD tax", value: (r) => adjust(r.fdTax, r.year), format: "inr" },
      { key: "fdBal", label: "Liquid FD balance", value: (r) => adjust(r.fdBalance, r.year), format: "inr" },
      { key: "cash", label: "Cash paid out", value: (r) => adjust(r.cashPaidOut, r.year), format: "inr" },
      { key: "principal", label: "Bond principal", value: (r) => adjust(r.bondPrincipal, r.year), format: "inr" },
      { key: "wealth", label: "Total wealth", value: (r) => adjust(r.totalWealth, r.year), format: "inr", strong: true },
      { key: "bank", label: "Bank FD", value: (r) => adjust(r.bankFdValue, r.year), format: "inr" },
    ],
    [adjust],
  );

  const finalWealth = adjust(result.finalWealth, s.ten);
  const bankFinal = adjust(result.bankFdFinal, s.ten);
  const edge = finalWealth - bankFinal;
  const payoutsPerYear = s.freq === "monthly" ? 12 : 4;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Corporate Bonds · Wint Wealth style"
        description="Fixed coupons paid monthly or quarterly, taxed at your slab, with principal back at maturity. Reinvest each post-tax coupon in a liquid FD or spend it. Benchmarked against a bank FD of the same principal."
        badges={[`${s.ten} yr tenure`, s.freq === "monthly" ? "Monthly payout" : "Quarterly payout"]}
        onReset={reset}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={isReal ? "Total wealth (today's ₹)" : "Total wealth at maturity"} value={<Money value={finalWealth} />} hint={<span className="num">{formatINR(finalWealth)}</span>} icon={ScrollText} />
        <KpiCard
          label="Post-tax XIRR"
          value={formatPct(adjustRate(result.postTaxIrr))}
          tone="positive"
          hint={`Pre-tax ${formatPct(adjustRate(result.preTaxIrr))} · ${s.reinv ? "coupons reinvested" : "coupons spent"}`}
          icon={Percent}
        />
        <KpiCard
          label="Per payout"
          value={<Money value={result.netCouponPerPayout} compact={false} />}
          hint={`Gross ${formatINR(result.couponPerPayout)} × ${payoutsPerYear}/yr, after ${Math.round(slab * 100)}% tax`}
          icon={CalendarClock}
        />
        <KpiCard
          label="Edge over bank FD"
          value={<Money value={edge} />}
          tone={edge >= 0 ? "positive" : "negative"}
          hint={`Bank FD ${formatPct(s.bfd)} → post-tax CAGR ${formatPct(adjustRate(result.bankFdPostTaxCagr))}`}
          icon={Landmark}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <SectionCard title="Inputs" description="Synced to the URL for sharing.">
          <div className="space-y-6">
            <SliderField id="bd-p" label="Principal invested" value={s.p} min={50000} max={2500000} step={10000} format={formatINR} onChange={(v) => set("p", v)} />
            <SliderField id="bd-ytm" label="Coupon / YTM" value={s.ytm} min={0.09} max={0.12} step={0.0005} format={(v) => formatPct(v)} onChange={(v) => set("ytm", v)} info="Modelled as a bullet bond bought at par, so coupon = YTM. Coupons are taxed as 'Income from other sources' at your slab." />
            <SliderField id="bd-ten" label="Tenure" value={s.ten} min={1} max={5} step={1} format={(v) => `${v} yr${v > 1 ? "s" : ""}`} onChange={(v) => set("ten", v)} />
            <Segmented
              label="Payout frequency"
              value={s.freq}
              options={[
                { value: "monthly", label: "Monthly" },
                { value: "quarterly", label: "Quarterly" },
              ]}
              onChange={(v) => set("freq", v)}
            />
            <SwitchField
              id="bd-reinv"
              label="Reinvest post-tax coupons"
              description={s.reinv ? `Parked in a ${formatPct(s.lfd)} liquid FD, compounded quarterly` : "Coupons are spent as they arrive"}
              checked={s.reinv}
              onChange={(v) => set("reinv", v)}
            />
            <SliderField id="bd-lfd" label="Liquid FD rate" value={s.lfd} min={0.04} max={0.08} step={0.0025} format={(v) => formatPct(v)} onChange={(v) => set("lfd", v)} disabled={!s.reinv} />
            <SliderField id="bd-bfd" label="Benchmark bank FD rate" value={s.bfd} min={0.05} max={0.09} step={0.0025} format={(v) => formatPct(v)} onChange={(v) => set("bfd", v)} />
          </div>
        </SectionCard>

        <div className="min-w-0 space-y-4">
          <SectionCard title="Wealth path vs bank FD" description={isReal ? "Inflation-adjusted to today's rupees" : "Post-tax, nominal rupees"}>
            <WealthChart data={chartData} xKey="year" series={SERIES} kind="line" xTickFormatter={(v) => `Y${v}`} tooltipLabel={(v) => (Number(v) === 0 ? "Purchase" : `Year ${v} · ${fyLabel(Number(v))}`)} />
          </SectionCard>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Callout icon={Banknote} title="Total coupons">
              Gross <span className="num text-foreground">{formatCompactINR(result.totalGrossCoupons)}</span>. Total tax including FD interest:{" "}
              <span className="num text-foreground">{formatCompactINR(result.totalTax)}</span>.
            </Callout>
            <Callout icon={TriangleAlert} title="Credit risk is not modelled" tone="negative">
              A 10–12% yield is pricing default risk. These projections assume every coupon and the principal are paid in full and on time.
            </Callout>
          </div>
          <YearTable rows={result.rows} columns={columns} fileName={`bonds-${s.ten}y-${(s.ytm * 100).toFixed(2)}pct`} rowKey={(r) => r.year} />
        </div>
      </div>
    </div>
  );
}
