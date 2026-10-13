import { EmptyState, SectorTag } from "@/components/ui";
import type { MomentumRow } from "@/lib/insights";

/** Sector deal counts vs the previous reporting week. Only rendered with real prior data. */
export default function MomentumTable({
  rows,
  previousLabel,
  partial = false,
}: {
  rows: MomentumRow[] | null;
  previousLabel?: string;
  partial?: boolean;
}) {
  if (!rows) {
    return partial ? (
      <EmptyState title="Week still in progress" compact>
        Momentum compares full weeks. This week&apos;s comparison appears in Monday&apos;s brief.
      </EmptyState>
    ) : (
      <EmptyState title="No previous week to compare" compact>
        Sector momentum compares this week with the previous reporting week. Build that week from the week picker in the
        header to see it.
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
