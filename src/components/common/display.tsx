"use client";

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCompactINR, formatINR, formatINRExact } from "@/lib/formatters";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useGlobalSettings } from "@/components/providers/GlobalSettingsProvider";

interface MoneyProps {
  value: number;
  /** Lakh/Crore shorthand (default) or full rupees. */
  compact?: boolean;
  className?: string;
}

/** Rupee amount in tabular mono, with the exact paise-level figure on hover. */
export function Money({ value, compact = true, className }: MoneyProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className={cn("num cursor-default whitespace-nowrap outline-none", className)}>
          {compact ? formatCompactINR(value) : formatINR(value)}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="num">
        {formatINRExact(value)}
      </TooltipContent>
    </Tooltip>
  );
}

type Tone = "default" | "positive" | "negative" | "muted";

const toneClass: Record<Tone, string> = {
  default: "text-foreground",
  positive: "text-positive",
  negative: "text-negative",
  muted: "text-muted-foreground",
};

interface KpiCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: Tone;
  className?: string;
}

export function KpiCard({ label, value, hint, icon: Icon, tone = "default", className }: KpiCardProps) {
  return (
    <Card className={cn("gap-0 rounded-lg py-0 shadow-none", className)}>
      <CardContent className="flex flex-col gap-1.5 p-4">
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-muted-foreground">
          <span className="truncate">{label}</span>
          {Icon ? <Icon className="size-3.5 shrink-0" aria-hidden /> : null}
        </div>
        <div className={cn("num text-xl font-semibold tracking-tight sm:text-2xl", toneClass[tone])}>{value}</div>
        {hint ? <div className="text-xs leading-snug text-muted-foreground">{hint}</div> : null}
      </CardContent>
    </Card>
  );
}

interface PageHeaderProps {
  title: string;
  description: string;
  badges?: string[];
  onReset?: () => void;
}

export function PageHeader({ title, description, badges = [], onReset }: PageHeaderProps) {
  const { isReal, inflation } = useGlobalSettings();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{title}</h1>
          {badges.map((badge) => (
            <Badge key={badge} variant="outline" className="rounded-md font-normal">
              {badge}
            </Badge>
          ))}
          {isReal ? (
            <Badge variant="secondary" className="num rounded-md font-normal">
              Real ₹ @ {(inflation * 100).toFixed(1)}% CPI
            </Badge>
          ) : null}
        </div>
        <p className="max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>
      {onReset ? (
        <Button variant="outline" size="sm" onClick={onReset} className="self-start sm:self-auto">
          <RotateCcw className="size-3.5" />
          Reset
        </Button>
      ) : null}
    </div>
  );
}

export function Callout({ icon: Icon, title, children, tone = "default" }: { icon: LucideIcon; title: string; children: ReactNode; tone?: Tone }) {
  return (
    <div className="flex gap-3 rounded-lg border bg-card p-4">
      <Icon className={cn("mt-0.5 size-4 shrink-0", toneClass[tone])} aria-hidden />
      <div className="space-y-1">
        <div className="text-sm font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

export function SectionCard({ title, description, action, children, className }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <Card className={cn("gap-0 rounded-lg py-0 shadow-none", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}

export function CalculatorSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_1fr]">
        <Skeleton className="h-96 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    </div>
  );
}
