"use client";

import { useMemo } from "react";
import { CalendarClock, Coins, Landmark, Percent, PiggyBank, ShieldCheck } from "lucide-react";
import { useUrlState } from "@/lib/url-state";
import { FY_MONTH_NAMES, formatCompactINR, formatINR, formatPct, fyLabel } from "@/lib/formatters";
import { preTaxEquivalent } from "@/lib/tax";
import {
  PPF_DEPOSIT_MODE_LABELS,
  PPF_EXTENSION_MODE_LABELS,
  PPF_MAX_ANNUAL_DEPOSIT,
  PPF_MIN_ANNUAL_DEPOSIT,
  ppfFirstYearEffectiveYield,
  simulatePpf,
  type PpfDepositMode,
  type PpfExtensionMode,
  type PpfMonthRow,
  type PpfYearRow,
} from "@/lib/engines/ppfEngine";
import { useGlobalSettings } from "@/components/providers/GlobalSettingsProvider";
import { Callout, KpiCard, Money, PageHeader, SectionCard } from "@/components/common/display";
import { Segmented, SelectField, SliderField } from "@/components/common/fields";
import { WealthChart, type ChartSeries } from "@/components/charts/WealthChart";
import { MonthTable, YearTable, type YearColumn } from "@/components/ledger/YearTable";

const DEFAULTS = {
  rate: 0.071,
  freq: "yearly" as "yearly" | "monthly",
  dep: 150000,
  mdep: 12500,
  mode: "lumpBefore5" as PpfDepositMode,
  ext: "stop" as PpfExtensionMode,
  blocks: 1,
  wd: 0,
};

const lumpModes: PpfDepositMode[] = ["lumpBefore5", "lumpAfter5"];
const sipModes: PpfDepositMode[] = ["sipBefore5", "sipAfter5"];
const modeOptions = (modes: PpfDepositMode[]) => modes.map((value) => ({ value, label: PPF_DEPOSIT_MODE_LABELS[value] }));
const PPF_MAX_MONTHLY_DEPOSIT = PPF_MAX_ANNUAL_DEPOSIT / 12;
const EXTENSION_MODES = Object.entries(PPF_EXTENSION_MODE_LABELS).map(([value, label]) => ({ value: value as PpfExtensionMode, label }));

const SERIES: ChartSeries[] = [
  { key: "principal", label: "Net deposits", color: "var(--chart-1)" },
  { key: "interest", label: "Accrued interest", color: "var(--chart-3)" },
];

export function PpfCalculator() {
  const { slab, adjust, adjustRate, isReal } = useGlobalSettings();
  const [s, set, reset] = useUrlState(DEFAULTS, {
    allowed: { mode: Object.keys(PPF_DEPOSIT_MODE_LABELS) as PpfDepositMode[], ext: Object.keys(PPF_EXTENSION_MODE_LABELS) as PpfExtensionMode[] },
    bounds: { rate: [0.06, 0.09], dep: [PPF_MIN_ANNUAL_DEPOSIT, PPF_MAX_ANNUAL_DEPOSIT], mdep: [PPF_MIN_ANNUAL_DEPOSIT, PPF_MAX_MONTHLY_DEPOSIT], blocks: [1, 4], wd: [0, 1] },
  });
  const monthly = s.freq === "monthly";
  const annualDeposit = monthly ? s.mdep * 12 : s.dep;
  const timingModes = monthly ? sipModes : lumpModes;
  // A saved URL could pair "monthly" with a lump-sum timing (or vice versa); treat it as the matching mode.
  const depositMode: PpfDepositMode = timingModes.includes(s.mode) ? s.mode : monthly ? (s.mode === "lumpAfter5" ? "sipAfter5" : "sipBefore5") : s.mode === "sipAfter5" ? "lumpAfter5" : "lumpBefore5";
  const setFrequency = (next: "yearly" | "monthly") => {
    set("freq", next);
    const after = s.mode === "lumpAfter5" || s.mode === "sipAfter5";
    set("mode", next === "monthly" ? (after ? "sipAfter5" : "sipBefore5") : after ? "lumpAfter5" : "lumpBefore5");
  };

  const result = useMemo(
    () =>
      simulatePpf({
        rate: s.rate,
        annualDeposit,
        depositMode,
        extensionMode: s.ext,
        extensionBlocks: s.blocks,
        annualWithdrawalPct: s.wd,
      }),
    [s.rate, annualDeposit, depositMode, s.ext, s.blocks, s.wd],
  );

  // Everything is in actual rupees. Real view only adds what the balance would buy in today's money.
  const growth = useMemo(
    () =>
      result.rows.map((row) => {
        const netIn = Math.max(0, Math.min(row.closing, row.cumulativeDeposits - row.cumulativeWithdrawals));
        return { year: row.year, netIn, interest: row.closing - netIn, real: adjust(row.closing, row.year) };
      }),
    [result.rows, adjust],
  );

  const chartData = useMemo(() => growth.map((g) => ({ year: g.year, principal: g.netIn, interest: g.interest })), [growth]);

  const columns = useMemo<YearColumn<PpfYearRow>[]>(
    () => [
      { key: "year", label: "Year", value: (r) => r.year, format: "int" },
      { key: "fy", label: "FY", value: (r) => fyLabel(r.year), format: "text" },
      { key: "phase", label: "Phase", value: (r) => r.phase, format: "text" },
      { key: "opening", label: "Opening", value: (r) => r.opening, format: "inr" },
      { key: "withdrawal", label: "Withdrawal", value: (r) => r.withdrawal, format: "inr", tone: (r) => (r.withdrawal > 0 ? "negative" : undefined) },
      { key: "deposit", label: "Deposit", value: (r) => r.deposit, format: "inr" },
      { key: "interest", label: "Interest (31 Mar)", value: (r) => r.interest, format: "inr", tone: () => "positive" },
      { key: "closing", label: "Closing balance", value: (r) => r.closing, format: "inr", strong: true },
      { key: "netIn", label: "Deposited so far (net)", value: (r) => growth[r.year - 1]?.netIn ?? 0, format: "inr" },
      { key: "intToDate", label: "Interest so far", value: (r) => growth[r.year - 1]?.interest ?? 0, format: "inr", tone: () => "positive" },
      ...(isReal ? [{ key: "real", label: "Closing balance (today's ₹)", value: (r: PpfYearRow) => growth[r.year - 1]?.real ?? 0, format: "inr" as const }] : []),
    ],
    [growth, isReal],
  );

  const monthColumns = useMemo<YearColumn<PpfMonthRow>[]>(
    () => [
      { key: "month", label: "Month", value: (m) => FY_MONTH_NAMES[m.month - 1], format: "text" },
      { key: "withdrawal", label: "Withdrawal", value: (m) => m.withdrawal, format: "inr", sum: true, tone: (m) => (m.withdrawal > 0 ? "negative" : undefined) },
      { key: "deposit", label: "Deposit", value: (m) => m.deposit, format: "inr", sum: true },
      { key: "eligible", label: "Interest-earning balance", value: (m) => m.eligibleBalance, format: "inr" },
      { key: "accrued", label: "Interest accrued", value: (m) => m.interestAccrued, format: "inr", sum: true, tone: () => "positive" },
      { key: "credited", label: "Interest credited", value: (m) => m.interestCredited, format: "inr", sum: true },
      { key: "balance", label: "Balance (month-end)", value: (m) => m.balance, format: "inr", strong: true },
    ],
    [],
  );

  const pretaxEquivalent = preTaxEquivalent(s.rate, slab);
  const effectiveYield = ppfFirstYearEffectiveYield(s.rate, depositMode);
  const bestYield = ppfFirstYearEffectiveYield(s.rate, "lumpBefore5");
  const extended = s.ext !== "stop";
  const maturity = result.maturityValue;
  const maturityToday = adjust(result.maturityValue, result.totalYears);
  const interestTotal = result.totalInterest;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Public Provident Fund"
        description="Interest on the lowest balance between the 5th and month-end, accrued monthly at rate ÷ 12 and credited once on 31 March. 15-year lock-in with optional 5-year extension blocks."
        badges={["EEE · Tax-free", `${result.totalYears} years`]}
        onReset={reset}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Maturity value"
          value={<Money value={maturity} />}
          hint={<span className="num">{isReal ? `Worth ${formatINR(maturityToday)} in today's money` : formatINR(maturity)}</span>}
          icon={Landmark}
        />
        <KpiCard label="Total deposited" value={<Money value={result.totalDeposits} />} hint={`${monthly ? `${formatINR(s.mdep)}/mo = ` : ""}${formatCompactINR(annualDeposit)}/yr × ${extended && s.ext === "extendWithContrib" ? result.totalYears : 15} yrs`} icon={PiggyBank} />
        <KpiCard
          label="Interest earned"
          value={<Money value={interestTotal} />}
          tone="positive"
          hint={result.totalWithdrawals > 0 ? `Withdrawn ${formatCompactINR(result.totalWithdrawals)} in extension` : "Fully tax-free under Sec 10(11)"}
          icon={Coins}
        />
        <KpiCard
          label="Pre-tax FD equivalent"
          value={formatPct(pretaxEquivalent)}
          hint={`${formatPct(s.rate)} ÷ (1 − ${Math.round(slab * 100)}% slab)${isReal ? ` · real ${formatPct(adjustRate(s.rate))}` : ""}`}
          icon={Percent}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <SectionCard title="Inputs" description="Changes are saved to the URL — bookmark or share any scenario.">
          <div className="space-y-6">
            <SliderField
              id="ppf-rate"
              label="Interest rate (p.a.)"
              value={s.rate}
              min={0.06}
              max={0.09}
              step={0.0005}
              format={(v) => formatPct(v)}
              onChange={(v) => set("rate", v)}
              info="Default 7.10%. The Ministry of Finance notifies the rate every quarter. Editable."
            />
            <Segmented
              label="How you deposit"
              value={s.freq}
              options={[
                { value: "yearly", label: "Yearly lump sum" },
                { value: "monthly", label: "Monthly" },
              ]}
              onChange={setFrequency}
              info="Monthly deposits are twelve equal instalments across the financial year, so they earn a little less than one lump sum in April."
            />
            {monthly ? (
              <SliderField
                id="ppf-monthly"
                label="Monthly deposit"
                value={s.mdep}
                min={PPF_MIN_ANNUAL_DEPOSIT}
                max={PPF_MAX_MONTHLY_DEPOSIT}
                step={500}
                format={formatINR}
                onChange={(v) => set("mdep", v)}
                info={`Twelve instalments a year, so at most ${formatINR(PPF_MAX_MONTHLY_DEPOSIT)} a month to stay inside the ₹1,50,000 yearly limit. That is ${formatINR(annualDeposit)} a year.`}
              />
            ) : (
              <SliderField
                id="ppf-deposit"
                label="Annual deposit"
                value={s.dep}
                min={PPF_MIN_ANNUAL_DEPOSIT}
                max={PPF_MAX_ANNUAL_DEPOSIT}
                step={500}
                format={formatINR}
                onChange={(v) => set("dep", v)}
                info="Minimum ₹500, maximum ₹1,50,000 per financial year."
              />
            )}
            <SelectField
              id="ppf-mode"
              label="Deposit timing"
              value={depositMode}
              options={modeOptions(timingModes)}
              onChange={(v) => set("mode", v)}
              info="Money deposited after the 5th misses that month's interest, because interest runs on the lowest balance between the 5th and month-end."
            />
            <SelectField
              id="ppf-ext"
              label="After 15 years"
              value={s.ext}
              options={EXTENSION_MODES}
              onChange={(v) => set("ext", v)}
              info="Without contributions: the corpus keeps compounding and 1 withdrawal/year of any amount is allowed. With contributions (Form H): deposits continue, and total withdrawals in each block are capped at 60% of the block's opening balance."
            />
            {extended ? (
              <>
                <SliderField
                  id="ppf-blocks"
                  label="Extension blocks (5 yrs each)"
                  value={s.blocks}
                  min={1}
                  max={4}
                  step={1}
                  format={(v) => `${v} · ${15 + v * 5} yrs`}
                  onChange={(v) => set("blocks", v)}
                />
                <SliderField
                  id="ppf-wd"
                  label="Annual withdrawal (% of balance)"
                  value={s.wd}
                  min={0}
                  max={1}
                  step={0.01}
                  format={(v) => formatPct(v, 0)}
                  onChange={(v) => set("wd", v)}
                  info={
                    s.ext === "extendWithContrib"
                      ? "Taken on 1 April of each extension year. Cumulative withdrawals per block are capped at 60% of the block-opening balance."
                      : "One withdrawal per year, taken on 1 April, up to 100% of the balance."
                  }
                />
              </>
            ) : null}
          </div>
        </SectionCard>

        <div className="min-w-0 space-y-4">
          <SectionCard title="Corpus growth" description={isReal ? "Actual rupees: what you deposit + the interest it earns = the closing balance. Real view only adds today's-money values to the cards and table" : "Nominal rupees, balance on 31 March"} expandable>
            <WealthChart
              data={chartData}
              xKey="year"
              series={SERIES}
              kind="area"
              stacked
              xTickFormatter={(v) => `Y${v}`}
              tooltipLabel={(v) => `Year ${v} · ${fyLabel(Number(v))}`}
              references={extended ? [{ x: 15, label: "Lock-in ends" }] : []}
            />
          </SectionCard>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Callout icon={CalendarClock} title="Deposit-timing drag" tone={effectiveYield < bestYield ? "negative" : "positive"}>
              First-year yield on your deposits: <span className="num text-foreground">{formatPct(effectiveYield)}</span> vs{" "}
              <span className="num text-foreground">{formatPct(bestYield)}</span> for a lump sum on/before 5 April.
            </Callout>
            <Callout icon={ShieldCheck} title="EEE status" tone="positive">
              Deposits qualify for 80C (Old Regime only); interest and maturity are fully exempt under both regimes.
            </Callout>
          </div>

          <YearTable
            rows={result.rows}
            columns={columns}
            fileName={`ppf-${result.totalYears}y-${(s.rate * 100).toFixed(2)}pct`}
            rowKey={(r) => r.year}
            highlight={(r) => r.year === 15}
            detailTitle={(r) => `Year ${r.year} · ${fyLabel(r.year)} · month by month`}
            detailDescription={(r) =>
              `${r.phase} · interest accrues monthly on the lowest balance between the 5th and month-end, then is credited on 31 March. Actual rupees.`
            }
            renderDetail={(r) => (
              <MonthTable
                rows={r.months}
                columns={monthColumns}
                rowKey={(m) => m.month}
                note={(m) =>
                  m.month === 1 && r.withdrawal > 0
                    ? "Withdrawal taken 1 April"
                    : m.month === 12
                      ? `Interest of ${formatINR(r.interest)} credited`
                      : m.month === 1 && depositMode === "lumpAfter5"
                        ? "Lump sum after the 5th earns no April interest"
                        : undefined
                }
              />
            )}
          />
        </div>
      </div>
    </div>
  );
}
