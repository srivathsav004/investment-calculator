"use client";

import { useMemo } from "react";
import { ArrowDownUp, Coins, Layers, Receipt, ShieldAlert, TriangleAlert } from "lucide-react";
import { useUrlState } from "@/lib/url-state";
import { FY_MONTH_NAMES, formatCompactINR, formatINR, formatNumber, formatPct, fyLabel } from "@/lib/formatters";
import {
  SWEEP_BREAK_PENALTY,
  SWEEP_DEFAULT_FD_RATE,
  SWEEP_DEFAULT_SAVINGS_RATE,
  SWEEP_TDS_THRESHOLD,
  SWEEP_UNIT,
  simulateSweep,
  type SweepYearRow,
} from "@/lib/engines/sweepEngine";
import { useGlobalSettings } from "@/components/providers/GlobalSettingsProvider";
import { Callout, KpiCard, Money, PageHeader, SectionCard } from "@/components/common/display";
import { Segmented, SelectField, SliderField, SwitchField } from "@/components/common/fields";
import { WealthChart, type ChartSeries } from "@/components/charts/WealthChart";
import { YearTable, type YearColumn } from "@/components/ledger/YearTable";

const DEFAULTS = {
  init: 300000,
  surplus: 25000,
  thr: "15000" as "15000" | "30000",
  fd: SWEEP_DEFAULT_FD_RATE,
  sav: SWEEP_DEFAULT_SAVINGS_RATE,
  wd: 100000,
  wdm: "9",
  yrs: 10,
  tds: true,
};

const MONTH_OPTIONS = FY_MONTH_NAMES.map((label, index) => ({ value: String(index + 1), label }));

const SERIES: ChartSeries[] = [
  { key: "fd", label: "Swept FDs", color: "var(--chart-1)" },
  { key: "savings", label: "Savings balance", color: "var(--chart-2)" },
];

export function SweepCalculator() {
  const { slab, regime, adjust, isReal } = useGlobalSettings();
  const [s, set, reset] = useUrlState(DEFAULTS, {
    allowed: { thr: ["15000", "30000"], wdm: MONTH_OPTIONS.map((m) => m.value) },
    bounds: { init: [50000, 2500000], surplus: [0, 100000], fd: [0.04, 0.09], sav: [0.02, 0.04], wd: [0, 300000], yrs: [1, 25] },
  });

  const result = useMemo(
    () =>
      simulateSweep({
        initialBalance: s.init,
        monthlySurplus: s.surplus,
        threshold: Number(s.thr),
        savingsRate: s.sav,
        fdRate: s.fd,
        annualWithdrawal: s.wd,
        withdrawalMonth: Number(s.wdm),
        years: s.yrs,
        taxSlab: slab,
        regime,
        tdsEnabled: s.tds,
      }),
    [s.init, s.surplus, s.thr, s.sav, s.fd, s.wd, s.wdm, s.yrs, s.tds, slab, regime],
  );

  const chartData = useMemo(
    () => result.rows.map((row) => ({ year: row.year, fd: adjust(row.fdBalance, row.year), savings: adjust(row.savingsBalance, row.year) })),
    [result.rows, adjust],
  );

  const columns = useMemo<YearColumn<SweepYearRow>[]>(
    () => [
      { key: "year", label: "Year", value: (r) => r.year, format: "int" },
      { key: "fy", label: "FY", value: (r) => fyLabel(r.year), format: "text" },
      { key: "deposits", label: "Credits", value: (r) => adjust(r.deposits, r.year), format: "inr" },
      { key: "withdrawals", label: "Withdrawn", value: (r) => adjust(r.withdrawals, r.year), format: "inr", tone: (r) => (r.withdrawals > 0 ? "negative" : undefined) },
      { key: "broken", label: "FD principal broken", value: (r) => adjust(r.brokenPrincipal, r.year), format: "inr" },
      { key: "savInt", label: "Savings int.", value: (r) => adjust(r.savingsInterest, r.year), format: "inr", tone: () => "positive" },
      { key: "fdInt", label: "FD int.", value: (r) => adjust(r.fdInterest, r.year), format: "inr", tone: () => "positive" },
      { key: "penalty", label: "Break penalty", value: (r) => adjust(r.breakPenalty, r.year), format: "inr", tone: (r) => (r.breakPenalty > 0 ? "negative" : undefined) },
      { key: "tds", label: "TDS", value: (r) => adjust(r.tds, r.year), format: "inr" },
      { key: "tax", label: "Total tax", value: (r) => adjust(r.tax, r.year), format: "inr", tone: (r) => (r.tax > 0 ? "negative" : undefined) },
      { key: "fdCount", label: "Live FDs", value: (r) => r.fdCount, format: "int" },
      { key: "total", label: "Total balance", value: (r) => adjust(r.total, r.year), format: "inr", strong: true },
    ],
    [adjust],
  );

  const last = result.rows[result.rows.length - 1];
  const prevTotal = result.rows.length > 1 ? result.rows[result.rows.length - 2].total : s.init;
  const lastYearNet = last ? last.savingsInterest + last.fdInterest - last.breakPenalty - last.tax : 0;
  const lastYearYield = last ? lastYearNet / Math.max(1, (prevTotal + last.total) / 2) : 0;
  const tdsYears = result.rows.filter((r) => r.tds > 0).length;
  const shortfall = result.rows.reduce((sum, r) => sum + r.shortfall, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="ICICI Money Multiplier · Auto-Sweep"
        description={`Balance above the threshold sweeps into FDs in ₹${formatNumber(SWEEP_UNIT)} multiples, compounded quarterly. Withdrawals the savings balance can't cover reverse-sweep the newest FD first (LIFO), and the broken part earns ${formatPct(SWEEP_BREAK_PENALTY, 0)} less.`}
        badges={[`${s.yrs} years`, `Threshold ${formatCompactINR(Number(s.thr))}`]}
        onReset={reset}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label={isReal ? "Post-tax balance (today's ₹)" : "Post-tax balance"} value={<Money value={adjust(result.finalTotal, s.yrs)} />} hint={<span className="num">{formatINR(adjust(result.finalTotal, s.yrs))}</span>} icon={Layers} />
        <KpiCard label="Interest (net of penalties)" value={<Money value={result.totalNetInterest} />} tone="positive" hint={`Post-tax yield, final FY: ${formatPct(lastYearYield)}`} icon={Coins} />
        <KpiCard
          label="Tax paid"
          value={<Money value={result.totalTax} />}
          tone="negative"
          hint={s.tds ? `10% TDS deducted in ${tdsYears} of ${s.yrs} yrs (FD interest > ${formatCompactINR(SWEEP_TDS_THRESHOLD)})` : "Paid at slab each 31 March"}
          icon={Receipt}
        />
        <KpiCard label="Break penalties" value={<Money value={result.totalPenalty} />} tone={result.totalPenalty > 0 ? "negative" : "muted"} hint={`Withdrawn ${formatCompactINR(result.totalWithdrawals)} in total`} icon={ShieldAlert} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <SectionCard title="Inputs" description="Synced to the URL for sharing.">
          <div className="space-y-6">
            <SliderField id="sw-init" label="Initial balance" value={s.init} min={50000} max={2500000} step={10000} format={formatINR} onChange={(v) => set("init", v)} />
            <SliderField id="sw-surplus" label="Monthly surplus credited" value={s.surplus} min={0} max={100000} step={1000} format={formatINR} onChange={(v) => set("surplus", v)} />
            <Segmented
              label="Savings threshold (2.75% p.a.)"
              value={s.thr}
              options={[
                { value: "15000", label: "₹15,000" },
                { value: "30000", label: "₹30,000" },
              ]}
              onChange={(v) => set("thr", v)}
              info="Balance kept in savings before anything sweeps into an FD."
            />
            <SliderField id="sw-fd" label="Swept FD rate (quarterly compounding)" value={s.fd} min={0.04} max={0.09} step={0.0005} format={(v) => formatPct(v)} onChange={(v) => set("fd", v)} />
            <SliderField id="sw-sav" label="Savings rate" value={s.sav} min={0.02} max={0.04} step={0.0025} format={(v) => formatPct(v)} onChange={(v) => set("sav", v)} />
            <SliderField
              id="sw-wd"
              label="Annual emergency withdrawal"
              value={s.wd}
              min={0}
              max={300000}
              step={5000}
              format={formatINR}
              onChange={(v) => set("wd", v)}
              info={`Paid from savings first. The shortfall is raised in ₹5,000 units by breaking the newest FDs. The broken portion earns the FD rate minus ${formatPct(SWEEP_BREAK_PENALTY, 0)} for the time it was held.`}
            />
            <SelectField id="sw-wdm" label="Withdrawal month" value={s.wdm} options={MONTH_OPTIONS} onChange={(v) => set("wdm", v)} />
            <SliderField id="sw-yrs" label="Horizon" value={s.yrs} min={1} max={25} step={1} format={(v) => `${v} yrs`} onChange={(v) => set("yrs", v)} />
            <SwitchField
              id="sw-tds"
              label="10% TDS on FD interest"
              description={`When FD interest in a year exceeds ${formatINR(SWEEP_TDS_THRESHOLD)}`}
              checked={s.tds}
              onChange={(v) => set("tds", v)}
              info="TDS is an advance against your slab tax. It only changes when tax leaves the account, not how much you pay in total."
            />
          </div>
        </SectionCard>

        <div className="min-w-0 space-y-4">
          <SectionCard title="Where the money sits" description={isReal ? "Inflation-adjusted to today's rupees, 31 March" : "Post-tax balances on 31 March"}>
            <WealthChart data={chartData} xKey="year" series={SERIES} kind="bar" stacked xTickFormatter={(v) => `Y${v}`} tooltipLabel={(v) => `Year ${v} · ${fyLabel(Number(v))}`} />
          </SectionCard>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Callout icon={ArrowDownUp} title="Tax treatment">
              Savings interest {regime === "old" ? "gets the 80TTA deduction (up to ₹10,000)" : "gets no 80TTA deduction under the New Regime"}. FD interest is fully taxed at your {Math.round(slab * 100)}% slab.
            </Callout>
            {shortfall > 0 ? (
              <Callout icon={TriangleAlert} title="Withdrawals exceeded the balance" tone="negative">
                <span className="num text-foreground">{formatINR(shortfall)}</span> of the requested withdrawals couldn&apos;t be met because savings and every FD were exhausted.
              </Callout>
            ) : (
              <Callout icon={ShieldAlert} title="LIFO reverse sweep">
                Breaking the newest FDs first keeps the older, higher-accrued deposits intact. That minimises the penalty in rupees.
              </Callout>
            )}
          </div>

          <YearTable rows={result.rows} columns={columns} fileName={`auto-sweep-${s.yrs}y`} rowKey={(r) => r.year} />
        </div>
      </div>
    </div>
  );
}
