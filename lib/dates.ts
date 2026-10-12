const DAY_MS = 24 * 60 * 60 * 1000;

/** The rolling "previous 7 days" window ending now. */
export function getWeekWindow(now = new Date()) {
  return { start: new Date(now.getTime() - 7 * DAY_MS), end: now };
}

const IST = "Asia/Kolkata";

/** e.g. "6 Oct" */
export function formatShortDate(iso: string | Date) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: IST });
}

/** e.g. "6 – 12 Oct 2026" or "28 Sep – 5 Oct 2026" */
export function formatRange(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  const opts = { timeZone: IST } as const;
  const sameMonth =
    s.toLocaleDateString("en-IN", { month: "short", ...opts }) ===
    e.toLocaleDateString("en-IN", { month: "short", ...opts });
  const start = s.toLocaleDateString("en-IN", sameMonth ? { day: "numeric", ...opts } : { day: "numeric", month: "short", ...opts });
  const end = e.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", ...opts });
  return `${start} – ${end}`;
}

/** e.g. "Mon 12 Oct, 6:25 pm IST" */
export function formatTimestamp(iso: string) {
  return (
    new Date(iso).toLocaleString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
      timeZone: IST,
    }) + " IST"
  );
}
