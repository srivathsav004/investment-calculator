"use client";

import { useContext, useMemo } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceDot, ReferenceLine, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { ExpandedViewContext } from "@/components/common/display";
import { formatAxisINR, formatCompactINR, formatINRExact, formatPct } from "@/lib/formatters";

export interface ChartSeries {
  key: string;
  label: string;
  /** CSS colour, normally a categorical token such as var(--chart-1). */
  color: string;
  dashed?: boolean;
}

export interface ChartReference {
  x?: number | string;
  y?: number;
  label: string;
}

export interface ChartMarker {
  x: number | string;
  y: number;
  label: string;
}

type ValueFormat = "inr" | "pct";

interface WealthChartProps<T extends object> {
  data: T[];
  xKey: keyof T & string;
  series: ChartSeries[];
  kind?: "area" | "bar" | "line";
  stacked?: boolean;
  valueFormat?: ValueFormat;
  height?: number;
  xTickFormatter?: (value: number | string) => string;
  tooltipLabel?: (value: number | string) => string;
  references?: ChartReference[];
  markers?: ChartMarker[];
  showTotal?: boolean;
  className?: string;
  xType?: "category" | "number";
}

interface TooltipEntry {
  dataKey?: unknown;
  value?: unknown;
}

function formatValue(value: number, format: ValueFormat): string {
  return format === "pct" ? formatPct(value) : formatCompactINR(value);
}

function IndianTooltip({
  active,
  payload,
  label,
  series,
  valueFormat,
  tooltipLabel,
  showTotal,
}: {
  active?: boolean;
  payload?: readonly TooltipEntry[];
  label?: unknown;
  series: ChartSeries[];
  valueFormat: ValueFormat;
  tooltipLabel?: (value: number | string) => string;
  showTotal: boolean;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const byKey = new Map(payload.map((entry) => [String(entry.dataKey), Number(entry.value)]));
  const rows = series.filter((s) => byKey.has(s.key)).map((s) => ({ ...s, value: byKey.get(s.key) ?? 0 }));
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const title = typeof label === "number" || typeof label === "string" ? (tooltipLabel ? tooltipLabel(label) : String(label)) : "";

  return (
    <div className="min-w-[200px] rounded-md border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-md">
      {title ? <div className="mb-1.5 font-medium">{title}</div> : null}
      <div className="space-y-1">
        {rows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 shrink-0 rounded-[2px]" style={{ background: row.color }} aria-hidden />
              {row.label}
            </span>
            <span className="num font-medium text-foreground" title={valueFormat === "inr" ? formatINRExact(row.value) : undefined}>
              {formatValue(row.value, valueFormat)}
            </span>
          </div>
        ))}
        {showTotal && rows.length > 1 ? (
          <div className="mt-1 flex items-center justify-between gap-4 border-t pt-1">
            <span className="text-muted-foreground">Total</span>
            <span className="num font-semibold">{formatValue(total, valueFormat)}</span>
          </div>
        ) : null}
        {valueFormat === "inr" && rows.length > 0 ? (
          <div className="num pt-0.5 text-[10px] text-muted-foreground">
            {showTotal && rows.length > 1 ? formatINRExact(total) : formatINRExact(rows[0].value)}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ChartLegend({ series }: { series: ChartSeries[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span
            className={cn("h-2 w-3 shrink-0 rounded-[2px]", s.dashed && "h-0.5 border-t-2 border-dashed bg-transparent")}
            style={s.dashed ? { borderColor: s.color } : { background: s.color }}
            aria-hidden
          />
          {s.label}
        </span>
      ))}
    </div>
  );
}

export function WealthChart<T extends object>({
  data,
  xKey,
  series,
  kind = "area",
  stacked = false,
  valueFormat = "inr",
  height = 320,
  xTickFormatter,
  tooltipLabel,
  references = [],
  markers = [],
  showTotal,
  className,
  xType = "category",
}: WealthChartProps<T>) {
  const expandedView = useContext(ExpandedViewContext);
  const config = useMemo<ChartConfig>(
    () => Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }])),
    [series],
  );
  const yFormatter = (value: number) => (valueFormat === "pct" ? formatPct(value, 1) : formatAxisINR(value));
  const total = showTotal ?? stacked;

  const axes = (
    <>
      <CartesianGrid vertical={false} strokeDasharray="3 3" className="stroke-border" />
      <XAxis
        dataKey={xKey as string}
        type={xType}
        domain={xType === "number" ? ["dataMin", "dataMax"] : undefined}
        tickLine={false}
        axisLine={false}
        tickMargin={8}
        minTickGap={18}
        tickFormatter={xTickFormatter}
        className="num"
      />
      <YAxis
        tickLine={false}
        axisLine={false}
        width={56}
        tickMargin={4}
        tickFormatter={yFormatter}
        domain={valueFormat === "pct" ? ["auto", "auto"] : [0, "auto"]}
        className="num"
      />
      <ChartTooltip
        cursor={kind === "bar" ? { className: "fill-muted/60" } : { strokeDasharray: "3 3" }}
        content={({ active, payload, label }) => (
          <IndianTooltip
            active={active}
            payload={payload as readonly TooltipEntry[] | undefined}
            label={label}
            series={series}
            valueFormat={valueFormat}
            tooltipLabel={tooltipLabel}
            showTotal={total}
          />
        )}
      />
      {references.map((ref) => (
        <ReferenceLine
          key={`${ref.label}-${ref.x ?? ""}-${ref.y ?? ""}`}
          x={ref.x}
          y={ref.y}
          stroke="var(--muted-foreground)"
          strokeDasharray="4 4"
          label={ref.label ? { value: ref.label, position: "insideTopLeft", fill: "var(--muted-foreground)", fontSize: 11 } : undefined}
        />
      ))}
      {markers.map((marker) => (
        <ReferenceDot
          key={`${marker.label}-${marker.x}`}
          x={marker.x}
          y={marker.y}
          r={5}
          fill="var(--foreground)"
          stroke="var(--background)"
          strokeWidth={2}
          label={{ value: marker.label, position: "top", fill: "var(--foreground)", fontSize: 11, offset: 10 }}
        />
      ))}
    </>
  );

  return (
    <div className={cn("space-y-3", className)}>
      {series.length > 1 ? <ChartLegend series={series} /> : null}
      <ChartContainer config={config} className="aspect-auto w-full" style={{ height: expandedView ? "calc(100dvh - 13rem)" : height }}>
        {kind === "bar" ? (
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="18%">
            {axes}
            {series.map((s, index) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId={stacked ? "stack" : undefined}
                fill={`var(--color-${s.key})`}
                stroke="var(--card)"
                strokeWidth={stacked ? 1 : 0}
                radius={!stacked || index === series.length - 1 ? [4, 4, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        ) : kind === "line" ? (
          <LineChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
            {axes}
            {series.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                name={s.label}
                type="monotone"
                stroke={`var(--color-${s.key})`}
                strokeWidth={2}
                strokeDasharray={s.dashed ? "5 4" : undefined}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        ) : (
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {axes}
            {series.map((s) => (
              <Area
                key={s.key}
                dataKey={s.key}
                name={s.label}
                type="monotone"
                stackId={stacked ? "stack" : undefined}
                stroke={`var(--color-${s.key})`}
                strokeWidth={2}
                fill={`var(--color-${s.key})`}
                fillOpacity={stacked ? 0.35 : 0.12}
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--background)" }}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        )}
      </ChartContainer>
    </div>
  );
}
