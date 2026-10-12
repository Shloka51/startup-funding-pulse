import "server-only";
import { cache } from "react";
import { getConfig } from "@/lib/config";
import { getDigestForPage } from "@/lib/digest";
import { freshnessOf, type Freshness } from "@/lib/freshness";
import { getWeekHistory, previousWeekOf } from "@/lib/history";
import { applyConfig } from "@/lib/rank";
import type { AppConfig, ConfigSource, Deal, Digest } from "@/lib/types";
import { findWatchlistMatch } from "@/lib/watchlist";

export interface Dashboard {
  digest: Digest | null;
  warning?: string;
  config: AppConfig;
  configSource: ConfigSource;
  /** Current week's deals, ranked and flagged with the *current* settings. */
  deals: Deal[];
  /** One digest per stored reporting week, newest first. */
  history: Digest[];
  /** Previous reporting week's deals (ranked with current settings), or null if none is stored. */
  previousDeals: Deal[] | null;
  previousWindow: { start: string; end: string } | null;
  freshness: Freshness | null;
}

/** Everything a page needs, loaded once per request (layout + page share it). Never throws. */
export const getDashboard = cache(async (): Promise<Dashboard> => {
  const [{ digest, warning }, { config, source }] = await Promise.all([getDigestForPage(), getConfig()]);
  if (!digest) {
    return { digest: null, warning, config, configSource: source, deals: [], history: [], previousDeals: null, previousWindow: null, freshness: null };
  }

  const deals = applyConfig(digest.deals, config, findWatchlistMatch);
  const history = await getWeekHistory(8);
  const previous = previousWeekOf(digest, history);

  return {
    digest,
    warning,
    config,
    configSource: source,
    deals,
    history,
    previousDeals: previous ? applyConfig(previous.deals, config, findWatchlistMatch) : null,
    previousWindow: previous?.window ?? null,
    freshness: freshnessOf(digest.generatedAt, warning),
  };
});
