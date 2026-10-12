import { NoDigest } from "@/components/Brief";
import DealsExplorer, { type ExplorerFilters } from "@/components/deals/DealsExplorer";
import { PageTitle } from "@/components/ui";
import { getDashboard } from "@/lib/dashboard";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const metadata = { title: "Deals · Funding Pulse" };

const KEYS = ["q", "sector", "stage", "investor", "match", "date", "deal"] as const;

export default async function DealsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ digest, warning, deals }, params] = await Promise.all([getDashboard(), searchParams]);
  if (!digest) return <NoDigest warning={warning} />;

  const initial: ExplorerFilters = {};
  for (const k of KEYS) {
    const v = params[k];
    if (typeof v === "string" && v) initial[k] = v;
  }

  return (
    <div className="space-y-4">
      <PageTitle
        title="Deals explorer"
        description="Every funding round announced this week, ranked by fit with your mandate. Click a row for sources, investors and why it ranks where it does."
      />
      <DealsExplorer
        key={JSON.stringify(initial)}
        deals={deals}
        patterns={digest.patterns ?? []}
        initial={initial}
      />
    </div>
  );
}
