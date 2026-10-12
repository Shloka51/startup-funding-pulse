"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

const STEPS = [
  { at: 0, label: "Fetching this week's funding news" },
  { at: 4, label: "Gemini Flash is reading each article" },
  { at: 40, label: "Analysing patterns and writing the brief" },
  { at: 70, label: "Almost there" },
];

/** Re-runs the full pipeline (POST /api/digest), then refreshes the page data. */
export default function RefreshButton({ compact = false, primary = false }: { compact?: boolean; primary?: boolean }) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [message, setMessage] = useState<{ kind: "ok" | "warn"; text: string } | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!running) return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(t);
  }, [running]);

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 8000);
    return () => clearTimeout(t);
  }, [message]);

  async function refresh() {
    setRunning(true);
    setElapsed(0);
    setMessage(null);
    try {
      const res = await fetch("/api/digest", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) throw new Error(`Refresh failed (${res.status})`);
      setMessage(
        data.warning
          ? { kind: "warn", text: data.warning }
          : { kind: "ok", text: `Updated: ${data.digest?.deals?.length ?? 0} deals.` }
      );
      startTransition(() => router.refresh());
    } catch (err) {
      setMessage({ kind: "warn", text: `${err instanceof Error ? err.message : "Refresh failed"}. Data unchanged.` });
    } finally {
      setRunning(false);
    }
  }

  const step = [...STEPS].reverse().find((s) => elapsed >= s.at)!;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={refresh}
        disabled={running}
        title="Re-run the live pipeline (about a minute)"
        className={`inline-flex items-center gap-1.5 rounded-md text-xs font-medium transition disabled:cursor-wait ${
          primary
            ? "bg-accent-strong px-3.5 py-2 text-sm text-on-accent hover:opacity-90"
            : "h-8 border border-line px-2.5 text-muted hover:bg-surface-2 hover:text-ink"
        }`}
      >
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className={`h-3.5 w-3.5 fill-none stroke-current stroke-[1.75] ${running ? "animate-spin" : ""}`}
        >
          <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className={compact ? "hidden sm:inline" : ""}>{running ? `Refreshing ${elapsed}s` : primary ? "Generate this week's brief" : "Refresh"}</span>
      </button>
      <div role="status" aria-live="polite">
        {(running || message) && (
          <p
            className={`absolute right-0 top-full z-40 mt-2 w-64 rounded-md border border-line bg-surface p-2.5 text-xs shadow-xl ${
              running ? "text-muted" : message?.kind === "ok" ? "text-good" : "text-warn"
            } ${primary ? "left-1/2 right-auto -translate-x-1/2" : ""}`}
          >
            {running ? `${step.label}… usually about a minute.` : message?.text}
          </p>
        )}
      </div>
    </div>
  );
}
