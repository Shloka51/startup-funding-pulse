import Link from "next/link";
import AlertsList from "@/components/AlertsList";
import { NoDigest } from "@/components/Brief";
import { AmountText, EmptyState, PageTitle, Panel, TextLink } from "@/components/ui";
import { buildAlerts } from "@/lib/alerts";
import { getDashboard } from "@/lib/dashboard";
import { formatShortDate } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const metadata = { title: "Watchlist · Funding Pulse" };

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export default async function WatchlistPage() {
  const { digest, warning, deals, config } = await getDashboard();
  if (!digest) return <NoDigest warning={warning} />;

  const alerts = buildAlerts(deals, { mandateLimit: 10, investorLimit: 6 });
  const priority = alerts.filter((a) => a.kind === "watchlist" || a.kind === "adjacent");
  const signals = alerts.filter((a) => a.kind === "mandate" || a.kind === "investor");

  return (
    <div className="space-y-5">
      <PageTitle
        title="Watchlist & alerts"
        description="Companies you track, and any announcement this week that involves them, directly or as an investor or backer."
        action={<TextLink href="/settings">Edit watchlist →</TextLink>}
      />

      <Panel title="Tracked companies" subtitle={`${config.watchlist.length} companies · matched on company name, investors and headline`} padded={false}>
        {config.watchlist.length === 0 ? (
          <div className="p-4">
            <EmptyState title="Your watchlist is empty" compact action={<TextLink href="/settings">Add companies →</TextLink>}>
              Add portfolio companies or names you track to get alerted when they raise or appear in other rounds.
            </EmptyState>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {config.watchlist.map((name) => {
              const hits = deals.filter((d) => d.watchlistMatch && norm(d.watchlistMatch) === norm(name));
              return (
                <li key={name} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink">{name}</p>
                    <p className="text-[11px] text-faint">
                      {hits.length ? `${hits.length} announcement${hits.length === 1 ? "" : "s"} this week` : "No announcements this week"}
                    </p>
                  </div>
                  {hits.length > 0 ? (
                    <ul className="w-full space-y-1.5 sm:w-auto sm:min-w-[22rem]">
                      {hits.map((d) => {
                        const direct = norm(d.company).includes(norm(name)) || norm(name).includes(norm(d.company));
                        return (
                          <li key={d.id}>
                            <Link
                              href={`/deals?deal=${encodeURIComponent(d.id)}`}
                              className="flex items-center justify-between gap-3 rounded-md border border-watch/40 bg-watch-soft px-3 py-2 text-xs hover:border-watch"
                            >
                              <span className="min-w-0">
                                <span className="block truncate font-medium text-ink">
                                  {direct ? `${d.company} raised` : `Named in ${d.company}'s round`}
                                </span>
                                <span className="text-[11px] text-muted">
                                  {d.stage !== "Undisclosed" ? `${d.stage} · ` : ""}
                                  {formatShortDate(d.date)} · {d.sourceName}
                                </span>
                              </span>
                              <AmountText deal={d} />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <span className="rounded border border-line px-2 py-0.5 text-[11px] text-faint">Quiet</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Watchlist & adjacency alerts" subtitle="Direct raises, or a tracked company named in another round" padded={false}>
          <AlertsList
            alerts={priority}
            emptyText="None of your tracked companies raised or appeared in another company's round this week."
          />
        </Panel>
        <Panel title="Mandate & investor signals" subtitle="Full mandate matches and investors with 2+ deals" padded={false}>
          <AlertsList alerts={signals} emptyText="No full mandate matches or repeat investors this week." />
        </Panel>
      </div>

      <p className="text-[11px] leading-relaxed text-faint">
        Adjacency is flagged only when the source names a watchlist company in another company&apos;s round (as an investor,
        backer or in the headline). Wider portfolio relationships aren&apos;t inferred.
      </p>
    </div>
  );
}
