import type { AppConfig, RawItem } from "@/lib/types";

export interface SourceResult {
  query: string;
  ok: boolean;
  items: RawItem[];
  error?: string;
}

/**
 * A live news provider. To add one (e.g. a paid news API), implement this
 * interface in lib/news/<name>.ts, read its key from process.env, and add it to
 * SOURCES in lib/news/index.ts. Each source must never throw: report failures
 * per query via `ok: false` instead.
 */
export interface NewsSource {
  name: string;
  /** Return false to skip this source (e.g. its API key isn't set). */
  enabled?: () => boolean;
  /** `range` limits results to an archive window (YYYY-MM-DD); omitted = the last 7 days. */
  fetch(config: AppConfig, range?: { after: string; before: string }): Promise<SourceResult[]>;
}
