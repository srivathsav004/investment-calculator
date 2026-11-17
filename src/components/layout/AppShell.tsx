"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useTheme } from "next-themes";
import {
  ArrowDownUp,
  BriefcaseBusiness,
  GitCompareArrows,
  IndianRupee,
  Landmark,
  LayoutDashboard,
  Moon,
  ScrollText,
  Sun,
  type LucideIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useGlobalSettings } from "@/components/providers/GlobalSettingsProvider";
import { TAX_SLABS, type TaxRegime, type ValueMode } from "@/lib/tax";

interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const OVERVIEW: NavItem = { href: "/", label: "Portfolio Overview", description: "Cross-asset comparator", icon: LayoutDashboard };

const CALCULATORS: NavItem[] = [
  { href: "/ppf", label: "PPF", description: "Public Provident Fund", icon: Landmark },
  { href: "/epf", label: "EPF + VPF", description: "Provident Fund & EPS", icon: BriefcaseBusiness },
  { href: "/auto-sweep", label: "Auto-Sweep", description: "ICICI Money Multiplier", icon: ArrowDownUp },
  { href: "/idfc-vs-sweep", label: "IDFC vs Sweep", description: "Progressive savings crossover", icon: GitCompareArrows },
  { href: "/bonds", label: "Corporate Bonds", description: "Coupons & reinvestment", icon: ScrollText },
];

const INFLATION_OPTIONS = [0.04, 0.05, 0.06, 0.07, 0.08];

function NavLink({ item, active, query }: { item: NavItem; active: boolean; query: string }) {
  const Icon = item.icon;
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={active} tooltip={item.label} className="h-auto py-2">
        <Link href={`${item.href}${query}`}>
          <Icon />
          <span className="flex flex-col leading-tight">
            <span className="font-medium">{item.label}</span>
            <span className="text-[11px] text-muted-foreground group-data-[collapsible=icon]:hidden">{item.description}</span>
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-8 shrink-0"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          aria-label="Toggle colour theme"
        >
          <Sun className="hidden size-4 dark:block" />
          <Moon className="size-4 dark:hidden" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Toggle light / dark</TooltipContent>
    </Tooltip>
  );
}

function GlobalTaxBar() {
  const { slab, regime, view, inflation, setSlab, setRegime, setView, setInflation } = useGlobalSettings();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5">
        <span className="hidden text-xs text-muted-foreground xl:inline">Slab</span>
        <Select value={String(slab)} onValueChange={(value) => setSlab(Number(value))}>
          <SelectTrigger size="sm" className="num h-8 w-[118px]" aria-label="Income tax slab">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TAX_SLABS.map((rate) => (
              <SelectItem key={rate} value={String(rate)} className="num">
                {Math.round(rate * 100)}% slab
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={regime} onValueChange={(value) => setRegime(value as TaxRegime)}>
        <TabsList className="h-8">
          <TabsTrigger value="new" className="px-2.5 text-xs">
            New regime
          </TabsTrigger>
          <TabsTrigger value="old" className="px-2.5 text-xs">
            Old regime
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Tabs value={view} onValueChange={(value) => setView(value as ValueMode)}>
        <TabsList className="h-8">
          <TabsTrigger value="nominal" className="px-2.5 text-xs">
            Nominal ₹
          </TabsTrigger>
          <TabsTrigger value="real" className="px-2.5 text-xs">
            Real ₹
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Select value={String(inflation)} onValueChange={(value) => setInflation(Number(value))}>
        <SelectTrigger size="sm" className="num h-8 w-[150px]" aria-label="Inflation assumption">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {INFLATION_OPTIONS.map((rate) => (
            <SelectItem key={rate} value={String(rate)} className="num">
              CPI {(rate * 100).toFixed(0)}% p.a.
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { navQuery } = useGlobalSettings();
  const current = [OVERVIEW, ...CALCULATORS].find((item) => item.href === pathname) ?? OVERVIEW;

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <Link href={`/${navQuery}`}>
                  <div className="flex aspect-square size-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                    <IndianRupee className="size-4" />
                  </div>
                  <div className="grid flex-1 text-left leading-tight">
                    <span className="truncate text-sm font-semibold">Wealth Simulator</span>
                    <span className="truncate text-[11px] text-muted-foreground">India · FY 2026–27</span>
                  </div>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Overview</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <NavLink item={OVERVIEW} active={pathname === "/"} query={navQuery} />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Calculators</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {CALCULATORS.map((item) => (
                  <NavLink key={item.href} item={item} active={pathname === item.href} query={navQuery} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t">
          <p className="px-2 py-1 text-[11px] leading-snug text-muted-foreground group-data-[collapsible=icon]:hidden">
            Illustrative projections. Rates and tax rules change — verify before investing.
          </p>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-w-0">
        <header className="sticky top-0 z-20 flex flex-col gap-2 border-b bg-background/85 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/70 lg:h-14 lg:flex-row lg:items-center lg:py-0">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
            <span className="truncate text-sm font-medium">{current.label}</span>
            <div className="ml-auto lg:hidden">
              <ThemeToggle />
            </div>
          </div>
          <div className="flex items-center gap-2 lg:ml-auto">
            <GlobalTaxBar />
            <div className="hidden lg:block">
              <ThemeToggle />
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6 sm:px-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
