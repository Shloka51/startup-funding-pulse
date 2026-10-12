import Link from "next/link";
import NavLinks from "@/components/NavLinks";
import RefreshButton from "@/components/RefreshButton";
import ThemeToggle from "@/components/ThemeToggle";
import { buildAlerts } from "@/lib/alerts";
import { getDashboard } from "@/lib/dashboard";
import { formatRange, formatTimestamp } from "@/lib/dates";

const LEVEL_STYLE = {
  fresh: "bg-good-soft text-good",
  current: "bg-accent-soft text-accent",
  stale: "bg-warn-soft text-warn",
} as const;

export default async function SiteHeader() {
  const { digest, freshness, deals } = await getDashboard();
  const watchAlerts = buildAlerts(deals).filter((a) => a.kind === "watchlist" || a.kind === "adjacent").length;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
        <div className="flex h-12 items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
            <span aria-hidden className="grid h-6 w-6 place-items-center rounded-md bg-accent-strong">
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-on-accent stroke-2">
                <path d="M1.5 9h3l2-5 3 9 2-4h3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            Funding Pulse
          </Link>

          {digest && freshness && (
            <div className="hidden min-w-0 items-center gap-3 text-xs text-muted md:flex">
              <span className="truncate">
                Period <span className="font-medium text-ink">{formatRange(digest.window.start, digest.window.end)}</span>
              </span>
              <span className="text-line-strong">|</span>
              <span className="truncate">Generated {formatTimestamp(digest.generatedAt)}</span>
              <span
                title={freshness.detail}
                className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 font-medium ${LEVEL_STYLE[freshness.level]}`}
              >
                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
                {freshness.label}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <RefreshButton compact />
            <ThemeToggle />
          </div>
        </div>

        {digest && freshness && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 pb-2 text-xs text-muted md:hidden">
            <span className="font-medium text-ink">{formatRange(digest.window.start, digest.window.end)}</span>
            <span>· {formatTimestamp(digest.generatedAt)}</span>
            <span className={`rounded px-1.5 py-0.5 font-medium ${LEVEL_STYLE[freshness.level]}`}>{freshness.label}</span>
          </p>
        )}

        <NavLinks badges={watchAlerts ? { "/watchlist": watchAlerts } : {}} />
      </div>
    </header>
  );
}
