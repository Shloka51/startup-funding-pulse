import { formatShortDate } from "@/lib/dates";
import { formatAmount, formatUsdM, isUsd } from "@/lib/format";
import type { Deal } from "@/lib/types";

export function WatchlistBadge({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-watch-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-watch">
      <svg aria-hidden viewBox="0 0 16 16" className="h-3 w-3 fill-current">
        <path d="M8 3C4.4 3 1.7 5.3.6 8c1.1 2.7 3.8 5 7.4 5s6.3-2.3 7.4-5C14.3 5.3 11.6 3 8 3Zm0 8a3 3 0 1 1 0-6 3 3 0 0 1 0 6Z" />
      </svg>
      Watchlist{name ? ` · ${name}` : ""}
    </span>
  );
}

function Amount({ deal, size = "lg" }: { deal: Deal; size?: "lg" | "sm" }) {
  const undisclosed = deal.amount === "Undisclosed";
  return (
    <div className="shrink-0 text-right">
      <p
        className={`font-mono font-semibold tabular-nums tracking-tight ${
          size === "lg" ? "text-lg" : "text-sm"
        } ${undisclosed ? "text-faint" : ""}`}
      >
        {formatAmount(deal.amount)}
      </p>
      {deal.amountUsdM !== null && !isUsd(deal.amount) && (
        <p className="font-mono text-xs tabular-nums text-faint">≈ {formatUsdM(deal.amountUsdM)}</p>
      )}
    </div>
  );
}

function Chip({ children, highlight }: { children: React.ReactNode; highlight?: boolean }) {
  return (
    <span
      className={`rounded-md px-2 py-0.5 text-xs font-medium ${
        highlight ? "bg-accent-soft text-accent" : "bg-surface-2 text-muted"
      }`}
    >
      {children}
    </span>
  );
}

function SourceLinks({ deal }: { deal: Deal }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1">
      <a
        href={deal.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-accent underline-offset-2 hover:underline"
      >
        {deal.sourceName} ↗
      </a>
      {deal.alsoReportedBy.length > 0 && (
        <span title={deal.alsoReportedBy.map((s) => s.name).join(", ")}>
          + {deal.alsoReportedBy.length} more
        </span>
      )}
    </span>
  );
}

/** Full card for focus deals. */
export default function DealCard({ deal }: { deal: Deal }) {
  const watched = !!deal.watchlistMatch;
  return (
    <article
      id={deal.id}
      className={`scroll-mt-20 rounded-xl border bg-surface p-4 sm:p-5 ${
        watched ? "border-watch/60 ring-1 ring-watch/30" : "border-line"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold tracking-tight sm:text-lg">{deal.company}</h3>
            {watched && <WatchlistBadge name={deal.watchlistMatch === deal.company ? "" : deal.watchlistMatch!} />}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Chip highlight={deal.stageMatch}>{deal.stage === "Undisclosed" ? "Stage n/a" : deal.stage}</Chip>
            <Chip highlight={deal.sectorMatch}>{deal.sector}</Chip>
            {deal.subSector && deal.subSector.toLowerCase() !== deal.sector.toLowerCase() && (
              <Chip>{deal.subSector}</Chip>
            )}
            {deal.city && <Chip>{deal.city}</Chip>}
          </div>
        </div>
        <Amount deal={deal} />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-muted">{deal.oneLineSummary}</p>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-faint">
        <span>
          Lead <span className={deal.leadInvestor === "Undisclosed" ? "" : "font-medium text-ink"}>{deal.leadInvestor}</span>
        </span>
        <span>{formatShortDate(deal.date)}</span>
        <SourceLinks deal={deal} />
      </div>
    </article>
  );
}

/** Compact row for "Other deals". Same information, less vertical space. */
export function DealRow({ deal }: { deal: Deal }) {
  return (
    <li id={deal.id} className="flex scroll-mt-20 items-start justify-between gap-4 py-3.5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold">{deal.company}</span>
          {deal.watchlistMatch && <WatchlistBadge name="" />}
          <span className="text-xs text-faint">
            {[deal.stage === "Undisclosed" ? null : deal.stage, deal.sector, deal.city || null].filter(Boolean).join(" · ")}
          </span>
        </div>
        <p className="mt-1 text-sm text-muted">{deal.oneLineSummary}</p>
        <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-faint">
          <span>
            Lead <span className={deal.leadInvestor === "Undisclosed" ? "" : "text-ink"}>{deal.leadInvestor}</span>
          </span>
          <span>{formatShortDate(deal.date)}</span>
          <SourceLinks deal={deal} />
        </p>
      </div>
      <Amount deal={deal} size="sm" />
    </li>
  );
}
