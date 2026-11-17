"use client";

import { useMemo } from "react";
import { Crosshair, GitCompareArrows, Scale, Trophy, Wallet } from "lucide-react";
import { useUrlState } from "@/lib/url-state";
import { formatAxisINR, formatCompactINR, formatINR, formatPct, fyLabel } from "@/lib/formatters";
import { SECTION_80TTA_LIMIT } from "@/lib/tax";
import { IDFC_DEFAULT_SLABS, analyseCrossover, blendedRate, simulateIdfc } from "@/lib/engines/idfcEngine";
import { SWEEP_DEFAULT_FD_RATE, SWEEP_DEFAULT_SAVINGS_RATE, simulateSweep } from "@/lib/engines/sweepEngine";
import { useGlobalSettings } from "@/components/providers/GlobalSettingsProvider";
import { Callout, KpiCard, Money, PageHeader, SectionCard } from "@/components/common/display";
import { Segmented, SliderField } from "@/components/common/fields";
import { WealthChart, type ChartMarker, type ChartSeries } from "@/components/charts/WealthChart";
import { YearTable, type YearColumn } from "@/components/ledger/YearTable";

const DEFAULTS = {
  bal: 500000,
  surplus: 20000,
  wd: 0,
  yrs: 10,
  thr: "15000" as "15000" | "30000",
  fd: SWEEP_DEFAULT_FD_RATE,
  sav: SWEEP_DEFAULT_SAVINGS_RATE,
};

const SERIES: ChartSeries[] = [
  { key: "idfc", label: "IDFC Progressive Savings", color: "var(--chart-1)" },
  { key: "sweep", label: "ICICI Auto-Sweep", color: "var(--chart-2)" },
];

const PRODUCT_NAME = { idfc: "IDFC Progressive Savings", sweep: "ICICI Auto-Sweep", tie: "Neither product" } as const;

interface ComparisonRow {
  year: number;
  idfcInterest: number;
  idfcTax: number;
  idfcBalance: number;
  sweepInterest: number;
  sweepTax: number;
  sweepBalance: number;
  diff: number;
}

function slabLabel(index: number): string {
  const lower = index === 0 ? 0 : IDFC_DEFAULT_SLABS[index - 1].upTo;
  const upper = IDFC_DEFAULT_SLABS[index].upTo;
  if (!Number.isFinite(upper)) return `Above ${formatCompactINR(lower, 0)}`;
  return `${formatCompactINR(lower === 0 ? 0 : lower + 1, 0)} – ${formatCompactINR(upper, 0)}`;
}

export function IdfcVsSweepCalculator() {
  const { slab, regime, adjust, adjustRate, isReal } = useGlobalSettings();
  const [s, set, reset] = useUrlState(DEFAULTS, {
    allowed: { thr: ["15000", "30000"] },
    bounds: { bal: [100000, 5000000], surplus: [0, 100000], wd: [0, 300000], yrs: [1, 25], fd: [0.04, 0.09], sav: [0.02, 0.04] },
  });

  const sweepConfig = useMemo(
    () => ({ threshold: Number(s.thr), savingsRate: s.sav, fdRate: s.fd, taxSlab: slab, regime }),
    [s.thr, s.sav, s.fd, slab, regime],
  );

  const crossover = useMemo(() => analyseCrossover(sweepConfig), [sweepConfig]);

  const yieldData = useMemo(
    () => crossover.points.map((p) => ({ balance: p.balance, idfc: adjustRate(p.idfcYield), sweep: adjustRate(p.sweepYield) })),
    [crossover.points, adjustRate],
  );

  const markers = useMemo<ChartMarker[]>(
    () => crossover.crossings.map((c) => ({ x: c.balance, y: adjustRate(c.yield), label: formatCompactINR(c.balance) })),
    [crossover.crossings, adjustRate],
  );

  const projection = useMemo(() => {
    const common = { initialBalance: s.bal, monthlySurplus: s.surplus, annualWithdrawal: s.wd, withdrawalMonth: 9, years: s.yrs, taxSlab: slab, regime };
    const idfc = simulateIdfc(common);
    const sweep = simulateSweep({ ...common, threshold: Number(s.thr), savingsRate: s.sav, fdRate: s.fd, tdsEnabled: false });
    const rows: ComparisonRow[] = idfc.rows.map((row, i) => {
      const sw = sweep.rows[i];
      return {
        year: row.year,
        idfcInterest: row.interest,
        idfcTax: row.tax,
        idfcBalance: row.closing,
        sweepInterest: sw.savingsInterest + sw.fdInterest - sw.breakPenalty,
        sweepTax: sw.tax,
        sweepBalance: sw.total,
        diff: row.closing - sw.total,
      };
    });
    return { idfc, sweep, rows };
  }, [s.bal, s.surplus, s.wd, s.yrs, s.thr, s.sav, s.fd, slab, regime]);

  const balanceData = useMemo(
    () => projection.rows.map((r) => ({ year: r.year, idfc: adjust(r.idfcBalance, r.year), sweep: adjust(r.sweepBalance, r.year) })),
    [projection.rows, adjust],
  );

  const columns = useMemo<YearColumn<ComparisonRow>[]>(
    () => [
      { key: "year", label: "Year", value: (r) => r.year, format: "int" },
      { key: "fy", label: "FY", value: (r) => fyLabel(r.year), format: "text" },
      { key: "idfcInt", label: "IDFC interest", value: (r) => adjust(r.idfcInterest, r.year), format: "inr", tone: () => "positive" },
      { key: "idfcTax", label: "IDFC tax", value: (r) => adjust(r.idfcTax, r.year), format: "inr" },
      { key: "idfcBal", label: "IDFC balance", value: (r) => adjust(r.idfcBalance, r.year), format: "inr", strong: true },
      { key: "swInt", label: "Sweep interest", value: (r) => adjust(r.sweepInterest, r.year), format: "inr", tone: () => "positive" },
      { key: "swTax", label: "Sweep tax", value: (r) => adjust(r.sweepTax, r.year), format: "inr" },
      { key: "swBal", label: "Sweep balance", value: (r) => adjust(r.sweepBalance, r.year), format: "inr", strong: true },
      { key: "diff", label: "IDFC − Sweep", value: (r) => adjust(r.diff, r.year), format: "inr", tone: (r) => (r.diff >= 0 ? "positive" : "negative") },
    ],
    [adjust],
  );

  const finalIdfc = adjust(projection.idfc.finalBalance, s.yrs);
  const finalSweep = adjust(projection.sweep.finalTotal, s.yrs);
  const winner = finalIdfc >= finalSweep ? "idfc" : "sweep";
  const tta = projection.idfc.rows.reduce((sum, r) => sum + r.deduction80TTA, 0);

  const crossoverSummary = (() => {
    if (crossover.crossings.length === 0) {
      return `No crossover between ₹1 L and ₹25 L. ${PRODUCT_NAME[crossover.leaderAtMin]} leads at every balance in range for your ${Math.round(slab * 100)}% slab under the ${regime === "old" ? "Old" : "New"} Regime.`;
    }
    return crossover.crossings
      .map((c) => `Above ${formatINR(c.balance)} → ${PRODUCT_NAME[c.leaderAbove]} pulls ahead (${formatPct(adjustRate(c.yield))} post-tax)`)
      .join(" · ");
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        title="IDFC FIRST Progressive Savings vs Auto-Sweep"
        description="IDFC pays progressive slab rates on the daily balance, credited and compounded monthly. Compare its post-tax yield with an ICICI-style sweep at every balance from ₹1 L to ₹25 L."
        badges={[regime === "old" ? "80TTA applied" : "No 80TTA (New Regime)", `${Math.round(slab * 100)}% slab`]}
        onReset={reset}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Crossover balance"
          value={crossover.crossings.length > 0 ? <Money value={crossover.crossings[0].balance} /> : "None"}
          hint={crossover.crossings.length > 1 ? `+${crossover.crossings.length - 1} more crossing(s)` : crossover.crossings.length === 0 ? `${PRODUCT_NAME[crossover.leaderAtMin]} leads throughout` : `Then ${PRODUCT_NAME[crossover.crossings[0].leaderAbove]} leads`}
          icon={Crosshair}
        />
        <KpiCard label={`IDFC after ${s.yrs} yrs`} value={<Money value={finalIdfc} />} tone={winner === "idfc" ? "positive" : "default"} hint={`Blended rate on ${formatCompactINR(s.bal)}: ${formatPct(blendedRate(s.bal))}`} icon={Wallet} />
        <KpiCard label={`Sweep after ${s.yrs} yrs`} value={<Money value={finalSweep} />} tone={winner === "sweep" ? "positive" : "default"} hint={`Threshold ${formatCompactINR(Number(s.thr))} · FD ${formatPct(s.fd)}`} icon={GitCompareArrows} />
        <KpiCard
          label="Head-to-head winner"
          value={<span className="text-base sm:text-lg">{winner === "idfc" ? "IDFC" : "Auto-Sweep"}</span>}
          hint={
            <span>
              by <Money value={Math.abs(finalIdfc - finalSweep)} /> · 80TTA used: {formatCompactINR(tta)}
            </span>
          }
          icon={Trophy}
        />
      </div>

      <SectionCard
        title="Post-tax one-year yield vs balance"
        description={`Static balance held for a full year, no top-ups. ${isReal ? "Shown as real (inflation-adjusted) yields." : "Nominal yields after tax at slab."}`}
        expandable
      >
        <WealthChart
          data={yieldData}
          xKey="balance"
          xType="number"
          series={SERIES}
          kind="line"
          valueFormat="pct"
          height={340}
          xTickFormatter={(v) => formatAxisINR(Number(v))}
          tooltipLabel={(v) => `Balance ${formatINR(Number(v))}`}
          markers={markers}
          references={crossover.crossings.map((c) => ({ x: c.balance, label: "" }))}
        />
        <div className="mt-4">
          <Callout icon={Crosshair} title={crossover.crossings.length > 0 ? "Crossover point" : "No crossover in range"} tone={crossover.crossings.length > 0 ? "positive" : "muted"}>
            {crossoverSummary}
          </Callout>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-4">
          <SectionCard title="Head-to-head inputs" description="The same cashflows go into both products.">
            <div className="space-y-6">
              <SliderField id="ivs-bal" label="Starting balance" value={s.bal} min={100000} max={5000000} step={25000} format={formatINR} onChange={(v) => set("bal", v)} />
              <SliderField id="ivs-surplus" label="Monthly surplus" value={s.surplus} min={0} max={100000} step={1000} format={formatINR} onChange={(v) => set("surplus", v)} />
              <SliderField id="ivs-wd" label="Annual withdrawal (in Sep)" value={s.wd} min={0} max={300000} step={5000} format={formatINR} onChange={(v) => set("wd", v)} />
              <SliderField id="ivs-yrs" label="Horizon" value={s.yrs} min={1} max={25} step={1} format={(v) => `${v} yrs`} onChange={(v) => set("yrs", v)} />
            </div>
          </SectionCard>

          <SectionCard title="Sweep assumptions">
            <div className="space-y-6">
              <Segmented
                label="Savings threshold"
                value={s.thr}
                options={[
                  { value: "15000", label: "₹15,000" },
                  { value: "30000", label: "₹30,000" },
                ]}
                onChange={(v) => set("thr", v)}
              />
              <SliderField id="ivs-fd" label="Swept FD rate" value={s.fd} min={0.04} max={0.09} step={0.0005} format={(v) => formatPct(v)} onChange={(v) => set("fd", v)} />
              <SliderField id="ivs-sav" label="Savings rate" value={s.sav} min={0.02} max={0.04} step={0.0025} format={(v) => formatPct(v)} onChange={(v) => set("sav", v)} />
            </div>
          </SectionCard>

          <SectionCard title="IDFC progressive slabs" description="Each slab rate applies only to the part of the balance inside it.">
            <dl className="num space-y-2 text-sm">
              {IDFC_DEFAULT_SLABS.map((slabRow, index) => (
                <div key={index} className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">{slabLabel(index)}</dt>
                  <dd className="font-medium">{formatPct(slabRow.rate)}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t pt-2 text-xs">
                <dt className="text-muted-foreground">80TTA (Old Regime)</dt>
                <dd>up to {formatINR(SECTION_80TTA_LIMIT)}</dd>
              </div>
            </dl>
          </SectionCard>
        </div>

        <div className="min-w-0 space-y-4">
          <SectionCard title="Post-tax balance projection" description={isReal ? "Inflation-adjusted to today's rupees" : "Nominal rupees on 31 March"} expandable>
            <WealthChart data={balanceData} xKey="year" series={SERIES} kind="line" xTickFormatter={(v) => `Y${v}`} tooltipLabel={(v) => `Year ${v} · ${fyLabel(Number(v))}`} />
          </SectionCard>
          <Callout icon={Scale} title="How the comparison is modelled">
            IDFC interest uses actual days per month ÷ 365. The sweep moves money into FDs in ₹5,000 units as soon as it&apos;s credited. Tax for both is debited from the account on 31 March.
          </Callout>
          <YearTable rows={projection.rows} columns={columns} fileName={`idfc-vs-sweep-${s.yrs}y`} rowKey={(r) => r.year} />
        </div>
      </div>
    </div>
  );
}
