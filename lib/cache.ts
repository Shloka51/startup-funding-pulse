import "server-only";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { getSupabase } from "@/lib/supabase";
import type { Digest } from "@/lib/types";
import { weekKeyOf } from "@/lib/weeks";

// Used only when Supabase isn't configured (local development).
const LOCAL_FILE = path.join(os.tmpdir(), "startup-funding-pulse-digest.json");

function looksLikeDigest(v: unknown): v is Digest {
  const d = v as Digest;
  return !!d && typeof d === "object" && Array.isArray(d.deals) && !!d.window?.start && !!d.generatedAt;
}

/** Save a finished digest so the page can load it instantly next time. */
export async function saveDigest(digest: Digest): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) {
    await fs.writeFile(LOCAL_FILE, JSON.stringify(digest), "utf8");
    return;
  }
  const { error } = await supabase.from("digests").insert({
    week_start: digest.window.start.slice(0, 10),
    week_end: digest.window.end.slice(0, 10),
    generated_at: digest.generatedAt,
    payload: digest,
  });
  if (error) throw new Error(`Cache save failed: ${error.message}`);
}

/** The most recently generated digest, or null. Never throws. */
export async function getLatestDigest(): Promise<Digest | null> {
  const supabase = getSupabase();
  try {
    if (!supabase) {
      const parsed = JSON.parse(await fs.readFile(LOCAL_FILE, "utf8"));
      return looksLikeDigest(parsed) ? parsed : null;
    }
    // Latest = the newest reporting week's best digest (see bestPerWeek), so an archive
    // build, an old rolling digest or a week-to-date view never replaces the weekly brief.
    const [best] = bestPerWeek(await listWeekIndex(), { includeWtd: false });
    return best ? getDigestById(best.row.id) : null;
  } catch (err) {
    if (supabase) console.error("[cache] read failed:", err);
    return null;
  }
}

export interface WeekIndexRow {
  id: number;
  generatedAt: string;
  window: { start: string; end: string };
  /** "legacy" = made before weeks were Monday-aligned (a rolling 7-day window). */
  kind: "live" | "archive" | "wtd" | "legacy";
  summary: { deals: number; usdM: number } | null;
}

/** Lightweight list of stored digests (no deal payloads), newest first. Never throws. */
export async function listWeekIndex(): Promise<WeekIndexRow[]> {
  const supabase = getSupabase();
  if (!supabase) {
    const latest = await getLatestDigest();
    return latest
      ? [{ id: 0, generatedAt: latest.generatedAt, window: latest.window, kind: latest.kind ?? "legacy", summary: latest.summary ?? { deals: latest.deals.length, usdM: 0 } }]
      : [];
  }
  try {
    const { data, error } = await supabase
      .from("digests")
      .select("id, generated_at, window:payload->window, kind:payload->kind, summary:payload->summary")
      .order("generated_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return (data ?? [])
      .filter((r) => r.window && typeof r.window === "object")
      .map((r) => ({
        id: r.id as number,
        generatedAt: r.generated_at as string,
        window: r.window as WeekIndexRow["window"],
        kind: r.kind === "live" || r.kind === "archive" || r.kind === "wtd" ? r.kind : "legacy",
        summary: (r.summary as WeekIndexRow["summary"]) ?? null,
      }));
  } catch (err) {
    console.error("[cache] week index read failed:", err);
    return [];
  }
}

export async function getDigestById(id: number): Promise<Digest | null> {
  const supabase = getSupabase();
  if (!supabase) return getLatestDigest();
  try {
    const { data, error } = await supabase.from("digests").select("payload").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return looksLikeDigest(data?.payload) ? data.payload : null;
  } catch (err) {
    console.error("[cache] read by id failed:", err);
    return null;
  }
}

/** Which digest represents a week: the full Monday brief, then an archive build, then an old rolling digest, then week-to-date. */
const KIND_RANK: Record<WeekIndexRow["kind"], number> = { live: 0, archive: 1, legacy: 2, wtd: 3 };

/** One row per week key (best version, then newest), newest week first. */
export function bestPerWeek(rows: WeekIndexRow[], { includeWtd }: { includeWtd: boolean }) {
  const byKey = new Map<string, WeekIndexRow>();
  for (const row of rows) {
    if (!includeWtd && row.kind === "wtd") continue;
    const key = weekKeyOf(row.window.start);
    const have = byKey.get(key);
    const better =
      !have ||
      KIND_RANK[row.kind] < KIND_RANK[have.kind] ||
      (KIND_RANK[row.kind] === KIND_RANK[have.kind] && row.generatedAt > have.generatedAt);
    if (better) byKey.set(key, row);
  }
  return [...byKey.entries()].map(([key, row]) => ({ key, row })).sort((a, b) => b.key.localeCompare(a.key));
}
