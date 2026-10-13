import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { bestPerWeek, getDigestById, listWeekIndex } from "@/lib/cache";
import { getConfig } from "@/lib/config";
import { formatRange, formatShortDate, formatTimestamp } from "@/lib/dates";
import { getDigestForPage } from "@/lib/digest";
import { freshnessOf, type Freshness } from "@/lib/freshness";
import { getWeekHistory, previousWeekOf } from "@/lib/history";
import { applyConfig } from "@/lib/rank";
import type { AppConfig, ConfigSource, Deal, Digest } from "@/lib/types";
import { findWatchlistMatch } from "@/lib/watchlist";
import { completedWeekKey, currentWeekKey, isWeekKey, recentKeys, weekKeyOf, windowForKey } from "@/lib/weeks";

export const WEEK_COOKIE = "fp_week";

export interface WeekOption {
  key: string;
  label: string;
  /** live = latest full week; stored/missing = older full weeks; progress/progress-missing = this week so far. */
  status: "live" | "stored" | "missing" | "progress" | "progress-missing";
  deals: number | null;
  usdM: number | null;
  generatedAt: string | null;
}

export interface Dashboard {
  digest: Digest | null;
  warning?: string;
  config: AppConfig;
  configSource: ConfigSource;
  /** Selected week's deals, ranked and flagged with the *current* settings. */
  deals: Deal[];
  /** One digest per stored reporting week, newest first. */
  history: Digest[];
  /** The reporting week before the selected one (ranked with current settings), or null if none is stored. */
  previousDeals: Deal[] | null;
  previousWindow: { start: string; end: string } | null;
  /** All deals from stored full weeks before the selected one (for "new investor" detection). */
  priorDeals: Deal[] | null;
  priorWeeks: number;
  freshness: Freshness | null;
  /** Week picker: latest week first, then the previous ARCHIVE_WEEKS − 1. */
  weeks: WeekOption[];
  selectedKey: string | null;
  isArchive: boolean;
  /** Viewing the week in progress (Monday → last update). */
  isPartial: boolean;
  /** Week-to-date summary for the Overview strip, when the week in progress isn't the one selected. */
  weekToDate: WeekOption | null;
}

function weekLabel(key: string, window?: { start: string; end: string }) {
  const w = window ?? windowForKey(key);
  return formatRange(w.start, w.end);
}

/** Everything a page needs, loaded once per request (layout + page share it). Never throws. */
export const getDashboard = cache(async (): Promise<Dashboard> => {
  const [{ digest: latest, warning }, { config, source }, index, jar] = await Promise.all([
    getDigestForPage(),
    getConfig(),
    listWeekIndex(),
    cookies(),
  ]);
  const empty = {
    config,
    configSource: source,
    deals: [],
    history: [],
    previousDeals: null,
    previousWindow: null,
    priorDeals: null,
    priorWeeks: 0,
    freshness: null,
    weeks: [],
    selectedKey: null,
    isArchive: false,
    isPartial: false,
    weekToDate: null,
  };
  if (!latest) return { digest: null, warning, ...empty };

  // Week picker. Per week key keep the best stored digest: a full week beats a week-to-date
  // snapshot, then newest first.
  const latestKey = weekKeyOf(latest.window.start);
  const nowKey = currentWeekKey();
  const byKey = new Map(bestPerWeek(index, { includeWtd: true }).filter((b) => b.key !== latestKey).map((b) => [b.key, b.row]));
  const wtdRow = byKey.get(nowKey);
  const showProgress = nowKey > latestKey; // the week in progress isn't covered by a full brief yet

  const progressOption: WeekOption | null = showProgress
    ? {
        key: nowKey,
        label: `${formatShortDate(windowForKey(nowKey).start)} – so far`,
        status: wtdRow?.kind === "wtd" ? "progress" : "progress-missing",
        deals: wtdRow?.summary?.deals ?? null,
        usdM: wtdRow?.summary?.usdM ?? null,
        generatedAt: wtdRow?.generatedAt ?? null,
      }
    : null;

  const fullWeeks: WeekOption[] = recentKeys(latestKey, showProgress ? 7 : 8).map((key) => {
    if (key === latestKey) {
      return {
        key,
        label: weekLabel(key, latest.window),
        status: "live",
        deals: latest.deals.length,
        usdM: latest.deals.reduce((s, d) => s + (d.amountUsdM ?? 0), 0),
        generatedAt: latest.generatedAt,
      };
    }
    const row = byKey.get(key);
    const full = row && row.kind !== "wtd" ? row : undefined;
    return {
      key,
      label: full?.kind === "archive" || !full ? weekLabel(key) : weekLabel(key, full.window),
      status: full ? "stored" : "missing",
      deals: full?.summary?.deals ?? null,
      usdM: full?.summary?.usdM ?? null,
      generatedAt: full?.generatedAt ?? null,
    };
  });
  const weeks = progressOption ? [progressOption, ...fullWeeks] : fullWeeks;

  // Selected week (session cookie). Falls back to the latest full week if it isn't stored.
  const wanted = jar.get(WEEK_COOKIE)?.value;
  let digest = latest;
  let selectedKey = latestKey;
  let isArchive = false;
  let isPartial = false;
  const option = weeks.find((w) => w.key === wanted);
  if (isWeekKey(wanted) && wanted !== latestKey && byKey.has(wanted) && option && (option.status === "stored" || option.status === "progress")) {
    const picked = await getDigestById(byKey.get(wanted)!.id);
    if (picked) {
      digest = picked;
      selectedKey = wanted;
      isPartial = picked.kind === "wtd";
      isArchive = !isPartial;
    }
  }

  const deals = applyConfig(digest.deals, config, findWatchlistMatch);
  const history = await getWeekHistory(8);
  // No comparison for a part-week; it would make every metric look like a drop.
  const previous = isPartial ? null : previousWeekOf(digest, history);

  const earlier = history.filter((h) => weekKeyOf(h.window.start) < selectedKey);
  const priorDeals = earlier.length ? earlier.flatMap((h) => applyConfig(h.deals, config, findWatchlistMatch)) : null;

  const behind = latestKey < completedWeekKey();
  const freshness: Freshness = isPartial
    ? { level: "progress", label: "In progress", detail: `Monday to ${formatTimestamp(digest.generatedAt)}; the full brief arrives Monday 07:00 IST` }
    : isArchive
      ? { level: "archive", label: "Archive", detail: `Built ${formatTimestamp(digest.generatedAt)} from news search for that week` }
      : warning
        ? freshnessOf(digest.generatedAt, warning)
        : behind
          ? { level: "stale", label: "Stale", detail: "A newer week has ended but isn't built yet; it builds on the next visit or Refresh" }
          : { level: "fresh", label: "Up to date", detail: "Covers the latest full week; next brief Monday 07:00 IST" };

  return {
    digest,
    warning: isArchive || isPartial ? undefined : warning,
    config,
    configSource: source,
    deals,
    history: isArchive ? history.filter((h) => new Date(h.window.end) <= new Date(digest.window.end)) : history,
    previousDeals: previous ? applyConfig(previous.deals, config, findWatchlistMatch) : null,
    previousWindow: previous?.window ?? null,
    priorDeals,
    priorWeeks: earlier.length,
    freshness,
    weeks,
    selectedKey,
    isArchive,
    isPartial,
    weekToDate: !isPartial ? progressOption : null,
  };
});
