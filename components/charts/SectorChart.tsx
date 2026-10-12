"use client";

import { useState } from "react";
import Tip from "@/components/charts/Tip";
import { formatUsdM } from "@/lib/format";
import { sectorStyle } from "@/lib/sectors";
import type { SectorRow } from "@/lib/summary";

type SortKey = "deals" | "capital" | "focus";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "deals", label: "Deals" },
  { key: "capital", label: "Capital" },
  { key: "focus", label: "Focus first" },
];

const byDeals = (a: SectorRow, b: SectorRow) => b.deals - a.deals || b.usdM - a.usdM;
const byCapital = (a: SectorRow, b: SectorRow) => b.usdM - a.usdM || b.deals - a.deals;

/** Visible rows for a sort; the fold into "Other" is recomputed per sort and "Other" stays last. */
function arrange(rows: SectorRow[], sort: SortKey, isFocus: (s: string) => boolean, maxRows: number): SectorRow[] {
  const real = rows.filter((r) => r.sector !== "Other");
  const existingOther = rows.find((r) => r.sector === "Other");
  let ordered: SectorRow[];
  let keep = maxRows - 1;
  if (sort === "focus") {
    const focus = real.filter((r) => isFocus(r.sector)).sort(byDeals);
    const rest = real.filter((r) => !isFocus(r.sector)).sort(byDeals);
    ordered = [...focus, ...rest];
    keep = Math.max(maxRows - 1, focus.length + (rest.length ? 1 : 0));
  } else {
    ordered = [...real].sort(sort === "capital" ? byCapital : byDeals);
  }
  const shown = ordered.slice(0, keep);
  const folded = [...ordered.slice(keep), ...(existingOther ? [existingOther] : [])];
  if (folded.length === 0) return shown;
  if (folded.length === 1) return [...shown, folded[0]];
  return [
    ...shown,
    folded.reduce((acc, r) => ({ sector: "Other", deals: acc.deals + r.deals, usdM: acc.usdM + r.usdM }), {
      sector: "Other",
      deals: 0,
      usdM: 0,
    }),
  ];
}

/**
 * Deals per sector, single series (one hue). The bar shows the measure being sorted by.
 * Sector identity is the dot beside the written name, never colour alone.
 */
export default function SectorChart({
  rows,
  focusSectors,
  maxRows = 7,
}: {
  rows: SectorRow[];
  focusSectors: string[];
  maxRows?: number;
}) {
  const [sort, setSort] = useState<SortKey>("deals");
  const isFocus = (s: string) => focusSectors.some((f) => f.toLowerCase() === s.toLowerCase());
  const visible = arrange(rows, sort, isFocus, maxRows);
  const measure = (r: SectorRow) => (sort === "capital" ? r.usdM : r.deals);
  const max = Math.max(...visible.map(measure), 1);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-faint">Bar = {sort === "capital" ? "disclosed capital (USD)" : "number of deals"}</p>
        <div role="radiogroup" aria-label="Sort sectors by" className="flex rounded-md border border-line p-0.5 text-[11px]">
          {SORTS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={sort === key}
              onClick={() => setSort(key)}
              className={`rounded px-2 py-0.5 font-medium transition ${
                sort === key ? "bg-surface-3 text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <ul className="space-y-2">
        {visible.map((r) => {
          const value = measure(r);
          return (
            <li key={r.sector} className="grid grid-cols-[minmax(0,8.5rem)_1fr_5.5rem] items-center gap-3 text-xs sm:grid-cols-[10rem_1fr_6.5rem]">
              <span className="flex min-w-0 items-center gap-1.5" style={sectorStyle(r.sector)}>
                <span aria-hidden className="sector-dot h-2 w-2 shrink-0 rounded-full" />
                <span className="truncate text-ink">{r.sector}</span>
                {isFocus(r.sector) && <span className="shrink-0 text-[10px] font-semibold uppercase text-accent">Focus</span>}
              </span>
              <Tip
                content={
                  <>
                    <span className="font-semibold">{r.sector}</span>: {r.deals} deal{r.deals === 1 ? "" : "s"}
                    {r.usdM > 0 ? `, ≈${formatUsdM(r.usdM)} disclosed` : ", no amounts disclosed"}
                  </>
                }
              >
                <span className="relative block h-2 rounded-sm bg-surface-3" aria-hidden>
                  <span
                    className="absolute inset-y-0 left-0 rounded-sm bg-accent transition-[width] duration-300"
                    style={{ width: value > 0 ? `${Math.max(2, (value / max) * 100)}%` : "0%" }}
                  />
                </span>
              </Tip>
              <span className="text-right tabular-nums">
                <span className={sort === "capital" ? "text-faint" : "font-semibold text-ink"}>{r.deals}</span>
                <span className="text-faint"> · </span>
                <span className={sort === "capital" ? "font-semibold text-ink" : "text-faint"}>
                  {r.usdM > 0 ? formatUsdM(r.usdM) : "n/a"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
