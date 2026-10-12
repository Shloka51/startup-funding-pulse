import "server-only";
import { cache } from "react";
import { getLatestDigest } from "@/lib/cache";
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
  const supabase = getSupabase();
  if (!supabase) {
    const latest = await getLatestDigest();
    return latest ? [latest] : [];
  }
  try {
    const { data, error } = await supabase
      .from("digests")
      .select("id, week_end, generated_at")
      .order("generated_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);

    const picked: { id: number; end: number }[] = [];
    for (const row of data ?? []) {
      const end = new Date(row.week_end).getTime();
      if (picked.length === 0 || end <= picked[picked.length - 1].end - MIN_GAP_MS) picked.push({ id: row.id, end });
      if (picked.length === maxWeeks) break;
    }
    if (picked.length === 0) return [];

    const { data: rows, error: e2 } = await supabase
      .from("digests")
      .select("id, payload")
      .in("id", picked.map((p) => p.id));
    if (e2) throw new Error(e2.message);
    const byId = new Map((rows ?? []).map((r) => [r.id as number, r.payload as Digest]));
    return picked.map((p) => byId.get(p.id)).filter((d): d is Digest => !!d && Array.isArray(d.deals));
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
