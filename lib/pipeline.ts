import "server-only";
import { getLatestDigest, saveDigest } from "@/lib/cache";
import { getConfig } from "@/lib/config";
import { analyzeWeek, type PreviousWeekContext } from "@/lib/gemini/analyze";
import { geminiModel, getGemini, mapPool } from "@/lib/gemini/client";
import { extractDeal } from "@/lib/gemini/extract";
import { excludePreviouslyReported, mergeDeals } from "@/lib/merge";
import { getWeekHistory, previousWeekOf } from "@/lib/history";
import { completedWeekKey, windowForKey } from "@/lib/weeks";
import { fetchWeeklyNews } from "@/lib/news";
import { investorActivity, stageBreakdown } from "@/lib/insights";
import { matchConfig, rankDeals } from "@/lib/rank";
import type { AppConfig, Deal, Digest, ExtractedDeal, RawItem } from "@/lib/types";
import { sectorBreakdown } from "@/lib/summary";
import { findWatchlistMatch } from "@/lib/watchlist";

/** Compact facts about the previous reporting week, if one is stored (for "what changed"). */
async function previousWeekContext(currentWindow: { start: string; end: string }): Promise<PreviousWeekContext | null> {
  const history = await getWeekHistory(3);
  const prev = previousWeekOf({ window: currentWindow } as Digest, history);
  if (!prev) return null;
  return {
    window: prev.window,
    deals: prev.deals.length,
    capitalUsdM: prev.deals.reduce((s, d) => s + (d.amountUsdM ?? 0), 0),
    sectors: sectorBreakdown(prev.deals, 8).map((r) => ({ sector: r.sector, deals: r.deals })),
    stages: stageBreakdown(prev.deals).filter((r) => r.deals > 0).map((r) => ({ stage: r.stage, deals: r.deals })),
    activeInvestors: investorActivity(prev.deals).slice(0, 5).map((i) => i.name),
  };
}

/** Upper bound on Gemini calls per run (one per article). */
const MAX_ARTICLES = 150;
const GEMINI_CONCURRENCY = 10;

export class PipelineError extends Error {
  constructor(public code: "news-failed" | "gemini-missing" | "gemini-failed", message: string) {
    super(message);
  }
}

/** If there are more articles than the cap, keep the ones most relevant to Aarav first. */
function prioritize(items: RawItem[], config: AppConfig): RawItem[] {
  if (items.length <= MAX_ARTICLES) return items;
  const terms = [...config.watchlist, ...config.targetSectors].map((t) => t.toLowerCase());
  const score = (i: RawItem) => (terms.some((t) => `${i.title} ${i.snippet}`.toLowerCase().includes(t)) ? 1 : 0);
  return [...items].sort((a, b) => score(b) - score(a) || b.publishedDate.localeCompare(a.publishedDate)).slice(0, MAX_ARTICLES);
}

/**
 * The full weekly pipeline:
 * config → live news → Gemini extraction (1 call per article) → merge duplicates
 * → Gemini week analysis (1 call) → rank + watchlist flags → cache.
 * Throws PipelineError only when there's nothing meaningful to show; callers fall back to the cache.
 */
export interface PipelineOptions {
  /** Defaults to the latest full Monday–Monday week (what the Monday cron builds). */
  window?: { start: string; end: string };
  /** "live" (latest full week), "archive" (older full week) or "wtd" (week in progress). */
  kind?: "live" | "archive" | "wtd";
}

export async function runPipeline(opts: PipelineOptions = {}): Promise<Digest> {
  const kind = opts.kind ?? (opts.window ? "archive" : "live");
  const window = opts.window ?? windowForKey(completedWeekKey());
  const started = Date.now();
  const { config } = await getConfig();
  const notes: string[] = [];

  // 1. Live news.
  const news = await fetchWeeklyNews(config, { window });
  const queriesOk = news.queries.filter((q) => q.ok).length;
  if (queriesOk === 0) {
    throw new PipelineError("news-failed", "Couldn't reach the live news source.");
  }
  if (queriesOk < news.queries.length) {
    notes.push(`${news.queries.length - queriesOk} of ${news.queries.length} news searches failed; results may be incomplete.`);
  }

  if (!getGemini()) throw new PipelineError("gemini-missing", "GEMINI_API_KEY is not configured.");

  // 2. Gemini Flash: one structured-extraction call per article.
  const articles = prioritize(news.items, config);
  if (articles.length < news.items.length) {
    notes.push(`Analysed the ${articles.length} most relevant of ${news.items.length} articles.`);
  }
  const results = await mapPool(articles, GEMINI_CONCURRENCY, (item) => extractDeal(item, config));

  const extracted: ExtractedDeal[] = [];
  let notFunding = 0;
  let failed = 0;
  for (const r of results) {
    if (r.kind === "deal") extracted.push(r.deal);
    else if (r.kind === "not-funding") notFunding++;
    else failed++;
  }
  if (articles.length > 0 && failed === articles.length) {
    const reason = results.find((r) => r.kind === "failed");
    throw new PipelineError("gemini-failed", `Gemini couldn't process any articles (${reason && "reason" in reason ? reason.reason : "unknown"}).`);
  }
  if (failed > 0) notes.push(`${failed} article${failed === 1 ? "" : "s"} couldn't be parsed and ${failed === 1 ? "was" : "were"} skipped.`);

  // 3. Same company reported by several outlets → one deal.
  let merged = mergeDeals(extracted);

  // 3b. Follow-up coverage: drop rounds the previous full week's brief already reported.
  //     Week-to-date compares with the latest full week; full weeks with the week before them.
  const priorDigest =
    kind === "wtd"
      ? await getLatestDigest()
      : previousWeekOf({ window: news.window } as Digest, await getWeekHistory(3).catch(() => []));
  if (priorDigest) {
    const { kept, dropped } = excludePreviouslyReported(merged, priorDigest.deals);
    if (dropped.length) {
      merged = kept;
      notes.push(
        `${dropped.length} round${dropped.length === 1 ? " was" : "s were"} already in the previous week's brief and excluded as follow-up coverage: ${dropped
          .map((d) => d.company)
          .join(", ")}.`
      );
    }
  }

  // 4. Gemini Flash: one pass over the whole week for patterns + consistent sectors/stages.
  let patterns: Digest["patterns"] = [];
  let brief: Digest["brief"] = null;
  try {
    // A part-week isn't compared with a full week: that would make every metric look like a drop.
    const previous = kind === "wtd" ? null : await previousWeekContext(news.window).catch(() => null);
    const partialDays = kind === "wtd" ? Math.max(1, Math.ceil((Date.parse(window.end) - Date.parse(window.start)) / 86_400_000)) : null;
    const analysis = await analyzeWeek(merged, config, previous, partialDays);
    analysis.normalized.forEach((n, i) => {
      merged[i].sector = n.sector;
      merged[i].stage = n.stage;
    });
    // Gemini spotted the same round under two names (e.g. brand vs parent company) → merge.
    const renamed = merged.map((d, i) => {
      const target = analysis.normalized.get(i)?.sameAs;
      return target !== null && target !== undefined ? { ...d, company: merged[target].company } : d;
    });
    if (renamed.some((d, i) => d.company !== merged[i].company)) merged = mergeDeals(renamed);
    patterns = analysis.patterns;
    brief = analysis.brief;
    if (!brief) notes.push("The AI weekly brief was unavailable for this run.");
  } catch (err) {
    console.error("[pipeline] week analysis failed:", err);
    patterns = null;
    notes.push("Pattern analysis and the AI brief were unavailable for this run.");
  }

  // 5. Rank by focus sector/stage and flag watchlist companies.
  const deals: Deal[] = rankDeals(
    merged.map((d, i) => ({
      ...d,
      id: `${d.date}-${i}-${d.company.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      ...matchConfig(d, config),
      watchlistMatch: findWatchlistMatch(d, config.watchlist),
    }))
  );

  const digest: Digest = {
    window: news.window,
    kind,
    summary: { deals: deals.length, usdM: deals.reduce((s, d) => s + (d.amountUsdM ?? 0), 0) },
    generatedAt: new Date().toISOString(),
    model: geminiModel(),
    config,
    deals,
    patterns,
    brief,
    stats: {
      articles: articles.length,
      extracted: extracted.length,
      notFunding,
      failed,
      queriesOk,
      queriesTotal: news.queries.length,
    },
    notes,
  };

  // 6. Cache it. A failed save shouldn't hide a good digest.
  try {
    await saveDigest(digest);
  } catch (err) {
    console.error("[pipeline] cache save failed:", err);
    digest.notes.push("This digest couldn't be saved, so it won't be available as a fallback.");
  }

  console.log(
    `[pipeline] ${deals.length} deals from ${articles.length} articles in ${((Date.now() - started) / 1000).toFixed(1)}s`
  );
  return digest;
}
