import type { AppConfig, Deal, ExtractedDeal, Tier } from "@/lib/types";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+]+/g, " ").trim();

function hasWord(haystack: string, needle: string) {
  const n = norm(needle);
  if (!n) return false;
  return new RegExp(`(^| )${n.replace(/[+]/g, "\\+")}( |$)`).test(norm(haystack));
}

/** "Fintech" matches sector "Fintech" or sub-sector "fintech infrastructure"; "AI" won't match "retail". */
export function sectorMatches(deal: ExtractedDeal, focusSectors: string[]) {
  return focusSectors.some((f) => norm(deal.sector) === norm(f) || hasWord(deal.sector, f) || hasWord(deal.subSector, f));
}

function canonicalStage(s: string) {
  const n = norm(s);
  if (/^series [d-z]\b/.test(n) || n === "series d+") return "series d+";
  if (n === "preseed" || n === "pre seed") return "pre seed";
  if (n === "pre series a" || n === "pre series-a") return "pre series a";
  return n;
}

export function stageMatches(deal: ExtractedDeal, focusStages: string[]) {
  const s = canonicalStage(deal.stage);
  return focusStages.some((f) => canonicalStage(f) === s);
}

/** Tier 1: focus sector AND focus stage. Tier 2: either. Tier 3: the rest. */
export function tierFor(sectorMatch: boolean, stageMatch: boolean): Tier {
  return sectorMatch && stageMatch ? 1 : sectorMatch || stageMatch ? 2 : 3;
}

/** Sort by tier, then biggest disclosed round, then most recent. */
export function rankDeals(deals: Deal[]): Deal[] {
  return [...deals].sort(
    (a, b) =>
      a.tier - b.tier ||
      (b.amountUsdM ?? -1) - (a.amountUsdM ?? -1) ||
      b.date.localeCompare(a.date) ||
      a.company.localeCompare(b.company)
  );
}

export function matchConfig(deal: ExtractedDeal, config: AppConfig) {
  const sectorMatch = sectorMatches(deal, config.targetSectors);
  const stageMatch = stageMatches(deal, config.targetStages);
  return { sectorMatch, stageMatch, tier: tierFor(sectorMatch, stageMatch) };
}

/**
 * Re-apply ranking + watchlist flags with the *current* settings. This is plain
 * code (no AI), so Settings changes show up instantly on a cached digest.
 */
export function applyConfig<T extends Deal>(deals: T[], config: AppConfig, findWatch: (d: T, w: string[]) => string | null): T[] {
  return rankDeals(
    deals.map((d) => ({ ...d, ...matchConfig(d, config), watchlistMatch: findWatch(d, config.watchlist) }))
  ) as T[];
}
