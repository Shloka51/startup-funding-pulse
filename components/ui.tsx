import Link from "next/link";
import { formatAmount, formatUsdM, isUsd } from "@/lib/format";
import { sectorStyle } from "@/lib/sectors";
import type { Deal } from "@/lib/types";

/** Bordered panel with an optional header row. The main layout unit of the dashboard. */
export function Panel({
  title,
  subtitle,
  action,
  children,
  className = "",
  padded = true,
  id,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
  id?: string;
}) {
  return (
    <section id={id} className={`rounded-lg border border-line bg-surface ${className}`}>
      {(title || action) && (
        <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 border-b border-line px-4 py-3">
          <div className="min-w-0">
            {title && <h2 className="text-[13px] font-semibold tracking-tight">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-faint">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={padded ? "p-4" : ""}>{children}</div>
    </section>
  );
}

/** Marks where a statement comes from: computed from data, or Gemini's interpretation. */
export function Provenance({ kind }: { kind: "observed" | "ai" }) {
  return kind === "observed" ? (
    <span className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-muted">
      <svg aria-hidden viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-none stroke-current stroke-[1.5]">
        <path d="M2 10V6M6 10V2M10 10V5" strokeLinecap="round" />
      </svg>
      Observed
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded border border-accent/40 bg-accent-soft px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-accent">
      <svg aria-hidden viewBox="0 0 12 12" className="h-2.5 w-2.5 fill-current">
        <path d="M6 0.8l1.2 3.1 3.1 1.2-3.1 1.2L6 9.4 4.8 6.3 1.7 5.1l3.1-1.2z" />
      </svg>
      Gemini interpretation
    </span>
  );
}

export function SectorTag({ sector, strong }: { sector: string; strong?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5" style={sectorStyle(sector)}>
      <span aria-hidden className="sector-dot h-2 w-2 shrink-0 rounded-full" />
      <span className={`truncate ${strong ? "font-medium text-ink" : ""}`}>{sector}</span>
    </span>
  );
}

const MATCH = {
  1: { label: "Mandate", cls: "bg-accent-soft text-accent", title: "Matches your target sector AND stage" },
  2: { label: "Partial", cls: "bg-surface-3 text-muted", title: "Matches your target sector OR stage" },
  3: { label: "Outside", cls: "text-faint", title: "Outside your target sectors and stages" },
} as const;

export function MatchBadge({ deal }: { deal: Pick<Deal, "tier" | "watchlistMatch"> }) {
  const m = MATCH[deal.tier];
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      {deal.watchlistMatch && (
        <span title={`Involves ${deal.watchlistMatch}`} className="rounded bg-watch-soft px-1.5 py-px text-[11px] font-semibold text-watch">
          Watchlist
        </span>
      )}
      <span title={m.title} className={`rounded px-1.5 py-px text-[11px] font-medium ${m.cls}`}>
        {m.label}
      </span>
    </span>
  );
}

/** Amount as reported, plus ≈USD for INR amounts. */
export function AmountText({ deal, align = "right" }: { deal: Pick<Deal, "amount" | "amountUsdM">; align?: "left" | "right" }) {
  const a = formatAmount(deal.amount);
  if (a === "Undisclosed") return <span className="text-faint">Undisclosed</span>;
  return (
    <span className={`inline-flex flex-col tabular-nums ${align === "right" ? "items-end" : "items-start"}`}>
      <span className="font-medium text-ink">{a}</span>
      {deal.amountUsdM !== null && !isUsd(deal.amount) && (
        <span className="text-[11px] text-faint">≈{formatUsdM(deal.amountUsdM)}</span>
      )}
    </span>
  );
}

export function EmptyState({
  title,
  children,
  action,
  compact = false,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`rounded-md border border-dashed border-line-strong text-center ${compact ? "px-4 py-5" : "px-6 py-10"}`}>
      <p className="text-[13px] font-medium text-ink">{title}</p>
      {children && <div className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-muted">{children}</div>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}

export function TextLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-xs font-medium text-accent underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}

export function PageTitle({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-[13px] text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
