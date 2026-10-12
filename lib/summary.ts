import { formatAmount, formatUsdM } from "@/lib/format";
import type { Deal } from "@/lib/types";

export interface SectorRow {
  sector: string;
  deals: number;
  usdM: number;
}

/** Deals per sector, biggest first; anything past `max` folds into "Other". */
export function sectorBreakdown(deals: Pick<Deal, "sector" | "amountUsdM">[], max = 6): SectorRow[] {
  const map = new Map<string, SectorRow>();
  for (const d of deals) {
    const key = d.sector || "Other";
    const row = map.get(key) ?? { sector: key, deals: 0, usdM: 0 };
    row.deals += 1;
    row.usdM += d.amountUsdM ?? 0;
    map.set(key, row);
  }
  const rows = [...map.values()].sort((a, b) => b.deals - a.deals || b.usdM - a.usdM);
  if (rows.length <= max) return rows;
  const rest = rows.slice(max - 1);
  const other = rest.reduce(
    (acc, r) => ({ sector: "Other", deals: acc.deals + r.deals, usdM: acc.usdM + r.usdM }),
    { sector: "Other", deals: 0, usdM: 0 }
  );
  return [...rows.slice(0, max - 1).filter((r) => r.sector !== "Other"), other];
}

/** A short plain-English summary of the week. Computed from the data, no AI. */
export function weekLede(deals: Deal[]): string {
  if (deals.length === 0) return "A quiet week: no Indian startup funding rounds were announced.";

  const disclosed = deals.filter((d) => d.amountUsdM !== null);
  const total = disclosed.reduce((s, d) => s + (d.amountUsdM ?? 0), 0);
  const opening = `${deals.length} round${deals.length === 1 ? "" : "s"}${
    total > 0 ? ` and ≈${formatUsdM(total)} in disclosed capital` : ""
  }.`;

  const clauses: string[] = [];
  const [top] = sectorBreakdown(deals, 99);
  if (top && top.deals > 1 && top.sector !== "Other") clauses.push(`${top.sector} was busiest with ${top.deals} deals`);
  const largest = [...disclosed].sort((a, b) => (b.amountUsdM ?? 0) - (a.amountUsdM ?? 0))[0];
  if (largest) clauses.push(`${largest.company}'s ${formatAmount(largest.amount)} was the largest round`);

  return clauses.length ? `${opening} ${clauses.join("; ")}.` : opening;
}
