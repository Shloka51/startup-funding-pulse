import { formatUsdM } from "@/lib/format";
import type { Alert } from "@/lib/alerts";
import type { Deal } from "@/lib/types";

function metrics(deals: Deal[], alerts: Alert[] | null) {
  const disclosed = deals.filter((d) => d.amountUsdM !== null);
  return {
    deals: deals.length,
    capital: disclosed.reduce((s, d) => s + (d.amountUsdM ?? 0), 0),
    disclosed: disclosed.length,
    mandate: deals.filter((d) => d.tier === 1).length,
    partial: deals.filter((d) => d.tier === 2).length,
    priority: alerts ? alerts.filter((a) => a.kind === "watchlist" || a.kind === "adjacent").length : 0,
  };
}

function Delta({ now, before, format = (n: number) => String(n) }: { now: number; before?: number; format?: (n: number) => string }) {
  if (before === undefined) return null;
  const d = now - before;
  if (d === 0) return <span className="text-[11px] text-faint">= prev week</span>;
  return (
    <span className={`text-[11px] font-medium ${d > 0 ? "text-good" : "text-bad"}`}>
      {d > 0 ? "▲" : "▼"} {format(Math.abs(d))} vs prev
    </span>
  );
}

/** Executive KPIs. Week-over-week deltas render only when a previous week is actually stored. */
export default function KpiRow({
  deals,
  alerts,
  previousDeals,
  previousAlerts,
  articles,
}: {
  deals: Deal[];
  alerts: Alert[];
  previousDeals: Deal[] | null;
  previousAlerts: Alert[] | null;
  articles: number;
}) {
  const now = metrics(deals, alerts);
  const prev = previousDeals ? metrics(previousDeals, previousAlerts) : null;
  const tiles = [
    { label: "Deals tracked", value: String(now.deals), sub: `from ${articles} articles screened`, delta: <Delta now={now.deals} before={prev?.deals} /> },
    {
      label: "Disclosed funding",
      value: now.capital > 0 ? `≈${formatUsdM(now.capital)}` : "—",
      sub: `${now.disclosed} of ${now.deals} rounds disclosed`,
      delta: <Delta now={now.capital} before={prev?.capital} format={formatUsdM} />,
    },
    { label: "Mandate matches", value: String(now.mandate), sub: `sector + stage · ${now.partial} partial`, accent: true, delta: <Delta now={now.mandate} before={prev?.mandate} /> },
    {
      label: "Priority alerts",
      value: String(now.priority),
      sub: now.priority ? "watchlist & adjacency" : "no watchlist activity",
      alert: now.priority > 0,
      delta: <Delta now={now.priority} before={prev?.priority} />,
    },
  ];

  return (
    <div>
      <dl className="grid grid-cols-2 overflow-hidden rounded-lg border border-line bg-line lg:grid-cols-4" style={{ gap: 1 }}>
        {tiles.map((t) => (
          <div key={t.label} className="bg-surface px-4 py-3">
            <dt className="text-xs text-muted">{t.label}</dt>
            <dd className="mt-1 flex items-baseline gap-2">
              <span className={`text-2xl font-semibold tabular-nums tracking-tight ${t.alert ? "text-watch" : t.accent ? "text-accent" : "text-ink"}`}>
                {t.value}
              </span>
              {t.delta}
            </dd>
            <dd className="mt-0.5 text-[11px] text-faint">{t.sub}</dd>
          </div>
        ))}
      </dl>
      {!prev && (
        <p className="mt-1.5 text-[11px] text-faint">
          Week-over-week changes appear once a previous weekly digest is stored (first comparison after next Monday&apos;s run).
        </p>
      )}
    </div>
  );
}
