import "server-only";
import { promises as fs } from "fs";
import path from "path";
import defaultConfig from "@/config/default-config.json";
import { getSupabase } from "@/lib/supabase";
import type { AppConfig, LoadedConfig } from "@/lib/types";

const CONFIG_FILE = path.join(process.cwd(), "config", "default-config.json");

const LIMITS = { itemLength: 60, targetSectors: 20, targetStages: 10, watchlist: 100 };

/** Trim, drop empties, de-duplicate case-insensitively, and cap list sizes. */
function cleanList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const v = item.trim().replace(/\s+/g, " ").slice(0, LIMITS.itemLength);
    if (!v || seen.has(v.toLowerCase())) continue;
    seen.add(v.toLowerCase());
    out.push(v);
    if (out.length >= max) break;
  }
  return out;
}

export function sanitizeConfig(input: unknown): AppConfig {
  const obj = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    targetSectors: cleanList(obj.targetSectors, LIMITS.targetSectors),
    targetStages: cleanList(obj.targetStages, LIMITS.targetStages),
    watchlist: cleanList(obj.watchlist, LIMITS.watchlist),
  };
}

async function readConfigFile(): Promise<AppConfig> {
  try {
    return sanitizeConfig(JSON.parse(await fs.readFile(CONFIG_FILE, "utf8")));
  } catch {
    // File missing or unreadable (e.g. serverless bundle) — use the bundled copy.
    return sanitizeConfig(defaultConfig);
  }
}

/** Load the active config. Never throws: Supabase -> local file -> bundled defaults. */
export async function getConfig(): Promise<LoadedConfig> {
  const supabase = getSupabase();
  if (!supabase) return { config: await readConfigFile(), source: "file" };

  try {
    const { data, error } = await supabase
      .from("app_config")
      .select("target_sectors, target_stages, watchlist")
      .eq("id", 1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error("Config row missing — run supabase/schema.sql");

    return {
      config: sanitizeConfig({
        targetSectors: data.target_sectors,
        targetStages: data.target_stages,
        watchlist: data.watchlist,
      }),
      source: "supabase",
    };
  } catch (err) {
    console.error("[config] Supabase read failed, using local file:", err);
    return {
      config: await readConfigFile(),
      source: "file",
      warning: "Couldn't reach the database, so these are the default settings.",
    };
  }
}

/** Persist config to Supabase, or to the local JSON file when Supabase isn't configured. */
export async function saveConfig(input: unknown): Promise<LoadedConfig> {
  const config = sanitizeConfig(input);
  const supabase = getSupabase();

  if (supabase) {
    const { error } = await supabase.from("app_config").upsert({
      id: 1,
      target_sectors: config.targetSectors,
      target_stages: config.targetStages,
      watchlist: config.watchlist,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(`Database save failed: ${error.message}`);
    return { config, source: "supabase" };
  }

  try {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2) + "\n", "utf8");
  } catch {
    throw new Error(
      "Can't save here: no database is connected and this server's files are read-only. Add the Supabase keys to save settings."
    );
  }
  return { config, source: "file" };
}
