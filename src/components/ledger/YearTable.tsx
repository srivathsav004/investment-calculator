"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronRight, Download, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCompactINR, formatINR, formatINRExact, formatNumber, formatPct } from "@/lib/formatters";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type ColumnFormat = "inr" | "inrCompact" | "pct" | "int" | "text";

export interface YearColumn<T> {
  key: string;
  label: string;
  value: (row: T) => number | string;
  format: ColumnFormat;
  /** Emphasise this column (e.g. closing balance). */
  strong?: boolean;
  tone?: (row: T) => "positive" | "negative" | undefined;
  /** MonthTable only: add a total for this column in the footer row. */
  sum?: boolean;
}

interface YearTableProps<T> {
  title?: string;
  rows: T[];
  columns: YearColumn<T>[];
  fileName: string;
  rowKey: (row: T) => string | number;
  highlight?: (row: T) => boolean;
  maxHeight?: number;
  /** When given, clicking a row opens a popup with this content (e.g. the month-by-month detail). */
  renderDetail?: (row: T) => ReactNode;
  detailTitle?: (row: T) => string;
  detailDescription?: (row: T) => string;
}

type SortState = { key: string; dir: "asc" | "desc" } | null;

export function renderCell(value: number | string, format: ColumnFormat) {
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

export function YearTable<T>(props: YearTableProps<T>) {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <YearTableCard {...props} onExpand={() => setExpanded(true)} />
      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] sm:max-w-[calc(100vw-4rem)]">
          <DialogHeader>
            <DialogTitle>{props.title ?? "Year-wise ledger"}</DialogTitle>
            <DialogDescription>Full-screen view{props.renderDetail ? " · click any row for its month-by-month breakdown" : ""}</DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 p-4">
            <YearTableCard {...props} bare maxHeight={Math.max(360, typeof window === "undefined" ? 600 : window.innerHeight - 190)} />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function YearTableCard<T>({
  title = "Year-wise ledger",
  rows,
  columns,
  fileName,
  rowKey,
  highlight,
  maxHeight = 480,
  renderDetail,
  detailTitle,
  detailDescription,
  onExpand,
  bare,
}: YearTableProps<T> & { onExpand?: () => void; bare?: boolean }) {
  const [sort, setSort] = useState<SortState>(null);
  const [selected, setSelected] = useState<T | null>(null);

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
          {bare ? null : <h2 className="text-sm font-semibold">{title}</h2>}
          <p className="text-xs text-muted-foreground">
            Click a header to sort · hover a figure for the exact amount{renderDetail ? " · click a row for its monthly detail" : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}>
            <Download className="size-3.5" />
            CSV
          </Button>
          {bare || !onExpand ? null : (
            <Button variant="outline" size="sm" onClick={onExpand} aria-label="Open the ledger full screen">
              <Maximize2 className="size-3.5" />
              Expand
            </Button>
          )}
        </div>
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
              <TableRow
                key={rowKey(row)}
                className={cn(highlight?.(row) && "bg-muted/40", renderDetail && "cursor-pointer")}
                onClick={renderDetail ? () => setSelected(row) : undefined}
                onKeyDown={
                  renderDetail
                    ? (event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          setSelected(row);
                        }
                      }
                    : undefined
                }
                tabIndex={renderDetail ? 0 : undefined}
              >
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
                      {renderDetail && index === 0 ? <ChevronRight className="mr-1 inline size-3 text-muted-foreground" aria-hidden /> : null}
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
      {renderDetail ? (
        <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
          <DialogContent className="max-w-6xl">
            <DialogHeader>
              <DialogTitle>{selected !== null && detailTitle ? detailTitle(selected) : "Detail"}</DialogTitle>
              <DialogDescription>{selected !== null && detailDescription ? detailDescription(selected) : "Month-by-month breakdown"}</DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-auto p-4">{selected !== null ? renderDetail(selected) : null}</div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

interface MonthTableProps<T> {
  rows: T[];
  columns: YearColumn<T>[];
  rowKey: (row: T) => string | number;
  /** Optional per-row remark (e.g. "FD created", "Ceiling split") shown beside the figures. */
  note?: (row: T) => string | undefined;
  footerLabel?: string;
}

/** Plain month-by-month grid used inside the row-detail popups. Columns flagged `sum` get a total. */
export function MonthTable<T>({ rows, columns, rowKey, note, footerLabel = "Total" }: MonthTableProps<T>) {
  const hasTotals = columns.some((c) => c.sum);
  return (
    <div className="overflow-auto rounded-md border">
      <Table className="text-xs">
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent">
            {columns.map((column) => (
              <TableHead key={column.key} className={cn("h-9 whitespace-nowrap px-3 font-medium", column.format === "text" ? "text-left" : "text-right")}>
                {column.label}
              </TableHead>
            ))}
            {note ? <TableHead className="h-9 px-3">Remark</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={rowKey(row)}>
              {columns.map((column) => {
                const tone = column.tone?.(row);
                return (
                  <TableCell
                    key={column.key}
                    className={cn(
                      "whitespace-nowrap px-3 py-1.5",
                      column.format === "text" ? "text-left" : "num text-right",
                      column.strong && "font-semibold",
                      tone === "positive" && "text-positive",
                      tone === "negative" && "text-negative",
                    )}
                  >
                    {renderCell(column.value(row), column.format)}
                  </TableCell>
                );
              })}
              {note ? <TableCell className="px-3 py-1.5 text-muted-foreground">{note(row) ?? ""}</TableCell> : null}
            </TableRow>
          ))}
        </TableBody>
        {hasTotals ? (
          <tfoot className="border-t bg-muted/40 font-semibold">
            <TableRow className="hover:bg-transparent">
              {columns.map((column, index) => (
                <TableCell key={column.key} className={cn("whitespace-nowrap px-3 py-2", column.format === "text" ? "text-left" : "num text-right")}>
                  {column.sum ? renderCell(rows.reduce((total, row) => total + Number(column.value(row)), 0), column.format) : index === 0 ? footerLabel : ""}
                </TableCell>
              ))}
              {note ? <TableCell /> : null}
            </TableRow>
          </tfoot>
        ) : null}
      </Table>
    </div>
  );
}
