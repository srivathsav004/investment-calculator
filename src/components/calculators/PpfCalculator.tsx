"use client";

import { useMemo } from "react";
import { CalendarClock, Coins, Landmark, Percent, PiggyBank, ShieldCheck } from "lucide-react";
import { useUrlState } from "@/lib/url-state";
import { formatCompactINR, formatINR, formatPct, fyLabel } from "@/lib/formatters";
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
  type PpfYearRow,
} from "@/lib/engines/ppfEngine";
import { useGlobalSettings } from "@/components/providers/GlobalSettingsProvider";
import { Callout, KpiCard, Money, PageHeader, SectionCard } from "@/components/common/display";
import { SelectField, SliderField } from "@/components/common/fields";
import { WealthChart, type ChartSeries } from "@/components/charts/WealthChart";
import { YearTable, type YearColumn } from "@/components/ledger/YearTable";

const DEFAULTS = {
  rate: 0.071,
  dep: 150000,
  mode: "lumpBefore5" as PpfDepositMode,
  ext: "stop" as PpfExtensionMode,
  blocks: 1,
  wd: 0,
};

const DEPOSIT_MODES = Object.entries(PPF_DEPOSIT_MODE_LABELS).map(([value, label]) => ({ value: value as PpfDepositMode, label }));
const EXTENSION_MODES = Object.entries(PPF_EXTENSION_MODE_LABELS).map(([value, label]) => ({ value: value as PpfExtensionMode, label }));

const SERIES: ChartSeries[] = [
  { key: "principal", label: "Net deposits", color: "var(--chart-1)" },
  { key: "interest", label: "Accrued interest", color: "var(--chart-3)" },
];

export function PpfCalculator() {
  const { slab, adjust, adjustRate, isReal } = useGlobalSettings();
  const [s, set, reset] = useUrlState(DEFAULTS, {
    allowed: { mode: Object.keys(PPF_DEPOSIT_MODE_LABELS) as PpfDepositMode[], ext: Object.keys(PPF_EXTENSION_MODE_LABELS) as PpfExtensionMode[] },
    bounds: { rate: [0.06, 0.09], dep: [PPF_MIN_ANNUAL_DEPOSIT, PPF_MAX_ANNUAL_DEPOSIT], blocks: [1, 4], wd: [0, 1] },
  });

  const result = useMemo(
    () =>
      simulatePpf({
        rate: s.rate,
        annualDeposit: s.dep,
        depositMode: s.mode,
        extensionMode: s.ext,
        extensionBlocks: s.blocks,
        annualWithdrawalPct: s.wd,
      }),
    [s.rate, s.dep, s.mode, s.ext, s.blocks, s.wd],
  );

  const chartData = useMemo(
    () =>
      result.rows.map((row) => {
        const netDeposits = Math.max(0, Math.min(row.closing, row.cumulativeDeposits - row.cumulativeWithdrawals));
        return {
          year: row.year,
          principal: adjust(netDeposits, row.year),
          interest: adjust(row.closing - netDeposits, row.year),
        };
      }),
    [result.rows, adjust],
  );

  const columns = useMemo<YearColumn<PpfYearRow>[]>(
    () => [
      { key: "year", label: "Year", value: (r) => r.year, format: "int" },
      { key: "fy", label: "FY", value: (r) => fyLabel(r.year), format: "text" },
      { key: "phase", label: "Phase", value: (r) => r.phase, format: "text" },
      { key: "opening", label: "Opening", value: (r) => adjust(r.opening, r.year - 1), format: "inr" },
      { key: "withdrawal", label: "Withdrawal", value: (r) => adjust(r.withdrawal, r.year - 1), format: "inr", tone: (r) => (r.withdrawal > 0 ? "negative" : undefined) },
      { key: "deposit", label: "Deposit", value: (r) => adjust(r.deposit, r.year - 1), format: "inr" },
      { key: "interest", label: "Interest (31 Mar)", value: (r) => adjust(r.interest, r.year), format: "inr", tone: () => "positive" },
      { key: "closing", label: "Closing balance", value: (r) => adjust(r.closing, r.year), format: "inr", strong: true },
    ],
    [adjust],
  );

  const pretaxEquivalent = preTaxEquivalent(s.rate, slab);
  const effectiveYield = ppfFirstYearEffectiveYield(s.rate, s.mode);
  const bestYield = ppfFirstYearEffectiveYield(s.rate, "lumpBefore5");
  const extended = s.ext !== "stop";
  const maturity = adjust(result.maturityValue, result.totalYears);

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
          label={isReal ? "Maturity value (today's ₹)" : "Maturity value"}
          value={<Money value={maturity} />}
          hint={<span className="num">{formatINR(maturity)}</span>}
          icon={Landmark}
        />
        <KpiCard label="Total deposited" value={<Money value={result.totalDeposits} />} hint={`${formatCompactINR(s.dep)} × ${extended && s.ext === "extendWithContrib" ? result.totalYears : 15} yrs`} icon={PiggyBank} />
        <KpiCard
          label="Interest earned"
          value={<Money value={result.totalInterest} />}
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
            <SelectField
              id="ppf-mode"
              label="Deposit timing"
              value={s.mode}
              options={DEPOSIT_MODES}
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
          <SectionCard title="Corpus growth" description={isReal ? "Inflation-adjusted to today's rupees" : "Nominal rupees, balance on 31 March"}>
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
          />
        </div>
      </div>
    </div>
  );
}
