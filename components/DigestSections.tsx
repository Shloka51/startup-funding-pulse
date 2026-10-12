import Link from "next/link";
import { formatAmount, formatUsdM, isUsd } from "@/lib/format";
import type { Deal, Pattern } from "@/lib/types";

export function SectionHeading({ title, count, hint }: { title: string; count?: number; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
        {title}
        {count !== undefined && <span className="ml-2 tabular-nums text-faint">{count}</span>}
      </h2>
      {hint && <p className="text-right text-xs text-faint">{hint}</p>}
    </div>
  );
}

export function StatTiles({ deals }: { deals: Deal[] }) {
  const disclosed = deals.filter((d) => d.amountUsdM !== null);
  const total = disclosed.reduce((sum, d) => sum + (d.amountUsdM ?? 0), 0);
  const focus = deals.filter((d) => d.tier < 3).length;
  const watch = deals.filter((d) => d.watchlistMatch).length;

  const tiles = [
    { label: "Deals", value: String(deals.length), sub: "this week" },
    { label: "Disclosed capital", value: total > 0 ? `≈${formatUsdM(total)}` : "—", sub: `across ${disclosed.length} rounds` },
    { label: "Focus matches", value: String(focus), sub: "sector or stage" },
    { label: "Watchlist hits", value: String(watch), alert: watch > 0, sub: watch ? "see alerts below" : "none this week" },
  ];

  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
      {tiles.map((t) => (
        <div key={t.label} className="bg-surface px-4 py-3">
          <dt className="text-xs text-faint">{t.label}</dt>
          <dd className={`mt-0.5 font-mono text-xl font-semibold tabular-nums ${t.alert ? "text-watch" : ""}`}>
            {t.value}
          </dd>
          {t.sub && <dd className="text-xs text-faint">{t.sub}</dd>}
        </div>
      ))}
    </dl>
  );
}

export function WatchlistAlerts({ deals }: { deals: Deal[] }) {
  const hits = deals.filter((d) => d.watchlistMatch);
  if (hits.length === 0) return null;

  return (
    <section aria-labelledby="watchlist-heading" className="rounded-xl border border-watch/40 bg-watch-soft p-4 sm:p-5">
      <h2 id="watchlist-heading" className="flex items-center gap-2 text-sm font-semibold text-watch">
        <span aria-hidden className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-watch opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-watch" />
        </span>
        Watchlist alert{hits.length > 1 ? `s · ${hits.length}` : ""}
      </h2>
      <ul className="mt-3 space-y-2">
        {hits.map((d) => (
          <li key={d.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 text-sm">
            <span>
              <a href={`#${d.id}`} className="font-semibold underline-offset-2 hover:underline">
                {d.company}
              </a>
              {d.watchlistMatch && d.watchlistMatch.toLowerCase() !== d.company.toLowerCase() && (
                <span className="text-muted"> (involves {d.watchlistMatch})</span>
              )}
              <span className="text-muted">
                {" "}
                · {[d.stage !== "Undisclosed" ? d.stage : null, d.sector].filter(Boolean).join(" · ")}
              </span>
            </span>
            <span className="font-mono text-sm tabular-nums">
              {formatAmount(d.amount)}
              {d.amountUsdM !== null && !isUsd(d.amount) && (
                <span className="text-muted"> ≈ {formatUsdM(d.amountUsdM)}</span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PatternsSection({ patterns, dealCount }: { patterns: Pattern[] | null; dealCount: number }) {
  return (
    <section>
      <SectionHeading title="Patterns this week" hint="Detected by Gemini Flash across all deals" />
      {patterns === null ? (
        <Quiet>Pattern analysis was unavailable for this run. Deals below are unaffected; try Refresh in a minute.</Quiet>
      ) : patterns.length === 0 ? (
        <Quiet>
          {dealCount < 3
            ? "Too few deals this week to call a pattern."
            : "No clear pattern stood out this week: deal flow was spread thinly across sectors."}
        </Quiet>
      ) : (
        <ol className="grid gap-3 sm:grid-cols-2">
          {patterns.map((p, i) => (
            <li
              key={p.title}
              className={`rounded-xl border border-line bg-surface p-4 ${
                patterns.length % 2 === 1 && i === patterns.length - 1 ? "sm:col-span-2" : ""
              }`}
            >
              <div className="flex gap-3">
                <span className="font-mono text-sm font-semibold text-accent">{String(i + 1).padStart(2, "0")}</span>
                <div className="min-w-0">
                  <h3 className="font-semibold leading-snug">{p.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{p.detail}</p>
                  <p className="mt-2.5 flex flex-wrap gap-1">
                    {p.companies.map((c) => (
                      <span key={c} className="rounded bg-surface-2 px-1.5 py-0.5 text-xs text-muted">
                        {c}
                      </span>
                    ))}
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export function Quiet({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-5 text-sm text-muted">
      {children}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function SettingsLink({ children = "Adjust focus in Settings →" }: { children?: React.ReactNode }) {
  return (
    <Link href="/settings" className="text-sm font-medium text-accent underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}
