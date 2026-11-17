"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, ArrowDownUp, BriefcaseBusiness, GitCompareArrows, Landmark, Lock, ScrollText, Trophy, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useUrlState } from "@/lib/url-state";
import { annualisedMonthlyIrr, formatCompactINR, formatINR, formatPct, fyLabel } from "@/lib/formatters";
import { preTaxEquivalent } from "@/lib/tax";
import { PPF_LOCK_IN_YEARS, PPF_MAX_ANNUAL_DEPOSIT, simulatePpf } from "@/lib/engines/ppfEngine";
import { simulateVoluntaryPf } from "@/lib/engines/epfEngine";
import { simulateSweep, SWEEP_DEFAULT_FD_RATE, SWEEP_DEFAULT_SAVINGS_RATE } from "@/lib/engines/sweepEngine";
import { simulateIdfc } from "@/lib/engines/idfcEngine";
import { simulateRecurringTaxable } from "@/lib/engines/bondEngine";
import { useGlobalSettings } from "@/components/providers/GlobalSettingsProvider";
import { KpiCard, Money, PageHeader, SectionCard } from "@/components/common/display";
import { SliderField } from "@/components/common/fields";
import { WealthChart, type ChartSeries } from "@/components/charts/WealthChart";
import { YearTable, type YearColumn } from "@/components/ledger/YearTable";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

const DEFAULTS = {
  sip: 12500,
  yrs: 15,
  ppf: 0.071,
  epf: 0.0825,
  ytm: 0.105,
  fd: 0.07,
};

type AssetKey = "ppf" | "vpf" | "sweep" | "idfc" | "bonds" | "fd";

interface AssetResult {
  key: AssetKey;
  name: string;
  tax: "EEE" | "Partly taxable" | "Taxable";
  liquidity: string;
  color: string;
  monthly: number;
  values: number[];
  invested: number;
  final: number;
  xirr: number;
  note?: string;
}

interface YearValues {
  year: number;
  values: Record<AssetKey, number>;
}

const CALCULATOR_LINKS: { href: string; title: string; body: string; icon: LucideIcon }[] = [
  { href: "/ppf", title: "PPF", body: "5th-of-month interest, Form H extensions, 60% block withdrawals", icon: Landmark },
  { href: "/epf", title: "EPF + VPF", body: "₹25k wage ceiling, EPS cap, ₹2.5L taxable-interest split", icon: BriefcaseBusiness },
  { href: "/auto-sweep", title: "Auto-Sweep", body: "₹5k sweep units, LIFO reverse sweep, 1% break penalty, TDS", icon: ArrowDownUp },
  { href: "/idfc-vs-sweep", title: "IDFC vs Sweep", body: "Progressive daily-balance slabs, 80TTA, exact crossover", icon: GitCompareArrows },
  { href: "/bonds", title: "Corporate Bonds", body: "Monthly/quarterly coupons with post-tax FD reinvestment", icon: ScrollText },
];

function monthlyIrr(monthly: number, months: number, final: number): number {
  const flows = new Array<number>(months + 1).fill(-monthly);
  flows[months] = final;
  return annualisedMonthlyIrr(flows);
}

export function PortfolioOverview() {
  const { slab, regime, adjust, adjustRate, isReal, navQuery } = useGlobalSettings();
  const [s, set, reset] = useUrlState(DEFAULTS, {
    bounds: { sip: [1000, 100000], yrs: [1, 35], ppf: [0.06, 0.09], epf: [0.07, 0.095], ytm: [0.09, 0.12], fd: [0.05, 0.09] },
  });

  const assets = useMemo<AssetResult[]>(() => {
    const months = s.yrs * 12;
    const ppfMonthly = Math.min(s.sip, PPF_MAX_ANNUAL_DEPOSIT / 12);
    const ppfBlocks = Math.max(0, Math.ceil((s.yrs - PPF_LOCK_IN_YEARS) / 5));
    const ppf = simulatePpf({
      rate: s.ppf,
      annualDeposit: ppfMonthly * 12,
      depositMode: "sipBefore5",
      extensionMode: ppfBlocks > 0 ? "extendWithContrib" : "stop",
      extensionBlocks: ppfBlocks,
      annualWithdrawalPct: 0,
    });
    const ppfValues = ppf.rows.slice(0, s.yrs).map((r) => r.closing);

    const vpfValues = simulateVoluntaryPf(s.sip, s.yrs, s.epf, slab).map((r) => r.value);

    const sweep = simulateSweep({
      initialBalance: 0,
      monthlySurplus: s.sip,
      threshold: 15000,
      savingsRate: SWEEP_DEFAULT_SAVINGS_RATE,
      fdRate: SWEEP_DEFAULT_FD_RATE,
      annualWithdrawal: 0,
      withdrawalMonth: 1,
      years: s.yrs,
      taxSlab: slab,
      regime,
      tdsEnabled: false,
    });
    const idfc = simulateIdfc({ initialBalance: 0, monthlySurplus: s.sip, annualWithdrawal: 0, withdrawalMonth: 1, years: s.yrs, taxSlab: slab, regime });
    const bonds = simulateRecurringTaxable(s.sip, s.yrs, s.ytm, slab, 1);
    const fd = simulateRecurringTaxable(s.sip, s.yrs, s.fd, slab, 3);

    const build = (base: Omit<AssetResult, "invested" | "final" | "xirr">): AssetResult => {
      const final = base.values[base.values.length - 1] ?? 0;
      return { ...base, invested: base.monthly * months, final, xirr: monthlyIrr(base.monthly, months, final) };
    };

    return [
      build({
        key: "ppf",
        name: "PPF",
        tax: "EEE",
        liquidity: "15-yr lock-in",
        color: "var(--chart-1)",
        monthly: ppfMonthly,
        values: ppfValues,
        note:
          s.sip > ppfMonthly
            ? `Capped at ${formatCompactINR(PPF_MAX_ANNUAL_DEPOSIT)}/yr`
            : s.yrs < PPF_LOCK_IN_YEARS
              ? `Locked until year ${PPF_LOCK_IN_YEARS}`
              : undefined,
      }),
      build({ key: "vpf", name: "VPF @ EPF rate", tax: "Partly taxable", liquidity: "Retirement / 5-yr rule", color: "var(--chart-2)", monthly: s.sip, values: vpfValues, note: s.sip * 12 > 250000 ? "Interest on contributions above ₹2.5L/yr is taxed" : undefined }),
      build({ key: "sweep", name: "ICICI Auto-Sweep", tax: "Taxable", liquidity: "Same day", color: "var(--chart-3)", monthly: s.sip, values: sweep.rows.map((r) => r.total) }),
      build({ key: "idfc", name: "IDFC Progressive", tax: "Taxable", liquidity: "Same day", color: "var(--chart-4)", monthly: s.sip, values: idfc.rows.map((r) => r.closing) }),
      build({ key: "bonds", name: "Corporate bonds", tax: "Taxable", liquidity: "Listed · thin market", color: "var(--chart-5)", monthly: s.sip, values: bonds.map((r) => r.value), note: "Credit risk not modelled" }),
      build({ key: "fd", name: "Bank FD", tax: "Taxable", liquidity: "Break penalty", color: "var(--chart-6)", monthly: s.sip, values: fd.map((r) => r.value) }),
    ];
  }, [s.sip, s.yrs, s.ppf, s.epf, s.ytm, s.fd, slab, regime]);

  const series = useMemo<ChartSeries[]>(() => assets.map((a) => ({ key: a.key, label: a.name, color: a.color })), [assets]);

  const yearRows = useMemo<YearValues[]>(
    () =>
      Array.from({ length: s.yrs }, (_, i) => ({
        year: i + 1,
        values: Object.fromEntries(assets.map((a) => [a.key, a.values[i] ?? 0])) as Record<AssetKey, number>,
      })),
    [assets, s.yrs],
  );

  const chartData = useMemo(
    () => yearRows.map((row) => ({ year: row.year, ...Object.fromEntries(assets.map((a) => [a.key, adjust(row.values[a.key], row.year)])) })),
    [yearRows, assets, adjust],
  );

  const columns = useMemo<YearColumn<YearValues>[]>(
    () => [
      { key: "year", label: "Year", value: (r) => r.year, format: "int" },
      { key: "fy", label: "FY", value: (r) => fyLabel(r.year), format: "text" },
      ...assets.map<YearColumn<YearValues>>((a) => ({ key: a.key, label: a.name, value: (r) => adjust(r.values[a.key], r.year), format: "inr" })),
    ],
    [assets, adjust],
  );

  const ranked = [...assets].sort((a, b) => b.xirr - a.xirr);
  const best = ranked[0];
  const totalInvested = s.sip * 12 * s.yrs;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio Overview"
        description="Every simulator, fed the same monthly SIP over the same horizon, ranked by post-tax XIRR. Change the tax slab, regime or nominal/real view in the top bar and the whole table re-ranks."
        badges={[`${formatINR(s.sip)}/mo`, `${s.yrs} years`, regime === "old" ? "Old Regime" : "New Regime"]}
        onReset={reset}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Top post-tax XIRR" value={formatPct(adjustRate(best.xirr))} tone="positive" hint={best.name} icon={Trophy} />
        <KpiCard label={isReal ? "Best corpus (today's ₹)" : "Best corpus"} value={<Money value={adjust(Math.max(...assets.map((a) => a.final)), s.yrs)} />} hint={assets.reduce((a, b) => (b.final > a.final ? b : a)).name} icon={Wallet} />
        <KpiCard label="Total invested" value={<Money value={totalInvested} />} hint={`${formatINR(s.sip)} × ${s.yrs * 12} months`} icon={ArrowDownUp} />
        <KpiCard
          label="PPF pre-tax equivalent"
          value={formatPct(preTaxEquivalent(s.ppf, slab))}
          hint={`A taxable product must yield this to match ${formatPct(s.ppf)} tax-free at ${Math.round(slab * 100)}%`}
          icon={Lock}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        <SectionCard title="Common inputs" description="Shared by every asset below.">
          <div className="space-y-6">
            <SliderField id="ov-sip" label="Monthly investment" value={s.sip} min={1000} max={100000} step={500} format={formatINR} onChange={(v) => set("sip", v)} />
            <SliderField id="ov-yrs" label="Horizon" value={s.yrs} min={1} max={35} step={1} format={(v) => `${v} yrs`} onChange={(v) => set("yrs", v)} />
            <SliderField id="ov-ppf" label="PPF rate" value={s.ppf} min={0.06} max={0.09} step={0.0005} format={(v) => formatPct(v)} onChange={(v) => set("ppf", v)} />
            <SliderField id="ov-epf" label="EPF / VPF rate" value={s.epf} min={0.07} max={0.095} step={0.0005} format={(v) => formatPct(v)} onChange={(v) => set("epf", v)} />
            <SliderField id="ov-ytm" label="Corporate bond YTM" value={s.ytm} min={0.09} max={0.12} step={0.0005} format={(v) => formatPct(v)} onChange={(v) => set("ytm", v)} />
            <SliderField id="ov-fd" label="Bank FD rate" value={s.fd} min={0.05} max={0.09} step={0.0005} format={(v) => formatPct(v)} onChange={(v) => set("fd", v)} />
          </div>
        </SectionCard>

        <div className="min-w-0 space-y-4">
          <SectionCard title="Post-tax corpus by asset" description={isReal ? "Inflation-adjusted to today's rupees" : "Nominal rupees on 31 March"}>
            <WealthChart data={chartData} xKey="year" series={series} kind="line" height={340} xTickFormatter={(v) => `Y${v}`} tooltipLabel={(v) => `Year ${v} · ${fyLabel(Number(v))}`} />
          </SectionCard>

          <div className="overflow-hidden rounded-lg border bg-card">
            <div className="border-b px-4 py-2.5">
              <h2 className="text-sm font-semibold">Ranked by post-tax XIRR</h2>
              <p className="text-xs text-muted-foreground">
                {isReal ? "Real" : "Nominal"} returns after tax at {Math.round(slab * 100)}% · {regime === "old" ? "Old" : "New"} Regime
              </p>
            </div>
            <div className="overflow-x-auto">
              <Table className="text-xs">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="px-3">#</TableHead>
                    <TableHead className="px-3">Asset</TableHead>
                    <TableHead className="px-3">Tax</TableHead>
                    <TableHead className="px-3">Liquidity</TableHead>
                    <TableHead className="px-3 text-right">Invested</TableHead>
                    <TableHead className="px-3 text-right">Corpus</TableHead>
                    <TableHead className="px-3 text-right">Gain (nominal)</TableHead>
                    <TableHead className="px-3 text-right">XIRR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranked.map((asset, index) => {
                    const corpus = adjust(asset.final, s.yrs);
                    return (
                      <TableRow key={asset.key}>
                        <TableCell className="num px-3 text-muted-foreground">{index + 1}</TableCell>
                        <TableCell className="px-3">
                          <div className="flex items-center gap-2">
                            <span className="size-2.5 shrink-0 rounded-[2px]" style={{ background: asset.color }} aria-hidden />
                            <div>
                              <div className="font-medium">{asset.name}</div>
                              {asset.note ? <div className="text-[11px] text-muted-foreground">{asset.note}</div> : null}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="px-3">
                          <Badge variant={asset.tax === "EEE" ? "secondary" : "outline"} className="rounded-md font-normal">
                            {asset.tax}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-3 text-muted-foreground">{asset.liquidity}</TableCell>
                        <TableCell className="px-3 text-right">
                          <Money value={asset.invested} />
                        </TableCell>
                        <TableCell className="px-3 text-right font-semibold">
                          <Money value={corpus} />
                        </TableCell>
                        <TableCell className="px-3 text-right text-positive">
                          <Money value={asset.final - asset.invested} />
                        </TableCell>
                        <TableCell className="num px-3 text-right font-semibold">{formatPct(adjustRate(asset.xirr))}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <YearTable title="Year-wise corpus by asset" rows={yearRows} columns={columns} fileName={`portfolio-overview-${s.yrs}y`} rowKey={(r) => r.year} maxHeight={360} />
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">Deep-dive calculators</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {CALCULATOR_LINKS.map(({ href, title, body, icon: Icon }) => (
            <Link key={href} href={`${href}${navQuery}`} className="group">
              <Card className="h-full gap-0 rounded-lg py-0 shadow-none transition-colors group-hover:border-foreground/25">
                <CardContent className="flex h-full flex-col gap-2 p-4">
                  <div className="flex items-center justify-between">
                    <Icon className="size-4 text-muted-foreground" />
                    <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                  <div className="text-sm font-medium">{title}</div>
                  <p className="text-xs text-muted-foreground">{body}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
