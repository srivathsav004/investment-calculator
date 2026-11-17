"use client";

import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function InfoTip({ children }: { children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="inline-flex text-muted-foreground hover:text-foreground" aria-label="More info">
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-pretty">{children}</TooltipContent>
    </Tooltip>
  );
}

interface SliderFieldProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
  info?: ReactNode;
  minLabel?: string;
  maxLabel?: string;
  disabled?: boolean;
  /** The value is a fraction shown as a percentage: typing "7.1" means 0.071. Detected from the formatted value when omitted. */
  percent?: boolean;
  /** Largest value that can be typed in (the slider itself stops at `max`). Defaults to `max`. */
  typedMax?: number;
}

const AMOUNT_SUFFIX: Record<string, number> = { k: 1e3, l: 1e5, lac: 1e5, lakh: 1e5, lakhs: 1e5, cr: 1e7, crore: 1e7, crores: 1e7 };

/** Parses "300000", "3,00,000", "₹3L", "2.5 lakh", "1cr" or "7.1%". Returns NaN when it isn't a number. */
export function parseTypedNumber(text: string, percent: boolean): number {
  const cleaned = text.replace(/[₹,%\s]/g, "").toLowerCase();
  const match = /^(\d*\.?\d+)([a-z]*)$/.exec(cleaned);
  if (!match) return Number.NaN;
  const base = Number(match[1]);
  if (!match[2]) return base;
  if (percent || !(match[2] in AMOUNT_SUFFIX)) return Number.NaN;
  return base * AMOUNT_SUFFIX[match[2]];
}

export function SliderField({ id, label, value, min, max, step, format, onChange, info, minLabel, maxLabel, disabled, percent: percentProp, typedMax }: SliderFieldProps) {
  const percent = percentProp ?? format(value).includes("%");
  const [draft, setDraft] = useState<string | null>(null);
  const scale = percent ? 100 : 1;
  const upper = Math.max(max, typedMax ?? max);

  const commit = () => {
    if (draft === null) return;
    const parsed = parseTypedNumber(draft, percent);
    setDraft(null);
    if (!Number.isFinite(parsed)) return;
    onChange(Math.min(Math.max(parsed / scale, min), upper));
  };

  return (
    <div className={cn("space-y-2.5", disabled && "opacity-50")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
            {label}
          </Label>
          {info ? <InfoTip>{info}</InfoTip> : null}
        </div>
        <Input
          id={`${id}-input`}
          type="text"
          inputMode="decimal"
          disabled={disabled}
          value={draft ?? format(value)}
          aria-label={`${label} (type a value)`}
          onFocus={(event) => {
            setDraft(String(Number((value * scale).toFixed(percent ? 3 : 2))));
            event.target.select();
          }}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              setDraft(null);
              event.currentTarget.blur();
            }
          }}
          className="num h-8 w-36 px-2 text-right text-sm font-medium"
        />
      </div>
      <Slider
        id={id}
        value={[Math.min(Math.max(value, min), max)]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={(values) => onChange(values[0] ?? value)}
        aria-label={label}
      />
      <div className="num flex justify-between text-[10px] text-muted-foreground">
        <span>{minLabel ?? format(min)}</span>
        <span>{maxLabel ?? format(max)}</span>
      </div>
    </div>
  );
}

interface Option<T extends string> {
  value: T;
  label: string;
}

interface SegmentedProps<T extends string> {
  label?: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  info?: ReactNode;
  className?: string;
  size?: "sm" | "default";
}

/** Segmented control built on shadcn Tabs. */
export function Segmented<T extends string>({ label, value, options, onChange, info, className, size = "default" }: SegmentedProps<T>) {
  return (
    <div className={cn("space-y-2", className)}>
      {label ? (
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          {info ? <InfoTip>{info}</InfoTip> : null}
        </div>
      ) : null}
      <Tabs value={value} onValueChange={(next) => onChange(next as T)}>
        <TabsList className={cn("w-full", size === "sm" && "h-8")}>
          {options.map((option) => (
            <TabsTrigger key={option.value} value={option.value} className={cn("flex-1 px-2", size === "sm" ? "text-xs" : "text-xs sm:text-sm")}>
              {option.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
    </div>
  );
}

interface SwitchFieldProps {
  id: string;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  info?: ReactNode;
}

export function SwitchField({ id, label, description, checked, onChange, info }: SwitchFieldProps) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-md border p-3">
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={id} className="text-sm font-medium">
            {label}
          </Label>
          {info ? <InfoTip>{info}</InfoTip> : null}
        </div>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

interface SelectFieldProps<T extends string> {
  id: string;
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  info?: ReactNode;
}

export function SelectField<T extends string>({ id, label, value, options, onChange, info }: SelectFieldProps<T>) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
        {info ? <InfoTip>{info}</InfoTip> : null}
      </div>
      <Select value={value} onValueChange={(next) => onChange(next as T)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface DateFieldProps {
  id: string;
  label: string;
  value: string;
  /** "date" for YYYY-MM-DD, "month" for YYYY-MM. */
  type: "date" | "month";
  min?: string;
  max?: string;
  onChange: (value: string) => void;
  info?: ReactNode;
}

export function DateField({ id, label, value, type, min, max, onChange, info }: DateFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
          {label}
        </Label>
        {info ? <InfoTip>{info}</InfoTip> : null}
      </div>
      <Input id={id} type={type} value={value} min={min} max={max} onChange={(event) => event.target.value && onChange(event.target.value)} className="num" />
    </div>
  );
}
