import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/providers/ThemeProvider";
import { GlobalSettingsProvider } from "@/components/providers/GlobalSettingsProvider";
import { AppShell } from "@/components/layout/AppShell";
import { CalculatorSkeleton } from "@/components/common/display";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Wealth Simulator · India FY 2026–27",
    template: "%s · Wealth Simulator",
  },
  description:
    "Fixed-income & provident-fund simulator for Indian investors: PPF, EPF + VPF, auto-sweep FDs and progressive savings with FY 2026–27 tax rules.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IN" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <TooltipProvider delayDuration={150}>
            <Suspense
              fallback={
                <div className="mx-auto w-full max-w-[1400px] px-6 py-6">
                  <CalculatorSkeleton />
                </div>
              }
            >
              <GlobalSettingsProvider>
                <AppShell>{children}</AppShell>
              </GlobalSettingsProvider>
            </Suspense>
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
