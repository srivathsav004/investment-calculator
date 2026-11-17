"use client";

import { useMemo } from "react";
import { AlertTriangle, BriefcaseBusiness, Coins, Receipt, ShieldCheck, Umbrella } from "lucide-react";
import { useUrlState } from "@/lib/url-state";
import { formatCompactINR, formatINR, formatPct, fyLabel } from "@/lib/formatters";
import {
  EPF_TAX_FREE_EMPLOYEE_LIMIT,
  EPF_WAGE_CEILING,
  EPS_MONTHLY_CAP,
  simulateEpf,
  type EpfYearRow,
} from "@/lib/engines/epfEngine";
import { useGlobalSettings } from "@/components/providers/GlobalSettingsProvider";
import { Callout, KpiCard, Money, PageHeader, SectionCard } from "@/components/common/display";
import { SliderField, SwitchField } from "@/components/common/fields";
import { WealthChart, type ChartSeries } from "@/components/charts/WealthChart";
import { YearTable, type YearColumn } from "@/components/ledger/YearTable";

const DEFAULTS = {
  rate: 0.0825,
  basic: 30000,
  hike: 0.08,
  vpf: 0,
  cap: true,
  yrs: 25,
};

const SERIES: ChartSeries[] = [
  { key: "taxFree", label: "EPF · tax-free bucket", color: "var(--chart-1)" },
  { key: "taxable", label: "EPF · taxable bucket", color: "var(--chart-2)" },
  { key: "pension", label: "EPS pension pool (0%)", color: "var(--chart-3)" },
];

export function EpfCalculator() {
  const { slab, adjust, isReal } = useGlobalSettings();
  const [s, set, reset] = useUrlState(DEFAULTS, {
    bounds: { rate: [0.07, 0.095], basic: [15000, 200000], hike: [0, 0.15], vpf: [0, 0.5], yrs: [1, 40] },
  });

  const result = useMemo(
    () =>
      simulateEpf({
        rate: s.rate,
        monthlyBasic: s.basic,
        annualHike: s.hike,
        vpfPct: s.vpf,
        capWageAtCeiling: s.cap,
        years: s.yrs,
        taxSlab: slab,
      }),
    [s.rate, s.basic, s.hike, s.vpf, s.cap, s.yrs, slab],
  );

  const chartData = useMemo(
    () =>
      result.rows.map((row) => ({
        year: row.year,
        taxFree: adjust(row.taxFreeBalance, row.year),
        taxable: adjust(row.taxableBalance, row.year),
        pension: adjust(row.pensionCorpus, row.year),
      })),
    [result.rows, adjust],
  );

  const columns = useMemo<YearColumn<EpfYearRow>[]>(
    () => [
      { key: "year", label: "Year", value: (r) => r.year, format: "int" },
      { key: "fy", label: "FY", value: (r) => fyLabel(r.year), format: "text" },
      { key: "basic", label: "Basic + DA /mo", value: (r) => adjust(r.monthlyBasic, r.year - 1), format: "inr" },
      { key: "employee", label: "Employee 12%", value: (r) => adjust(r.employeeContribution, r.year), format: "inr" },
      { key: "vpf", label: "VPF", value: (r) => adjust(r.vpfContribution, r.year), format: "inr" },
      { key: "employer", label: "Employer → EPF", value: (r) => adjust(r.employerEpfContribution, r.year), format: "inr" },
      { key: "eps", label: "Employer → EPS", value: (r) => adjust(r.epsContribution, r.year), format: "inr" },
      { key: "taxableContrib", label: "Above ₹2.5L", value: (r) => adjust(r.taxableContribution, r.year), format: "inr", tone: (r) => (r.taxableContribution > 0 ? "negative" : undefined) },
      { key: "interest", label: "Interest", value: (r) => adjust(r.interest, r.year), format: "inr", tone: () => "positive" },
      { key: "tax", label: "Tax on interest", value: (r) => adjust(r.taxOnInterest, r.year), format: "inr", tone: (r) => (r.taxOnInterest > 0 ? "negative" : undefined) },
      { key: "epf", label: "EPF balance", value: (r) => adjust(r.epfBalance, r.year), format: "inr", strong: true },
      { key: "pension", label: "EPS pool", value: (r) => adjust(r.pensionCorpus, r.year), format: "inr" },
    ],
    [adjust],
  );

  const first = result.firstMonth;
  const finalYear = s.yrs;
  const breachRow = result.rows.find((r) => r.taxableContribution > 0);
  const breachYear = breachRow?.year;
  const breachEmployeeTotal = breachRow ? breachRow.employeeContribution + breachRow.vpfContribution : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="EPF + VPF"
        description={`Interest at rate ÷ 12 on the monthly running balance, credited on 31 March. Employer's 8.33% EPS share is capped at ₹${EPS_MONTHLY_CAP.toLocaleString("en-IN")}/month (8.33% of the ₹${EPF_WAGE_CEILING.toLocaleString("en-IN")} ceiling) and earns no interest.`}
        badges={[`${s.yrs} years`, s.cap ? "Wage capped at ₹25k" : "Uncapped wage"]}
        onReset={reset}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={isReal ? "EPF corpus (today's ₹)" : "EPF corpus"}
          value={<Money value={adjust(result.finalEpfBalance, finalYear)} />}
          hint={<span className="num">{formatINR(adjust(result.finalEpfBalance, finalYear))}</span>}
          icon={BriefcaseBusiness}
        />
        <KpiCard
          label="Tax-free vs taxable"
          value={
            <span className="flex items-baseline gap-1.5">
              <Money value={adjust(result.finalTaxFreeBalance, finalYear)} />
              <span className="text-sm text-muted-foreground">/</span>
              <Money value={adjust(result.finalTaxableBalance, finalYear)} className="text-base text-negative" />
            </span>
          }
          hint={`Interest on employee money above ${formatCompactINR(EPF_TAX_FREE_EMPLOYEE_LIMIT)}/yr is taxed at slab`}
          icon={ShieldCheck}
        />
        <KpiCard
          label="Total interest · tax paid"
          value={<Money value={result.totalInterest} />}
          tone="positive"
          hint={
            <span>
              Tax on taxable interest: <Money value={result.totalTax} className="text-negative" /> at {Math.round(slab * 100)}% slab
            </span>
          }
          icon={Coins}
        />
        <KpiCard
          label="EPS pension pool"
          value={<Money value={adjust(result.finalPensionCorpus, finalYear)} />}
          hint="Contributions only — pays a pension, not a lump sum"
          icon={Umbrella}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-4">
          <SectionCard title="Inputs" description="Synced to the URL for sharing.">
            <div className="space-y-6">
              <SliderField id="epf-rate" label="EPF interest rate" value={s.rate} min={0.07} max={0.095} step={0.0005} format={(v) => formatPct(v)} onChange={(v) => set("rate", v)} info="Default 8.25%, the rate EPFO declares each year. Editable." />
              <SliderField id="epf-basic" label="Starting Basic + DA (monthly)" value={s.basic} min={15000} max={200000} step={500} format={formatINR} onChange={(v) => set("basic", v)} />
              <SliderField id="epf-hike" label="Annual salary hike" value={s.hike} min={0} max={0.15} step={0.005} format={(v) => formatPct(v, 1)} onChange={(v) => set("hike", v)} />
              <SliderField id="epf-vpf" label="VPF (% of Basic + DA)" value={s.vpf} min={0} max={0.5} step={0.01} format={(v) => formatPct(v, 0)} onChange={(v) => set("vpf", v)} info="Voluntary Provident Fund. 100% goes to your EPF account and earns the EPF rate. The employer does not match it." />
              <SliderField id="epf-yrs" label="Years of service" value={s.yrs} min={1} max={40} step={1} format={(v) => `${v} yrs`} onChange={(v) => set("yrs", v)} />
              <SwitchField
                id="epf-cap"
                label="Statutory wage ceiling"
                description={s.cap ? `PF wage capped at ${formatINR(EPF_WAGE_CEILING)}/month` : "Contributions on actual Basic + DA"}
                checked={s.cap}
                onChange={(v) => set("cap", v)}
                info="Many employers contribute on the capped ₹25,000 wage. Uncapped means 12% of the full Basic + DA from both sides. EPS stays capped either way."
              />
            </div>
          </SectionCard>

          <SectionCard title="Month 1 contribution split" description={`On Basic + DA of ${formatINR(first.basic)}`}>
            <dl className="num space-y-2 text-sm">
              {[
                ["PF wage", first.pfWage, "muted"],
                ["Employee 12% → EPF", first.employee, "default"],
                ["VPF → EPF", first.vpf, "default"],
                ["Employer 12% total", first.employerTotal, "muted"],
                [`  ↳ EPS (cap ₹${EPS_MONTHLY_CAP})`, first.eps, "default"],
                ["  ↳ Employer → EPF", first.employerEpf, "default"],
              ].map(([label, value, tone]) => (
                <div key={String(label)} className="flex justify-between gap-3">
                  <dt className={tone === "muted" ? "text-muted-foreground" : "whitespace-pre text-foreground"}>{label}</dt>
                  <dd className={tone === "muted" ? "text-muted-foreground" : "font-medium"}>{formatINR(Number(value))}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t pt-2">
                <dt className="font-medium">Into EPF each month</dt>
                <dd className="font-semibold">{formatINR(first.employee + first.vpf + first.employerEpf)}</dd>
              </div>
            </dl>
          </SectionCard>
        </div>

        <div className="min-w-0 space-y-4">
          <SectionCard title="Balance by bucket" description={isReal ? "Inflation-adjusted to today's rupees" : "Nominal rupees on 31 March"}>
            <WealthChart data={chartData} xKey="year" series={SERIES} kind="area" stacked xTickFormatter={(v) => `Y${v}`} tooltipLabel={(v) => `Year ${v} · ${fyLabel(Number(v))}`} />
          </SectionCard>

          {breachYear ? (
            <Callout icon={AlertTriangle} title={`₹2.5L employee-contribution limit crossed in year ${breachYear}`} tone="negative">
              In year {breachYear}, employee contributions (EPF + VPF) reach <span className="num text-foreground">{formatINR(breachEmployeeTotal)}</span>. The excess goes to a separate
              taxable account. Its interest is taxed every year at your {Math.round(slab * 100)}% slab (Sec 10(12) proviso and Rule 9D).
            </Callout>
          ) : (
            <Callout icon={Receipt} title="Entire corpus is tax-free" tone="positive">
              Employee contributions stay within {formatCompactINR(EPF_TAX_FREE_EMPLOYEE_LIMIT)} a year, so all interest is exempt after 5 years of continuous service.
            </Callout>
          )}

          <YearTable rows={result.rows} columns={columns} fileName={`epf-${s.yrs}y`} rowKey={(r) => r.year} />
        </div>
      </div>
    </div>
  );
}
