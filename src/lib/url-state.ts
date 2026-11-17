"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type Primitive = number | string | boolean;
type StateShape = Record<string, Primitive>;

export interface UrlStateOptions<T extends StateShape> {
  /** Allowed values for string keys; anything else in the URL falls back to the default. */
  allowed?: { [K in keyof T]?: readonly T[K][] };
  /** Inclusive numeric bounds; out-of-range URL values are clamped. */
  bounds?: { [K in keyof T]?: readonly [number, number] };
  debounceMs?: number;
}

const WRITE_DEBOUNCE_MS = 250;

function parseValue<T extends StateShape, K extends keyof T>(
  key: K,
  raw: string | null,
  fallback: T[K],
  options: UrlStateOptions<T>,
): T[K] {
  if (raw === null) return fallback;
  if (typeof fallback === "number") {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    const range = options.bounds?.[key];
    const clamped = range ? Math.min(Math.max(parsed, range[0]), range[1]) : parsed;
    return clamped as T[K];
  }
  if (typeof fallback === "boolean") {
    return (raw === "1" || raw === "true") as T[K];
  }
  const allowed = options.allowed?.[key];
  if (allowed && !allowed.includes(raw as T[K])) return fallback;
  return raw as T[K];
}

function serialise(value: Primitive): string {
  if (typeof value === "boolean") return value ? "1" : "0";
  if (typeof value === "number") return String(Number(value.toFixed(6)));
  return value;
}

/**
 * Merge a patch into the current URL's query string without a navigation.
 * Keys equal to their default are removed to keep shared links short.
 */
export function writeSearchParams(patch: Record<string, Primitive>, defaults: Record<string, Primitive>): void {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(patch)) {
    if (key in defaults && defaults[key] === value) params.delete(key);
    else params.set(key, serialise(value));
  }
  const query = params.toString();
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState(window.history.state, "", url);
}

/**
 * Slider-friendly state that mirrors itself into URL search params.
 * Reads the URL once on mount, updates local state instantly, and debounces URL writes.
 */
export function useUrlState<T extends StateShape>(
  defaults: T,
  options: UrlStateOptions<T> = {},
): [T, <K extends keyof T>(key: K, value: T[K]) => void, () => void] {
  const searchParams = useSearchParams();
  const [state, setState] = useState<T>(() => {
    const initial = { ...defaults };
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      initial[key] = parseValue(key, searchParams.get(String(key)), defaults[key], options);
    }
    return initial;
  });

  const defaultsRef = useRef(defaults);
  const pending = useRef<Partial<T>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounceMs = options.debounceMs ?? WRITE_DEBOUNCE_MS;

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const patch = pending.current;
    pending.current = {};
    if (Object.keys(patch).length > 0) writeSearchParams(patch as Record<string, Primitive>, defaultsRef.current);
  }, []);

  const set = useCallback(
    <K extends keyof T>(key: K, value: T[K]) => {
      setState((prev) => (prev[key] === value ? prev : { ...prev, [key]: value }));
      pending.current = { ...pending.current, [key]: value };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, debounceMs);
    },
    [debounceMs, flush],
  );

  const reset = useCallback(() => {
    setState({ ...defaultsRef.current });
    pending.current = { ...defaultsRef.current };
    flush();
  }, [flush]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return [state, set, reset];
}
