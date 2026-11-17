"use client";

import { useMemo } from "react";
import { Landmark, ReceiptText, ShieldCheck } from "lucide-react";
import { formatINR } from "@/lib/formatters";
import { TAX_SLABS } from "@/lib/tax";
import { SWEEP_THRESHOLDS, SWEEP_TDS_THRESHOLD, simulateSweep, type SweepInput, type SweepResult } from "@/lib/engines/sweepEngine";
import { Callout, SectionCard } from "@/components/common/display";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface Idea {
  key: string;
  title: string;
  detail: string;
  /** Interest earned after tax and penalties — the part of the final balance that is not your own money. */
  earned: number;
  tax: number;
  penalty: number;
}

const earnedOf = (r: SweepResult) => r.totalNetInterest - r.totalTax;

const signed = (value: number) => (Math.abs(value) < 1 ? "—" : `${value > 0 ? "+" : "−"}${formatINR(Math.abs(value))}`);

/** Re-runs the sweep with one lever changed at a time and reports what it does to the final balance and tax. */
export function SweepTaxIdeas({ input, base }: { input: SweepInput; base: SweepResult }) {
  const ideas = useMemo<Idea[]>(() => {
    const run = (key: string, title: string, detail: string, patch: Partial<SweepInput>): Idea => {
      const r = simulateSweep({ ...input, ...patch });
      return { key, title, detail, earned: earnedOf(r), tax: r.totalTax, penalty: r.totalPenalty };
    };
    const list: Idea[] = [];

    if (input.regime === "new") {
      list.push(run("old", "Old Regime instead of New", "Only the ₹10,000 savings-interest deduction (80TTA) changes in this model. The Old Regime slabs and lost deductions are not modelled, so check your full return before switching.", { regime: "old" }));
    }

    for (const slab of TAX_SLABS.filter((x) => x < input.taxSlab)) {
      list.push(
        run(
          `slab-${slab}`,
          `Hold the money in a family member's name taxed at ${Math.round(slab * 100)}%`,
          "A gift to a parent is not clubbed with your income, so the interest is taxed in their hands (clubbing applies to a spouse or minor child only). Treat it as their money; it must be a genuine gift.",
          { taxSlab: slab },
        ),
      );
    }

    if (input.annualWithdrawal > 0) {
      const other = SWEEP_THRESHOLDS.find((t) => t !== input.threshold);
      if (other !== undefined && other > input.threshold) {
        list.push(run("buffer", `Keep the larger ${formatINR(other)} savings buffer`, "A bigger cash buffer means fewer FDs broken for withdrawals, so fewer 1% penalties, at the cost of more money earning the savings rate.", { threshold: other }));
      }
      if ((input.withdrawalsPerYear ?? 1) === 1) {
        list.push(run("spread", "Take the same withdrawals as 12 monthly amounts", "Smaller pulls are more likely to be covered by the savings balance alone, which avoids breaking an FD.", { withdrawalsPerYear: 12 }));
      }
      list.push(run("none", "Not withdrawing at all", "The upper bound: what this plan would be if the money never left.", { annualWithdrawal: 0 }));
    }

    return list;
  }, [input]);

  return (
    <SectionCard
      title="Ways to cut the tax"
      description={`Each row changes one thing against your current plan and shows the difference. "Earned after tax" is interest minus tax and penalties, so top-ups toward your target don't blur the comparison (earned after tax ${formatINR(earnedOf(base))}, tax paid ${formatINR(base.totalTax)}, penalties ${formatINR(base.totalPenalty)}).`}
      expandable
    >
      {ideas.length > 0 ? (
        <div className="overflow-x-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="px-3">Change</TableHead>
                <TableHead className="px-3 text-right">Earned after tax</TableHead>
                <TableHead className="px-3 text-right">Tax paid</TableHead>
                <TableHead className="px-3 text-right">Penalties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ideas.map((idea) => (
                <TableRow key={idea.key}>
                  <TableCell className="max-w-md px-3 whitespace-normal">
                    <div className="font-medium">{idea.title}</div>
                    <div className="text-[11px] text-muted-foreground">{idea.detail}</div>
                  </TableCell>
                  <TableCell className={`num px-3 text-right font-semibold ${idea.earned - earnedOf(base) > 0 ? "text-positive" : ""}`}>{signed(idea.earned - earnedOf(base))}</TableCell>
                  <TableCell className="num px-3 text-right text-muted-foreground">{signed(idea.tax - base.totalTax)}</TableCell>
                  <TableCell className="num px-3 text-right text-muted-foreground">{signed(idea.penalty - base.totalPenalty)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">You are already on the lowest slab with no withdrawals, so there is nothing to compare here.</p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
        <Callout icon={ReceiptText} title="TDS is not extra tax">
          Banks deduct 10% only when FD interest at one bank passes {formatINR(SWEEP_TDS_THRESHOLD)} a year (under 60). It is an advance against your slab tax, which you claim in your return. Form 15G only works if your total income is below the taxable limit, so it does not help at a 30% slab.
        </Callout>
        <Callout icon={Landmark} title="Money beyond the target">
          Not modelled here. Equity-oriented funds, including arbitrage funds, are taxed only when you sell: 12.5% on gains held over 12 months, after a ₹1.25 lakh yearly exemption, against slab tax on FD interest every year. Deferral keeps more of it compounding, but returns are not guaranteed and FD-like safety is lost. Arbitrage funds are the lowest-risk version.
        </Callout>
        <Callout icon={ShieldCheck} title="Tax-free homes">
          PPF interest is fully tax-free and EPF interest is tax-free within the ₹2.5L yearly employee limit. Money you will not touch for 15 years suits those better than a taxed sweep. Keep only your emergency fund in the sweep.
        </Callout>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        Rules checked Nov 2026 against{" "}
        <a className="underline" href="https://www.bankbazaar.com/tax/tds-rates-chart.html" target="_blank" rel="noreferrer">BankBazaar TDS chart</a>,{" "}
        <a className="underline" href="https://www.finnovate.in/learn/blog/mutual-fund-taxation-india-fy-2025-26" target="_blank" rel="noreferrer">Finnovate MF tax guide</a> and the{" "}
        <a className="underline" href="https://www.incometaxindia.gov.in/documents/d/guest/faqs-on-clubbing-of-income" target="_blank" rel="noreferrer">Income Tax Dept clubbing FAQ</a>. The Income-tax Act 2025 (from 1 April 2026) renumbers sections; I could not confirm the savings-interest deduction and equity-fund rates are unchanged in its text, so verify before acting.
      </p>
    </SectionCard>
  );
}
