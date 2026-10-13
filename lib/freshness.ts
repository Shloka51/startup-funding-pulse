export type FreshnessLevel = "fresh" | "current" | "stale" | "archive" | "progress";

export interface Freshness {
  level: FreshnessLevel;
  label: string;
  detail: string;
}

const HOUR = 60 * 60 * 1000;

function ago(ms: number) {
  const h = Math.floor(ms / HOUR);
  if (h < 1) return "less than an hour ago";
  if (h < 48) return `${h} hour${h === 1 ? "" : "s"} ago`;
  return `${Math.floor(h / 24)} days ago`;
}

/**
 * Fresh: generated in the last 24h. Current: within the weekly cycle (≤ 7 days).
 * Stale: older than a week, or the latest live refresh failed and we fell back to the cache.
 */
export function freshnessOf(generatedAt: string, fallbackWarning?: string, now = Date.now()): Freshness {
  const age = now - new Date(generatedAt).getTime();
  if (fallbackWarning) return { level: "stale", label: "Stale", detail: fallbackWarning };
  if (age <= 24 * HOUR) return { level: "fresh", label: "Fresh", detail: `Generated ${ago(age)}` };
  if (age <= 7 * 24 * HOUR) return { level: "current", label: "This week", detail: `Generated ${ago(age)}; next run Monday 07:00 IST` };
  return { level: "stale", label: "Stale", detail: `Generated ${ago(age)}; the Monday refresh may have failed` };
}
