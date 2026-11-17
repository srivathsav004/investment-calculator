"use client";

import { useMemo } from "react";
import { ArrowDownUp, Coins, Layers, Lightbulb, Receipt, ShieldAlert, TriangleAlert } from "lucide-react";
import { useUrlState } from "@/lib/url-state";
import { FY_MONTH_NAMES, formatCompactINR, formatINR, formatNumber, formatPct, fyLabel } from "@/lib/formatters";
import {
  SWEEP_BREAK_PENALTY,
  SWEEP_DEFAULT_FD_RATE,
  SWEEP_DEFAULT_SAVINGS_RATE,
  SWEEP_TDS_THRESHOLD,
  SWEEP_THRESHOLDS,
  SWEEP_UNIT,
  compareSweepScenarios,
  simulateSweep,
  type SweepInput,
  type SweepMonthRow,
  type SweepYearRow,
} from "@/lib/engines/sweepEngine";
import { useGlobalSettings } from "@/components/providers/GlobalSettingsProvider";
import { Callout, KpiCard, Money, PageHeader, SectionCard } from "@/components/common/display";
import { Segmented, SelectField, SliderField, SwitchField } from "@/components/common/fields";
import { WealthChart, type ChartSeries } from "@/components/charts/WealthChart";
import { Badge } from "@/components/ui/badge";
import { ResultsLayout } from "@/components/common/ResultsLayout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SweepTaxIdeas } from "@/components/calculators/SweepTaxIdeas";
import { MonthTable, YearTable, type YearColumn } from "@/components/ledger/YearTable";

const DEFAULTS = {
  init: 15000,
  surplus: 15000,
  tgt: 300000,
  after: 0,
  thr: "15000" as "15000" | "30000",
  fd: SWEEP_DEFAULT_FD_RATE,
  sav: SWEEP_DEFAULT_SAVINGS_RATE,
  wd: 100000,
  wdm: "9",
  yrs: 10,
  tds: true,
  next: false,
  tab: "overview" as "overview" | "ledger" | "habits" | "tax",
};

const MONTH_OPTIONS = FY_MONTH_NAMES.map((label, index) => ({ value: String(index + 1), label }));

const SERIES: ChartSeries[] = [
  { key: "fd", label: "Swept FDs", color: "var(--chart-1)" },
  { key: "savings", label: "Savings balance", color: "var(--chart-2)" },
];

export function SweepCalculator() {
  const { slab, regime, adjust, isReal } = useGlobalSettings();
  const [s, set, reset] = useUrlState(DEFAULTS, {
    allowed: { tab: ["overview", "ledger", "habits", "tax"], thr: ["15000", "30000"], wdm: MONTH_OPTIONS.map((m) => m.value) },
    bounds: { init: [0, 100000000], surplus: [0, 10000000], tgt: [0, 100000000], after: [0, 10000000], fd: [0.04, 0.09], sav: [0.02, 0.04], wd: [0, 100000000], yrs: [1, 25] },
  });

  const baseInput = useMemo<SweepInput>(
    () => ({
        initialBalance: s.init,
        monthlySurplus: s.surplus,
        targetBalance: s.tgt,
        monthlySurplusAfterTarget: s.after,
        threshold: Number(s.thr),
        savingsRate: s.sav,
        fdRate: s.fd,
        annualWithdrawal: s.wd,
        withdrawalMonth: Number(s.wdm),
        years: s.yrs,
        taxSlab: slab,
        regime,
        tdsEnabled: s.tds,
        fdStartsNextMonth: s.next,
    }),
    [s.init, s.surplus, s.tgt, s.after, s.thr, s.sav, s.fd, s.wd, s.wdm, s.yrs, s.tds, s.next, slab, regime],
  );
  const result = useMemo(() => simulateSweep(baseInput), [baseInput]);

  const chartData = useMemo(
    () => result.rows.map((row) => ({ year: row.year, fd: row.fdBalance, savings: row.savingsBalance })),
    [result.rows],
  );

  const columns = useMemo<YearColumn<SweepYearRow>[]>(
    () => [
      { key: "year", label: "Year", value: (r) => r.year, format: "int" },
      { key: "fy", label: "FY", value: (r) => fyLabel(r.year), format: "text" },
      { key: "deposits", label: "Credits", value: (r) => r.deposits, format: "inr" },
      { key: "withdrawals", label: "Withdrawn", value: (r) => r.withdrawals, format: "inr", tone: (r) => (r.withdrawals > 0 ? "negative" : undefined) },
      { key: "broken", label: "FD principal broken", value: (r) => r.brokenPrincipal, format: "inr" },
      { key: "savInt", label: "Savings int.", value: (r) => r.savingsInterest, format: "inr", tone: () => "positive" },
      { key: "fdInt", label: "FD int.", value: (r) => r.fdInterest, format: "inr", tone: () => "positive" },
      { key: "penalty", label: "Break penalty", value: (r) => r.breakPenalty, format: "inr", tone: (r) => (r.breakPenalty > 0 ? "negative" : undefined) },
      { key: "tds", label: "TDS", value: (r) => r.tds, format: "inr" },
      { key: "tax", label: "Total tax", value: (r) => r.tax, format: "inr", tone: (r) => (r.tax > 0 ? "negative" : undefined) },
      { key: "fdCount", label: "Live FDs", value: (r) => r.fdCount, format: "int" },
      { key: "total", label: "Total balance", value: (r) => r.total, format: "inr", strong: true },
      ...(isReal ? [{ key: "real", label: "Total balance (today's ₹)", value: (r: SweepYearRow) => adjust(r.total, r.year), format: "inr" as const }] : []),
    ],
    [adjust, isReal],
  );

  const scenarios = useMemo(
    () =>
      compareSweepScenarios(
        {
          initialBalance: s.init,
          monthlySurplus: s.surplus,
          targetBalance: s.tgt,
          monthlySurplusAfterTarget: s.after,
          threshold: SWEEP_THRESHOLDS[0],
          savingsRate: s.sav,
          fdRate: s.fd,
          annualWithdrawal: s.wd,
          withdrawalMonth: Number(s.wdm),
          years: s.yrs,
          taxSlab: slab,
          regime,
          tdsEnabled: s.tds,
          fdStartsNextMonth: s.next,
        },
        s.wd,
      ),
    [s.init, s.surplus, s.tgt, s.after, s.sav, s.fd, s.wd, s.wdm, s.yrs, s.tds, s.next, slab, regime],
  );
  const scenarioKeys = ["none", "occasional", "frequent"] as const;

  const monthColumns = useMemo<YearColumn<SweepMonthRow>[]>(
    () => [
      { key: "month", label: "Month", value: (m) => FY_MONTH_NAMES[m.month - 1], format: "text" },
      { key: "credited", label: "Credited", value: (m) => m.credited, format: "inr", sum: true },
      { key: "withdrawn", label: "Withdrawn", value: (m) => m.withdrawn, format: "inr", sum: true, tone: (m) => (m.withdrawn > 0 ? "negative" : undefined) },
      { key: "swept", label: "Swept to FD", value: (m) => m.swept, format: "inr", sum: true },
      { key: "broken", label: "FD broken", value: (m) => m.broken, format: "inr", sum: true, tone: (m) => (m.broken > 0 ? "negative" : undefined) },
      { key: "savAccrued", label: "Savings int. accrued", value: (m) => m.savingsInterestAccrued, format: "inr", sum: true, tone: () => "positive" },
      { key: "savCredited", label: "Savings int. credited", value: (m) => m.savingsInterestCredited, format: "inr", sum: true },
      { key: "fdInt", label: "FD int.", value: (m) => m.fdInterest, format: "inr", sum: true, tone: () => "positive" },
      { key: "savings", label: "Savings balance", value: (m) => m.savingsBalance, format: "inr" },
      { key: "fd", label: "FD balance", value: (m) => m.fdBalance, format: "inr" },
      { key: "fdCount", label: "Live FDs", value: (m) => m.fdCount, format: "int" },
    ],
    [],
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

      <div className="grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
        <KpiCard label="Post-tax balance" value={<Money value={result.finalTotal} />} hint={<span className="num">{isReal ? `Worth ${formatINR(adjust(result.finalTotal, s.yrs))} in today's money` : formatINR(result.finalTotal)}</span>} icon={Layers} />
        <KpiCard label="Net interest" value={<Money value={result.totalNetInterest} />} tone="positive" hint={`After break penalties · post-tax yield, final FY: ${formatPct(lastYearYield)}`} icon={Coins} />
        <KpiCard
          label="Tax paid"
          value={<Money value={result.totalTax} />}
          tone="negative"
          hint={s.tds ? `10% TDS deducted in ${tdsYears} of ${s.yrs} yrs (FD interest > ${formatCompactINR(SWEEP_TDS_THRESHOLD)})` : "Paid at slab each 31 March"}
          icon={Receipt}
        />
        <KpiCard label="Break penalties" value={<Money value={result.totalPenalty} />} tone={result.totalPenalty > 0 ? "negative" : "muted"} hint={`Withdrawn ${formatCompactINR(result.totalWithdrawals)} in total`} icon={ShieldAlert} />
      </div>

      <ResultsLayout
        value={s.tab}
        onValueChange={(value) => set("tab", value as typeof s.tab)}
        inputs={
          <>
            <SectionCard title="Inputs" description="Synced to the URL for sharing.">
              <div className="space-y-6">
                <SliderField
                  id="sw-init"
                  label="Initial balance"
                  value={s.init}
                  min={0}
                  max={2500000}
                  typedMax={100000000}
                  step={5000}
                  format={formatINR}
                  onChange={(v) => set("init", v)}
                  info={`Starts in savings. At or below the ${formatCompactINR(Number(s.thr))} threshold nothing sweeps, so it only earns the savings rate until a credit pushes the balance at least ${formatINR(SWEEP_UNIT)} past the threshold.`}
                />
                <SliderField id="sw-surplus" label={s.tgt > 0 ? "Monthly until target" : "Monthly surplus credited"} value={s.surplus} min={0} max={100000} step={1000} typedMax={10000000} format={formatINR} onChange={(v) => set("surplus", v)} />
                <SliderField
                  id="sw-tgt"
                  label="Target corpus"
                  value={s.tgt}
                  min={0}
                  max={2000000}
                  step={25000}
                  typedMax={100000000}
                  format={formatINR}
                  onChange={(v) => set("tgt", v)}
                  info="Set 0 for no target. Invest the monthly amount until savings plus swept FDs reach this total, e.g. an emergency fund. If withdrawals pull the total back below it, investing resumes until it is topped up again."
                />
                {s.tgt > 0 ? (
                  <SliderField id="sw-after" label="Monthly investment after target" value={s.after} min={0} max={100000} step={1000} typedMax={10000000} format={formatINR} onChange={(v) => set("after", v)} info="0 means stop investing once the target is reached; the balance then only compounds." />
                ) : null}
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
                  typedMax={100000000}
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
                <SwitchField
                  id="sw-next"
                  label="New FD earns from next month"
                  description={s.next ? "A swept FD's first interest is the month after the sweep" : "A swept FD earns interest in the month it is created"}
                  checked={s.next}
                  onChange={(v) => set("next", v)}
                  info="Surplus is assumed to land at the start of the month. Switch this on for a more conservative view where a freshly swept FD only starts earning in the following month. Each FD still compounds quarterly from its own start."
                />
              </div>
            </SectionCard>

          </>
        }
        tabs={[
          {
            value: "overview",
            label: "Overview",
            content: (
              <>
                <SectionCard title="Where the money sits" description="Post-tax balances on 31 March, actual rupees" expandable>
                  <WealthChart data={chartData} xKey="year" series={SERIES} kind="bar" stacked xTickFormatter={(v) => `Y${v}`} tooltipLabel={(v) => `Year ${v} · ${fyLabel(Number(v))}`} />
                </SectionCard>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {s.tgt > 0 ? (
                    <Callout icon={Layers} title="Target corpus">
                      {result.targetReachedMonth
                        ? `${formatINR(s.tgt)} is reached in month ${result.targetReachedMonth} (${Math.floor((result.targetReachedMonth - 1) / 12)} yrs ${(result.targetReachedMonth - 1) % 12 + 1} mo). ${s.after > 0 ? `After that you invest ${formatINR(s.after)} a month.` : "After that nothing more is invested; the corpus only compounds (withdrawals are topped back up to the target)."}`
                        : `${formatINR(s.tgt)} is not reached within ${s.yrs} years at ${formatINR(s.surplus)} a month.`}
                    </Callout>
                  ) : null}
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

              </>
            ),
          },
          {
            value: "ledger",
            label: "Year-wise ledger",
            content: (
              <>
                <YearTable
                  rows={result.rows}
                  columns={columns}
                  fileName={`auto-sweep-${s.yrs}y`}
                  rowKey={(r) => r.year}
                  detailTitle={(r) => `Year ${r.year} · ${fyLabel(r.year)} · month by month`}
                  detailDescription={() =>
                    `Savings interest accrues monthly and is credited every quarter. Each swept FD compounds quarterly from its own start date. Actual rupees.`
                  }
                  renderDetail={(r) => <MonthTable rows={r.months} columns={monthColumns} rowKey={(m) => m.month} note={(m) => m.note} />}
                />
              </>
            ),
          },
          {
            value: "habits",
            label: "Withdrawal habits",
            content: (
              <>
                <SectionCard
                  title="Which withdrawal habit are you?"
                  description={`Same investment plan, rates and tax as your inputs; only the withdrawals change. Withdrawal amount: ${formatINR(s.wd)} (set it in the inputs).`}
                  expandable
                >
                  <div className="overflow-x-auto">
                    <Table className="text-xs">
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="px-3">Pattern</TableHead>
                          {SWEEP_THRESHOLDS.map((t) => (
                            <TableHead key={t} className="px-3 text-right">
                              Balance · {formatCompactINR(t)} threshold
                            </TableHead>
                          ))}
                          <TableHead className="px-3 text-right">Penalties (best)</TableHead>
                          <TableHead className="px-3 text-right">Unmet withdrawals</TableHead>
                          <TableHead className="px-3">Better threshold</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scenarioKeys.map((key) => {
                          const pair = scenarios.filter((o) => o.scenario.key === key);
                          const best = pair.reduce((a, b) => (b.finalTotal > a.finalTotal ? b : a));
                          const other = pair.find((o) => o !== best) ?? best;
                          const gap = best.finalTotal - other.finalTotal;
                          return (
                            <TableRow key={key}>
                              <TableCell className="px-3">
                                <div className="font-medium">{pair[0].scenario.label}</div>
                                <div className="text-[11px] text-muted-foreground">{pair[0].scenario.description}</div>
                              </TableCell>
                              {pair.map((o) => (
                                <TableCell key={o.threshold} className={`px-3 text-right ${o === best ? "font-semibold" : "text-muted-foreground"}`}>
                                  <Money value={o.finalTotal} />
                                </TableCell>
                              ))}
                              <TableCell className="px-3 text-right">
                                <Money value={best.penalty} />
                              </TableCell>
                              <TableCell className="px-3 text-right">{best.shortfall > 0 ? <Money value={best.shortfall} className="text-negative" /> : "—"}</TableCell>
                              <TableCell className="px-3">
                                <Badge variant="secondary" className="rounded-md font-normal">
                                  {formatCompactINR(best.threshold)}
                                </Badge>
                                <span className="ml-2 text-muted-foreground">
                                  {gap < 0.002 * best.finalTotal ? "marginal" : "+"}
                                  {gap >= 0.002 * best.finalTotal ? formatCompactINR(gap) : ""}
                                </span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="mt-4">
                    <Callout icon={Lightbulb} title="How to read this">
                      {s.wd === 0
                        ? "Set an annual withdrawal above ₹0 to see how occasional and frequent withdrawals change the picture."
                        : "A lower threshold sweeps more money into the higher-paying FD, but any withdrawal beyond the savings balance has to break an FD and lose 1% of its rate for the time held. A higher threshold keeps a bigger cash buffer at the savings rate. Compare the gap with the cost of the buffer: if the lead is marginal, the choice barely matters and the bigger buffer is the safer pick."}
                    </Callout>
                  </div>
                </SectionCard>

              </>
            ),
          },
          {
            value: "tax",
            label: "Ways to cut tax",
            content: (
              <>
                <SweepTaxIdeas input={baseInput} base={result} />

              </>
            ),
          },
        ]}
      />
    </div>
  );
}
