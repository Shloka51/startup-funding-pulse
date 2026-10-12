import { NextResponse } from "next/server";
import { getConfig } from "@/lib/config";
import { fetchWeeklyNews } from "@/lib/news";

export const dynamic = "force-dynamic";

/** Raw live feed (before Gemini) — useful for checking the data source directly. */
export async function GET() {
  const { config } = await getConfig();
  return NextResponse.json(await fetchWeeklyNews(config));
}
