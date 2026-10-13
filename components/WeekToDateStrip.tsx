"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { buildWeek, setWeekCookie } from "@/components/weekActions";
import { formatUsdM } from "@/lib/format";

/** Overview teaser for the week in progress: open it if built, or build it (~1 min). */
export default function WeekToDateStrip({
  weekKey,
  built,
  deals,
  usdM,
  updated,
}: {
  weekKey: string;
  built: boolean;
  deals: number | null;
  usdM: number | null;
  updated: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [building, setBuilding] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!building) return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [building]);

  function open() {
    setWeekCookie(weekKey);
    startTransition(() => router.refresh());
  }

  async function build() {
    setBuilding(true);
    setError(null);
    try {
      await buildWeek(weekKey);
      open();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Build failed");
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-accent/40 bg-surface px-4 py-2.5">
      <div className="flex min-w-0 items-center gap-3">
        <span
          aria-hidden
          className="h-7 w-1.5 shrink-0 rounded-sm"
          style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--accent) 0 3px, transparent 3px 6px)" }}
        />
        <p className="min-w-0 text-xs">
          <span className="font-semibold text-ink">This week so far</span>
          <span className="text-muted">
            {building
              ? ` · reading this week's news with Gemini Flash… ${elapsed}s`
              : built
                ? ` · ${deals ?? "?"} deals${usdM ? `, ≈${formatUsdM(usdM)} disclosed` : ""} since Monday · updated ${updated}`
                : " · see what's been announced since Monday, before the full brief on Monday 07:00 IST"}
          </span>
          {error && <span className="ml-2 text-bad">{error}</span>}
        </p>
      </div>
      <button
        type="button"
        onClick={built ? open : build}
        disabled={building || pending}
        className="shrink-0 rounded-md border border-accent/50 px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent-soft disabled:opacity-50"
      >
        {building ? "Building…" : pending ? "Opening…" : built ? "View week to date →" : "Build week to date (~1 min)"}
      </button>
    </div>
  );
}
