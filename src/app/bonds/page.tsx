import type { Metadata } from "next";
import { BondCalculator } from "@/components/calculators/BondCalculator";

export const metadata: Metadata = {
  title: "Corporate Bonds",
  description: "Corporate bond coupon simulator with post-tax reinvestment into a liquid FD and a bank FD benchmark.",
};

export default function BondsPage() {
  return <BondCalculator />;
}
