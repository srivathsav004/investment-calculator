import type { Metadata } from "next";
import { PpfCalculator } from "@/components/calculators/PpfCalculator";

export const metadata: Metadata = {
  title: "PPF Simulator",
  description: "Public Provident Fund calculator with 5th-of-month interest, deposit timing and 5-year extension blocks.",
};

export default function PpfPage() {
  return <PpfCalculator />;
}
