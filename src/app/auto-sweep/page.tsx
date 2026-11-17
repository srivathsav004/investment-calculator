import type { Metadata } from "next";
import { SweepCalculator } from "@/components/calculators/SweepCalculator";

export const metadata: Metadata = {
  title: "Auto-Sweep Simulator",
  description: "ICICI Money Multiplier auto-sweep FD simulator with LIFO reverse sweeps, break penalties and TDS.",
};

export default function AutoSweepPage() {
  return <SweepCalculator />;
}
