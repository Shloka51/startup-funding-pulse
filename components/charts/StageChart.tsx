import Tip from "@/components/charts/Tip";
import { formatUsdM } from "@/lib/format";
import type { StageRow } from "@/lib/insights";

/**
 * Deals by stage, in funding order. Single series; focus stages are labelled, not recoloured.
 * Bridge/Debt rows are hidden when empty; "Undisclosed" is always shown last so gaps are visible.
 */
export default function StageChart({ rows, focusStages }: { rows: StageRow[]; focusStages: string[] }) {
  const visible = rows.filter((r) => r.deals > 0 || !["Bridge", "Debt"].includes(r.stage));
  const max = Math.max(...visible.map((r) => r.deals), 1);
  const isFocus = (s: string) => focusStages.some((f) => f.toLowerCase() === s.toLowerCase() || (s === "Series D+" && /series [d-z]/i.test(f)));

  return (
    <ul className="space-y-2">
      {visible.map((r) => (
        <li key={r.stage} className="grid grid-cols-[7.5rem_1fr_5.5rem] items-center gap-3 text-xs">
          <span className={`flex items-center gap-1.5 ${r.stage === "Undisclosed" ? "text-faint" : "text-ink"}`}>
            {r.stage}
            {isFocus(r.stage) && <span className="text-[10px] font-semibold uppercase text-accent">Focus</span>}
          </span>
          <Tip
            content={
              <>
                <span className="font-semibold">{r.stage}</span>: {r.deals} deal{r.deals === 1 ? "" : "s"}
                {r.usdM > 0 ? `, ≈${formatUsdM(r.usdM)} disclosed` : ""}
              </>
            }
          >
            <span className="relative block h-2 rounded-sm bg-surface-3" aria-hidden>
              <span
                className={`absolute inset-y-0 left-0 rounded-sm ${r.stage === "Undisclosed" ? "bg-line-strong" : "bg-accent"}`}
                style={{ width: r.deals > 0 ? `${Math.max(2, (r.deals / max) * 100)}%` : "0%" }}
              />
            </span>
          </Tip>
          <span className="text-right tabular-nums">
            <span className="font-semibold text-ink">{r.deals}</span>
            <span className="text-faint"> · {r.usdM > 0 ? formatUsdM(r.usdM) : "n/a"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
