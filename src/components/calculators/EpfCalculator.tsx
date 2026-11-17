"use client";

import { useMemo } from "react";
import { AlertTriangle, BriefcaseBusiness, CalendarRange, Coins, Hourglass, Receipt, ShieldCheck, Umbrella } from "lucide-react";
import { useUrlState } from "@/lib/url-state";
import { formatCompactINR, formatINR, formatPct } from "@/lib/formatters";
import {
  EPF_DECLARED_RATES,
  EPF_INTEREST_END_AGE,
  EPF_TAX_FREE_EMPLOYEE_LIMIT,
  EPF_WAGE_CEILING,
  EPF_WAGE_CEILING_OLD,
  EPS_MIN_SERVICE_YEARS,
  simulateEpf,
  type EpfMonthRow,
  type EpfYearRow,
} from "@/lib/engines/epfEngine";
import { useGlobalSettings } from "@/components/providers/GlobalSettingsProvider";
import { Callout, KpiCard, Money, PageHeader, SectionCard } from "@/components/common/display";
import { DateField, SliderField, SwitchField } from "@/components/common/fields";
import { WealthChart, type ChartSeries } from "@/components/charts/WealthChart";
import { MonthTable, YearTable, type YearColumn } from "@/components/ledger/YearTable";

const DEFAULTS = {
  rate: 0.0825,
  dob: "2004-06-15",
  start: "2025-08",
  basic: 25000,
  cap: true,
  eps: true,
};

const SERIES: ChartSeries[] = [
  { key: "taxFree", label: "EPF · tax-free bucket", color: "var(--chart-1)" },
  { key: "taxable", label: "EPF · taxable bucket", color: "var(--chart-2)" },
];

const DOB_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_PATTERN = /^\d{4}-\d{2}$/;

/** Years between today's rupees (FY2026-27 starts at 1) and the end of a ledger FY; past years aren't deflated. */
const yearsAhead = (row: EpfYearRow) => Math.max(0, row.fyStart - 2025);

function durationLabel(months: number): string {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return `${years} yr${years === 1 ? "" : "s"}${rest ? ` ${rest} mo` : ""}`;
}

export function EpfCalculator() {
  const { slab, adjust, isReal } = useGlobalSettings();
  const [s, set, reset] = useUrlState(DEFAULTS, {
    bounds: { rate: [0.07, 0.095], basic: [8000, 200000] },
  });
  const dob = DOB_PATTERN.test(s.dob) ? s.dob : DEFAULTS.dob;
  const start = MONTH_PATTERN.test(s.start) ? s.start : DEFAULTS.start;

  const result = useMemo(
    () =>
      simulateEpf({
        rate: s.rate,
        monthlyBasic: s.basic,
        vpfPct: 0,
        capWageAtCeiling: s.cap,
        epsMember: s.eps,
        dob,
        startMonth: start,
        retireAge: EPF_INTEREST_END_AGE,
        taxSlab: slab,
      }),
    [s.rate, s.basic, s.cap, s.eps, dob, start, slab],
  );

  const chartData = useMemo(
    () =>
      result.rows.map((row) => ({
        year: row.year,
        taxFree: row.taxFreeBalance,
        taxable: row.taxableBalance,
      })),
    [result.rows],
  );

  // Salary and contributions are the actual rupees paid in each year, so they never deflate in Real view.
  const columns = useMemo<YearColumn<EpfYearRow>[]>(
    () => [
      { key: "fy", label: "FY", value: (r) => r.fy, format: "text" },
      { key: "months", label: "Months", value: (r) => r.monthsInYear, format: "int" },
      { key: "rate", label: "Rate", value: (r) => r.rate, format: "pct" },
      { key: "basic", label: "Basic + DA /mo", value: (r) => r.monthlyBasic, format: "inr" },
      { key: "employee", label: "Employee 12%", value: (r) => r.employeeContribution, format: "inr" },
      { key: "employer", label: "Employer → EPF", value: (r) => r.employerEpfContribution, format: "inr" },
      { key: "eps", label: "Employer → EPS", value: (r) => r.epsContribution, format: "inr" },
      { key: "taxableContrib", label: "Above ₹2.5L", value: (r) => r.taxableContribution, format: "inr", tone: (r) => (r.taxableContribution > 0 ? "negative" : undefined) },
      { key: "interest", label: "Interest", value: (r) => r.interest, format: "inr", tone: () => "positive" },
      { key: "tax", label: "Tax on interest", value: (r) => r.taxOnInterest, format: "inr", tone: (r) => (r.taxOnInterest > 0 ? "negative" : undefined) },
      { key: "epf", label: "EPF balance", value: (r) => r.epfBalance, format: "inr", strong: true },
      { key: "pension", label: "EPS pool", value: (r) => r.pensionCorpus, format: "inr" },
      ...(isReal ? [{ key: "real", label: "EPF balance (today's ₹)", value: (r: EpfYearRow) => adjust(r.epfBalance, yearsAhead(r)), format: "inr" as const }] : []),
    ],
    [adjust, isReal],
  );

  const monthColumns = useMemo<YearColumn<EpfMonthRow>[]>(
    () => [
      { key: "label", label: "Month", value: (m) => m.label, format: "text" },
      { key: "basic", label: "Basic + DA", value: (m) => m.basic, format: "inr" },
      { key: "ceiling", label: "Wage ceiling", value: (m) => m.ceiling, format: "inr" },
      { key: "employee", label: "Employee 12%", value: (m) => m.employee, format: "inr", sum: true },
      { key: "employer", label: "Employer → EPF", value: (m) => m.employerEpf, format: "inr", sum: true },
      { key: "eps", label: "Employer → EPS", value: (m) => m.eps, format: "inr", sum: true },
      { key: "accrued", label: "Interest accrued", value: (m) => m.interestAccrued, format: "inr", sum: true, tone: () => "positive" },
      { key: "credited", label: "Interest credited", value: (m) => m.interestCredited, format: "inr", sum: true },
      { key: "balance", label: "EPF balance", value: (m) => m.balance, format: "inr", strong: true },
    ],
    [],
  );

  const rows = result.rows;
  const lastRow = rows[rows.length - 1];
  const finalYears = lastRow ? yearsAhead(lastRow) : 0;
  const breachRow = rows.find((r) => r.taxableContribution > 0);
  const pension = result.pension;
  const retirementLabel = new Date(`${result.retirementDate}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  const firstMonthLabel = rows[0]?.months[0]?.label ?? start;
  const hasContributions = rows.length > 0;
  const cappedBasic = s.cap && s.basic >= EPF_WAGE_CEILING;

  return (
    <div className="space-y-6">
      <PageHeader
        title="EPF"
        description={`Month-by-month from ${firstMonthLabel} until you turn ${EPF_INTEREST_END_AGE}. Interest is accrued monthly at rate ÷ 12 on the running balance and credited each 31 March. The wage ceiling was ${formatINR(EPF_WAGE_CEILING_OLD)} until 16 Sep 2026 and is ${formatINR(EPF_WAGE_CEILING)} from 17 Sep 2026.`}
        badges={[hasContributions ? durationLabel(result.contributionMonths) : "No contributions", s.cap ? "Wage capped at ceiling" : "Uncapped wage"]}
        onReset={reset}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label={`EPF corpus at ${EPF_INTEREST_END_AGE}`}
          value={<Money value={result.finalEpfBalance} />}
          hint={<span className="num">{isReal ? `Worth ${formatINR(adjust(result.finalEpfBalance, finalYears))} in today's money` : formatINR(result.finalEpfBalance)}</span>}
          icon={BriefcaseBusiness}
        />
        <KpiCard
          label="Tax-free vs taxable"
          value={
            <span className="flex items-baseline gap-1.5">
              <Money value={result.finalTaxFreeBalance} />
              <span className="text-sm text-muted-foreground">/</span>
              <Money value={result.finalTaxableBalance} className="text-base text-negative" />
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
          label="Estimated EPS pension"
          value={pension.eligible ? <span>{formatINR(pension.monthlyPension)}/mo</span> : <span className="text-muted-foreground">Not eligible</span>}
          hint={
            pension.eligible
              ? `From age ${EPF_INTEREST_END_AGE} · ${pension.pensionableService} pensionable yrs × ${formatINR(pension.pensionableWage)} ÷ 70 (nominal ₹)`
              : s.eps
                ? `Needs ${EPS_MIN_SERVICE_YEARS}+ years of service; below that only the EPS balance is withdrawable`
                : "EPS membership switched off"
          }
          icon={Umbrella}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-4">
          <SectionCard title="Inputs" description="Synced to the URL for sharing.">
            <div className="space-y-6">
              <DateField
                id="epf-dob"
                label="Date of birth"
                type="date"
                value={dob}
                min="1960-01-01"
                max="2008-12-31"
                onChange={(v) => set("dob", v)}
                info="Contributions stop on your 58th birthday, when the EPF account also stops earning interest."
              />
              <DateField
                id="epf-start"
                label="First contribution month (UAN start)"
                type="month"
                value={start}
                min="2010-01"
                max="2040-12"
                onChange={(v) => set("start", v)}
              />
              <SliderField
                id="epf-rate"
                label="EPF rate from FY26-27 (projected)"
                value={s.rate}
                min={0.07}
                max={0.095}
                step={0.0005}
                format={(v) => formatPct(v)}
                onChange={(v) => set("rate", v)}
                info={`FY2025-26 always uses the declared ${formatPct(EPF_DECLARED_RATES[2025])}. EPFO has not announced a rate for FY2026-27 or later, so this value is a projection you choose.`}
              />
              <SliderField
                id="epf-basic"
                label="Basic + DA when you joined (monthly)"
                value={s.basic}
                min={8000}
                max={200000}
                step={500}
                format={formatINR}
                onChange={(v) => set("basic", v)}
                info="Set this to your real Basic + DA. Take it from your salary slip. With the wage cap on, anything above the ceiling does not change your PF."
              />
              <SwitchField
                id="epf-cap"
                label="Contribute on the wage ceiling"
                description={s.cap ? "PF wage = lower of Basic + DA and the ceiling" : "Contributions on actual Basic + DA"}
                checked={s.cap}
                onChange={(v) => set("cap", v)}
                info="Many employers contribute on the capped wage. Uncapped means 12% of the full Basic + DA from both sides. EPS stays capped either way."
              />
              <SwitchField
                id="epf-eps"
                label="I am an EPS member"
                description={s.eps ? "8.33% of the capped wage goes to EPS" : "Employer's whole 12% goes to EPF"}
                checked={s.eps}
                onChange={(v) => set("eps", v)}
                info="Members who joined after Sept 2014 with wages above the ceiling at joining are not in EPS. Check the EPS column in your EPFO passbook."
              />
            </div>
          </SectionCard>

          <SectionCard title="Monthly contribution split" description={`On Basic + DA of ${formatINR(rows[0]?.months[0]?.basic ?? s.basic)} at the start`}>
            <div className="space-y-4">
              {result.eraSplits.map(({ label, split, ceiling }) => (
                <div key={label}>
                  <div className="mb-1.5 flex items-baseline justify-between gap-2 text-xs">
                    <span className="font-medium">{label}</span>
                    <span className="num text-muted-foreground">ceiling {formatINR(ceiling)}</span>
                  </div>
                  <dl className="num space-y-1.5 text-sm">
                    {[
                      ["PF wage", split.pfWage, true],
                      ["Employee 12% → EPF", split.employee, false],
                      ["Employer 12% total", split.employerTotal, true],
                      ["  ↳ EPS", split.eps, false],
                      ["  ↳ Employer → EPF", split.employerEpf, false],
                    ].map(([name, value, muted]) => (
                      <div key={String(name)} className="flex justify-between gap-3">
                        <dt className={muted ? "text-muted-foreground" : "whitespace-pre text-foreground"}>{name}</dt>
                        <dd className={muted ? "text-muted-foreground" : "font-medium"}>{formatINR(Number(value))}</dd>
                      </div>
                    ))}
                    <div className="flex justify-between gap-3 border-t pt-1.5">
                      <dt className="font-medium">Into EPF each month</dt>
                      <dd className="font-semibold">{formatINR(split.employee + split.employerEpf)}</dd>
                    </div>
                    <div className="flex justify-between gap-3 text-muted-foreground">
                      <dt>Total PF deduction (you + employer)</dt>
                      <dd>{formatINR(split.employee + split.employerTotal)}</dd>
                    </div>
                  </dl>
                </div>
              ))}
              {result.eraSplits.length === 0 ? <p className="text-sm text-muted-foreground">No contribution months in this range.</p> : null}
            </div>
          </SectionCard>
        </div>

        <div className="min-w-0 space-y-4">
          <SectionCard title="Balance by bucket" description="Actual rupees on 31 March" expandable>
            <WealthChart data={chartData} xKey="year" series={SERIES} kind="area" stacked xTickFormatter={(v) => rows[Number(v) - 1]?.fy.replace("FY", "") ?? `Y${v}`} tooltipLabel={(v) => rows[Number(v) - 1]?.fy ?? `Year ${v}`} />
          </SectionCard>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Callout icon={CalendarRange} title={hasContributions ? `${firstMonthLabel} → ${result.lastContributionMonth}` : "No contribution months"} tone="positive">
              {hasContributions ? (
                <>
                  {result.contributionMonths} monthly contributions ({durationLabel(result.contributionMonths)}). You turn {EPF_INTEREST_END_AGE} on {retirementLabel}, so contributions stop with the {result.lastContributionMonth} wages.
                </>
              ) : (
                <>The first contribution month is on or after the date you turn {EPF_INTEREST_END_AGE}.</>
              )}
            </Callout>
            <Callout icon={Hourglass} title={`After ${EPF_INTEREST_END_AGE}`}>
              If you stop working at {EPF_INTEREST_END_AGE}, your EPF account becomes inoperative and stops earning interest, so this projection ends at the last contribution and the corpus is withdrawable then. If you keep working, EPF contributions continue (EPS stops, so the employer&apos;s full 12% goes to EPF) and the account stays operative.{" "}
              {pension.eligible ? (
                <>
                  The EPS pension starts at {EPF_INTEREST_END_AGE}: about <span className="num text-foreground">{formatINR(pension.monthlyPension)}</span>/month. This follows the EPS-95 formula, with the wage capped at {formatINR(EPF_WAGE_CEILING)}, service capped at 35 years and a 2-year bonus after 20.
                </>
              ) : (
                <>No monthly pension: it needs at least {EPS_MIN_SERVICE_YEARS} years of EPS service.</>
              )}
            </Callout>
          </div>

          {breachRow ? (
            <Callout icon={AlertTriangle} title={`₹2.5L employee-contribution limit crossed in ${breachRow.fy}`} tone="negative">
              In {breachRow.fy}, employee contributions reach{" "}
              <span className="num text-foreground">{formatINR(breachRow.employeeContribution)}</span>. The excess goes to a separate taxable account. Its interest is taxed every year at your {Math.round(slab * 100)}% slab (Sec 10(12) proviso and Rule 9D).
            </Callout>
          ) : (
            <Callout icon={Receipt} title="Entire corpus is tax-free" tone="positive">
              Employee contributions stay within {formatCompactINR(EPF_TAX_FREE_EMPLOYEE_LIMIT)} a year, so all interest is exempt after 5 years of continuous service.
              {cappedBasic ? ` At the capped wage your employee share is only ${formatINR(rows[rows.length - 1]?.months[0]?.employee ?? 0)} a month.` : ""}
            </Callout>
          )}

          <YearTable
            rows={rows}
            columns={columns}
            fileName={`epf-${start}-to-age-${EPF_INTEREST_END_AGE}`}
            rowKey={(r) => r.year}
            highlight={(r) => r.months.some((m) => m.label === "Sep 2026")}
            detailTitle={(r) => `${r.fy} · month by month`}
            detailDescription={(r) =>
              `${r.monthsInYear} month${r.monthsInYear === 1 ? "" : "s"} at ${formatPct(r.rate)}${r.rateDeclared ? " (declared by EPFO)" : " (projected)"} · contributions credited at month-end, interest accrued monthly and credited on 31 March. Actual rupees.`
            }
            renderDetail={(r) => <MonthTable rows={r.months} columns={monthColumns} rowKey={(m) => m.label} note={(m) => m.note} />}
          />
        </div>
      </div>
    </div>
  );
}
