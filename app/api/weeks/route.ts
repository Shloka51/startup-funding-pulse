import { NextResponse } from "next/server";
import { getLatestDigest, listWeekIndex } from "@/lib/cache";
import { PipelineError, runPipeline } from "@/lib/pipeline";
import { currentWeekKey, isWeekKey, recentKeys, weekKeyOf, weekToDateWindow, windowForKey } from "@/lib/weeks";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const building = new Set<string>();
const WTD_COOLDOWN_MS = 10 * 60 * 1000;

/**
 * Build a reporting week on demand. Body: { week: "YYYY-MM-DD" } (a Monday).
 *  - The week in progress → "this week so far" (Monday → now). Re-runnable every 10 minutes.
 *  - One of the 7 full weeks before the latest brief → archive build from Google News archive search.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const week = body?.week;
  if (!isWeekKey(week)) return NextResponse.json({ error: "week must be a Monday as YYYY-MM-DD" }, { status: 400 });

  const latest = await getLatestDigest();
  if (!latest) return NextResponse.json({ error: "Generate the weekly brief first." }, { status: 409 });
  const latestKey = weekKeyOf(latest.window.start);
  const nowKey = currentWeekKey();
  const inProgress = week === nowKey && nowKey > latestKey;

  if (!inProgress && !recentKeys(latestKey).slice(1).includes(week)) {
    return NextResponse.json({ error: "Only this week so far or the 7 weeks before the latest brief can be built." }, { status: 400 });
  }
  if (inProgress) {
    const last = (await listWeekIndex()).find((r) => r.kind === "wtd" && weekKeyOf(r.window.start) === week);
    if (last && Date.now() - Date.parse(last.generatedAt) < WTD_COOLDOWN_MS) {
      return NextResponse.json({ error: "Updated less than 10 minutes ago. Try again shortly." }, { status: 429 });
    }
  }
  if (building.has(week)) return NextResponse.json({ error: "That week is already being built." }, { status: 409 });

  building.add(week);
  try {
    const digest = inProgress
      ? await runPipeline({ window: weekToDateWindow(), kind: "wtd" })
      : await runPipeline({ window: windowForKey(week), kind: "archive" });
    return NextResponse.json({ ok: true, week, kind: digest.kind, deals: digest.deals.length, notes: digest.notes });
  } catch (err) {
    const message = err instanceof PipelineError ? err.message : err instanceof Error ? err.message : "Build failed";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  } finally {
    building.delete(week);
  }
}
