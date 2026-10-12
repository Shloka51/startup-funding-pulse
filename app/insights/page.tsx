import Brief, { NoDigest } from "@/components/Brief";
import MomentumTable from "@/components/charts/MomentumTable";
import SectorChart from "@/components/charts/SectorChart";
import StageChart from "@/components/charts/StageChart";
import TrendChart from "@/components/charts/TrendChart";
import { PageTitle, Panel } from "@/components/ui";
import { getDashboard } from "@/lib/dashboard";
import { formatRange } from "@/lib/dates";
import { sectorMomentum, stageBreakdown, weeklySeries } from "@/lib/insights";
import { sectorBreakdown } from "@/lib/summary";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
export const metadata = { title: "Insights · Funding Pulse" };

export default async function InsightsPage() {
  const { digest, warning, deals, config, history, previousDeals, previousWindow } = await getDashboard();
  if (!digest) return <NoDigest warning={warning} />;

  // Use the live (re-ranked) current week as the newest point; older points come from stored history.
  const weeks = [digest, ...history.filter((h) => h.window.end !== digest.window.end)];

  return (
    <div className="space-y-5">
      <PageTitle
        title="Insights"
        description="The weekly investment brief and capital-flow analytics. Statements marked Observed are computed from the deal data; Gemini interpretation is the model's read of the same data."
      />

      <Panel title="Weekly investment brief" subtitle={`Reporting period ${formatRange(digest.window.start, digest.window.end)} · model ${digest.model}`}>
        <Brief digest={digest} deals={deals} variant="full" previousWindow={previousWindow} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Funding by sector" subtitle="Sort by deal count, capital, or your focus sectors">
          <SectorChart rows={sectorBreakdown(deals, Infinity)} focusSectors={config.targetSectors} maxRows={9} />
        </Panel>
        <Panel title="Funding by stage" subtitle="Deal count with disclosed capital">
          <StageChart rows={stageBreakdown(deals)} focusStages={config.targetStages} />
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Weekly trend" subtitle="Deals and disclosed capital per stored reporting week">
          <TrendChart points={weeklySeries(weeks)} />
        </Panel>
        <Panel title="Sector momentum" subtitle="Deal count change vs the previous reporting week">
          <MomentumTable
            rows={previousDeals ? sectorMomentum(deals, previousDeals) : null}
            previousLabel={previousWindow ? formatRange(previousWindow.start, previousWindow.end).replace(/ \d{4}$/, "") : undefined}
          />
        </Panel>
      </div>
    </div>
  );
}
