"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { buildWeek, setWeekCookie } from "@/components/weekActions";
import { formatUsdM } from "@/lib/format";

export interface PickerWeek {
  key: string;
  label: string;
  status: "live" | "stored" | "missing" | "progress" | "progress-missing";
  deals: number | null;
  usdM: number | null;
  generated: string | null;
}

const shortDate = (key: string) =>
  new Date(`${key}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

const STATUS_STYLE = {
  fresh: "bg-good-soft text-good",
  current: "bg-accent-soft text-accent",
  stale: "bg-warn-soft text-warn",
  archive: "bg-watch-soft text-watch",
  progress: "bg-accent-soft text-accent",
} as const;

const isProgress = (w: PickerWeek) => w.status === "progress" || w.status === "progress-missing";
const isMissing = (w: PickerWeek) => w.status === "missing" || w.status === "progress-missing";

/** Diagonal stripes for a week that's still in progress. */
const HATCH = {
  backgroundImage:
    "repeating-linear-gradient(135deg, var(--accent) 0 4px, color-mix(in oklab, var(--accent) 35%, transparent) 4px 8px)",
};

/**
 * "Time machine" week selector. The trigger steps between weeks with ‹ ›; the popover shows the
 * last 8 reporting weeks as a timeline (bar height = deals), lets you open stored weeks, and
 * build missing ones from Google News archive search + Gemini Flash.
 */
export default function WeekPicker({
  weeks,
  selectedKey,
  status,
}: {
  weeks: PickerWeek[]; // newest first
  selectedKey: string;
  status: { level: keyof typeof STATUS_STYLE; label: string; detail: string };
}) {
  const router = useRouter();
  const timeline = [...weeks].reverse(); // oldest → newest, time flows left to right
  const selectedIdx = Math.max(0, timeline.findIndex((w) => w.key === selectedKey));
  const selected = timeline[selectedIdx];

  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(selectedIdx);
  const [building, setBuilding] = useState<{ key: string; started: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const colRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const maxDeals = Math.max(1, ...timeline.map((w) => w.deals ?? 0));
  const focused = timeline[focus] ?? selected;

  const go = useCallback(
    (w: PickerWeek) => {
      setWeekCookie(w.status === "live" ? null : w.key);
      setOpen(false);
      startTransition(() => router.refresh());
    },
    [router]
  );

  async function build(w: PickerWeek) {
    setError(null);
    setBuilding({ key: w.key, started: Date.now() });
    try {
      await buildWeek(w.key);
      setWeekCookie(w.key);
      setOpen(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Build failed");
    } finally {
      setBuilding(null);
    }
  }

  function activate(w: PickerWeek) {
    if (building) return;
    if (isMissing(w)) build(w);
    else if (w.key !== selectedKey) go(w);
    else if (w.status === "progress") build(w); // "Update now" on the week in progress
    else setOpen(false);
  }

  /** ‹ › on the trigger: step to the adjacent week; open the timeline if it still needs building. */
  function step(dir: -1 | 1) {
    const target = timeline[selectedIdx + dir];
    if (!target) return;
    if (isMissing(target)) {
      setFocus(selectedIdx + dir);
      setOpen(true);
    } else go(target);
  }

  // Build progress timer.
  useEffect(() => {
    if (!building) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - building.started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [building]);

  // Open: focus the selected week; close on outside click.
  useEffect(() => {
    if (!open) return;
    setFocus(selectedIdx);
    requestAnimationFrame(() => colRefs.current[selectedIdx]?.focus());
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !triggerRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, selectedIdx]);

  function onKeyDown(e: React.KeyboardEvent) {
    const move = (i: number) => {
      const next = Math.min(timeline.length - 1, Math.max(0, i));
      setFocus(next);
      colRefs.current[next]?.focus();
    };
    const targets: Record<string, number> = {
      ArrowLeft: focus - 1,
      ArrowRight: focus + 1,
      Home: 0,
      End: timeline.length - 1,
    };
    if (e.key in targets) {
      e.preventDefault();
      move(targets[e.key]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const canOlder = selectedIdx > 0;
  const canNewer = selectedIdx < timeline.length - 1;
  const busy = pending || !!building;

  return (
    <div className="relative">
      <div ref={triggerRef} className="flex items-center gap-1.5">
        <div className="flex items-center rounded-md border border-line bg-surface">
          <button
            type="button"
            onClick={() => step(-1)}
            disabled={!canOlder || busy}
            aria-label="Previous week"
            title="Previous week"
            className="grid h-8 w-7 place-items-center text-muted hover:text-ink disabled:opacity-30"
          >
            ‹
          </button>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-haspopup="dialog"
            aria-expanded={open}
            className="flex h-8 items-center gap-2 border-x border-line px-2.5 text-xs hover:bg-surface-2"
          >
            <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 fill-none stroke-current stroke-[1.5] text-faint">
              <rect x="2" y="3" width="12" height="11" rx="1.5" />
              <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" strokeLinecap="round" />
            </svg>
            <span className="text-faint">{isProgress(selected) ? "This week" : "Week of"}</span>
            <span className="font-medium tabular-nums text-ink">{isProgress(selected) ? selected.label.replace(/ – so far$/, " – today") : selected.label}</span>
            {pending && <span className="h-3 w-3 animate-spin rounded-full border-2 border-faint border-t-transparent" aria-hidden />}
            <svg aria-hidden viewBox="0 0 12 12" className={`h-2.5 w-2.5 fill-current text-faint transition ${open ? "rotate-180" : ""}`}>
              <path d="M2 4l4 4 4-4z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            disabled={!canNewer || busy}
            aria-label="Next week"
            title="Next week"
            className="grid h-8 w-7 place-items-center text-muted hover:text-ink disabled:opacity-30"
          >
            ›
          </button>
        </div>
        <span title={status.detail} className={`inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-xs font-medium ${STATUS_STYLE[status.level]}`}>
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
          {status.label}
        </span>
      </div>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="Choose reporting week"
          onKeyDown={onKeyDown}
          className="fixed inset-x-3 top-24 z-50 rounded-lg border border-line-strong bg-surface shadow-2xl sm:absolute sm:inset-x-auto sm:left-1/2 sm:top-full sm:mt-2 sm:w-[600px] sm:-translate-x-1/2"
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
            <div>
              <p className="text-[13px] font-semibold">Time machine</p>
              <p className="mt-0.5 text-xs text-faint">
                Recent reporting weeks plus this week so far (striped). Bar height = deals found. Dashed weeks can be
                built from Google News archive search.
              </p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-faint hover:text-ink">
              ✕
            </button>
          </div>

          {/* Timeline */}
          <div role="listbox" aria-label="Reporting weeks" className="grid gap-1.5 px-4 pb-2 pt-4"
            style={{ gridTemplateColumns: `repeat(${timeline.length}, minmax(0, 1fr))` }}>
            {timeline.map((w, i) => {
              const isSel = w.key === selectedKey;
              const isFocus = i === focus;
              const isBuilding = building?.key === w.key;
              const h = w.deals ? Math.max(10, (w.deals / maxDeals) * 100) : 0;
              return (
                <button
                  key={w.key}
                  ref={(el) => {
                    colRefs.current[i] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={isSel}
                  tabIndex={isFocus ? 0 : -1}
                  onFocus={() => setFocus(i)}
                  onMouseEnter={() => setFocus(i)}
                  onClick={() => {
                    // One click opens a built week. Unbuilt weeks only get selected, so a stray
                    // click never starts a one-minute build; the Build button below does that.
                    setFocus(i);
                    if (!isMissing(w) && w.key !== selectedKey) go(w);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && activate(w)}
                  aria-label={`${w.label}: ${isMissing(w) ? "not built" : `${w.deals ?? "?"} deals`}${w.status === "live" ? ", latest full week" : isProgress(w) ? ", in progress" : ""}`}
                  className={`group flex flex-col items-center gap-1 rounded-md px-1 pb-1.5 pt-1 outline-none transition ${
                    isFocus ? "bg-surface-2" : ""
                  } ${isSel ? "ring-1 ring-accent" : ""}`}
                >
                  <span className={`h-4 text-[11px] tabular-nums ${isMissing(w) ? "text-faint" : "font-semibold text-ink"}`}>
                    {isMissing(w) ? "—" : (w.deals ?? "?")}
                  </span>
                  <span className="flex h-20 w-full items-end justify-center">
                    {isMissing(w) ? (
                      <span
                        className={`grid h-7 w-full max-w-9 place-items-center rounded-sm border border-dashed text-sm ${
                          isBuilding ? "animate-pulse border-accent text-accent" : "border-line-strong text-faint group-hover:border-accent group-hover:text-accent"
                        }`}
                      >
                        +
                      </span>
                    ) : isProgress(w) ? (
                      <span className="w-full max-w-9 rounded-t-sm transition-[height]" style={{ height: `${h}%`, ...HATCH }} />
                    ) : (
                      <span
                        className={`w-full max-w-9 rounded-t-sm transition-[height] ${w.status === "live" ? "bg-accent" : isSel ? "bg-accent/80" : "bg-accent/45"}`}
                        style={{ height: `${h}%` }}
                      />
                    )}
                  </span>
                  <span className="h-px w-full bg-line-strong" aria-hidden />
                  <span className={`text-[10px] tabular-nums ${isSel ? "font-semibold text-ink" : "text-faint"}`}>{shortDate(w.key)}</span>
                  <span className="h-3.5">
                    {w.status === "live" && (
                      <span className="rounded bg-accent-soft px-1 text-[9px] font-bold uppercase tracking-wider text-accent">Latest</span>
                    )}
                    {isProgress(w) && (
                      <span className="rounded border border-accent/50 px-1 text-[9px] font-bold uppercase tracking-wider text-accent">Now</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Detail for the focused week */}
          <div className="mx-4 mb-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface-2 px-3 py-2.5">
            <div className="min-w-0 text-xs">
              <p className="font-medium text-ink">
                {isProgress(focused) ? "This week so far" : `Week of ${focused.label}`}
                {focused.status === "live" && <span className="ml-1.5 text-accent">· latest full week</span>}
                {isProgress(focused) && <span className="ml-1.5 text-accent">· in progress</span>}
                {focused.key === selectedKey && focused.status !== "live" && <span className="ml-1.5 text-watch">· viewing</span>}
              </p>
              <p className="mt-0.5 text-faint">
                {building?.key === focused.key
                  ? `Reading ${isProgress(focused) ? "this week's" : "that week's"} news with Gemini Flash… ${elapsed}s (usually about a minute)`
                  : focused.status === "progress-missing"
                    ? "See what's been announced since Monday. The full brief still arrives Monday 07:00 IST."
                    : focused.status === "missing"
                      ? "Not built yet. Searches Google News for that week and runs Gemini Flash on every article."
                      : `${focused.deals ?? "?"} deals${isProgress(focused) ? " so far" : ""}${focused.usdM ? ` · ≈${formatUsdM(focused.usdM)} disclosed` : ""}${focused.generated ? ` · ${isProgress(focused) ? "updated" : "built"} ${focused.generated}` : ""}`}
              </p>
              {error && <p className="mt-1 text-bad">{error}</p>}
            </div>
            <button
              type="button"
              onClick={() => activate(focused)}
              disabled={!!building || (focused.key === selectedKey && !isMissing(focused) && focused.status !== "progress")}
              className="shrink-0 rounded-md bg-accent-strong px-3 py-1.5 text-xs font-medium text-on-accent transition hover:opacity-90 disabled:opacity-40"
            >
              {building?.key === focused.key
                ? "Building…"
                : focused.status === "progress-missing"
                  ? "Build week to date"
                  : focused.status === "missing"
                    ? "Build this week"
                    : focused.status === "progress"
                      ? focused.key === selectedKey
                        ? "Update now"
                        : "View this week so far"
                      : focused.key === selectedKey
                        ? "Currently viewing"
                        : focused.status === "live"
                          ? "Back to latest week"
                          : "Open this week"}
            </button>
          </div>

          <p className="flex flex-wrap gap-x-3 border-t border-line px-4 py-2 text-[10px] text-faint">
            <span><kbd className="font-sans">← →</kbd> move</span>
            <span><kbd className="font-sans">Enter</kbd> open / build</span>
            <span><kbd className="font-sans">Esc</kbd> close</span>
            <span>Click a week to open it · dashed weeks need building first</span>
          </p>
        </div>
      )}
    </div>
  );
}

/** Strip shown on every tab while an archived week is selected. */
export function ArchiveBar({ label, built }: { label: string; built: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="border-b border-watch/30 bg-watch-soft">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-xs sm:px-6">
        <p className="text-watch">
          <span className="font-semibold">Viewing archive:</span> week of {label}
          <span className="text-watch/80"> · built {built} · alerts and ranking use your current mandate</span>
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setWeekCookie(null);
            startTransition(() => router.refresh());
          }}
          className="rounded border border-watch/40 px-2 py-0.5 font-medium text-watch hover:bg-watch/10 disabled:opacity-50"
        >
          {pending ? "Loading…" : "Back to latest week →"}
        </button>
      </div>
    </div>
  );
}

/** Strip shown on every tab while viewing this week so far. */
export function ProgressBar({ weekKey, updated }: { weekKey: string; updated: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function update() {
    setBusy(true);
    setError(null);
    try {
      await buildWeek(weekKey);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border-b border-accent/30 bg-accent-soft">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-1.5 text-xs sm:px-6">
        <p className="text-accent">
          <span className="font-semibold">This week so far</span>
          <span className="text-muted"> · Monday to {updated} · partial week, so no week-over-week comparison · full brief Monday 07:00 IST</span>
          {error && <span className="ml-2 text-bad">{error}</span>}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={update}
            disabled={busy || pending}
            className="rounded border border-accent/50 px-2 py-0.5 font-medium text-accent hover:bg-accent/10 disabled:opacity-50"
          >
            {busy ? "Updating… (~1 min)" : "Update now"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setWeekCookie(null);
              startTransition(() => router.refresh());
            }}
            className="rounded px-2 py-0.5 font-medium text-muted hover:text-ink disabled:opacity-50"
          >
            Back to last full week →
          </button>
        </div>
      </div>
    </div>
  );
}
