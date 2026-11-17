import type { Metadata } from "next";
import { EpfCalculator } from "@/components/calculators/EpfCalculator";

export const metadata: Metadata = {
  title: "EPF + VPF Simulator",
  description: "EPF and VPF projection with the ₹25,000 wage ceiling, EPS cap and the ₹2.5 lakh taxable-interest split.",
};

export default function EpfPage() {
  return <EpfCalculator />;
}
