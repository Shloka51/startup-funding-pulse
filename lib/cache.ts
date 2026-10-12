import "server-only";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { getSupabase } from "@/lib/supabase";
import type { Digest } from "@/lib/types";

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
    const { data, error } = await supabase
      .from("digests")
      .select("payload")
      .order("generated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return looksLikeDigest(data?.payload) ? data.payload : null;
  } catch (err) {
    if (supabase) console.error("[cache] read failed:", err);
    return null;
  }
}
