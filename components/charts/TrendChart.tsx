import Tip from "@/components/charts/Tip";
import { EmptyState } from "@/components/ui";
import { formatUsdM } from "@/lib/format";
import type { WeekPoint } from "@/lib/insights";

function Bars({ points, value, format, label }: { points: WeekPoint[]; value: (p: WeekPoint) => number; format: (n: number) => string; label: string }) {
  const max = Math.max(...points.map(value), 1);
  return (
    <figure>
      <figcaption className="mb-2 text-xs text-faint">{label}</figcaption>
      <div className="flex h-28 items-end gap-2 border-b border-line-strong">
        {points.map((p, i) => {
          const v = value(p);
          const last = i === points.length - 1;
          return (
            <Tip key={p.label} className="flex h-full flex-1 items-end" content={<><span className="font-semibold">{p.label}</span>: {format(v)}</>}>
              <span
                className={`block w-full rounded-t-sm ${last ? "bg-accent" : "bg-accent/45"}`}
                style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
                aria-hidden
              />
            </Tip>
          );
        })}
      </div>
      <div className="mt-1.5 flex gap-2">
        {points.map((p) => (
          <span key={p.label} className="flex-1 truncate text-center text-[10px] text-faint">
            {p.label}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** Weekly deals and disclosed capital as two separate charts (never a dual axis). Needs ≥ 2 weeks. */
export default function TrendChart({ points }: { points: WeekPoint[] }) {
  if (points.length < 2) {
    return (
      <EmptyState title="Trend needs at least two reporting weeks" compact>
        {points.length === 1
          ? `Only ${points[0].label} is stored so far. The first week-over-week comparison appears after the next Monday digest; nothing is extrapolated before then.`
          : "No reporting weeks are stored yet."}
      </EmptyState>
    );
  }
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Bars points={points} value={(p) => p.deals} format={(n) => `${n} deals`} label="Deals per week" />
      <Bars points={points} value={(p) => p.usdM} format={(n) => (n > 0 ? `≈${formatUsdM(n)}` : "none disclosed")} label="Disclosed capital per week (USD)" />
    </div>
  );
}
