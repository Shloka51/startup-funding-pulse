import type { RawItem } from "@/lib/types";

/** Phrases that on their own clearly describe a funding round. */
const STRONG_SIGNAL =
  /\b(funding|fundraise|series\s+[a-h]\b|pre-?series|seed round|seed funding|pre-?seed|bridge round|round led by|growth round|venture debt|in a round|investment round|financing round)\b/i;

/** Verbs that mean "got money" — only count when money/round context is nearby. */
const RAISE_VERB = /\b(raise[sd]?|raising|secures?|secured|bags?|bagged|nets?|netted|garners?|closes?|closed|lands?|gets?)\b/i;
const MONEY =
  /(\$\s?\d|₹\s?\d|\brs\.?\s?\d|\binr\s?\d|\busd\s?\d|\b\d+(\.\d+)?\s?(mn|million|bn|billion|cr|crore|lakh|k)\b|\bcapital\b|\binvestors?\b|\bround\b|\bled by\b)/i;

/** Headlines that match the words above but are rarely a startup funding round. */
const NOISE =
  /\b(layoffs?|lays off|shuts? down|ipo|listing|share price|stocks?|sensex|nifty|mutual funds?|quarterly results|q[1-4] results|net profit|fii|fpi|concerns?|questions?|eyebrows|alarm|stakes|round-?ups?|this week|weekly|week \d+|in q[1-4]|yoy)\b/i;

/** Explainers, guides and opinion posts that mention "funding" without announcing a round. */
const EXPLAINER = /\b(how to|schemes?|guide|tips|lessons|explained|vs\.?|versus|why|what|should you|everyone asks)\b/i;

export function isLikelyFundingNews(item: RawItem): boolean {
  const text = `${item.title} ${item.snippet}`;
  if (NOISE.test(item.title) || EXPLAINER.test(item.title)) return false;
  // LinkedIn posts are mostly commentary: require an explicit raise AND an amount in the headline.
  if (/linkedin/i.test(item.source)) return RAISE_VERB.test(item.title) && MONEY.test(item.title);
  return STRONG_SIGNAL.test(text) || (RAISE_VERB.test(item.title) && MONEY.test(text));
}

const STOPWORDS = new Set([
  "a", "an", "the", "in", "of", "for", "to", "and", "its", "at", "on", "by", "with", "from",
  "as", "is", "rs", "inr", "usd", "mn", "million", "cr", "crore", "india", "indian", "startup",
  "round", "funding", "raises", "raised", "led", "secures", "bags",
]);

function tokens(title: string): Set<string> {
  return new Set(
    title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOPWORDS.has(t))
  );
}

function similarity(a: Set<string>, b: Set<string>) {
  if (!a.size || !b.size) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / Math.min(a.size, b.size);
}

/**
 * Best-guess company name: the run of Capitalised words right before the
 * funding verb. "Bertelsmann India-backed Nat Habit raises…" -> ["nat","habit"].
 */
function headlineSubject(title: string): string[] | null {
  const m = title.match(/^(.*?)\s+(raises|raised|secures|secured|bags|bagged|nets|closes|lands|gets)\b/i);
  if (!m) return null;
  const words = m[1].replace(/['’]s\b/g, "").split(/\s+/);
  const run: string[] = [];
  for (let i = words.length - 1; i >= 0; i--) {
    const w = words[i].replace(/[^\p{L}\p{N}.&-]/gu, "");
    if (!w || !/^[\p{Lu}\p{N}]/u.test(w)) break;
    run.unshift(w.toLowerCase());
  }
  return run.length ? run : null;
}

/**
 * "tessolve" matches "tessolve semiconductor" (prefix) and "nat habit" matches
 * "bertelsmann india-backed nat habit" (suffix).
 */
function sameSubject(a: string[] | null, b: string[] | null) {
  if (!a || !b) return false;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  const offset = long.length - short.length;
  return short.every((w, i) => long[i] === w) || short.every((w, i) => long[offset + i] === w);
}

/**
 * Remove repeats: the same article from several queries (same URL), the same
 * story syndicated across outlets (near-identical headlines), and the same
 * company's announcement worded differently by different outlets.
 * Keeps the earliest-published copy so the date reflects the announcement.
 */
export function dedupeItems(items: RawItem[]): RawItem[] {
  const sorted = [...items].sort((a, b) => a.publishedDate.localeCompare(b.publishedDate));
  const kept: { item: RawItem; toks: Set<string>; subject: string[] | null }[] = [];
  const seenUrls = new Set<string>();

  for (const item of sorted) {
    if (seenUrls.has(item.url)) continue;
    seenUrls.add(item.url);
    const toks = tokens(item.title);
    const subject = headlineSubject(item.title);
    const dup = kept.some((k) => similarity(k.toks, toks) >= 0.75 || sameSubject(k.subject, subject));
    if (!dup) kept.push({ item, toks, subject });
  }
  return kept.map((k) => k.item);
}
