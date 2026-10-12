import { EmptyState, SectorTag } from "@/components/ui";
import type { MomentumRow } from "@/lib/insights";

/** Sector deal counts vs the previous reporting week. Only rendered with real prior data. */
export default function MomentumTable({ rows, previousLabel }: { rows: MomentumRow[] | null; previousLabel?: string }) {
  if (!rows) {
    return (
      <EmptyState title="No previous week to compare" compact>
        Sector momentum compares this week with the last stored reporting week. It will appear automatically once a
        second weekly digest exists.
      </EmptyState>
    );
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="text-left text-faint">
          <th className="pb-2 font-medium">Sector</th>
          <th className="pb-2 text-right font-medium">{previousLabel ?? "Prev"}</th>
          <th className="pb-2 text-right font-medium">This week</th>
          <th className="pb-2 text-right font-medium">Change</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((r) => (
          <tr key={r.sector}>
            <td className="py-1.5"><SectorTag sector={r.sector} /></td>
            <td className="py-1.5 text-right tabular-nums text-muted">{r.before}</td>
            <td className="py-1.5 text-right font-medium tabular-nums">{r.now}</td>
            <td className={`py-1.5 text-right font-medium tabular-nums ${r.delta > 0 ? "text-good" : r.delta < 0 ? "text-bad" : "text-faint"}`}>
              {r.delta > 0 ? "▲" : r.delta < 0 ? "▼" : "–"} {Math.abs(r.delta) || ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
