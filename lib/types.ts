/** Aarav's editable preferences. Stored in Supabase `app_config`, or config/default-config.json as fallback. */
export interface AppConfig {
  targetSectors: string[];
  targetStages: string[];
  watchlist: string[];
}

/** Where the active config was loaded from. */
export type ConfigSource = "supabase" | "file";

export interface LoadedConfig {
  config: AppConfig;
  source: ConfigSource;
  /** Set when Supabase was configured but could not be reached. */
  warning?: string;
}

/** One news article as fetched, before any AI processing. */
export interface RawItem {
  id: string;
  title: string;
  snippet: string;
  url: string;
  source: string;
  /** ISO timestamp */
  publishedDate: string;
  /** Which search query surfaced it (first one, after de-duplication). */
  query: string;
}

export interface QueryStatus {
  source: string;
  query: string;
  ok: boolean;
  count: number;
  error?: string;
}

export interface FetchReport {
  items: RawItem[];
  queries: QueryStatus[];
  window: { start: string; end: string };
  fetchedAt: string;
  stats: { fetched: number; inWindow: number; fundingRelated: number; afterDedupe: number };
}

/** Canonical funding stages Gemini must choose from. */
export const STAGES = [
  "Pre-seed",
  "Seed",
  "Pre-Series A",
  "Series A",
  "Series B",
  "Series C",
  "Series D+",
  "Bridge",
  "Debt",
  "Undisclosed",
] as const;
export type Stage = (typeof STAGES)[number];

/** One deal as extracted by Gemini from a single article. */
export interface ExtractedDeal {
  company: string;
  sector: string;
  subSector: string;
  stage: Stage;
  /** Human-readable, as reported, e.g. "₹142 crore (~$17M)" or "Undisclosed". */
  amount: string;
  /** Best-effort USD value in millions, for sorting. null if undisclosed. */
  amountUsdM: number | null;
  leadInvestor: string;
  otherInvestors: string[];
  city: string;
  /** ISO date (YYYY-MM-DD) of the announcement. */
  date: string;
  oneLineSummary: string;
  sourceUrl: string;
  sourceName: string;
  headline: string;
}

export type Tier = 1 | 2 | 3;

/** A deal after ranking + watchlist flagging — what the UI renders. */
export interface Deal extends ExtractedDeal {
  id: string;
  tier: Tier;
  sectorMatch: boolean;
  stageMatch: boolean;
  /** The watchlist name that matched, if any. */
  watchlistMatch: string | null;
  /** Other outlets that covered the same deal. */
  alsoReportedBy: { name: string; url: string }[];
}

export interface Pattern {
  title: string;
  detail: string;
  companies: string[];
}

export interface Digest {
  window: { start: string; end: string };
  generatedAt: string;
  model: string;
  config: AppConfig;
  deals: Deal[];
  /** null when the pattern-analysis call failed. */
  patterns: Pattern[] | null;
  stats: {
    articles: number;
    extracted: number;
    notFunding: number;
    failed: number;
    queriesOk: number;
    queriesTotal: number;
  };
  /** Human-readable notes about partial failures during this run. */
  notes: string[];
}
