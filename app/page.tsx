import DealCard, { DealRow } from "@/components/DealCard";
import {
  PatternsSection,
  Quiet,
  SectionHeading,
  SettingsLink,
  StatTiles,
  WatchlistAlerts,
} from "@/components/DigestSections";
import RefreshButton from "@/components/RefreshButton";
import StatusBanner from "@/components/StatusBanner";
import { getConfig } from "@/lib/config";
import { formatRange, formatTimestamp } from "@/lib/dates";
import { getDigestForPage } from "@/lib/digest";
import { applyConfig } from "@/lib/rank";
import { findWatchlistMatch } from "@/lib/watchlist";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export default async function DigestPage() {
  const [{ digest, warning }, { config }] = await Promise.all([getDigestForPage(), getConfig()]);

  if (!digest) {
    return (
      <div className="space-y-6">
        <Header />
        {warning && <StatusBanner tone="warn">{warning}</StatusBanner>}
        <div className="rounded-xl border border-dashed border-line bg-surface px-6 py-12 text-center">
          <p className="text-lg font-semibold">No digest yet</p>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
            Generate this week&apos;s brief from live funding news. It takes about a minute while Gemini Flash reads
            each article.
          </p>
          <div className="mt-5 flex justify-center">
            <RefreshButton variant="primary" />
          </div>
        </div>
      </div>
    );
  }

  // Ranking + watchlist use the *current* settings, so edits apply instantly.
  const deals = applyConfig(digest.deals, config, findWatchlistMatch);
  const focus = deals.filter((d) => d.tier < 3);
  const tier1 = deals.filter((d) => d.tier === 1);
  const tier2 = deals.filter((d) => d.tier === 2);
  const other = deals.filter((d) => d.tier === 3);
  const noFocusSet = config.targetSectors.length === 0 && config.targetStages.length === 0;

  return (
    <div className="space-y-10">
      <div className="space-y-5">
        <Header range={formatRange(digest.window.start, digest.window.end)} />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-sm text-muted">
            Updated {formatTimestamp(digest.generatedAt)}
            <span className="text-faint"> · {digest.stats.articles} articles read by Gemini Flash</span>
          </p>
          <RefreshButton />
        </div>
        {warning && <StatusBanner tone="warn">{warning}</StatusBanner>}
        {digest.notes.length > 0 && (
          <StatusBanner tone="info">
            {digest.notes.map((n) => (
              <p key={n}>{n}</p>
            ))}
          </StatusBanner>
        )}
        <StatTiles deals={deals} />
      </div>

      <WatchlistAlerts deals={deals} />

      {deals.length === 0 ? (
        <Quiet action={<SettingsLink>Review your sectors in Settings →</SettingsLink>}>
          No Indian startup funding announcements were found for this week. Sources were checked: {digest.stats.queriesOk} of{" "}
          {digest.stats.queriesTotal} searches responded. Quiet weeks happen; try Refresh later.
        </Quiet>
      ) : (
        <>
          <PatternsSection patterns={digest.patterns} dealCount={deals.length} />

          <section>
            <SectionHeading
              title="Focus deals"
              count={focus.length}
              hint={noFocusSet ? undefined : `${[...config.targetSectors, ...config.targetStages].join(" · ")}`}
            />
            {focus.length === 0 ? (
              <Quiet action={<SettingsLink />}>
                {noFocusSet
                  ? "You haven't set any focus sectors or stages yet, so every deal is listed below."
                  : "No deals matched your focus sectors or stages this week. Everything that did happen is listed below."}
              </Quiet>
            ) : (
              <div className="space-y-6">
                {tier1.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-faint">Sector and stage match</p>
                    <div className="space-y-3">
                      {tier1.map((d) => (
                        <DealCard key={d.id} deal={d} />
                      ))}
                    </div>
                  </div>
                )}
                {tier2.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-medium text-faint">Sector or stage match</p>
                    <ul className="divide-y divide-line rounded-xl border border-line bg-surface px-4 sm:px-5">
                      {tier2.map((d) => (
                        <DealRow key={d.id} deal={d} />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </section>

          {other.length > 0 && (
            <section>
              <SectionHeading title="Other deals" count={other.length} hint="Outside your focus, biggest first" />
              <ul className="divide-y divide-line rounded-xl border border-line bg-surface px-4 sm:px-5">
                {other.map((d) => (
                  <DealRow key={d.id} deal={d} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <footer className="border-t border-line pt-5 text-xs leading-relaxed text-faint">
        Live data from Google News ({digest.stats.queriesOk}/{digest.stats.queriesTotal} searches ok) · Extraction and
        patterns by Google Gemini Flash ({digest.model}) · Amounts in ₹ converted at ≈ ₹88/$ for comparison · Always
        verify with the source before acting.
      </footer>
    </div>
  );
}

function Header({ range }: { range?: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-faint">Monday brief · Indian startup funding</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
        {range ? `Week of ${range}` : "This week in funding"}
      </h1>
    </div>
  );
}
