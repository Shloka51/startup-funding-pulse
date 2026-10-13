"use client";

/** Selected week lives in a session cookie, so every tab and link stays on it. */
export function setWeekCookie(key: string | null) {
  document.cookie = key ? `fp_week=${key}; path=/; samesite=lax` : "fp_week=; path=/; max-age=0; samesite=lax";
}

/** Build (or update) a week via /api/weeks. Throws with a readable message on failure. */
export async function buildWeek(key: string): Promise<{ deals: number }> {
  const res = await fetch("/api/weeks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ week: key }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.ok) throw new Error(data.error || `Build failed (${res.status})`);
  return { deals: data.deals ?? 0 };
}
