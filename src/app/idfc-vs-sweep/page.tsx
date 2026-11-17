import type { Metadata } from "next";
import { IdfcVsSweepCalculator } from "@/components/calculators/IdfcVsSweepCalculator";

export const metadata: Metadata = {
  title: "IDFC vs Auto-Sweep",
  description: "IDFC FIRST progressive savings slabs vs ICICI auto-sweep FDs, with the exact post-tax crossover balance.",
};

export default function IdfcVsSweepPage() {
  return <IdfcVsSweepCalculator />;
}
