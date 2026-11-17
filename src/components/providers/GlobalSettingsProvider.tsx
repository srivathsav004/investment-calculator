"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { useUrlState } from "@/lib/url-state";
import { realRate, toReal } from "@/lib/formatters";
import { TAX_SLABS, type TaxRegime, type ValueMode } from "@/lib/tax";

export const GLOBAL_DEFAULTS = {
  slab: 0.3,
  regime: "new" as TaxRegime,
  view: "nominal" as ValueMode,
  infl: 0.06,
};

export const GLOBAL_PARAM_KEYS = Object.keys(GLOBAL_DEFAULTS) as (keyof typeof GLOBAL_DEFAULTS)[];

interface GlobalSettings {
  slab: number;
  regime: TaxRegime;
  view: ValueMode;
  inflation: number;
  isReal: boolean;
  setSlab: (slab: number) => void;
  setRegime: (regime: TaxRegime) => void;
  setView: (view: ValueMode) => void;
  setInflation: (inflation: number) => void;
  /** Convert a nominal amount at the end of `years` into the active display basis. */
  adjust: (nominal: number, years: number) => number;
  /** Convert a nominal annual rate into the active display basis. */
  adjustRate: (nominalRate: number) => number;
  /** Query string carrying non-default global settings, for cross-route links. */
  navQuery: string;
}

const GlobalSettingsContext = createContext<GlobalSettings | null>(null);

export function GlobalSettingsProvider({ children }: { children: ReactNode }) {
  const [state, set] = useUrlState(GLOBAL_DEFAULTS, {
    allowed: { regime: ["new", "old"], view: ["nominal", "real"] },
    bounds: { slab: [0, 0.3], infl: [0, 0.15] },
  });

  const slab = (TAX_SLABS as readonly number[]).includes(state.slab) ? state.slab : GLOBAL_DEFAULTS.slab;
  const isReal = state.view === "real";
  const inflation = state.infl;

  const adjust = useCallback(
    (nominal: number, years: number) => (isReal ? toReal(nominal, years, inflation) : nominal),
    [isReal, inflation],
  );
  const adjustRate = useCallback(
    (nominalRate: number) => (isReal ? realRate(nominalRate, inflation) : nominalRate),
    [isReal, inflation],
  );

  const value = useMemo<GlobalSettings>(() => {
    const params = new URLSearchParams();
    if (slab !== GLOBAL_DEFAULTS.slab) params.set("slab", String(slab));
    if (state.regime !== GLOBAL_DEFAULTS.regime) params.set("regime", state.regime);
    if (state.view !== GLOBAL_DEFAULTS.view) params.set("view", state.view);
    if (inflation !== GLOBAL_DEFAULTS.infl) params.set("infl", String(Number(inflation.toFixed(4))));
    const query = params.toString();
    return {
      slab,
      regime: state.regime,
      view: state.view,
      inflation,
      isReal,
      setSlab: (next) => set("slab", next),
      setRegime: (next) => set("regime", next),
      setView: (next) => set("view", next),
      setInflation: (next) => set("infl", next),
      adjust,
      adjustRate,
      navQuery: query ? `?${query}` : "",
    };
  }, [slab, state.regime, state.view, inflation, isReal, set, adjust, adjustRate]);

  return <GlobalSettingsContext.Provider value={value}>{children}</GlobalSettingsContext.Provider>;
}

export function useGlobalSettings(): GlobalSettings {
  const context = useContext(GlobalSettingsContext);
  if (!context) throw new Error("useGlobalSettings must be used inside <GlobalSettingsProvider>");
  return context;
}
