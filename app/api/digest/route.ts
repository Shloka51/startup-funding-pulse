import { NextResponse } from "next/server";
import { getDigestForPage, regenerateDigest } from "@/lib/digest";

export const dynamic = "force-dynamic";
// One Gemini call per article can take ~30–60s for a busy week.
export const maxDuration = 300;

/** Latest digest (cached; generated on first use). */
export async function GET() {
  return NextResponse.json(await getDigestForPage());
}

/** Re-run the full pipeline now ("Refresh digest"). Falls back to the cache on failure. */
export async function POST() {
  return NextResponse.json(await regenerateDigest());
}
