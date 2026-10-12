import "server-only";
import { getWeekWindow } from "@/lib/dates";
import { dedupeItems, isLikelyFundingNews } from "@/lib/news/filter";
import { googleNewsRss } from "@/lib/news/rss";
import type { NewsSource } from "@/lib/news/types";
import type { AppConfig, FetchReport, QueryStatus, RawItem } from "@/lib/types";

/** Live news providers. Add new ones here (see lib/news/types.ts). */
const SOURCES: NewsSource[] = [googleNewsRss];

/**
 * Fetch the previous 7 days of Indian startup funding news from every enabled
 * source, keep only funding-related items, and de-duplicate. Never throws —
 * per-query failures are reported in `queries`.
 */
export async function fetchWeeklyNews(config: AppConfig, now = new Date()): Promise<FetchReport> {
  const window = getWeekWindow(now);
  const active = SOURCES.filter((s) => !s.enabled || s.enabled());

  const perSource = await Promise.all(
    active.map(async (source) => {
      try {
        return { source: source.name, results: await source.fetch(config) };
      } catch (err) {
        const error = err instanceof Error ? err.message : "Source failed";
        return { source: source.name, results: [{ query: "(all)", ok: false, items: [], error }] };
      }
    })
  );

  const queries: QueryStatus[] = [];
  const all: RawItem[] = [];
  for (const { source, results } of perSource) {
    for (const r of results) {
      queries.push({ source, query: r.query, ok: r.ok, count: r.items.length, error: r.error });
      all.push(...r.items);
    }
  }

  const inWindow = all.filter((item) => {
    const t = new Date(item.publishedDate).getTime();
    return t >= window.start.getTime() && t <= window.end.getTime() + 60 * 60 * 1000;
  });
  const funding = inWindow.filter(isLikelyFundingNews);
  const items = dedupeItems(funding).sort((a, b) => b.publishedDate.localeCompare(a.publishedDate));

  return {
    items,
    queries,
    window: { start: window.start.toISOString(), end: window.end.toISOString() },
    fetchedAt: new Date().toISOString(),
    stats: { fetched: all.length, inWindow: inWindow.length, fundingRelated: funding.length, afterDedupe: items.length },
  };
}
