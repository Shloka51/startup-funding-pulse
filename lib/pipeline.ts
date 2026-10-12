import "server-only";
import { saveDigest } from "@/lib/cache";
import { getConfig } from "@/lib/config";
import { analyzeWeek } from "@/lib/gemini/analyze";
import { geminiModel, getGemini, mapPool } from "@/lib/gemini/client";
import { extractDeal } from "@/lib/gemini/extract";
import { mergeDeals } from "@/lib/merge";
import { fetchWeeklyNews } from "@/lib/news";
import { matchConfig, rankDeals } from "@/lib/rank";
import type { AppConfig, Deal, Digest, ExtractedDeal, RawItem } from "@/lib/types";
import { findWatchlistMatch } from "@/lib/watchlist";

/** Upper bound on Gemini calls per run (one per article). */
const MAX_ARTICLES = 120;
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
export async function runPipeline(): Promise<Digest> {
  const started = Date.now();
  const { config } = await getConfig();
  const notes: string[] = [];

  // 1. Live news.
  const news = await fetchWeeklyNews(config);
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

  // 4. Gemini Flash: one pass over the whole week for patterns + consistent sectors/stages.
  let patterns: Digest["patterns"] = [];
  try {
    const analysis = await analyzeWeek(merged, config);
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
  } catch (err) {
    console.error("[pipeline] week analysis failed:", err);
    patterns = null;
    notes.push("Pattern analysis was unavailable for this run.");
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
    generatedAt: new Date().toISOString(),
    model: geminiModel(),
    config,
    deals,
    patterns,
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
