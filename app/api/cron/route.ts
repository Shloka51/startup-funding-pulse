import { NextResponse } from "next/server";
import { runPipeline } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Monday-morning delivery. Vercel Cron calls this every Monday at 01:30 UTC
 * (07:00 IST) — see vercel.json — and sends `Authorization: Bearer $CRON_SECRET`.
 * On failure the previous digest stays cached and the page keeps showing it.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();
  try {
    const digest = await runPipeline();
    return NextResponse.json({
      ok: true,
      deals: digest.deals.length,
      patterns: digest.patterns?.length ?? 0,
      notes: digest.notes,
      seconds: Math.round((Date.now() - started) / 1000),
    });
  } catch (err) {
    console.error("[cron] weekly digest failed:", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Pipeline failed" },
      { status: 500 }
    );
  }
}
