"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCompactINR, formatINR, formatINRExact, formatNumber, formatPct } from "@/lib/formatters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export type ColumnFormat = "inr" | "inrCompact" | "pct" | "int" | "text";

export interface YearColumn<T> {
  key: string;
  label: string;
  value: (row: T) => number | string;
  format: ColumnFormat;
  /** Emphasise this column (e.g. closing balance). */
  strong?: boolean;
  tone?: (row: T) => "positive" | "negative" | undefined;
}

interface YearTableProps<T> {
  title?: string;
  rows: T[];
  columns: YearColumn<T>[];
  fileName: string;
  rowKey: (row: T) => string | number;
  highlight?: (row: T) => boolean;
  maxHeight?: number;
}

type SortState = { key: string; dir: "asc" | "desc" } | null;

function renderCell(value: number | string, format: ColumnFormat) {
  if (typeof value === "string" || format === "text") return String(value);
  switch (format) {
    case "inr":
      return formatINR(value);
    case "inrCompact":
      return formatCompactINR(value);
    case "pct":
      return formatPct(value);
    case "int":
      return formatNumber(value);
  }
}

function csvEscape(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csvValue(value: number | string, format: ColumnFormat): string {
  if (typeof value === "string") return csvEscape(value);
  if (format === "pct") return (value * 100).toFixed(4);
  if (format === "int") return String(Math.round(value));
  return value.toFixed(2);
}

export function YearTable<T>({ title = "Year-wise ledger", rows, columns, fileName, rowKey, highlight, maxHeight = 480 }: YearTableProps<T>) {
  const [sort, setSort] = useState<SortState>(null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const column = columns.find((c) => c.key === sort.key);
    if (!column) return rows;
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = column.value(a);
      const vb = column.value(b);
      if (typeof va === "number" && typeof vb === "number") return (va - vb) * factor;
      return String(va).localeCompare(String(vb), "en-IN", { numeric: true }) * factor;
    });
  }, [rows, columns, sort]);

  const toggleSort = (key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "desc" };
      if (prev.dir === "desc") return { key, dir: "asc" };
      return null;
    });
  };

  const exportCsv = () => {
    const header = columns.map((c) => csvEscape(c.format === "pct" ? `${c.label} (%)` : c.format === "text" || c.format === "int" ? c.label : `${c.label} (INR)`));
    const lines = sorted.map((row) => columns.map((c) => csvValue(c.value(row), c.format)).join(","));
    const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName.endsWith(".csv") ? fileName : `${fileName}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <div>
          <h2 className="text-sm font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">Click a column header to sort · hover a figure for the exact amount</p>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="size-3.5" />
          CSV
        </Button>
      </div>
      <div className="overflow-auto" style={{ maxHeight }}>
        <Table className="text-xs">
          <TableHeader className="sticky top-0 z-10 bg-card shadow-[0_1px_0_var(--border)]">
            <TableRow className="hover:bg-transparent">
              {columns.map((column, index) => {
                const active = sort?.key === column.key;
                const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
                return (
                  <TableHead
                    key={column.key}
                    className={cn("h-9 whitespace-nowrap px-3", column.format === "text" ? "text-left" : "text-right", index === 0 && "sticky left-0 z-10 bg-card")}
                    aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(column.key)}
                      className={cn("inline-flex items-center gap-1 font-medium hover:text-foreground", active ? "text-foreground" : "text-muted-foreground")}
                    >
                      {column.label}
                      <Icon className="size-3 opacity-60" aria-hidden />
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => (
              <TableRow key={rowKey(row)} className={cn(highlight?.(row) && "bg-muted/40")}>
                {columns.map((column, index) => {
                  const value = column.value(row);
                  const tone = column.tone?.(row);
                  const content = renderCell(value, column.format);
                  const showExact = typeof value === "number" && (column.format === "inr" || column.format === "inrCompact");
                  return (
                    <TableCell
                      key={column.key}
                      className={cn(
                        "whitespace-nowrap px-3 py-2",
                        column.format === "text" ? "text-left" : "num text-right",
                        column.strong && "font-semibold",
                        tone === "positive" && "text-positive",
                        tone === "negative" && "text-negative",
                        index === 0 && "sticky left-0 bg-card",
                      )}
                    >
                      {showExact ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-default">{content}</span>
                          </TooltipTrigger>
                          <TooltipContent className="num">{formatINRExact(value)}</TooltipContent>
                        </Tooltip>
                      ) : (
                        content
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
