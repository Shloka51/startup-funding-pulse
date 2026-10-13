import Link from "next/link";
import NavLinks from "@/components/NavLinks";
import RefreshButton from "@/components/RefreshButton";
import ThemeToggle from "@/components/ThemeToggle";
import WeekPicker, { ArchiveBar, ProgressBar, type PickerWeek } from "@/components/WeekPicker";
import { buildAlerts } from "@/lib/alerts";
import { getDashboard } from "@/lib/dashboard";
import { formatTimestamp } from "@/lib/dates";

export default async function SiteHeader() {
  const { digest, freshness, deals, weeks, selectedKey, isArchive, isPartial } = await getDashboard();
  const watchAlerts = buildAlerts(deals).filter((a) => a.kind === "watchlist" || a.kind === "adjacent").length;

  const pickerWeeks: PickerWeek[] = weeks.map((w) => ({
    key: w.key,
    label: w.label,
    status: w.status,
    deals: w.deals,
    usdM: w.usdM,
    generated: w.generatedAt ? formatTimestamp(w.generatedAt) : null,
  }));
  const picker =
    digest && freshness && selectedKey ? (
      <WeekPicker
        weeks={pickerWeeks}
        selectedKey={selectedKey}
        status={{
          level: freshness.level,
          label: freshness.label,
          detail: `${freshness.detail}. Generated ${formatTimestamp(digest.generatedAt)}.`,
        }}
      />
    ) : null;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="flex h-12 items-center justify-between gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-2 text-[15px] font-semibold tracking-tight">
            <span aria-hidden className="grid h-6 w-6 place-items-center rounded-md bg-accent-strong">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-on-accent stroke-2">
                <path d="M1.5 9h3l2-5 3 9 2-4h3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            Funding Pulse
          </Link>

          {picker && <div className="hidden md:block">{picker}</div>}

          <div className="flex items-center gap-2">
            {digest && !isArchive && !isPartial && (
              <span className="hidden text-[11px] text-faint lg:inline">Generated {formatTimestamp(digest.generatedAt)}</span>
            )}
            {!isArchive && !isPartial && <RefreshButton compact />}
            <ThemeToggle />
          </div>
        </div>

        {picker && <div className="pb-2 md:hidden">{picker}</div>}

        <NavLinks badges={watchAlerts ? { "/watchlist": watchAlerts } : {}} />
      </div>
      {isPartial && digest && selectedKey && <ProgressBar weekKey={selectedKey} updated={formatTimestamp(digest.generatedAt)} />}
      {isArchive && digest && (
        <ArchiveBar label={weeks.find((w) => w.key === selectedKey)?.label ?? ""} built={formatTimestamp(digest.generatedAt)} />
      )}
    </header>
  );
}
