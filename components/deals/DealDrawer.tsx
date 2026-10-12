"use client";

import { useEffect, useRef } from "react";
import { AmountText, MatchBadge, Provenance, SectorTag } from "@/components/ui";
import { formatShortDate } from "@/lib/dates";
import type { Deal, Pattern } from "@/lib/types";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-3 py-2 text-xs">
      <dt className="text-faint">{label}</dt>
      <dd className="min-w-0 text-ink">{children}</dd>
    </div>
  );
}

function whyRanked(d: Deal) {
  const parts: string[] = [];
  if (d.watchlistMatch) parts.push(`involves ${d.watchlistMatch}, a watchlist company`);
  if (d.sectorMatch && d.stageMatch) parts.push(`matches your mandate on sector (${d.sector}) and stage (${d.stage})`);
  else if (d.sectorMatch) parts.push(`is in a target sector (${d.sector}) but not a target stage`);
  else if (d.stageMatch) parts.push(`is at a target stage (${d.stage}) but outside your target sectors`);
  else parts.push("is outside your target sectors and stages");
  return `This deal ${parts.join(", and ")}.`;
}

function qualityNotes(d: Deal) {
  const notes: string[] = [];
  if (d.amount === "Undisclosed" || d.amountUsdM === null) notes.push("Amount not disclosed (or not convertible), so it's excluded from capital totals.");
  if (d.stage === "Undisclosed") notes.push("Stage not stated in the coverage.");
  if (d.sector === "Other") notes.push("Sector classification is uncertain.");
  if (d.leadInvestor === "Undisclosed") notes.push("No lead investor named in the coverage.");
  if (d.alsoReportedBy.length) notes.push(`Merged from ${d.alsoReportedBy.length + 1} reports of the same round.`);
  return notes;
}

/** Slide-over with everything known about a deal, its sources, and why it ranks where it does. */
export default function DealDrawer({ deal, patterns, onClose }: { deal: Deal | null; patterns: Pattern[]; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!deal) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [deal, onClose]);

  if (!deal) return null;
  const related = patterns.filter((p) => p.companies.includes(deal.company));
  const notes = qualityNotes(deal);
  const investors = [deal.leadInvestor, ...deal.otherInvestors].filter((n) => n && n !== "Undisclosed");

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="deal-title">
      <button type="button" aria-label="Close details" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-line bg-surface shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h2 id="deal-title" className="text-base font-semibold tracking-tight">{deal.company}</h2>
            <p className="mt-0.5 text-xs text-muted">
              {[deal.subSector, deal.city].filter(Boolean).join(" · ") || deal.sector}
            </p>
            <div className="mt-2"><MatchBadge deal={deal} /></div>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-muted hover:bg-surface-2 hover:text-ink"
          >
            ✕
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <div className="flex items-end justify-between gap-4 rounded-md border border-line bg-surface-2 px-4 py-3">
            <div>
              <p className="text-[11px] text-faint">Round</p>
              <p className="text-sm font-medium">{deal.stage === "Undisclosed" ? "Stage not disclosed" : deal.stage}</p>
            </div>
            <div className="text-right text-base"><AmountText deal={deal} /></div>
          </div>

          <p className="text-[13px] leading-relaxed text-ink">{deal.oneLineSummary}</p>

          <dl className="divide-y divide-line border-y border-line">
            <Row label="Sector"><SectorTag sector={deal.sector} strong /></Row>
            <Row label="Announced">{formatShortDate(deal.date)}</Row>
            <Row label="Lead investor">
              <span className={deal.leadInvestor === "Undisclosed" ? "text-faint" : ""}>{deal.leadInvestor}</span>
            </Row>
            <Row label="Other investors">
              {deal.otherInvestors.length ? deal.otherInvestors.join(", ") : <span className="text-faint">None named</span>}
            </Row>
            {deal.city && <Row label="City">{deal.city}</Row>}
          </dl>

          <section>
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Why it ranks here</h3>
            <p className="text-xs leading-relaxed text-muted">{whyRanked(deal)}</p>
          </section>

          <section>
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Sources</h3>
            <ul className="space-y-1.5 text-xs">
              <li>
                <a href={deal.sourceUrl} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
                  {deal.sourceName} ↗
                </a>
                <span className="text-faint"> · primary</span>
              </li>
              {deal.alsoReportedBy.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                    {s.name} ↗
                  </a>
                </li>
              ))}
            </ul>
            <blockquote className="mt-2 border-l-2 border-line-strong pl-3 text-xs italic text-muted">“{deal.headline}”</blockquote>
          </section>

          {related.length > 0 && (
            <section>
              <div className="mb-1.5 flex items-center gap-2">
                <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">Part of this week&apos;s patterns</h3>
                <Provenance kind="ai" />
              </div>
              <ul className="space-y-2">
                {related.map((p) => (
                  <li key={p.title} className="text-xs">
                    <p className="font-medium text-ink">{p.title}</p>
                    <p className="text-muted">{p.detail}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {investors.length > 0 && (
            <section>
              <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Investors</h3>
              <div className="flex flex-wrap gap-1.5">
                {investors.map((n) => (
                  <a
                    key={n}
                    href={`/deals?investor=${encodeURIComponent(n)}`}
                    className="rounded border border-line px-2 py-0.5 text-[11px] text-muted hover:border-accent hover:text-accent"
                  >
                    {n}: all deals
                  </a>
                ))}
              </div>
            </section>
          )}

          <section className="rounded-md border border-line bg-surface-2 p-3">
            <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">Data quality</h3>
            <ul className="list-disc space-y-1 pl-4 text-[11px] text-muted">
              {notes.map((n) => <li key={n}>{n}</li>)}
              <li>Fields were extracted by Gemini Flash from the headline and snippet. Verify with the source before acting.</li>
            </ul>
          </section>
        </div>
      </aside>
    </div>
  );
}
