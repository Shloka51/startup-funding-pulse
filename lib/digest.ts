import "server-only";
import { after } from "next/server";
import { getLatestDigest } from "@/lib/cache";
import { PipelineError, runPipeline } from "@/lib/pipeline";
import type { Digest } from "@/lib/types";

export interface DigestResult {
  digest: Digest | null;
  /** true if this digest was generated in this request. */
  fresh: boolean;
  /** Shown as a banner when we had to fall back. */
  warning?: string;
}

function describe(err: unknown) {
  if (err instanceof PipelineError) {
    if (err.code === "news-failed") return "Live news fetch failed";
    if (err.code === "gemini-missing") return "Gemini isn't configured";
    return "Gemini couldn't process this week's news";
  }
  return "Something went wrong while generating the digest";
}

/** Run the pipeline now; on failure, fall back to the last cached digest. Never throws. */
export async function regenerateDigest(): Promise<DigestResult> {
  try {
    return { digest: await runPipeline(), fresh: true };
  } catch (err) {
    console.error("[digest] pipeline failed:", err);
    const cached = await getLatestDigest();
    return {
      digest: cached,
      fresh: false,
      warning: cached
        ? `${describe(err)}, so you're seeing the last saved digest.`
        : `${describe(err)} and there's no saved digest yet.`,
    };
  }
}

/** A cached digest older than this is rebuilt in the background on the next visit. */
const STALE_AFTER_MS = 12 * 60 * 60 * 1000;
let backgroundRun: Promise<unknown> | null = null;

/**
 * For page loads: serve the cached digest instantly. If it's stale, rebuild it in the
 * background (after the response is sent) so the next visit is current. With no cache
 * at all, generate it now. Never throws.
 */
export async function getDigestForPage(): Promise<DigestResult> {
  const cached = await getLatestDigest();
  if (!cached) return regenerateDigest();

  const age = Date.now() - new Date(cached.generatedAt).getTime();
  if (age > STALE_AFTER_MS && !backgroundRun) {
    after(async () => {
      backgroundRun = runPipeline().catch((err) => console.error("[digest] background refresh failed:", err));
      await backgroundRun;
      backgroundRun = null;
    });
  }
  return { digest: cached, fresh: false };
}
