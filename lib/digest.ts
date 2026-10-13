import "server-only";
import { after } from "next/server";
import { getLatestDigest } from "@/lib/cache";
import { PipelineError, runPipeline } from "@/lib/pipeline";
import { completedWeekKey, weekKeyOf } from "@/lib/weeks";
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

let backgroundRun: Promise<unknown> | null = null;

/**
 * For page loads: serve the cached weekly brief instantly. If a newer full week has ended
 * and isn't built yet (e.g. the Monday cron failed), build it in the background after the
 * response is sent. With no cache at all, generate it now. Never throws.
 */
export async function getDigestForPage(): Promise<DigestResult> {
  const cached = await getLatestDigest();
  if (!cached) return regenerateDigest();

  const behind = weekKeyOf(cached.window.start) < completedWeekKey();
  if (behind && !backgroundRun) {
    after(async () => {
      backgroundRun = runPipeline().catch((err) => console.error("[digest] background refresh failed:", err));
      await backgroundRun;
      backgroundRun = null;
    });
  }
  return { digest: cached, fresh: false };
}
