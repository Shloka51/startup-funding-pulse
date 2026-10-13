import type { ExtractedDeal } from "@/lib/types";

const SUFFIXES = /\b(private|pvt|limited|ltd|inc|llp|technologies|technology|tech|labs|india|solutions|ventures)\b/g;

function companyKey(name: string) {
  return name.toLowerCase().replace(SUFFIXES, "").replace(/[^a-z0-9]/g, "");
}

function sameCompany(a: string, b: string) {
  if (!a || !b) return false;
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  return short.length >= 5 && long.startsWith(short);
}

/** How much useful detail a deal has — used to pick the best of several reports. */
function richness(d: ExtractedDeal) {
  return (
    (d.amountUsdM !== null ? 4 : 0) +
    (d.leadInvestor !== "Undisclosed" ? 3 : 0) +
    (d.stage !== "Undisclosed" ? 2 : 0) +
    (d.city ? 1 : 0) +
    d.otherInvestors.length * 0.1
  );
}

export interface MergedDeal extends ExtractedDeal {
  alsoReportedBy: { name: string; url: string }[];
}

type MergeInput = ExtractedDeal & { alsoReportedBy?: MergedDeal["alsoReportedBy"] };

/** Collapse multiple articles about the same company's round into one deal. */
export function mergeDeals(deals: MergeInput[]): MergedDeal[] {
  const groups: { key: string; items: MergeInput[] }[] = [];
  for (const d of deals) {
    const key = companyKey(d.company);
    const group = groups.find((g) => sameCompany(g.key, key));
    if (group) group.items.push(d);
    else groups.push({ key, items: [d] });
  }

  return groups.map(({ items }) => {
    const best = [...items].sort((a, b) => richness(b) - richness(a))[0];
    const others = items.filter((d) => d !== best);
    const seen = new Set([best.sourceUrl]);
    const alsoReportedBy = [
      ...items.flatMap((d) => d.alsoReportedBy ?? []),
      ...others.map((d) => ({ name: d.sourceName, url: d.sourceUrl })),
    ].filter((s) => !seen.has(s.url) && seen.add(s.url));
    const investors = [...new Set([...best.otherInvestors, ...others.flatMap((d) => d.otherInvestors)])].filter(
      (i) => i.toLowerCase() !== best.leadInvestor.toLowerCase()
    );
    const earliest = items.map((d) => d.date).sort()[0];
    return { ...best, date: earliest, otherInvestors: investors.slice(0, 8), alsoReportedBy: alsoReportedBy.slice(0, 6) };
  });
}

/** Same round if amounts are within ~35% of each other, or either side didn't disclose one. */
function similarAmount(a: number | null, b: number | null) {
  if (a === null || b === null) return true;
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return lo > 0 && hi / lo <= 1.35;
}

/**
 * Drop rounds already covered in an earlier brief (follow-up articles published later).
 * Matching: same company (tolerant of suffixes like "Semiconductor"/"Pvt Ltd") AND a similar amount.
 */
export function excludePreviouslyReported<T extends ExtractedDeal>(
  deals: T[],
  prior: Pick<ExtractedDeal, "company" | "amountUsdM">[]
): { kept: T[]; dropped: T[] } {
  const priorKeys = prior.map((p) => ({ key: companyKey(p.company), usd: p.amountUsdM }));
  const kept: T[] = [];
  const dropped: T[] = [];
  for (const d of deals) {
    const key = companyKey(d.company);
    const seen = priorKeys.some((p) => sameCompany(p.key, key) && similarAmount(p.usd, d.amountUsdM));
    (seen ? dropped : kept).push(d);
  }
  return { kept, dropped };
}
