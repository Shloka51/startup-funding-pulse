import "server-only";
import { cache } from "react";
import { bestPerWeek, getDigestById, getLatestDigest, listWeekIndex } from "@/lib/cache";
import { getSupabase } from "@/lib/supabase";
import type { Digest } from "@/lib/types";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Two digests count as different reporting weeks only if their windows end ≥ 6 days apart. */
const MIN_GAP_MS = 6 * DAY_MS;

/**
 * One digest per reporting week, newest first (the latest run of each week).
 * Never throws; returns [] or just the latest digest when history isn't available.
 */
export const getWeekHistory = cache(async (maxWeeks = 8): Promise<Digest[]> => {
  if (!getSupabase()) {
    const latest = await getLatestDigest();
    return latest ? [latest] : [];
  }
  try {
    // Full weeks only (a week in progress would distort comparisons); best version per week.
    const picked = bestPerWeek(await listWeekIndex(), { includeWtd: false }).slice(0, maxWeeks);
    const digests = await Promise.all(picked.map((p) => getDigestById(p.row.id)));
    return digests.filter((d): d is Digest => !!d && Array.isArray(d.deals));
  } catch (err) {
    console.error("[history] read failed:", err);
    return [];
  }
});

/** The most recent digest from an earlier reporting week than `current`, if one exists. */
export function previousWeekOf(current: Digest, history: Digest[]): Digest | null {
  const end = new Date(current.window.end).getTime();
  return history.find((d) => new Date(d.window.end).getTime() <= end - MIN_GAP_MS) ?? null;
}
