"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

const STEPS = [
  { at: 0, label: "Fetching this week's funding news…" },
  { at: 4, label: "Gemini Flash is reading each article…" },
  { at: 40, label: "Finding patterns across the week…" },
  { at: 70, label: "Almost there…" },
];

export default function RefreshButton({ variant = "default" }: { variant?: "default" | "primary" }) {
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
          : { kind: "ok", text: `Updated: ${data.digest?.deals?.length ?? 0} deals found.` }
      );
      startTransition(() => router.refresh());
    } catch (err) {
      setMessage({
        kind: "warn",
        text: err instanceof Error ? `${err.message}. The digest below is unchanged.` : "Refresh failed.",
      });
    } finally {
      setRunning(false);
    }
  }

  const step = [...STEPS].reverse().find((s) => elapsed >= s.at)!;

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        onClick={refresh}
        disabled={running}
        className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition disabled:cursor-wait ${
          variant === "primary"
            ? "bg-accent text-white hover:opacity-90 dark:text-[#0e1014]"
            : "border border-line bg-surface hover:bg-surface-2"
        }`}
      >
        <svg
          aria-hidden
          viewBox="0 0 16 16"
          className={`h-3.5 w-3.5 fill-none stroke-current stroke-[1.75] ${running ? "animate-spin" : ""}`}
        >
          <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3h-3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {running ? `Refreshing… ${elapsed}s` : "Refresh digest"}
      </button>
      <p className="min-h-4 text-xs" role="status" aria-live="polite">
        {running && <span className="text-muted">{step.label} Usually takes about a minute.</span>}
        {!running && message && (
          <span className={message.kind === "ok" ? "text-good" : "text-warn"}>{message.text}</span>
        )}
      </p>
    </div>
  );
}
