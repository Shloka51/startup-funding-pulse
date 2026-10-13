import { XMLParser } from "fast-xml-parser";
import type { AppConfig, RawItem } from "@/lib/types";
import type { NewsSource, SourceResult } from "@/lib/news/types";

const BASE = "https://news.google.com/rss/search";
const TIMEOUT_MS = 8000;
const MAX_SECTOR_QUERIES = 8;

/** Broad queries that catch most Indian funding announcements across all outlets. */
const BASE_QUERIES = [
  "startup raises funding India",
  "Indian startup funding round",
  "raises Series A India",
  "raises seed funding India",
  "funding round led by India startup",
  "crore funding startup",
];

/**
 * Targeted queries for the channels where announcements appear (per the brief: startup media,
 * press releases, financial newswires, investor/founder LinkedIn posts). All go through Google
 * News search; LinkedIn content is only what Google News itself indexes (headlines, no scraping).
 */
const CHANNEL_QUERIES = [
  "site:entrackr.com raises", // startup media
  "site:inc42.com raises funding",
  "site:yourstory.com raises",
  "site:vccircle.com raises",
  "site:prnewswire.com India raises funding", // press releases
  "site:economictimes.indiatimes.com startup raises", // financial press / newswires
  "site:business-standard.com startup funding",
  "site:linkedin.com startup raises funding India", // investor & founder posts
];

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function buildQueries(config: AppConfig): string[] {
  const sectorQueries = config.targetSectors
    .slice(0, MAX_SECTOR_QUERIES)
    .map((sector) => `${sector} startup funding India`);
  return [...BASE_QUERIES, ...CHANNEL_QUERIES, ...sectorQueries];
}

function feedUrl(query: string, range?: { after: string; before: string }) {
  const when = range ? `after:${range.after} before:${range.before}` : "when:7d";
  const params = new URLSearchParams({ q: `${query} ${when}`, hl: "en-IN", gl: "IN", ceid: "IN:en" });
  return `${BASE}?${params}`;
}

function stripHtml(html: string) {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function text(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value && typeof value === "object" && "#text" in value) return String((value as { "#text": unknown })["#text"]);
  return "";
}

function parseFeed(xml: string, query: string): RawItem[] {
  const doc = parser.parse(xml);
  const rawItems = doc?.rss?.channel?.item;
  const list: unknown[] = Array.isArray(rawItems) ? rawItems : rawItems ? [rawItems] : [];

  const items: RawItem[] = [];
  for (const entry of list) {
    const it = entry as Record<string, unknown>;
    const source = text(it.source).trim() || "Unknown";
    // Google News titles end with " - <Source>"; drop that suffix.
    // NFKC turns styled unicode (𝐑𝐚𝐢𝐬𝐞𝐬, common in LinkedIn posts) into plain letters.
    let title = text(it.title).normalize("NFKC").trim();
    if (title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3)).trim();

    const url = text(it.link).trim();
    const date = new Date(text(it.pubDate));
    if (!title || !url || Number.isNaN(date.getTime())) continue; // malformed entry — skip

    let snippet = stripHtml(text(it.description)).normalize("NFKC");
    if (snippet.endsWith(source)) snippet = snippet.slice(0, -source.length).trim();
    if (!snippet || snippet === title) snippet = "";

    items.push({
      id: text(it.guid) || url,
      title,
      snippet,
      url,
      source,
      publishedDate: date.toISOString(),
      query,
    });
  }
  return items;
}

async function fetchQuery(query: string, range?: { after: string; before: string }) {
  const res = await fetch(feedUrl(query, range), {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; StartupFundingPulse/1.0)" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return parseFeed(await res.text(), query);
}

/** Keyless live source: Google News RSS search, scoped to India and the last 7 days (or an archive window). */
export const googleNewsRss: NewsSource = {
  name: "Google News",
  async fetch(config, range): Promise<SourceResult[]> {
    const queries = buildQueries(config);
    const settled = await Promise.allSettled(queries.map((q) => fetchQuery(q, range)));
    return settled.map((r, i) =>
      r.status === "fulfilled"
        ? { query: queries[i], ok: true, items: r.value }
        : {
            query: queries[i],
            ok: false,
            items: [],
            error: r.reason instanceof Error ? r.reason.message : "Fetch failed",
          }
    );
  },
};
