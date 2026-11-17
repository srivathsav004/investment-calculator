"use client";

import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
}

export function SliderField({ id, label, value, min, max, step, format, onChange, info, minLabel, maxLabel, disabled }: SliderFieldProps) {
  return (
    <div className={cn("space-y-2.5", disabled && "opacity-50")}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={id} className="text-xs font-medium text-muted-foreground">
            {label}
          </Label>
          {info ? <InfoTip>{info}</InfoTip> : null}
        </div>
        <span className="num rounded-md border bg-muted/40 px-2 py-0.5 text-sm font-medium">{format(value)}</span>
      </div>
      <Slider
        id={id}
        value={[value]}
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
