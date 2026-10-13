import Link from "next/link";
import RefreshButton from "@/components/RefreshButton";
import { EmptyState, Provenance, TextLink } from "@/components/ui";
import { formatRange } from "@/lib/dates";
import { investorActivity, observedChanges, observedFacts, type NewInvestorRow } from "@/lib/insights";
import type { Deal, Digest } from "@/lib/types";

function CompanyLinks({ names, deals }: { names: string[]; deals: Deal[] }) {
  if (!names.length) return null;
  return (
    <span className="mt-1.5 flex flex-wrap gap-1">
      {names.map((c) => {
        const d = deals.find((x) => x.company === c);
        return d ? (
          <Link
            key={c}
            href={`/deals?deal=${encodeURIComponent(d.id)}`}
            className="rounded border border-line px-1.5 py-px text-[11px] text-muted hover:border-accent hover:text-accent"
          >
            {c}
          </Link>
        ) : (
          <span key={c} className="rounded border border-line px-1.5 py-px text-[11px] text-faint">{c}</span>
        );
      })}
    </span>
  );
}

function SectionLabel({ children, kind }: { children: React.ReactNode; kind: "observed" | "ai" }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted">{children}</h3>
      <Provenance kind={kind} />
    </div>
  );
}

/**
 * The weekly investment brief. Observed facts (plain code over stored deals) are always shown
 * separately from Gemini's interpretation, and every company Gemini names links to its deal.
 */
export default function Brief({
  digest,
  deals,
  variant = "full",
  previousWindow,
  newInvestors = null,
  priorWeeks = 0,
  previousDeals = null,
}: {
  digest: Digest;
  deals: Deal[];
  variant?: "compact" | "full";
  previousWindow: { start: string; end: string } | null;
  /** null = no earlier week stored, so "new" can't be judged. */
  newInvestors?: NewInvestorRow[] | null;
  priorWeeks?: number;
  /** The previous full week's deals, for the observed "what changed" block. */
  previousDeals?: Deal[] | null;
}) {
  const compact = variant === "compact";
  const brief = digest.brief;
  const facts = observedFacts(deals);
  const patterns = digest.patterns ?? [];
  const active = investorActivity(deals).filter((i) => i.deals >= 2);

  return (
    <div className="space-y-5">
      {/* Executive summary (AI) */}
      <div>
        <SectionLabel kind="ai">Executive summary</SectionLabel>
        {brief ? (
          <p className="text-[13px] leading-relaxed text-ink">{brief.summary}</p>
        ) : (
          <p className="text-xs text-muted">
            {brief === null
              ? "Gemini couldn't produce the summary for this run. The observed facts and deals below are unaffected."
              : "This digest was generated before the AI brief existed. Use Refresh to generate it; the facts below are current."}
          </p>
        )}
      </div>

      {/* Observed facts */}
      <div>
        <SectionLabel kind="observed">Observed in this week&apos;s data</SectionLabel>
        <dl className={`grid gap-x-6 gap-y-3 ${compact ? "sm:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
          {(compact ? facts.slice(0, 4) : facts).map((f) => (
            <div key={f.label} className="min-w-0">
              <dt className="text-[11px] text-faint">{f.label}</dt>
              <dd className="truncate text-[13px] font-medium text-ink" title={f.value}>{f.value}</dd>
              {f.detail && <dd className="text-[11px] text-muted">{f.detail}</dd>}
            </div>
          ))}
        </dl>
      </div>

      {/* Patterns (AI, evidence-linked) */}
      <div>
        <SectionLabel kind="ai">Sector &amp; stage patterns</SectionLabel>
        {digest.patterns === null ? (
          <p className="text-xs text-muted">Pattern analysis was unavailable for this run.</p>
        ) : patterns.length === 0 ? (
          <p className="text-xs text-muted">No pattern backed by at least two deals stood out this week.</p>
        ) : (
          <ol className="space-y-3">
            {(compact ? patterns.slice(0, 3) : patterns).map((p, i) => (
              <li key={p.title} className="flex gap-3">
                <span className="w-4 shrink-0 text-xs font-semibold tabular-nums text-accent">{i + 1}</span>
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink">{p.title}</p>
                  {!compact && <p className="mt-0.5 text-xs leading-relaxed text-muted">{p.detail}</p>}
                  <CompanyLinks names={p.companies} deals={deals} />
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Investor activity: observed table + AI read */}
      {!compact && (
        <div className="grid gap-5 lg:grid-cols-2">
          <div>
            <SectionLabel kind="observed">Investors with 2+ deals</SectionLabel>
            {active.length === 0 ? (
              <p className="text-xs text-muted">No investor backed more than one disclosed deal this week.</p>
            ) : (
              <ul className="divide-y divide-line rounded-md border border-line">
                {active.slice(0, 8).map((i) => (
                  <li key={i.name} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
                    <Link href={`/deals?investor=${encodeURIComponent(i.name)}`} className="truncate font-medium text-ink hover:text-accent">
                      {i.name}
                    </Link>
                    <span className="shrink-0 tabular-nums text-muted">
                      {i.deals} deals{i.leads ? ` · led ${i.leads}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <SectionLabel kind="ai">Investor read</SectionLabel>
            {!brief || brief.investorInsights.length === 0 ? (
              <p className="text-xs text-muted">
                {brief ? "Gemini found no investor behaviour worth flagging this week." : "Available after the next refresh."}
              </p>
            ) : (
              <ul className="space-y-3">
                {brief.investorInsights.map((x) => (
                  <li key={x.title}>
                    <p className="text-[13px] font-medium text-ink">{x.title}</p>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{x.detail}</p>
                    <CompanyLinks names={x.companies} deals={deals} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* New investors in target verticals (observed) */}
      {!compact && (
        <div>
          <SectionLabel kind="observed">New investors in your target sectors</SectionLabel>
          {newInvestors === null ? (
            <p className="text-xs text-muted">
              Needs at least one earlier stored week to tell who&apos;s new. Build last week from the week picker in the header.
            </p>
          ) : newInvestors.length === 0 ? (
            <p className="text-xs text-muted">
              Every named investor in your target-sector deals also appeared in the previous {priorWeeks} stored week
              {priorWeeks === 1 ? "" : "s"}.
            </p>
          ) : (
            <>
              <ul className="divide-y divide-line rounded-md border border-line">
                {newInvestors.slice(0, 10).map((i) => (
                  <li key={i.name} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-3 py-2 text-xs">
                    <Link href={`/deals?investor=${encodeURIComponent(i.name)}`} className="font-medium text-ink hover:text-accent">
                      {i.name}
                    </Link>
                    <span className="flex flex-wrap gap-1">
                      {i.companies.map((c) => (
                        <Link
                          key={c.id}
                          href={`/deals?deal=${encodeURIComponent(c.id)}`}
                          className="rounded border border-line px-1.5 py-px text-[11px] text-muted hover:border-accent hover:text-accent"
                        >
                          {c.company} · {c.sector}
                          {c.stage !== "Undisclosed" ? ` · ${c.stage}` : ""}
                        </Link>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] text-faint">
                Not seen in any deal across the previous {priorWeeks} stored week{priorWeeks === 1 ? "" : "s"}. Investors
                are only known when the coverage names them.
              </p>
            </>
          )}
        </div>
      )}

      {/* Changes vs previous week (observed: computed, not generated) */}
      {!compact && (
        <div>
          <SectionLabel kind="observed">Changes vs previous week</SectionLabel>
          {digest.kind === "wtd" ? (
            <p className="text-xs text-muted">
              This week is still in progress, so it isn&apos;t compared with full weeks. The Monday brief will include the comparison.
            </p>
          ) : previousDeals && previousWindow ? (
            <>
              <ul className="space-y-1 text-xs text-ink">
                {observedChanges(deals, previousDeals).map((c) => (
                  <li key={c} className="flex gap-2">
                    <span aria-hidden className="text-faint">•</span>
                    {c}
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[11px] text-faint">
                Compared with {formatRange(previousWindow.start, previousWindow.end)}. Mandate matches use your current settings for both weeks.
              </p>
            </>
          ) : (
            <p className="text-xs text-muted">
              No previous week is stored yet. Build it from the week picker in the header to enable comparisons.
            </p>
          )}
        </div>
      )}

      {/* Follow-ups (AI) */}
      <div>
        <SectionLabel kind="ai">Suggested follow-ups</SectionLabel>
        {!brief || brief.followUps.length === 0 ? (
          <p className="text-xs text-muted">{brief ? "No specific follow-ups suggested." : "Available after the next refresh."}</p>
        ) : (
          <ul className="space-y-2.5">
            {(compact ? brief.followUps.slice(0, 2) : brief.followUps).map((f) => (
              <li key={f.action} className="flex gap-2.5">
                <span aria-hidden className="mt-1 h-3.5 w-3.5 shrink-0 rounded-sm border border-line-strong" />
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-ink">{f.action}</p>
                  <p className="text-xs text-muted">{f.why}</p>
                  {!compact && <CompanyLinks names={f.companies} deals={deals} />}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {compact && (
        <div className="border-t border-line pt-3">
          <TextLink href="/insights">Full brief, investor activity and analytics →</TextLink>
        </div>
      )}
    </div>
  );
}

export function NoDigest({ warning }: { warning?: string }) {
  return (
    <EmptyState title="No brief generated yet" action={<RefreshButton primary />}>
      {warning ? <p className="mb-2 text-warn">{warning}</p> : null}
      Generate this week&apos;s brief from live funding news. Gemini Flash reads every article, so it takes about a minute.
    </EmptyState>
  );
}
