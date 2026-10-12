import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/**
 * Server-only Supabase client using the service-role key.
 * Tables have RLS enabled with no policies, so only this key can read/write them.
 * Returns null when Supabase isn't configured — callers must fall back gracefully.
 */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const configured =
    !!url && !!key && url.startsWith("https://") && !url.includes("your-project-ref");

  client = configured
    ? createClient(url, key, { auth: { persistSession: false } })
    : null;
  return client;
}
