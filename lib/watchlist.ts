import type { ExtractedDeal } from "@/lib/types";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Returns the watchlist name involved in this announcement, if any — as the
 * company raising, an investor, or anywhere in the headline (e.g. "Zepto-backed…").
 * Matching is case-insensitive on whole words, so "Groww" won't match "Growwth".
 */
export function findWatchlistMatch(deal: ExtractedDeal, watchlist: string[]): string | null {
  const haystack = [deal.company, deal.headline, deal.leadInvestor, ...deal.otherInvestors].join(" \n ");
  for (const name of watchlist) {
    const n = name.trim();
    if (!n) continue;
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${escape(n)}($|[^\\p{L}\\p{N}])`, "iu");
    if (re.test(haystack)) return n;
  }
  return null;
}
